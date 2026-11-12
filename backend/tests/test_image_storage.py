import io
from types import SimpleNamespace

import pytest
from PIL import Image, PngImagePlugin

from app.images.service import ImageNotFound, ImageService
from app.images.storage import ImageStorage, ImageTooLarge, InvalidImage, normalize_image


def picture(format="PNG", size=(30, 20)):
    buffer = io.BytesIO()
    info = PngImagePlugin.PngInfo()
    info.add_text("private", "metadata must disappear")
    Image.new("RGB", size, "red").save(buffer, format=format, pnginfo=info)
    return buffer.getvalue()


@pytest.mark.parametrize(
    "format,suffix,mime",
    [("PNG", ".png", "image/png"), ("JPEG", ".jpg", "image/jpeg"), ("WEBP", ".webp", "image/webp")],
)
def test_decode_and_strip_metadata(format, suffix, mime):
    data, width, height = normalize_image(
        io.BytesIO(picture(format, (1500, 1000))), "ignored" + suffix, mime
    )
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == "PNG" and max(image.size) <= 1024
        assert "private" not in image.info and "exif" not in image.info
    assert width <= 1024 and height <= 1024


@pytest.mark.parametrize(
    "data,name,mime",
    [
        (b'<svg onload="alert(1)"/>', "x.png", "image/png"),
        (picture(), "x.svg", "image/svg+xml"),
        (picture(), "x.jpg", "image/jpeg"),
        (b"broken", "x.png", "image/png"),
    ],
)
def test_reject_spoofed_or_invalid_file(data, name, mime):
    with pytest.raises(InvalidImage):
        normalize_image(io.BytesIO(data), name, mime)


def test_limits_size_and_pixels():
    with pytest.raises(ImageTooLarge):
        normalize_image(io.BytesIO(b"x" * (5 * 1024 * 1024 + 1)), "x.png", "image/png")
    with pytest.raises(ImageTooLarge):
        normalize_image(io.BytesIO(picture(size=(5000, 4000))), "x.png", "image/png")


def test_storage_scopes_files_and_rejects_traversal(tmp_path):
    storage = ImageStorage(tmp_path)
    filename = storage.write("logos", "1", picture())
    assert storage.path("logos", "1", filename).is_file()
    assert not storage.path("logos", "2", filename).exists()
    for name in ["../../outside.png", "bad.png", "a" * 32 + ".svg"]:
        with pytest.raises(InvalidImage):
            storage.path("logos", "1", name)


def test_animated_png_is_not_accepted():
    data = io.BytesIO()
    Image.new("RGB", (5, 5), "red").save(
        data, format="PNG", save_all=True, append_images=[Image.new("RGB", (5, 5), "blue")]
    )
    with pytest.raises(InvalidImage):
        normalize_image(io.BytesIO(data.getvalue()), "x.png", "image/png")


def test_manually_set_unmanaged_logo_path_is_not_served(tmp_path):
    settings = SimpleNamespace(image_storage_dir=tmp_path, public_api_url="http://localhost:8000")
    service = ImageService(None, settings)
    service.repo = SimpleNamespace(
        target=lambda *args, **kwargs: (
            "http://localhost:8000/api/v1/media/companies/1/logos/bad.png",
        )
    )
    with pytest.raises(ImageNotFound):
        service.read("logos", "1", filename="bad.png")
