import io
import zipfile

import pytest

from app.cv.storage import InvalidCVFile, PrivateCVStorage, validate_cv

PDF = b"%PDF-1.7\nE7 format-validation fixture\n%%EOF\n"


def docx(extra=None):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<Types><Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.'
            'wordprocessingml.document.main+xml" /></Types>',
        )
        archive.writestr("word/document.xml", "<document />")
        archive.writestr("_rels/.rels", "<Relationships />")
        if extra:
            archive.writestr(extra, "untrusted")
    return out.getvalue()


def test_pdf_private_random_keys_read_and_transaction_compensation(tmp_path):
    storage = PrivateCVStorage(tmp_path)
    valid = validate_cv(io.BytesIO(PDF), "resume.pdf", "application/pdf", max_bytes=1024)
    first, second = storage.store(valid), storage.store(valid)
    assert first.key != second.key and first.size == len(PDF)
    assert "resume" not in first.key and first.key not in repr(first)
    with storage.open_authorized(first.key) as stream:
        assert stream.read() == PDF
    storage.discard_uncommitted(first.key)
    assert not (tmp_path / first.key).exists() and (tmp_path / second.key).exists()


@pytest.mark.parametrize(
    "filename,data,mime",
    [
        ("../../cv.pdf", PDF, "application/pdf"),
        ("cv.pdf.exe", PDF, "application/pdf"),
        ("cv.pdf", b"not a PDF", "application/pdf"),
        ("cv.pdf", PDF, "text/html"),
        ("cv.docx", b"PKfake", None),
        ("cv.pdf", b"", None),
    ],
)
def test_reject_spoofed_files_and_paths(filename, data, mime):
    with pytest.raises(InvalidCVFile):
        validate_cv(io.BytesIO(data), filename, mime, max_bytes=1024)


def test_read_size_is_bounded():
    stream = io.BytesIO(b"x" * 10000)
    with pytest.raises(InvalidCVFile, match="oversized"):
        validate_cv(stream, "cv.pdf", None, max_bytes=128)
    assert stream.tell() == 129


def test_valid_docx_structure():
    value = validate_cv(io.BytesIO(docx()), "CV.DOCX", None, max_bytes=4096)
    assert value.suffix == ".docx"


@pytest.mark.parametrize("entry", ["../escape", "word/vbaProject.bin", "word/embeddings/a.bin"])
def test_reject_unsafe_docx_members(entry):
    with pytest.raises(InvalidCVFile):
        validate_cv(io.BytesIO(docx(entry)), "cv.docx", None, max_bytes=4096)


def test_storage_cannot_escape_root(tmp_path):
    storage = PrivateCVStorage(tmp_path)
    for key in ["../outside.pdf", "/etc/passwd", "file.pdf:stream", "a.pdf"]:
        with pytest.raises(InvalidCVFile):
            storage.open_authorized(key)
        with pytest.raises(InvalidCVFile):
            storage.discard_uncommitted(key)
