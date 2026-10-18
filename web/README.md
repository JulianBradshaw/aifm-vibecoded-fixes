# Browser version

A static page that runs this repository's fixed model and the original model side by side in the browser with [Pyodide](https://pyodide.org) (Python compiled to WebAssembly). There is no server: the page downloads Pyodide, numpy, scipy and PyYAML from the jsDelivr CDN (about 30 MB, cached after the first visit), unpacks both models from `model.zip`, and solves each setting in a Web Worker.

Each setting starts from a preset's website payload (`bugs/harness/presets.json`, the same parameters the website sends to `/api/compute`), applies the page's overrides, and runs it through both models.

- `index.html`, `style.css`, `app.js`: the page, sliders and SVG charts (no build step, no chart library).
- `worker.js`: loads Pyodide and runs the models off the main thread.
- `runner.py`: the Python entry point.
- `bundle.py`: writes `model.zip` from `progress_model/` (fixed) and the upstream commit's `progress_model/` (original, renamed `progress_model_upstream`), plus the input data.

## Run locally

```sh
python web/bundle.py
python -m http.server -d web 8000
```

Then open http://localhost:8000. To test against a local copy of the Pyodide distribution instead of the CDN, add `?pyodide=/path/to/pyodide/` to the URL. Settings are kept in the URL hash, so a link reproduces them.

Pyodide 314.0.7 ships numpy 2.4.6 and scipy 1.18.0; the dates it gives match a native run to well under a day.

## Publishing

`.github/workflows/pages.yml` bundles both models and deploys this folder to GitHub Pages on every push to `main`. Enable it once under Settings > Pages > Source: GitHub Actions.
