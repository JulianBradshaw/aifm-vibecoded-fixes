// Runs both models in Pyodide off the main thread so the sliders stay responsive.
// Messages in:  {type: 'init', pyodideBase}, {type: 'preset', preset},
//               {type: 'run', id, which, preset, overrides}
// Messages out: {type: 'progress', text}, {type: 'ready'}, {type: 'preset', preset, params},
//               {type: 'result', id, which, data, ms}, {type: 'error', id, message}

let py = null;

function progress(text) {
  postMessage({ type: 'progress', text });
}

async function init(pyodideBase) {
  progress('Downloading Python (about 10 MB)');
  const { loadPyodide } = await import(pyodideBase + 'pyodide.mjs');
  py = await loadPyodide({ indexURL: pyodideBase });
  progress('Downloading numpy and scipy (about 17 MB)');
  await py.loadPackage(['numpy', 'scipy', 'pyyaml']);
  progress('Loading the models');
  const [zip, runner] = await Promise.all([
    fetch('model.zip').then((r) => { if (!r.ok) throw new Error('model.zip not found; run python web/bundle.py'); return r.arrayBuffer(); }),
    fetch('runner.py').then((r) => r.text()),
  ]);
  py.unpackArchive(zip, 'zip', { extractDir: '/home/pyodide/app' });
  await py.runPythonAsync(runner);
}

function call(name, ...args) {
  const fn = py.globals.get(name);
  try {
    return JSON.parse(fn(...args));
  } finally {
    fn.destroy();
  }
}

async function handle(msg) {
  if (msg.type === 'init') {
    await init(msg.pyodideBase);
    postMessage({ type: 'ready' });
  } else if (msg.type === 'preset') {
    postMessage({ type: 'preset', preset: msg.preset, params: call('preset', msg.preset) });
  } else if (msg.type === 'run') {
    const t0 = performance.now();
    const data = call('run', msg.which, msg.preset, JSON.stringify(msg.overrides));
    postMessage({ type: 'result', id: msg.id, which: msg.which, data, ms: performance.now() - t0 });
  }
}

// Messages are handled one at a time, in order.
let queue = Promise.resolve();
onmessage = (event) => {
  const msg = event.data;
  queue = queue.then(() => handle(msg)).catch((err) => {
    const text = String(err && err.message ? err.message : err);
    // Python tracebacks end with the useful line.
    const last = text.trim().split('\n').pop();
    postMessage({ type: 'error', id: msg.id, which: msg.which, stage: msg.type, message: last });
  });
};
