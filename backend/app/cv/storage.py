"""Private immutable file storage. Callers must authorize owner/application access.

No SQL, metadata defaults, public URL, NLP or database lifecycle is implemented here.
Validation checks format and resource limits; it is not a malware scanner.
"""

import io
import os
import re
import secrets
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import BinaryIO
from xml.etree import ElementTree


class InvalidCVFile(ValueError):
    pass


@dataclass(frozen=True)
class ValidatedFile:
    data: bytes = field(repr=False)
    suffix: str
    media_type: str


@dataclass(frozen=True)
class StoredFile:
    key: str = field(repr=False)
    size: int
    media_type: str


def validate_cv(stream: BinaryIO, filename: str, media_type: str | None, *, max_bytes: int):
    """Read at most max_bytes+1; caller supplies the separately chosen upload limit."""
    if max_bytes < 1:
        raise ValueError("Positive upload limit required")
    if not filename or any(c in filename for c in ("/", "\\", ":", "\x00")):
        raise InvalidCVFile("Invalid filename")
    suffix = Path(filename).suffix.lower()
    types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    if suffix not in types or media_type not in {None, "application/octet-stream", types[suffix]}:
        raise InvalidCVFile("Unsupported file type")
    data = bytearray()
    while len(data) <= max_bytes:
        chunk = stream.read(min(65536, max_bytes + 1 - len(data)))
        if not chunk:
            break
        data.extend(chunk)
    if not data or len(data) > max_bytes:
        raise InvalidCVFile("Empty or oversized file")
    payload = bytes(data)
    if suffix == ".pdf":
        if not re.match(rb"%PDF-\d\.\d", payload) or not payload.rstrip().endswith(b"%%EOF"):
            raise InvalidCVFile("Invalid PDF signature")
    else:
        _validate_docx(payload)
    return ValidatedFile(payload, suffix, types[suffix])


def _validate_docx(data: bytes):
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            infos = archive.infolist()
            names = [item.filename for item in infos]
            if len(infos) > 256 or len(names) != len(set(names)):
                raise InvalidCVFile("Invalid DOCX archive entries")
            if sum(item.file_size for item in infos) > 25 * 1024 * 1024:
                raise InvalidCVFile("Expanded DOCX too large")
            for item in infos:
                parts = PurePosixPath(item.filename).parts
                if (
                    ".." in parts
                    or item.filename.startswith("/")
                    or "\\" in item.filename
                    or ":" in item.filename
                    or item.flag_bits & 1
                    or item.file_size > max(1, item.compress_size) * 200
                    or "vbaproject" in item.filename.lower()
                    or item.filename.lower().startswith("word/embeddings/")
                ):
                    raise InvalidCVFile("Unsafe DOCX archive")
            if not {"[Content_Types].xml", "word/document.xml", "_rels/.rels"} <= set(names):
                raise InvalidCVFile("Missing DOCX document")
            xml = archive.read("[Content_Types].xml")
            if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
                raise InvalidCVFile("Unsafe document types")
            tree = ElementTree.fromstring(xml)
            expected = (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
            )
            if not any(
                node.attrib.get("PartName") == "/word/document.xml"
                and node.attrib.get("ContentType") == expected
                for node in tree
            ):
                raise InvalidCVFile("Not a DOCX document")
            if archive.testzip() is not None:
                raise InvalidCVFile("Corrupt DOCX archive")
    except (zipfile.BadZipFile, ElementTree.ParseError, RuntimeError, NotImplementedError) as error:
        raise InvalidCVFile("Invalid DOCX archive") from error


class PrivateCVStorage:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def _path(self, key: str) -> Path:
        if not re.fullmatch(r"[a-f0-9]{48}\.(?:pdf|docx)", key):
            raise InvalidCVFile("Invalid storage key")
        path = self.root / key
        if path.is_symlink() or not path.resolve().is_relative_to(self.root):
            raise InvalidCVFile("Invalid storage path")
        return path

    def store(self, file: ValidatedFile) -> StoredFile:
        self.root.mkdir(parents=True, exist_ok=True)
        key = secrets.token_hex(24) + file.suffix
        path = self._path(key)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(file.data)
                stream.flush()
                os.fsync(stream.fileno())
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        return StoredFile(key, len(file.data), file.media_type)

    def open_authorized(self, key: str) -> BinaryIO:
        """Only after caller verifies the owning Candidate or scoped application access."""
        path = self._path(key)
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        return os.fdopen(fd, "rb")

    def discard_uncommitted(self, key: str):
        """Compensation for a newly written file whose database transaction failed."""
        self._path(key).unlink(missing_ok=True)
