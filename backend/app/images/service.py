import re
from urllib.parse import parse_qs, urlsplit

from app.images.repository import ImageRepository
from app.images.storage import ImageStorage, normalize_image


class ImageNotFound(Exception):
    pass


class ImageService:
    def __init__(self, session, settings):
        self.session = session
        self.repo = ImageRepository(session)
        self.storage = ImageStorage(settings.image_storage_dir)
        self.base = settings.public_api_url.rstrip("/")

    def url(self, kind, owner_id, filename):
        if kind == "avatars":
            return f"{self.base}/api/v1/candidates/me/avatar?image={filename[:-4]}"
        return f"{self.base}/api/v1/media/companies/{owner_id}/logos/{filename}"

    def upload(self, kind, owner_id, file):
        data, width, height = normalize_image(file.file, file.filename, file.content_type)
        if self.repo.target(kind, owner_id, lock=True) is None:
            raise ImageNotFound()
        filename = self.storage.write(kind, owner_id, data)
        url = self.url(kind, owner_id, filename)
        self.repo.update(kind, owner_id, url)
        self.session.commit()
        # Retain immutable previous/orphan files: no dangerous deletion on an
        # uncertain commit or concurrent download. Only DB-referenced files serve.
        return {
            "url": url,
            "width": width,
            "height": height,
            "size": len(data),
            "media_type": "image/png",
        }

    def read(self, kind, owner_id, *, public=False, filename=None):
        row = self.repo.target(kind, owner_id, public=public)
        if row is None or not row[0]:
            raise ImageNotFound()
        url = row[0]
        parsed = urlsplit(url)
        if kind == "avatars":
            token = parse_qs(parsed.query).get("image", [""])[0]
            if not re.fullmatch(r"[a-f0-9]{32}", token):
                raise ImageNotFound()
            filename = token + ".png"
        else:
            filename = filename or parsed.path.rsplit("/", 1)[-1]
        if url != self.url(kind, owner_id, filename):
            raise ImageNotFound()
        path = self.storage.path(kind, owner_id, filename)
        if not path.is_file():
            raise ImageNotFound()
        return path
