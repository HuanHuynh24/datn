import io
import re
import uuid
import warnings
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 16_000_000


class InvalidImage(ValueError):
    pass


class ImageTooLarge(ValueError):
    pass


def normalize_image(stream, filename, content_type):
    suffix = Path(filename or "").suffix.lower()
    formats = {
        ".png": ("PNG", "image/png"),
        ".jpg": ("JPEG", "image/jpeg"),
        ".jpeg": ("JPEG", "image/jpeg"),
        ".webp": ("WEBP", "image/webp"),
    }
    if suffix not in formats or content_type != formats[suffix][1]:
        raise InvalidImage()
    data = stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ImageTooLarge()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=["PNG", "JPEG", "WEBP"]) as image:
                if image.format != formats[suffix][0] or getattr(image, "n_frames", 1) != 1:
                    raise InvalidImage()
                if image.width * image.height > MAX_PIXELS or max(image.size) > 8192:
                    raise ImageTooLarge()
                image.load()
                rotated = ImageOps.exif_transpose(image).convert("RGBA")
                rotated.thumbnail((1024, 1024))
                # Fresh pixels only: do not carry EXIF, PNG text, ICC or trailing data.
                clean = Image.new("RGBA", rotated.size)
                clean.paste(rotated)
                output = io.BytesIO()
                clean.save(output, format="PNG")
                return output.getvalue(), clean.width, clean.height
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ImageTooLarge() from None
    except (UnidentifiedImageError, OSError, ValueError) as error:
        if isinstance(error, (InvalidImage, ImageTooLarge)):
            raise
        raise InvalidImage() from None


class ImageStorage:
    def __init__(self, root):
        self.root = Path(root).resolve()

    def path(self, kind, owner_id, filename):
        if (
            kind not in {"avatars", "logos"}
            or not re.fullmatch(r"[1-9][0-9]{0,18}", str(owner_id))
            or not re.fullmatch(r"[a-f0-9]{32}\.png", filename)
        ):
            raise InvalidImage()
        target = (self.root / kind / str(owner_id) / filename).resolve()
        if not target.is_relative_to(self.root):
            raise InvalidImage()
        return target

    def write(self, kind, owner_id, data):
        filename = uuid.uuid4().hex + ".png"
        path = self.path(kind, owner_id, filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as file:
            file.write(data)
        return filename
