# ShipsMS demos

This repository is the home of the standalone ShipsMS demos, separate from the simulator repository. Publish its root to GitHub Pages. `index.html` links to all twelve demos; each screen lives in its own folder. `Weapons/` contains the shared compiled assets for the six weapon and defense screens.

## Local preview

```sh
python3 -m http.server 18087 --bind 127.0.0.1
```

Open http://localhost:18087/. No simulator server or account is needed. Demo state is local sample state.

## Helm map verification

With Playwright installed, run `node tests/helm-map.cjs` against the preview above. Set `PLAYWRIGHT_MODULE` to an existing Playwright installation if necessary, and `DEMO_URL` to override the Helm URL.

Helm supports LRS and SRS contact selection, system-map repeated-click centering, pan and wheel/pinch zoom, and a 30-light-year maximum system radius. SRS selection does not assign a navigation destination. Sample naval ships provide contacts at near, system, and interstellar scales.

The plain HTML screens are edited directly here. The weapon pages currently use compiled Angular assets exported from ShipSim; their editable Angular source is still in that repository. Avoid overwriting this repository with an older wholesale export.

## Weapon demo builds

The editable `demo-app/` workspace is private and ignored by Git. It is not shipped in this repository. On the maintainer machine, `node scripts/build-weapons.cjs` produces the minified production bundles and updates the public entry pages. No source maps are published. Browser JavaScript remains inspectable despite minification.
