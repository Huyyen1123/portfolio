# Panorama cubemap faces

## Source and license

These six images are from the **"Cherry Blossom Panorama"** resource pack
by **BlueHDGaming** (v1.1.5), originally at:
`assets/minecraft/textures/gui/title/background/panorama_0.png`..`panorama_5.png`
inside the downloaded pack.

**License terms (BlueHDGaming Resource Pack License v3.1) that apply here:**

- **Attribution is required** wherever this site is shown publicly:
  include the pack's name ("Cherry Blossom Panorama") and a direct link
  to its official Modrinth page. This is not yet added anywhere visible
  on the site -- add it (e.g. a footer credit line) before treating this
  as done.
- **Redistribution of the raw asset files is restricted**: the license
  permits using the pack "in videos, livestreams, screenshots or other
  media" but does not clearly cover publishing the original PNG files
  themselves in a public repository for anyone to download. Committing
  these six files to a **public** GitHub repo is a real gray area under
  this license, not obviously covered by the permissions section, and
  the license explicitly prohibits "redistribut[ing], reupload[ing] or
  republish[ing]" the assets outside what's listed. Worth resolving
  (e.g. by asking the author, keeping the repo private, or serving these
  from a private host instead of committing them to a public repo)
  before this goes live somewhere public.
- Full text: see the pack's own `LICENSE.txt` (not copied into this repo
  -- keep a copy if you need to reference it later, since it isn't
  bundled here).

## File mapping (verified by comparing actual pixel edges, not filenames)

The resource pack's own numbering (0-3 = the four horizontal directions
in capture order, 4 = up, 5 = down) does **not** match the order this
project's `js/panorama.js` expects (`[+X, -X, +Y, -Y, +Z, -Z]`, the
standard Three.js `CubeTextureLoader` order). The files were renamed on
copy:

| This project's file | Cube face | Source pack's original file | Content |
|---|---|---|---|
| `panorama_0.png` | +X (right) | pack's `panorama_1.png` | dark grove interior, small bright gap in background |
| `panorama_1.png` | -X (left) | pack's `panorama_3.png` | dark grove interior, beehive visible |
| `panorama_2.png` | +Y (top) | pack's `panorama_4.png` | looking straight up through the canopy |
| `panorama_3.png` | -Y (bottom) | pack's `panorama_5.png` | looking straight down at grass/flowers |
| `panorama_4.png` | +Z (front) | pack's `panorama_2.png` | dark grove interior, red block visible |
| `panorama_5.png` | -Z (back) | pack's `panorama_0.png` | **the sunset/cherry-tree view** -- this is what the camera faces by default (yaw 0) |

This mapping was derived empirically: the four horizontal source faces'
left/right edges were compared pixel-by-pixel (mean color difference per
row) to find which faces actually tile together, confirming the cycle
`0 -> 1 -> 2 -> 3 -> 0` (in the pack's own original numbering) before
assigning them to +X/-X/+Z/-Z slots such that the sunset face lands on
-Z, where Three.js's default camera orientation looks by default. This
was then confirmed by rendering the actual cube and sweeping the camera
through a full rotation plus extreme up/down pitch, checking for seams,
mirroring, or upside-down faces -- none were found.

If you ever replace these with a different panorama, re-verify the same
way rather than trusting filenames: a wrongly-ordered or mirrored face
produces a visible seam or a jump as the camera crosses that edge.

## Requirements for a replacement set

- All six images the same size, square (these are 2048x2048).
- PNG or JPG both work -- `js/panorama.js` requests `.png`, so keep that
  extension (re-export as PNG if a replacement source is JPG).
- The six faces must actually tile into a seamless cube around a single
  viewpoint.

## Fallback behavior

If these six files are ever missing or fail to load, `js/panorama.js`
catches the failure and leaves `assets/video/background.mp4`/`.webm`
showing instead -- no placeholder gradient, no fake scenery.
