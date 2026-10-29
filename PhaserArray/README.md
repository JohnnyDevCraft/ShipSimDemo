# EBW Control (Phaser Array)

The energy beam weapon console, rebuilt on the Helm design (2026-10-29). It replaces the Angular EBC page; the rules are the same. It shares the full-window targeting scope with Torpedo Launch and EPW Control: see `../TorpedoLaunch/README.md` for the scope, target readout, zoom, aim tape, history and Delegate Aim. The page scales from an iPad in landscape to 4K; `tests/energy-weapons-layout.cjs` checks those sizes and `tests/energy-weapons.cjs` the behaviour.

Files: `index.html` (with `<body data-weapon="array">`), and in `../Shared/`: `console.css`, `scope.css`, `energy-weapon.css`, `console-ui.js`, `scene.js` (the 3D models), `scope.js` (the scope) and `energy-weapon.js` (this weapon panel, shared with EPW Control), minified or bundled from `demo-app/static-src/Shared/` by `node scripts/build-static.cjs`. `scripts/build-weapons.cjs` no longer writes this folder's `index.html`.

- **Phaser array panel (left):** shot power (1–100%) on a vertical slider, with the WED and WKD it gives, beside the capacitor, filling amber as it charges, with the shot power marked across it. Below: supply, recharge time to the shot power, the beam's length and reach, last shot and shots fired; then Arm (Safe) and Fire Beam.
- **Aiming:** all round, ±180°. The beam is drawn from the emitter below the view up to the reticle while it fires; the status reads FIRING.
- **Bottom bar:** History, Delegate Fire, Delegate Aim and Clear Target. Fire, when it cannot be used, is dimmed and a tap says why. Space or a right-click on the scope also fires.
- **Menu → Demo controls:** add a random ship, pause ship movement, supply level, full- and minimum-power charge times, max WED and WKD, bridge aim and bridge fire.

## Rules (from the Angular EBC demo)

- The capacitor charges toward the shot power. A full charge takes the minimum-power time (6 s) at 1% supply and the full-power time (2 s) at 100%; 0% supply pauses charging.
- Firing needs the array armed, local fire control, no beam already firing and the capacitor charged to the shot power, which the shot spends.
- The beam hits at once and lasts one second, following the aim. Each moment it damages the first ship along it, out to 100 km: full damage (60 WED, 60 WKD a second at 100% shot power) to 50 km, falling to a tenth at 100 km. Shield and hull hits work as for torpedoes.
- The intercept is the ship's present bearing, within 100 km.
