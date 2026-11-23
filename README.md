# ShipsMS demos

This repository is the home of the standalone ShipsMS demos, separate from the simulator repository. Publish its root to GitHub Pages. `index.html` links to all twenty-two demos; each screen lives in its own folder. `Shared/` holds the scripts Helm Control and Navigation Control have in common, and the shared console look and controls (`console.css`, `console-ui.js`) that Navigation, Reactor, Battery, Power Distribution, Communications, Transporter, Cargo Bay, Shields, Tractor Beam, Warp Field, Fighter, Command, Torpedo Assembly, Torpedo Launch, EPW and EBW Control use, and the targeting scope the three weapon consoles and Fighter Control share (`scope.js`, `scope.css`, the 3D `scene.js`, and `energy-weapon.js` and `.css` for EPW and EBW), and the quick switch every page's menu carries (`quick-switch.js`: the five divisions and an overlay of their consoles), and the weapons fire on the short range scans and camera scopes (`weapons-fire.js`: Tactical Officer's scanner look and the targeting scope's look, at true scale) with the demo's combat that makes it (`demo-battle.js`, `DemoBattle`: the engagement of four ships the scopes, Fighter and the View Screen show, and the enemy ship Helm and Navigation add; at hull 0 that enemy is a wreck), and the combat state every console reads (`demo-combat.js`, `DemoCombat`, MissionProtocol 1.0.0-Beta10: critical damage on the ship's components and the shields of stations and settlements, set from every menu's Critical damage and shared by every tab). `Weapons/` contains the compiled assets for the one remaining Angular screen (Tactical Officer).

## Install on a tablet (preview)

The demos are also one installable app (a progressive web app) for a tablet in landscape: **https://johnnydevcraft.github.io/ShipSimDemo/app/** (live once the pull request that adds `app/` and `sw.js` is merged into `master`). The public page above is unchanged and cannot be installed during the preview.

- **Android (Chrome, ONN 8-inch):** open the URL on Wi-Fi → Chrome menu → **Install app** → open **MPS Demos** from the home screen → keep the station picker open until it says **Offline ready**.
- **iPad (Safari):** open the URL → **Share** → **Add to Home Screen** → open the app from its icon (it keeps its own storage, separate from Safari) → keep the picker open until **Offline ready**.
- The first set-up downloads about 210 MB: every demo, sound and 3D model. **Preparation failed · Retry** means a download failed or storage ran out (the reason is shown); reconnect or free space and tap **Retry**, and it carries on where it stopped. **Update** appears when a new version is published.
- **Fullscreen (Android):** the installed app opens fullscreen: no Chrome address bar or tabs, and Android's status and navigation bars are hidden. Swipe in from the top or bottom edge to show them (they hide again after about 3 seconds); the on-screen keyboard also shows them while it is open. A Chrome tab showing the same address keeps Chrome's bars; that is expected.
- **Leaving the app:** swipe in from the edge, then use **Back** or **Home**. **Back** on a demo returns to the station picker, and **Back** on the picker leaves the app. **‹ Stations** (labelled *Back to stations*) also returns to the picker.
- **Where it installs:** only from the HTTPS address above. `http://localhost` and `http://127.0.0.1` count as secure, so a desktop browser can install from the local preview for testing, but a tablet on the local network cannot: an `http://<ip>` address (for example `http://192.168.1.20:18087/ShipSimDemo/app/`) is not a secure origin, so Chrome offers no install, registers no service worker and works only online, and **Add to Home screen** there only makes a shortcut that opens in a Chrome tab, not fullscreen.
- **Already installed before fullscreen:** open the app → tap **Update** → close it, and leave the tablet charging on Wi-Fi; Chrome refreshes the installed app within a day of a later launch. To force it: Chrome → `about://webapks` → **Update** next to MPS Demos, then close and reopen the app. If it still opens with the status bar, uninstall MPS Demos and install it again.
- **iPad:** the Home Screen app stays as it was (the status bar stays visible; iPadOS does not hide it for web apps).
- **Desktop Chrome:** an installed app stays a normal app window. In a desktop browser that has opened `/app/` before, a demo page viewed in full screen (F11) may show **‹ Stations**, and that tab keeps it until it is closed; it only leads to the station picker.
- In the app every demo has a **‹ Stations** control beside the emblem; links to the public page and links that would open another tab stay in the app window, so one console is shown at a time. Linked consoles keep the session when you switch: Helm's ship keeps flying on View Screen and Navigation, and DOT Bay's repairs carry on in Command.
- Limits: iPad cannot lock landscape; sound unlocks with a tap on each station; on Android the installed app may open links to the public page; a wrong address under `/app/` shows GitHub's 404 until the app has been opened once; the autopilot steers only while Helm is open.
- Offline: emulated in Chromium, all 23 demos open with their 3D models and sounds from a cold start with no network. Real-device (Android and iPad) results are reported separately once the device checklist has been run; until then no offline claim is made for real devices. Layout: every demo fits 960×600 (the whole 8-inch screen, as the fullscreen app gets it) and 1280×800 in emulation, with **‹ Stations** at least 44×44; Torpedo Assembly's Impact/Proximity options sit on its Configure page and fit once it is open (still on the device checklist).

