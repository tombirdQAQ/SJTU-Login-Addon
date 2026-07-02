from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "extension" / "icons"
    output.mkdir(parents=True, exist_ok=True)
    font_path = Path("C:/Windows/Fonts/arialbd.ttf")

    for size in (16, 32, 48, 128):
        image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle(
            (0, 0, size - 1, size - 1),
            radius=max(2, size // 6),
            fill=(140, 0, 40, 255),
        )
        font = ImageFont.truetype(str(font_path), max(10, int(size * 0.68)))
        draw.text(
            (size / 2, size / 2 - 0.04 * size),
            "J",
            font=font,
            fill="white",
            anchor="mm",
            stroke_width=max(0, size // 48),
            stroke_fill="white",
        )
        image.save(output / f"icon-{size}.png")


if __name__ == "__main__":
    main()
