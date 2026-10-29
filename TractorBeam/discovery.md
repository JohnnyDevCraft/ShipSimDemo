# Tractor beam: what to decide for the component and the live console

The demo works and settles the console's shape. These are the open decisions for the tractor emitter component (the module catalog entry) and for the real control. Each lists what the demo does now.

## 1. The component's ratings (catalog)

| Rating | Demo value | Decide |
| --- | --- | --- |
| Beam range | 5 km | Per mark or model? Measured centre to centre, hull to hull, or to the nearest point of the target? |
| Max move speed | 100 m/s | Fixed, or derived from emitter strength ÷ target mass once mass is modelled? |
| Max turn rate | 6°/s | As above. Does turning get harder with longer hulls? |
| Minimum clearance | 40 m between hulls | Is this a component rating or a ship-safety constant? |
| Idle / max power | 1 / 12 PU | Draw rises evenly with distance from idle (alongside) to max (at beam range), and the available power limits the reach. Decide whether the curve stays linear, whether moving or turning adds to it, and whether mass will scale it. |
| Coverage | All round | Real emitters may cover an arc (forward and aft emitters?). If so, a ship pulled outside the arc is dropped or handed between emitters. |
| Lock time | Instant | A short acquisition (1–3 s) with the reticle held on target would make it feel deliberate and fit sensor rules. |
| Number of beams | One | Bigger ships may carry two emitters and hold two ships, or hold one more strongly. |

## 2. What can be locked

- Ships only, shields down (demo). Decide whether a target's shields block the lock only while they hold (any facing up) or only the facing towards us; the demo blocks on any shield.
- Asteroids and cargo pods later: give them a kind the rule can allow.
- Never stations, planets, moons, stars: keep as a hard rule, or base it on mass once mass exists.
- Line of sight: should a body (or another ship) between us and the target block the lock, as it blocks transporters and weapons?
- Friend or foe: can we lock an enemy ship whose shields are down? Can it resist (its own engines pulling against the beam), and does that cost us power or break the beam?
- Cloaked, out of sensor range, or destroyed ships: not lockable.

## 3. Mass (deferred)

When mass arrives, decide one model and apply it to all three ratings: for example, speed and turn rate scale with emitter strength ÷ target mass, holding fails above a max mass, and power rises with mass × speed. Until then, the demo treats every ship alike.

## 4. Moving the held ship

- Coordinates: the demo stores range and bearing relative to us and moves the ship in that frame, so it keeps station as we turn. Decide whether the held ship should stay fixed to our frame while we fly at impulse (it moves with us) or in space (we drag it).
- Our own manoeuvres: can the helm fly at impulse while holding? Does impulse add to the beam's work (the held ship must accelerate with us)?
- Acceleration: the demo jumps straight to the stick's speed. Real control may want ramping (acceleration and deceleration limits) so ships do not stop dead.
- Collisions: the demo only keeps the held ship's distance from us. Decide whether it can hit other ships or the station, and what happens if it does.
- Up and down: the console is flat, like the rest of the sim. If the sim gains height, the Position stick needs a third axis or a mode switch.

## 5. Breaking the beam

The demo drops the ship when its shields go up or our available power falls below what its distance needs. Also decide:

- Range: beyond beam range (if our ship moves away, or the target's engines pull it).
- Our shields: can the beam pass out through our own raised shields? (Transporters cannot; weapons can.)
- Damage to the emitter: a damaged emitter with reduced ratings, or a failure chance under load.
- Warp: starting warp with a held ship outside the field should either refuse or drop the ship.
- What a dropped ship does: keeps its last velocity (the demo leaves it where it is).

## 6. The warp field hand-off

- Field radius: 500 m from our centre in the demo; should it come from the warp drive's rating, and extending it cost power?
- Alignment: within 10° of our heading. Is alignment needed, or only being inside?
- Who confirms: the tractor console shows "ready", but the helm (or engineering) extends the field and engages. The live console should report readiness to the helm, and the helm's engage should check it.
- During warp: does the beam keep holding (power draw), or does the warp field carry the ship and the beam release?

## 7. The live console

- Authority: one tractor operator, or can the helm and tactical take it over (like Delegate Aim on the weapon consoles)?
- Server truth: joystick input should be sent as rates (speed and turn requests) at a steady tick, with the server applying limits and reporting the held ship's position. Pause the request (zero rates) if the connection or the page loses focus, and on lifting both fingers.
- Two-thumb control: the demo's sticks each follow one pointer, so both work at once on a touch screen; keep that when moving to Angular, and keep the keyboard fallback.
- Reporting: other consoles should see the beam (view screen, helm scanners, the held ship's own crew, Communications for hails like "you are being tractored").
- Missions: tow a disabled ship to a station, recover a drifting shuttle, carry a ship to warp. Missions should check validated state (held, inside field, delivered) rather than narrative claims, as with transporters.
