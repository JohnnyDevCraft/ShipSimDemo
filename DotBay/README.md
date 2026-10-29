# DOT Bay Control

The DOT bay's console (2026-10-29), on the Helm design. A DOT (Diagnostic and Operational Technician) is a repair unit; the bay holds four. The bay schematic fills the space between the side panels and the controls float over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/dot-bay-layout.cjs` checks those sizes and `tests/dot-bay.cjs` the behaviour.

Files: `index.html`, `styles.css` and `dotbay.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`; `../Shared/console.css` is the shared console look. It shows the NON-HABITABLE notice from `../Shared/habitability.js` like every console.

- **Schematic:** the bay, in the drawing style of Battery and Docking Control. The bay power bus feeds four charging cradles (cyan streams to the ones charging). Each cradle shows its DOT standing on its transporter pad, its battery, its state (ready, charging, beaming out, beaming home, repairing, stranded) and its assignment. A DOT beaming in or out fades on its pad in a transporter shimmer; a deployed DOT's cradle says where it is working. Tap a cradle (or focus it and press Enter) to pick its DOT.
- **Bay (left):** online or offline, the power drawn against idle and maximum, how many DOTs are ready, charging and deployed, and the transporter.
- **Selected DOT (left):** its state, battery (repair time left on this charge, or time to full), assignment and location.
- **Components (right):** the ship's twelve components, damaged first: integrity, the DOTs assigned (numbered chips, coloured by what each is doing) and the time left on the repair, or its time for one DOT.
- **Advisory line:** the selected DOT's work, beam or charge, how many components are damaged, or the bay offline and any stranded DOTs.
- **Bottom bar:** **Assign DOT n** (pick a damaged component, with the repair time if this DOT joins), **Send Now** (send the selected DOT to its job before it is fully charged, from 30% battery; it shows the battery and pulses when it can), **Recall DOT**, **Recall All**, **Bay Online / Offline** and **Diagnostics** (every DOT and the bay's figures).
- **Menu → Demo controls:** damage a component (set its integrity, or at random) and the demo clock (×1, ×10, ×60).

## Rules

- An assigned DOT beams from the bay straight to its component: ten seconds by the bay's transporter, either way.
- It repairs until its battery runs out, about five minutes, then beams home on its own, recharges (two minutes from empty) and beams back to the same component, until the repair is done, it is reassigned (it beams straight to the new component) or it is recalled. A DOT assigned while charging deploys when full, or earlier with Send Now once its battery is at 30% or more; it then repairs for that fraction of five minutes before heading home.
- Each component has a repair time for one DOT (from nothing to full, 8 to 40 minutes); DOTs on it share the work, so two DOTs take half the time. A finished repair sends its DOTs home and clears their assignments.
- Power: 1.0 PU idle while online, plus 1.5 PU for each DOT charging; 7.0 PU with all four charging. Offline the bay draws nothing, charging and the transporter stop, and a DOT whose battery runs out is stranded until the bay is back online.
- The bay does not share state with Power Distribution or the other consoles yet: component damage is a demo stand-in.
