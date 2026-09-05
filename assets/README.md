# Assets

- **images/** — empty for now; the landing background is built entirely from CSS gradients and inline SVG shapes (no bitmap assets needed yet).
- **fonts/** — empty; the pixel display font (Press Start 2P) and body font (IBM Plex Mono) are loaded from Google Fonts via `<link>` in `index.html`, not bundled locally. Add a local `@font-face` here if that ever needs to change.
- **sounds/** — empty; hover/click UI sounds are synthesized at runtime with the Web Audio API (see `js/main.js`), not bundled audio files, to avoid relying on de-facto "royalty-free" files with unverified licensing. Background music is wired up (Settings → Music) but has no track — drop an audio file here, point `#bg-music`'s `src` at it in `index.html`, and it'll play/pause/loop through the existing toggle.