How it works: `app/` is the station picker (built from the private `demo-app/projects/station-picker`; its manifest asks for `"display": "fullscreen"`, and browsers that cannot do fullscreen fall back to a standalone window), `sw.js` is the service worker at the site root (scope `/ShipSimDemo/`, registered only by `app/`), and `app/precache-manifest.json` lists every published file with its SHA-256. `Shared/app-shell.js` adds the back control only inside the app: a standalone window, a fullscreen window that the app's service worker controls (a desktop tab in F11 or using the Fullscreen API does not count), or a tab the picker opened. Build with `node scripts/build-static.cjs && node scripts/build-pwa.cjs` in the source repository, check with `node scripts/build-pwa.cjs --check` and `node scripts/check-publish.cjs <target>`, and copy with `node scripts/publish-copy.cjs <target>`.

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
node tests/helm-flight.cjs          # align, charge, engage and exit warp; Track, Quick Jump, keyboard commands
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
node tests/cargo-bay.cjs            # Cargo Bay
node tests/cargo-bay-layout.cjs     # Cargo Bay fits iPad landscape through 4K
node tests/shield-control.cjs       # Shield System Control
node tests/shield-layout.cjs        # Shield System Control fits iPad landscape through 4K
node tests/tractor-beam.cjs         # Tractor Beam Control
node tests/tractor-beam-layout.cjs  # Tractor Beam Control fits iPad landscape through 4K
node tests/warp-field.cjs           # Warp Field Control
node tests/warp-field-layout.cjs    # Warp Field Control fits iPad landscape through 4K
node tests/fighter-control.cjs      # Fighter Control
node tests/fighter-layout.cjs       # Fighter Control fits iPad landscape through 4K
node tests/command-control.cjs      # Command Control
node tests/command-layout.cjs       # Command Control fits phones from 360×640 to 430×932
node tests/demo-index.cjs           # index link
node tests/quick-switch.cjs         # the menu's quick switch (divisions, overlay, every page)
node tests/demo-combat.cjs          # every menu's Critical damage: components' critical effects and station shields, shared by every tab
node tests/weapons-fire.cjs         # the demo's combat: the engagement on the weapon scopes, Fighter and the View Screen; Helm's and Navigation's enemy ship
DEMO_MOUNT=/ShipSimDemo VIEWPORTS=960x600,1280x800,1180x820,1024x768 node tests/pwa-journeys.cjs  # the installable app: picker → every demo → back, reload, unknown /app/ address
DEMO_MOUNT=/ShipSimDemo VIEWPORTS=960x600,1280x800 node tests/pwa-back-control.cjs  # ‹ Stations in the app only (standalone, fullscreen app window); not in F11 or Fullscreen API tabs; links stay in the window
node tests/pwa-installability.cjs   # /app/ installable and fullscreen, demos and the public root are not
node tests/pwa-offline.cjs          # full preload, then a cold start with no server (Chromium)
node tests/pwa-update.cjs           # a new deployment: Update, only changed files download
node tests/pwa-linked-state.cjs     # destination, camera and zoom, critical damage across a switch and a relaunch
node tests/pwa-helm-viewscreen.cjs  # Helm → View Screen in one window
node tests/pwa-dotbay-command.cjs   # DOT Bay → Command in one window
VIEWPORTS=960x600,1280x800 node tests/pwa-tablet-fit.cjs  # report: which demos fit each size, controls under Android's swiped-in bars
FIT_STRICT=1 VIEWPORTS=960x600,1280x800 node tests/pwa-tablet-fit.cjs  # the same, failing on any demo that does not fit
```

The browser tests serve this folder themselves and run in Chromium and WebKit. The real app-window cases in `pwa-back-control.cjs` open headful Chromium windows (`STANDALONE=0` skips them). Set `ENGINES=chromium` to run one engine, `PLAYWRIGHT_MODULE` to use another Playwright installation, and `DEMO_BASE` to test an already running server.

The plain HTML and CSS are edited directly here. The weapon pages use compiled Angular assets built from `demo-app/`. Avoid overwriting the published repository with an older wholesale export.

## Weapon demo builds

The editable `demo-app/` workspace is private. It is tracked in the simulator repository and must not be copied to the published demo repository, which ignores it. On the maintainer machine, `node scripts/build-weapons.cjs` produces the minified production bundles and updates the public entry pages. No source maps are published. Browser JavaScript remains inspectable despite minification.
