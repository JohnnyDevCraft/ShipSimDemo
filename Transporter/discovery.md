# Transporter discovery decisions

## Reachable locations in the preview

Other Location lists now filter both sources and destinations by actual geometric distance and unobstructed line segments. A beam segment that enters any planet/moon disk is blocked, even if the target is within transporter range; touching the intended surface endpoint is allowed. Earth has a 6,371 km radius. The ship defaults to 1,000 km altitude over Tokyo's preview bearing. Footer bearing and altitude controls move this standalone demo ship; they lock during a transport cycle. A small illustrative moon occludes Delta Survey Outpost within range to exercise the far-side case. Range changes refresh the lists. These computed positions supersede the earlier fixed-distance fixtures; this preview remains separate from the navigation demo's ship state.

## Shield interlock

Internal transfers between our transporter pad and cargo bay work with shields up. Any external source or destination requires our shields down. If the other endpoint is another ship, that ship's shields must also be down. Both checks apply in both directions and throughout dematerialization/materialization. Raising a blocking shield stops progress and zeros the levers while preserving batch and buffer state; lowering shields lets the operator resume. The preview has an own-shield indicator near power usage, an additional remote-ship status for ship routes, and footer toggles for each. Production requires actual shield state rather than these fixture toggles.

## Planetary settlements and outposts

Settlements are a GTO object type, parented to a planet. Their surface bearing is stored in degrees with zero pointing from the planet toward the system gravitational center. Derive the surface position from that bearing, the planet position/radius, and the system center; do not store an unrelated screen angle. A planetary outpost is also a settlement and requires this surface coordinate.

During implementation, every already-settled planet belonging to any civilization receives a randomly chosen total of 1–10 settlements with civilization-appropriate names. Preserve established settlements/outposts and their identity within that total, and persist the generated result so rerunning a seeder does not reroll or duplicate it. Earth retains its eight explicitly named settlements. Prime planets must have multiple settlements; use 2–10 for those to satisfy both requirements. If existing named settlements already exceed a rolled total, preserve them. Seed all resulting records into GTO with their planet parent, civilization, and surface bearing. This is a future seeding requirement, not a live database change during discovery.

Settlements are selectable source and destination locations for both Bio personnel and Non-bio mission objects. Their actual contents, range, and planet occlusion determine availability. The transporter preview includes all eight Earth settlements under Other Location, each with illustrative personnel and mission cargo; distances in that standalone preview are fixtures, not linked to the navigation demo's ship position.

Every prime planet will have multiple settlements. Earth's initial set is Paris, Jerusalem, Moscow, Hong Kong, Tokyo, San Francisco, St. Louis, and Port Canaveral. Settlement locations belong to their planet and lie on its physical surface. In the 2D map presentation they are spaced around the outer planetary rim, shown as yellow dots two CSS pixels in diameter. Dots appear only below a 20,000 km map radius. Labels appear at 10,000 km radius and closer.

These shared visibility rules must be implemented on SRS, Helm System, Communications System, and GTO Administration System maps. Transport range is measured from the ship to the settlement surface location, not the planetary center. The planet must not obstruct the path: ship position must be on the settlement-facing side. Mission tools must be able to identify a settlement as a personnel pickup/drop-off or cargo endpoint.

The navigation discovery template now demonstrates Earth's eight settlements in SRS and System views. Bearings are evenly spaced preview fixtures, not geographic projections. The Earth Settlements camera button changes only the System camera. Selecting a dot shows ship distance and illustrative Mark I range/planet-occlusion status. Live map integration and persistent settlement records remain future implementation.

## Power and transfer speed

When effective available power is below minimum required power, replace all Target and Destination panel contents and the Transport workspace below the Pattern Transfer heading with a black checkered screen reading “System not available.” Hidden controls are inert. Keep the transport heading and power readouts visible, with footer demo settings accessible. Returning to minimum power restores the view and preserved cycle state.

Minimum required power is module idle power. Max variable power is the rated maximum total draw. Effective available power is the lesser of bus supply and rated maximum multiplied by restrictor percentage. Available power is the supply ceiling, not unused headroom. Idle draw is supplied up to the minimum when no transfer is running.

Below idle power, no transfer or new lock progresses; existing buffered patterns remain held. At idle power an active transfer runs at 10% of full speed. Speed increases linearly to 100% at rated maximum power. A restricted supply cannot become a new full-speed reference. Lever zero pauses; positive lever settings request a level between idle and rated maximum, clipped by available power.

Footer controls expose minimum/idle PU, maximum PU, bus supply, restrictor percentage, and lowest/fastest stage-progress rates. Defaults are 1 PU, 12 PU, 12 PU, 100%, 1.25% per second, and 12.5% per second. The speed fields are linked at 1:10 to preserve the minimum-power rule. Both transport stages use the same rates. Later module creator/catalog work must expose the persistent power ratings and transfer-speed settings; bus supply and restrictor remain runtime inputs. No production editor or catalog changes are part of this preview.

Discovery only: catalog, AI mission integration, and live transfers remain future implementation.

## Range and buffer capacity

All transporter range settings must be between 10,000 and 15,000 km inclusive. The proposed variants are:

| Variant | Range | Pad / Bio mass equivalent | Cargo / Non-bio mass equivalent | Provisional pad kg | Provisional cargo kg |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mark I | 10,000 km | 2 adults | 4 adults | 160 | 320 |
| Mark II | 12,000 km | 4 adults | 6 adults | 320 | 480 |
| Mark III | 14,000 km | 6 adults | 12 adults | 480 | 960 |

The adult counts are mass equivalents, not target-count limits. The demo assumes 80 kg per adult solely to translate the requested equivalents into editable kg values; this conversion is provisional. Actual target masses determine batch size.

Bio always uses the pad limit, regardless of source or destination. The higher cargo limit applies only to Non-bio with our Cargo Bay as either endpoint. All other routes use the pad limit. This supersedes the earlier Bio cargo-limit rule.

The demo exposes variant presets and a range setting constrained to 10,000–15,000 km. Its three sample external locations are all within the minimum range; actual spatial range detection remains for implementation.

## Completion and clearing

Dematerialization completion automatically returns its power lever to zero and disables it, then enables materialization. Materialization completion also automatically returns to zero, with both controls disabled until another selected batch has acquired locks. Previously selected capacity-waiting targets resume locking automatically; with none waiting, both remain disabled until new targets are selected and locked. These rules supersede both earlier manual power-down requirements.

Materialization resets progress to zero. The operator lowers the right lever before the next waiting batch may lock. Clear Transport sits above the progress bar on the right; it clears the operation when powered down and with no buffered patterns, preserving target locations. Reset Demo separately restores original sample locations.

## Narrative and mission scope

Future AI story tools and instructions must understand personnel transport and persistent character locations. Missions may include beaming delegates aboard, carrying them to another planet for diplomatic work, and collecting or delivering mission cargo on planetary surfaces. Completed transports change the locations of actual characters or mission items. Mission progress must use validated transfer results rather than narrative assertions. No AI or database implementation is authorized by these discovery notes.
