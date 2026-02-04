## Quick context

This is a minimal, static Three.js demo project. It has no package.json or build step. Files of interest:

- `index.html` — defines an `importmap` and loads `index.js` as a module.
- `index.js` — the main app. Imports Three.js, controls, and dat.gui.

Keep guidance short and specific to this repository so an AI agent can be productive immediately.

## Architecture & why

- Single-page static app. All runtime dependencies are loaded from CDNs via the `importmap` declared in `index.html`.
- There is no bundler or Node.js toolchain — edits must work when served over HTTP (not file://).

## Key patterns and gotchas (from the code)

- The `importmap` maps:
  - `"three"` -> the three.module.js CDN URL
  - `"jsm/"` -> the examples/jsm/ path on the same CDN

- Prefer using the `jsm/` prefix for Three.js example modules. Example (correct form):

  `import { OrbitControls } from 'jsm/controls/OrbitControls.js';`

  The current `index.js` uses `three/examples/jsm/...` which will not match the `jsm/` mapping and can cause module resolution errors when served in the browser.

- This project relies on CDN modules. If you add new libraries, either add them to the importmap or use absolute CDN URLs.

## Run / debug locally

1. Serve the folder over HTTP (importmaps and ES modules usually break with file://). Simple options:

   - Python 3: `python -m http.server 8000` (run in the project root)
   - VS Code: use the Live Server extension

2. Open `http://localhost:8000/` in a modern browser and check DevTools console for module errors (typical first bug).

3. Look for messages like `Failed to resolve module specifier` — they usually mean an import string doesn't match the importmap.

## Common, discoverable fixes you may need to apply

- Fix import specifiers to match the importmap. Example change in `index.js`:

  - Bad: `import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';`
  - Good: `import { OrbitControls } from 'jsm/controls/OrbitControls.js';`

- The project currently uses CDN imports for `dat.gui` but doesn't map it in the importmap. Either import via full CDN URL or add a mapping.

- Small typos in `index.js` are present and can confuse newcomers (e.g. `antialess` → `antialias`, `camara` → `camera`). When modifying, keep variable naming consistent across the file.

## Where to look for more context

- `index.html` — importmap declarations and module loading
- `index.js` — runtime behavior, imports, and where to add controls/lights/animation loop
- `README.md` — minimal; not authoritative

## Example agent tasks (explicit, actionable)

- Resolve module import errors: open `index.js`, align import specifiers with `importmap` or add CDN mappings in `index.html`.
- Add an animation loop and basic lighting: `renderer.setAnimationLoop()` or `requestAnimationFrame()` + `AmbientLight`/`DirectionalLight`.
- Add a local development helper: create a one-liner `serve` script in a `README` or add a `package.json` with a `start` script if a Node workflow is desired.

## Do not assume

- There is no bundler, test runner, or CI config present — do not add instructions that assume their existence unless you add those files.
- Do not attempt to download or install packages using npm/yarn; prefer CDN or explicitly add a package manifest.

---
If any section is unclear or you want the agent to adopt a Node-based workflow (npm + bundler), tell me and I can update this file with step-by-step changes.
