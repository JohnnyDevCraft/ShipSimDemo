# Transporter Control

The transporter operator's console, rebuilt on the Helm design (2026-10-29). It replaces the three-panel discovery preview (`preview.js`); the transport rules are the same, and `discovery.md` still records them. The transfer schematic fills the window and the controls float over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/transporter-layout.cjs` checks those sizes and `tests/transporter-control.cjs` the behaviour.

Files: `index.html`, `styles.css`, `../Shared/console.css` (the shared console look) and `transporter.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`.

- **Schematic:** the **source** (drawn as what it is: the transporter pad, the cargo bay, a station, a ship or a surface site) feeds the **dematerialize** stream into the **pattern buffer**, which shows the pattern count; the **materialize** stream carries them to the **destination**. Each stream shows its stage running from 0 to 100% complete, while the buffer fills only by the batch's share of the mass limit (one 74 kg person in a 160 kg pad buffer fills it to 46%). The streams move, and the active pad shimmers, while a stage runs. Under the source: the selected targets, each name with its lock state on the line below and a lock bar. Under the destination: its breathability and temperature, and what has been delivered, each name with where it went. Tap the destination to change it. A ship at either end shows its shield state.
- **Gauges (top of the schematic):** buffer occupancy (pattern mass held against the limit), transfer speed, power in use (amber when supply is restricted) and pattern mass against the active limit (pad or cargo).
- **Target Scan (left):** Bio personnel or Non-bio cargo; the pad, the cargo bay or another location within range; Scan; then tap targets to select them. Each selected target shows its lock (acquiring, locked, waiting, buffer full or over the mass limit).
- **Transfer (right):** the dematerialize and materialize levers, with minimum power, power in use, available power, transfer speed and stage progress. A locked lever answers a tap with why it is locked.
- **Advisory line:** what the transporter needs next, from power and shield interlocks down to the next step.
- **Top bar:** our shield state and the transport cycle (standby, locking, locked, dematerializing, buffer hold, materializing, paused, blocked, complete, no power).
- **Bottom bar:**
  - Destination: the pad, the cargo bay or a location within range, with the destination's atmosphere, temperature and breathability.
  - Range Map: our ship, the range circle, Earth, the survey moon and every external location, listed as in range, out of range or behind a body. Tap a location in the list (or its dot) to light it up on the map; one beyond the edge of the map gets an arrow pointing toward it.
  - Clear Transport (powered down, nothing buffered).
  - Diagnostics: every reading.
- **Menu → Demo controls:** Mark I/II/III presets, range, lock time, pad and cargo mass limits, idle and maximum power, bus supply, restrictor, fastest and lowest stage rates (linked 1:10), our shields and TNS Resolute's shields, the ship's bearing around Earth and altitude, and Reset Demo. Mark, range, mass limits and ship position are locked during a cycle.

## Rules the stand-in follows

The rules are the discovery preview's (see `discovery.md`), with these notes:

- Targets lock one at a time in selection order (3 s each by default), skipping any that no longer fit what is left of the mass limit. Only locked targets enter a batch; the rest wait and lock again once the buffer is free.
- Bio always uses the pad limit. The cargo limit applies only to Non-bio with our Cargo Bay at one end.
- Raising the dematerialize lever starts the batch; lowering it to zero pauses. When the buffer is full the lever drops to zero on its own and the materialize lever takes over; it drops to zero when delivery finishes, and any waiting targets start locking.
- Zero lever draws idle power. A raised lever asks for a level between idle and the rated maximum, clipped by supply. Speed is 10% of full at idle and rises linearly to 100% at the rated maximum. Below idle power the workspace becomes a black checkered "System not available" screen; nothing locks or moves and buffered patterns are held.
- Internal transfers (pad and cargo bay) work with shields up. Any external end needs our shields down, and a ship at either end needs its shields down too. Raising a blocking shield zeros the levers and holds the batch and buffer.
- Other locations are offered only within range and in clear line of sight: a beam may not pass through Earth or the moon. Range is measured to the surface location.
- Clear Transport sets the source back to the pad and the destination to the cargo bay and clears selections, scan and the delivered list; nobody is moved. Reset Demo also returns everyone to their starting location.
