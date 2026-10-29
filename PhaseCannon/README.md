# EPW Control (Phase Cannon)

The energy pulse weapon console, rebuilt on the Helm design (2026-10-29). It replaces the Angular EPC page; the rules are the same. It shares the full-window targeting scope with Torpedo Launch and EBW Control: see `../TorpedoLaunch/README.md` for the scope, target readout, zoom, aim tape, history and Delegate Aim. The page scales from an iPad in landscape to 4K; `tests/energy-weapons-layout.cjs` checks those sizes and `tests/energy-weapons.cjs` the behaviour.

Files: `index.html` (with `<body data-weapon="cannon">`), and in `../Shared/`: `console.css`, `scope.css`, `energy-weapon.css`, `console-ui.js`, `scene.js` (the 3D models), `scope.js` (the scope) and `energy-weapon.js` (this weapon panel, shared with EBW Control), minified or bundled from `demo-app/static-src/Shared/` by `node scripts/build-static.cjs`. `scripts/build-weapons.cjs` no longer writes this folder's `index.html`.

- **Phase cannon panel (left):** shot power (1–100%) on a vertical slider, with the energy (WED) and kinetic (WKD) damage it gives; three chambers beside it, each filling as it charges, with the shot power marked across them; the chamber that fires next is outlined in green. Below: supply, recharge time to the shot power, pulse speed and full-power range, last shot and shots fired; then Arm (Safe) and Fire Pulse.
- **Aiming:** a 90° acquisition arc (±45°).
- **Bottom bar:** History, Delegate Fire, Delegate Aim and Clear Target. Fire, when it cannot be used, is dimmed and a tap says why. Space or a right-click on the scope also fires.
- **Menu → Demo controls:** add a random ship, pause ship movement, supply level, full- and minimum-power charge times, max WED and WKD, pulse speed, full-power and dissipation distances, chamber count (1–3), bridge aim and bridge fire.

## Rules (from the Angular EPC demo)

- Every chamber charges toward the shot power at once. A full charge (0 to 100%) takes the minimum-power time (3 s) at 1% supply and the full-power time (1.5 s) at 100%; 0% supply pauses charging.
- Firing needs the cannon armed, local fire control and a chamber charged to the shot power; the first such chamber fires and spends the shot power from its charge.
- A pulse travels at 15 km/s on the aim's bearing. It does full damage (120 WED, 40 WKD at 100% shot power) out to 50,000 km, fading to none at 90,000 km, where it ends. Hits work as for torpedoes: shield damage while the quadrant is up, otherwise hull and subsystem damage.
- The intercept is the constant-course solution at the pulse speed, within its range and 25,000 km.
