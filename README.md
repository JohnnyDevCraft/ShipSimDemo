# ShipsMS demos

This repository is the home of the standalone ShipsMS demos, separate from the simulator repository. Publish its root to GitHub Pages. `index.html` links to all thirteen demos; each screen lives in its own folder. `Shared/` holds the scripts Helm Control and Navigation Control have in common. `Weapons/` contains the shared compiled assets for the six weapon and defense screens.

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

esbuild is taken from `ESBUILD`, or from the simulator workspace's `ng-app/node_modules`. Edit the sources, not the minified files.

## Tests

```sh
node --test tests/*.test.cjs        # navigation computer, world and widget rules
node tests/helm-map.cjs             # Helm scanner maps
node tests/helm-destination.cjs     # Helm's Selected Destination widget
node tests/helm-flight.cjs          # align, charge, engage and exit warp
node tests/navigation-control.cjs   # Navigation Control
node tests/demo-index.cjs           # index link
```

The browser tests serve this folder themselves and run in Chromium and WebKit. Set `ENGINES=chromium` to run one engine, `PLAYWRIGHT_MODULE` to use another Playwright installation, and `DEMO_BASE` to test an already running server.

The plain HTML and CSS are edited directly here. The weapon pages use compiled Angular assets built from `demo-app/`. Avoid overwriting the published repository with an older wholesale export.

## Weapon demo builds

The editable `demo-app/` workspace is private. It is tracked in the simulator repository and must not be copied to the published demo repository, which ignores it. On the maintainer machine, `node scripts/build-weapons.cjs` produces the minified production bundles and updates the public entry pages. No source maps are published. Browser JavaScript remains inspectable despite minification.
