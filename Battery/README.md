# Battery Control

The backup battery's console (2026-10-29), on the Helm design. It takes over the battery and power sync duties that came off Reactor Control. The schematic fills the space between the side panels and the controls float over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/battery-layout.cjs` checks those sizes and `tests/battery-control.cjs` the behaviour.

Files: `index.html`, `styles.css` and `battery.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`; `../Shared/console.css` is the shared console look.

- **Schematic:** the **reactor** (online or offline, and its output) feeds the **ship bus** directly (load, supplied, unmet). Its **surplus** and **station** power (over the umbilical) meet at a bus bar and pass through the **recharge** breaker into the **backup battery**, which fills as it charges, with its reserve marked. The battery feeds the bus through the **bus power** breaker. Each breaker is drawn closed (green) or open (red); the streams move with what flows through them.
- **Battery (left):** charge as a percentage, a level gauge with the reserve band, PU·s, the reserve, the charge coming in (from the reactor and from the station), the power going out to the bus, the net rate, and the time to full or to the reserve.
- **Power sync (right, monitor only):** docking, the umbilical, power sync (on, off or disconnecting), whether we are taking a charge from the station, and the charge stage. Power sync is set up with the station; this console shows it but cannot turn it on or off.
- **Reactor (right, monitor only):** state, output, ship load and the surplus or shortfall.
- **Advisory line:** an unmet load and why, recharge off while charge is available, station or reactor charging, bus support and the time to reserve, full, or nothing able to charge.
- **Bottom bar:** **Recharge** and **Bus Power**, the battery's two controls (lit green when on, red when off), and Diagnostics.
- **Menu → Demo controls:** stand-ins for the rest of the ship: reactor online, reactor output, ship load, battery charge, dock and undock, and start or stop power sync.

## Rules (from Reactor Control's battery model)

- The battery holds 10,000 PU·s. It keeps a 2,000 PU·s reserve for reactor startup and shutdown: bus support stops there.
- The reactor supplies the ship bus first. With Recharge on, its surplus charges the battery, and so does station power while power sync is on (or disconnecting). With Recharge off, the battery takes no charge.
- Station power charges in stages: 0 → 80 → 90 → 95 → 97 → 100%, five minutes each (26.7, 3.3, 1.7, 0.7 and 1 PU/s).
- With Bus Power on, the battery covers whatever the reactor cannot supply, down to the reserve; with it off, any shortfall goes unmet.
- The umbilical attaches ten seconds after docking. Power sync needs it; stopping power sync takes ten seconds. In the demo, power sync must be stopped before undocking.
- This page does not share state with Reactor Control: its reactor, ship load and station are demo stand-ins.
