"""Run the 3 presets x 3 AC anchors through the website's /api/compute route.

Uses the Flask test client, so the request is the same one the browser sends
(payload from presets.json, time_range [2017, 2200], initial_progress 0).

    python bugs/harness/run_grid.py LABEL            -> bugs/results/LABEL.json
    python bugs/harness/run_grid.py LABEL k=v ...    -> same, with overrides
"""
import contextlib
import io
import json
import logging
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, ROOT)
logging.disable(logging.CRITICAL)
with contextlib.redirect_stdout(io.StringIO()):
    from api.index import app

PRESETS = ['daniel-08-16-26', 'eli-08-16-26', 'brendan-08-16-26']
ANCHORS = ['uplift-solved', 'time-horizon', 'revenue']
MILESTONES = ['AC', 'AI2027-SC', 'SAR-level-experiment-selection-skill', 'SIAR-level-experiment-selection-skill',
              'TED-AI', 'ASI']

_client = app.test_client()


def load_presets():
    with open(os.path.join(HERE, 'presets.json')) as f:
        return json.load(f)


def compute(params):
    body = {'parameters': params, 'time_range': [2017, 2200], 'initial_progress': 0.0}
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        r = _client.post('/api/compute', json=body)
    js = r.get_json()
    if r.status_code != 200 or not js.get('success', True):
        return {'error': (js or {}).get('error', f'HTTP {r.status_code}')}
    ms = js.get('milestones') or {}
    out = {}
    for k, v in ms.items():
        if isinstance(v, dict) and v.get('time') is not None:
            out[k] = v['time']
    return {'milestones': out, 'raw': js}


def run_grid(overrides=None):
    presets = load_presets()
    res = {}
    for pid in PRESETS:
        for mode in ANCHORS:
            p = dict(presets[pid], ac_anchor_mode=mode, **(overrides or {}))
            r = compute(p)
            res[f'{pid}|{mode}'] = r.get('milestones', r)
    return res


def _parse(v):
    try:
        return float(v)
    except ValueError:
        return v


if __name__ == '__main__':
    label = sys.argv[1]
    ov = dict(a.split('=', 1) for a in sys.argv[2:])
    ov = {k: _parse(v) for k, v in ov.items()}
    res = run_grid(ov)
    os.makedirs(os.path.join(ROOT, 'bugs', 'results'), exist_ok=True)
    with open(os.path.join(ROOT, 'bugs', 'results', f'{label}.json'), 'w') as f:
        json.dump(res, f, indent=1, sort_keys=True)
    for k, v in res.items():
        if 'error' in v:
            print(f'{k:40s} ERROR {v["error"]}')
        else:
            print(f'{k:40s} AC {v.get("AC", float("nan")):9.3f}  ASI {v.get("ASI", float("nan")):9.3f}')
