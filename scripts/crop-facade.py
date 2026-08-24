from PIL import Image

im = Image.open(r"C:\Users\haytham\Downloads\façademaitrecoif.jpg")
w, h = im.size
top = 70
bottom = 1070
cropped = im.crop((0, top, w, bottom))
cropped.save(r"C:\Users\haytham\Desktop\maitre-coif\public\maitre-coif-facade.jpg", quality=92)
print(cropped.size)
