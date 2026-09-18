# ShipsMS demo collection

`index.html` is the ShipsMS introduction and links to all twelve demos. Every demo has its own folder directly under `Templates`:

- Helm, Reactor, PowerDistribution, Communications, Transporter, ViewScreen
- TacticalOfficer, TorpedoAssembly, TorpedoLaunch, PhaseCannon, PhaserArray, Shields

The six weapon and defense demos share compiled Angular assets in `Weapons/`. Keep that folder alongside the individual demo folders. All demos run in the browser without a simulation server.

## Rebuild and publish

From the repository root:

```sh
npm --prefix ng-app ci
npm --prefix ng-app run build:demos
```

This updates the weapon demo pages and shared assets inside `Templates`, then copies the complete collection to `ng-app/dist/github-pages/`. Publish the contents of either folder as the GitHub Pages artifact. Relative links and hash routes support repository subpaths without server rewrites. The export does not change GitHub Pages settings.

To preview directly from Templates:

```sh
python3 -m http.server 18086 --bind 127.0.0.1 --directory Templates
```

Open `http://localhost:18086/`. The plain HTML demos remain editable in their folders. Edit weapon demos in `ng-app/src`, then rebuild; their exported HTML and shared bundles are generated files.
