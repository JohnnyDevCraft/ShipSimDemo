# ShipsMS demos

This repository is the home of the standalone ShipsMS demos, separate from the simulator repository. Publish its root to GitHub Pages. `index.html` links to all twenty demos; each screen lives in its own folder. `Shared/` holds the scripts Helm Control and Navigation Control have in common, and the shared console look and controls (`console.css`, `console-ui.js`) that Navigation, Reactor, Battery, Power Distribution, Communications, Transporter, Shields, Tractor Beam, Warp Field, Fighter, Torpedo Assembly, Torpedo Launch, EPW and EBW Control use, and the targeting scope the three weapon consoles and Fighter Control share (`scope.js`, `scope.css`, the 3D `scene.js`, and `energy-weapon.js` and `.css` for EPW and EBW). `Weapons/` contains the compiled assets for the one remaining Angular screen (Tactical Officer).

## Local preview

```sh
python3 -m http.server 18087 --bind 127.0.0.1
```

Open http://localhost:18087/. No simulator server or account is needed. Demo state is local sample state.

## Helm and Navigation

Helm Control flies the ship; Navigation Control sets destinations. They share one stand-in navigation computer through the browser's `localStorage`, so a destination set on Navigation Control appears on Helm Control in another tab. See `Helm/README.md` and `Navigation/README.md`.

Their scripts are minified from readable sources in the private workspace:

```sh
node scripts/build-static.cjs          # demo-app/static-src/<Page>/*.js -> <Page>/*.js
node scripts/build-static.cjs --check  # exit 1 if a public script is stale
```

esbuild is taken from `ESBUILD`, or from the simulator workspace's `ng-app/node_modules`. A source named `*.bundle.js` is bundled with three.js from `demo-app/render-deps` (the weapon consoles' 3D scene, `Shared/scene.js`). Edit the sources, not the minified files.

## Tests

```sh
node --test tests/*.test.cjs        # navigation computer, world and widget rules
node tests/helm-map.cjs             # Helm scanner maps
node tests/helm-destination.cjs     # Helm's Selected Destination widget
node tests/helm-flight.cjs          # align, charge, engage and exit warp
node tests/helm-layout.cjs          # Helm fits iPad portrait/landscape through 4K
node tests/navigation-control.cjs   # Navigation Control
node tests/navigation-layout.cjs    # Navigation fits iPad portrait/landscape through 4K
node tests/reactor-control.cjs      # Reactor Control
node tests/reactor-layout.cjs       # Reactor fits iPad landscape through 4K
node tests/battery-control.cjs      # Battery Control
node tests/battery-layout.cjs       # Battery fits iPad landscape through 4K
node tests/power-distribution.cjs   # Power Distribution
node tests/power-distribution-layout.cjs  # Power Distribution fits iPad landscape through 4K
node tests/torpedo-assembly.cjs     # Torpedo Assembly Control
node tests/torpedo-assembly-layout.cjs  # Torpedo Assembly fits iPad landscape through 4K
node tests/torpedo-launch.cjs       # Torpedo Launch Control
node tests/torpedo-launch-layout.cjs    # Torpedo Launch fits iPad landscape through 4K
node tests/energy-weapons.cjs       # EPW and EBW Control
node tests/energy-weapons-layout.cjs    # EPW and EBW fit iPad landscape through 4K
node tests/communications.cjs       # Communications Control
node tests/communications-layout.cjs    # Communications fits iPad landscape through 4K
node tests/transporter-control.cjs  # Transporter Control
node tests/transporter-layout.cjs   # Transporter fits iPad landscape through 4K
node tests/shield-control.cjs       # Shield System Control
node tests/shield-layout.cjs        # Shield System Control fits iPad landscape through 4K
node tests/tractor-beam.cjs         # Tractor Beam Control
node tests/tractor-beam-layout.cjs  # Tractor Beam Control fits iPad landscape through 4K
node tests/warp-field.cjs           # Warp Field Control
node tests/warp-field-layout.cjs    # Warp Field Control fits iPad landscape through 4K
node tests/fighter-control.cjs      # Fighter Control
node tests/fighter-layout.cjs       # Fighter Control fits iPad landscape through 4K
node tests/demo-index.cjs           # index link
```

The browser tests serve this folder themselves and run in Chromium and WebKit. Set `ENGINES=chromium` to run one engine, `PLAYWRIGHT_MODULE` to use another Playwright installation, and `DEMO_BASE` to test an already running server.

The plain HTML and CSS are edited directly here. The weapon pages use compiled Angular assets built from `demo-app/`. Avoid overwriting the published repository with an older wholesale export.

## Weapon demo builds

The editable `demo-app/` workspace is private. It is tracked in the simulator repository and must not be copied to the published demo repository, which ignores it. On the maintainer machine, `node scripts/build-weapons.cjs` produces the minified production bundles and updates the public entry pages. No source maps are published. Browser JavaScript remains inspectable despite minification.
