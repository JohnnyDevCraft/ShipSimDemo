# Torpedo Assembly Control

The ordnance officer's assembly console, rebuilt on the Helm design (2026-10-29). It replaces the two-panel Angular TAC page; the rules are the same. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/torpedo-assembly-layout.cjs` checks those sizes and `tests/torpedo-assembly.cjs` the behaviour.

Files: `index.html`, `styles.css`, `../Shared/console.css` (the shared console look) and `assembly.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`. `scripts/build-weapons.cjs` no longer writes this folder's `index.html`.

- **Head gallery (centre):** a torpedo hull stands in the middle of the bay and the three heads (warhead, probe and beacon) turn across its nose. Swipe, use the arrows or tap a side head to bring it onto the hull. Beside the hull, one card describes the head and its stock; the other shows the current configuration with a Configure button. Tapping the head on the hull also opens its configuration.
- **Configuration (one slide over):** a drawing of the torpedo as configured, its live readouts, and the head's settings. The drawing follows the settings: the warhead's arming ring brightens with the yield, the probe lights one lens per sensor, and the beacon's lamp is amber for a warning buoy and green for a comms relay. Numbers are entered on the keypad; the warning message is typed on the console keyboard, in capitals.
  - **Warhead:** yield slider (0–100%), with the energy (WED) and kinetic (WKD) damage it gives; detonation on impact or within a proximity distance.
  - **Probe:** up to three sensors; transmitter frequency and medium (RF or SSC); battery (10,000, 20,000 or 30,000 PU); optional warp field generator (warp factor 1–6 and travel distance, in M, KM, MKM, BKM or LY); optional self-destruct timer (seconds, minutes or hours). Readouts: power draw, time to empty and, with warp, the maximum distance.
  - **Beacon:** a warning buoy (medium and message) or a silent comms relay (receive and send frequency and medium, and a galactic destination); battery. Readouts: draw and lifetime.
- **Magazine (left):** hulls and the three kinds of head in stock. During a refill, the next slot of each kind fills as it loads.
- **Assembly bay (left):** assembly speed, available power, the assembly and loading shares, and the cycle time.
- **Ready for launch (right):** one slot per torpedo the rack can hold. A torpedo being assembled shows its progress; tap a ready one for its details.
- **Advisory line:** what stops an assembly, what is being assembled, or that the bay is ready.
- **Bottom bar:** the three head types, Refill, Configure (Heads when the configuration is showing) and Assemble. Assemble works from either page with the configuration as set. Refill is dark until the ship is docked at a station with the umbilical attached; it lights while refilling, and a second tap halts the refill. A dimmed button says why when tapped.
- **Menu:** demo controls for the magazine and rack (stock, Dock and Undock, ready capacity, handing the next torpedo to the launcher), bay power and warhead damage maxima, and the power draw rates; reset.

## Rules (from the Angular TAC demo)

- One assembly at a time. It takes one hull and one head when it starts, and reserves a ready slot.
- Available power is split evenly between assembly and tube loading. The cycle time runs linearly from the minimum-speed time (30 s) at minimum power (10 PU) to the full-speed time (10 s) at maximum power (24 PU). Below minimum power the bay is offline and an assembly in progress pauses.
- The ready rack holds 6 by default. Assembly stops while it is full.
- Warhead damage is the maximum (WED 30, WKD 150) times the yield. A proximity detonation needs a distance above zero.
- A probe carries at most three sensors. Sensors draw 1 PU/s (subatomic particle, atomic particle, molecular, scan), 0.5 PU/s (bio, weather) or 0.1 PU/s (radiation); the transmitter draws 1 PU/s on SSC or 0.1 PU/s on RF. Warp draws 20 PU/s at warp 1 rising to 40 PU/s at warp 6, from 30 seconds after launch until the distance is covered.
- A beacon draws at its warning medium's or send medium's transmitter rate. Transmitters may not draw more than 2 PU/s.
- The draw rates are saved into each torpedo when its assembly starts; later changes apply to the next torpedo.
- Configuration stays selected after each assembly, so another of the same is one press.
- A station refill needs the ship docked with the umbilical attached (the demo's Dock does both). It brings aboard one hull every 30 seconds and one warhead, probe and beacon head every 15 seconds each, all at once, up to the magazine's capacity (12 hulls, 8 warheads, 3 probes, 3 beacons), and stops when the magazine is full. Halting it, or undocking, drops the items part-way aboard.
- Reset demo reloads the page with an empty rack, a full magazine and the default settings.
