# octagonn.github.io

Portfolio site for Octavio Albuquerque, software and security engineer.

**Live:** https://octagonn.github.io

## How it's built

One static page with no framework or build toolchain.

- **Hero:** a raw WebGL fragment shader that draws slowly drifting topographic contours in three parallax layers.
- **Selected work:** a Three.js point cloud that reads like a terrain scan and moves with scroll.
- **Homelab:** a scroll-driven 3D tour of my actual 15U rack, modeled from photos. Each stop slides a machine out of the rack and shows its hardware, OS, and what it runs.
- Without WebGL it falls back to static content, and it respects reduced-motion settings.

## Editing

- `src.html` holds the markup and styles, and `app.js` holds all the scripting.
- `img/` holds the Spotted App Store screenshots as base64.
- Run `python build.py` to regenerate `index.html`.
