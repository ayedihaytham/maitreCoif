from PIL import Image

logo = Image.open(r"C:\Users\haytham\Desktop\maitre-coif\public\logo-gold.png").convert("RGBA")

size = 512
canvas = Image.new("RGBA", (size, size), (10, 10, 10, 255))  # #0A0A0A

margin = 64
target_w = size - margin * 2
scale = target_w / logo.width
target_h = int(logo.height * scale)
if target_h > size - margin * 2:
    scale = (size - margin * 2) / logo.height
    target_w = int(logo.width * scale)
    target_h = size - margin * 2

resized = logo.resize((target_w, target_h), Image.LANCZOS)
x = (size - target_w) // 2
y = (size - target_h) // 2
canvas.paste(resized, (x, y), resized)

canvas.save(r"C:\Users\haytham\Desktop\maitre-coif\app\icon.png")
print("saved", canvas.size)
