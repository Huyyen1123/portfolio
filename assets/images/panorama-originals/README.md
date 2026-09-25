# Panorama originals (not served)

Full-resolution (2048x2048 PNG) source files for the six cubemap faces
used at `assets/images/panorama/`. These are **not referenced by any
code** -- they exist purely as the source of truth if the production
WebP files ever need to be regenerated at a different size/quality.

Same "Cherry Blossom Panorama" resource pack by BlueHDGaming, same
license terms, as documented in `assets/images/panorama/README.md`.
Filenames here match the production slot convention (`panorama_0.png` =
+X, etc.) -- see that README's mapping table for how these relate to
the resource pack's own original file numbering.

To regenerate the production files:

```python
from PIL import Image
for i in range(6):
    im = Image.open(f"panorama_{i}.png").convert("RGB")
    im.resize((1024, 1024), Image.LANCZOS).save(
        f"../panorama/panorama_{i}.webp", "WEBP", quality=90, method=6
    )
```
