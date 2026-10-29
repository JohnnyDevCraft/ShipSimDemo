# Reactor Control

The engineer's reactor console, rebuilt on the Helm design (2026-10-28). The schematic fills the window and the controls float over it. The bottom bar holds the reactor actions and opens dialogs, and demo-only controls sit behind the menu. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/reactor-layout.cjs` checks those sizes.

Files: `index.html`, `styles.css`, `../Shared/console.css` (the shared console look) and `reactor.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`. `helm-theme.css` is no longer used by any page.

- **Schematic:** fuel flows from the **fuel reserves** tank (level, units left and time remaining at the current burn) through the **fuel injection** pipe, which shows the fuel flow in units per second, with the burn under it. The **chamber** shows the reaction power in the glow, inside the magnetic confinement ring; the twelve collector blades turn with the collector angle. The **collector** pipe shows what reaches the ship bus, with the gross output under it. The **ship bus** box shows output, requested load and balance. The **coolant loop** under the chamber shows actual and required coolant flow. The streams in the pipes move with what flows through them. A faulty subsystem's label turns red. The magnetic confinement ring is gold while plasma stability is 80% or more and reddens as it falls; at 0% (or with the reactor off) it is a thin blue line, where the field would be. Below 80% the glow also turns red-hot.
- **Gauges (top of the schematic):** plasma stability, collector efficiency, chamber temperature (with the 80 danger and 100 damage marks) and reactor damage. Damage is an indicator only; it cannot be typed in.
- **Reaction Control (left):** fuel flow and confinement beam sliders (fuel cannot go below idle, 10%, while the reactor runs; the hatched band marks it), with the required beam, what was delivered and where it came from (main reactor, support battery or station power).
- **Collectors · Coolant (right):** collector angle and coolant valve sliders, with the best angle, the coolant needed and the pump power.
- **Amber marks on the sliders:** what the reactor needs now: the required beam, the best collector angle and the valve opening for the coolant needed.
- **Advisory line:** the most important thing the reactor needs, from runaway and overheating warnings down to "confinement stable".
- **Bottom bar:**
  - Initialize, Shutdown (controlled) and Chamber Off (every control to zero once the reactor is cold). When Initialize or Shutdown cannot be used, it is dimmed but a tap says why.
  - Maintenance: damage control repairs, and component replacement by a free DOT on a cold reactor.
  - Diagnostics: every reading, including battery charging and support.
  - Eject Core, which asks first.
- **Menu → Demo controls:** requested ship load and available fuel on the keypad, take 10% damage, station power, refill fuel, install a new core, cold start and reset.

Station power and battery support are not shown on this console: Battery Control (`../Battery/`) now shows the battery, its recharge and bus support, and power sync. The battery still exists in this console's model, which uses it for startup, confinement and load support, and Diagnostics shows its level; the two demos do not share state.

## Rules the stand-in follows

The reactor model is the discovery preview's, with these changes:

- Docking, the umbilical and power sync are a single **station power** switch in the demo controls.
- **Idle is 10% fuel flow (0.100 units/s).** Initialize ramps fuel from zero to idle over 100 seconds with every control locked; the sequence opens the coolant valve as far as the reaction needs. At idle the controls are released. A running reactor cannot take fuel below idle.
- **A controlled shutdown starts only at idle, with plasma stability at 80% or more and the chamber temperature in the green (below 80).** It ramps fuel from idle to zero (50 seconds) with every control locked, holding the beam and collectors on what the dying reaction needs, so stability holds to the end.
- Ship load support from the battery stops at the 2,000 PU·s shutdown reserve, which is kept for startup, confinement and the coolant pumps.

- Fuel drives the reaction (180 PU at 1 unit/s). The reaction follows the fuel gradually.
- Confinement needs a beam that rises with the fuel. Stability falls as the beam strays from what is needed. Below 30% stability there is a one-in-six chance every five seconds of a containment failure, which destroys the reactor.
- Capture efficiency peaks when the collector angle matches the best angle for the current reaction. It runs from 55% to 95%, scaled by stability.
- The beam comes off the reactor's own output when it can; otherwise from station power or the support battery. Coolant pumps run off the bus after confinement.
- Chamber temperature rises when the coolant flow falls short of what the reaction needs. At 100 the collectors overheat and the core takes damage. Below 50% stability no coolant setting can keep up.
- Each 10% of damage from 30% to 80% breaks one subsystem: the coolant valve, the confinement producers, the collectors or the fuel injector (a leak or a restriction). Above 70% damage confinement weakens and wavers. At 100% the reactor explodes.
- Repairs remove 10% damage every 10 seconds. They cannot go below 10% for each faulty part, or below 40% while faulty parts are in a running reactor. Replacing a part takes five or ten minutes with a cold reactor and removes 10% damage.
- Initialize needs damage under 70% and either station power or more than the battery's 2,000 PU·s shutdown reserve.
- Reset demo reloads the page as a cold start.
