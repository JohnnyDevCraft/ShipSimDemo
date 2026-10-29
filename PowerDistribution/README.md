# Power Distribution

The engineer's power console, rebuilt on the Helm design (2026-10-29). It replaces the three-panel preview (`preview.js` and `thermal.js`); the rules are the same. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/power-distribution-layout.cjs` checks those sizes and `tests/power-distribution.cjs` the behaviour.

Files: `index.html`, `styles.css` and `power.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`; `../Shared/console.css` is the shared console look.

- **Hull bus (left, always on screen):** the bus temperature on a 0–530 K gauge with its normal, warning and critical zones, the temperature status, the bus load against the 150 PU maximum and 200 PU breach marks, the headroom and whether the bus is heating, cooling or steady.
- **Power subsystems (the rest of the screen):** one card for each of the fourteen powered subsystems, with its draw and its regulator (or ON/OFF for fixed demand), coloured green when on, amber when it gets less than its minimum (and so draws nothing), red when its relay is off, and purple (STATION) for life support the station is providing. **Tap a card** to open it in an overlay, which holds what the production console will: the relay, the power regulator bar (for regulated subsystems), its minimum, actual and maximum draw and regulation as gauges, what it may draw, the warp factor cap, and notices (relay open, underpowered, life support outage).
- **Bottom bar:** **Gauges** opens the bus gauges overlay: reactor bus, requested load, delivered load, power balance, battery draw and battery charge. Then the quick relay commands: **Impulse** and **Warp** (each switches the other's relay off), **Sensors** (sensors and dampeners), **Weapons** (phase cannons and torpedo launcher), **Shields**, **Life Support**, **Navigation** and **Comms**, which light green when their relays are on, amber when some are, red when off; and **All Off** (everything but life support). Quick commands switch relays and never change regulators.
- **Advisory line:** the hull bus breached, life support off with its outage clock, unmet load, a hot or heating bus, battery support, or the spare on the bus.
- **Menu → Demo controls** (their own view, kept off the console): reactor on and its power, docked, umbilical and power sync (station power), the battery's bus switch (a stand-in: it belongs to Battery Control), subsystem demand (each subsystem's operating setting, standing in for what it asks of the bus) and the warp drive's nacelle charging and warp, overriding the bus load, previewing a hot bus and life support time ×60.

The support battery panel is gone: Battery Engaged now lives on Battery Control (`../Battery/`), as Bus Power. This console only shows the battery's draw and charge, in the gauges overlay.

## Rules (from the preview)

- A subsystem draws what its operating setting asks, capped by its relay and regulator; one allowed less than its minimum draws nothing. The warp drive draws 20% of its maximum while charging and up to its maximum at warp 6.
- The bus is the reactor (up to 180 PU) plus 40 PU of station power over power sync. Warp takes its share of the bus first; the others share the rest. The battery covers a deficit for everything but warp.
- The battery charges from any bus surplus (at most 26.7 PU on power sync).
- The hull bus heats when the load is over 150 PU, by a fiftieth of a kelvin a second for each PU over; under 150 PU it settles at 89 K. Over 200 PU, or at 530 K, it breaches and the ship is lost.
- Life support switched off counts its outage: residual, then cold after five minutes, oxygen exhausted after ten and space temperature after fifteen.
- Docked with the umbilical attached, the station provides life support: the ship's can be switched off without an outage (its card and button turn purple and read STATION, and the outage clock is reset), and switched on it is marked redundant. Detaching the umbilical with the ship's life support off starts the outage clock.
