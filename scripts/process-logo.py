from PIL import Image
import numpy as np

src = Image.open(r"C:\Users\haytham\Downloads\maitre_coif.jpg").convert("RGB")
arr = np.array(src).astype(np.float32)

bg = np.array([254, 203, 0], dtype=np.float32)
dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))

low, high = 18.0, 55.0
alpha = np.clip((dist - low) / (high - low), 0.0, 1.0)
alpha_u8 = (alpha * 255).astype(np.uint8)

h, w = alpha_u8.shape
rgba = np.zeros((h, w, 4), dtype=np.uint8)
rgba[..., 3] = alpha_u8

rgba_black = rgba.copy()
rgba_black[..., 0:3] = arr.astype(np.uint8)
out_black = Image.fromarray(rgba_black, mode="RGBA")

gold = np.array([212, 175, 55], dtype=np.uint8)
rgba_gold = rgba.copy()
rgba_gold[..., 0:3] = gold
out_gold = Image.fromarray(rgba_gold, mode="RGBA")

bbox = out_black.getbbox()
print("bbox:", bbox)
pad = 6
if bbox:
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(w, r + pad)
    b = min(h, b + pad)
    out_black = out_black.crop((l, t, r, b))
    out_gold = out_gold.crop((l, t, r, b))

out_black.save(r"C:\Users\haytham\Desktop\maitre-coif\public\logo-black.png")
out_gold.save(r"C:\Users\haytham\Desktop\maitre-coif\public\logo-gold.png")
print("sizes:", out_black.size, out_gold.size)
