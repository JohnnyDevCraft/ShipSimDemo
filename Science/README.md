# Science Console demo

Local mock starship gameplay: library, Signal Challenge, Signal Guard, and receive-only probe telemetry. Open two tabs and choose different ships under Menu → Demo controls. The waveform contest adjusts a fictional reactor fuel-flow value in shared browser storage. There are no external targets or network control commands.

Signal Operations replaces the former Electronic Warfare label; Signal Operations Module replaces Hacking Module. Internal storage keys remain compatible.

Readable scripts: `demo-app/static-src/Science/`. Build with `node scripts/build-static.cjs`. Production work requires separate approval.

## Library records from the seed (2026-11-04)

The Library Computer also holds MissionProtocol's people, organization and settlement histories and starships
(feature "People, Factions, and Ship Crews", Phase 6). They are generated, never hand-edited:

    node scripts/library-from-seed.cjs ~/Source/repos/MissionProtocol/SeedData/v3/catalog-seed.json
    node scripts/build-static.cjs

The script writes `demo-app/static-src/Science/library-records.js`; `library-data.js` turns it into entries
(categories **People** and **Starships**; histories go to Organizations and Stations and settlements, replacing the
body of a hand-written entry of the same name).

What a player may read:
- **People.** Public people (every person of the Terran civilization a starship's roster does not name) to everyone;
  NPC bridge officers only to their own organization. Only a person's biography is shown — the seed's Temperament,
  Motivation, In character, Affiliations and Crew assignment lines are game-master and AI text and are not copied.
- **Organizations.** Every organization, its history (backStory) as the body.
- **Settlements.** The Terran public settlements with their history. New Melbourne and Doran (not public) keep their
  Terran Space Command survey entries.
- **Starships.** Every catalog starship's public record. Its NPC bridge roster — the identities the ship uses while it
  is computer-run — shows only to its own organization.
- **Our own ship is crewed.** The ship you are aboard (TNS Cooper, TN-02, for the escort; Cinder Vale has no catalog
  record) shows its **live crew** — here a mock (`ScienceSim.crew`: CPT-1, HELM-1, TAC-1, ENG-1 and this console's
  officer), standing in for the crew the ship service holds in memory — and never its catalog roster; that roster's
  officers are left out of the library altogether while the ship is crewed (`LibraryData.visible`).

People and Starships run to hundreds of records, so the list shows 120 at a time with SHOW MORE.
