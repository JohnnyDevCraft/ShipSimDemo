# Cargo Bay

The cargo bay's console (2026-10-31), the demo of the live console in the Xelseor Mission Protocol Sim's ship consoles (release
1.0.0-Beta2). The hold is on the left, the manifests fill the middle, and the delivery request and discrepancy log are on the right.
It scales from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/cargo-bay-layout.cjs` checks
those sizes and `tests/cargo-bay.cjs` the behaviour.

Files: `index.html`, `styles.css` and `cargobay.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by
`node scripts/build-static.cjs`; `../Shared/console.css` is the shared console look. It shows the NON-HABITABLE notice from
`../Shared/habitability.js` like every console.

- **Cargo aboard (left):** crates, mass and how many are inspected; the crates by type; each crate with ORDERED / NOT ORDERED and
  UNCHECKED, INSPECTED or its findings. Tap a crate to open it in the CRATE view.
- **Manifests (middle):** EXPECTED (the orders from Atlas Bulk Transport: Gliese Orbital Station to Earth Orbital Station, four
  crates, and whether each is aboard), RECEIVED (the manifest each crate came aboard with), COMPARE (the two side by side, crate by
  crate, rows that differ highlighted: a crate not aboard, one not ordered, a count that differs) and CRATE (inspect it, its manifest
  against what was counted, log all findings or log a discrepancy by hand).
- **Delivery request (right):** the receiver, the steps (prepared, transmitted, approved or refused, delivered), what the request
  carries and the receiver's answer. Once approved, **Send the cargo by transporter** beams the crates to the receiver (in the live
  console this is Transporter Control).
- **Discrepancy log (right):** every discrepancy logged, with a note when the crew wrote one; STRIKE removes it.
- **Bottom bar:** the three manifest views, Inspect Crate, Log Discrepancy, Prepare Request and Transmit.
- **Menu → Demo controls:** cargo orders on or off, the communications array powered, the ship far from Earth (every receiver out of
  reach), beam another crate aboard, and reset.

## Rules (the simulator's)

- Sample cargo: the orders list Grain, Luxury goods, Refined ore and Consumer goods. Aboard are the first three and a crate of
  Medical supplies nobody ordered. The grain crate's manifest says 42 sacks of wheat where the orders say 40; the wine and medical
  crates hold less than their manifests say, which only inspecting shows.
- A request carries the crates aboard that the orders list (every crate aboard without orders), the manifests they came aboard with,
  the crew's inventory of those inspected and the discrepancies logged for them, as they were when it was prepared.
- Transmitting needs the communications array powered. The receiver answers after a moment. It refuses when the ship is more than
  100,000 km away, a crate is not aboard, a crate on the orders is consigned to someone else, a crate has not been inventoried, or a
  discrepancy found in a crate is not logged; otherwise it approves, noting the discrepancies for the consignee. A refused request
  can be transmitted again, or prepared again after putting it right.
- Delivering the cargo does not close the orders; in the simulator the organization closes the mission.
