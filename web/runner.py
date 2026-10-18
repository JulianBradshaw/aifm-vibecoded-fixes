"""Browser entry point: runs the fixed and the original model inside Pyodide.

Both packages are unpacked from model.zip: progress_model (this repository's
fixed model) and progress_model_upstream (the original it started from). A run
takes a preset from presets.json (the same payload the website sends to
/api/compute), applies the page's overrides, and returns JSON for the page.
"""
import csv
import json
import logging
import math
import sys
from dataclasses import fields

APP = '/home/pyodide/app'
sys.path.insert(0, APP)
logging.disable(logging.CRITICAL)

import numpy as np
import progress_model as fixed
import progress_model_upstream as upstream

MODELS = {'fixed': fixed, 'upstream': upstream}
with open(f'{APP}/presets.json') as f:
    PRESETS = json.load(f)
TIME_RANGE = [2017, 2200]
# Read by the website's time-series generator, which the API only uses when all three are sent.
TIME_SERIES_KEYS = {'constant_training_system_performance_growth_rate', 'slowdown_year',
                    'post_slowdown_training_system_performance_growth_rate'}
MILESTONES = ['AIR-25x', 'AC', 'AI2027-SC', 'SAR-level-experiment-selection-skill',
              'SIAR-level-experiment-selection-skill', 'TED-AI', 'ASI']


def _time_series(pkg):
    with open(f'{APP}/inputs/input_data.csv') as f:
        rows = list(csv.DictReader(f))
    col = lambda k: np.array([float(r[k]) for r in rows])
    return pkg.TimeSeriesData(col('time'), col('L_HUMAN'), col('inference_H100e'),
                              col('experiment_H100e'), col('training_H100e'))


def _num(x):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def _milestone_time(v):
    return _num(v.get('time') if isinstance(v, dict) else v)


def preset(preset_id):
    return json.dumps(PRESETS[preset_id])


def run(which, preset_id, overrides_json):
    pkg = MODELS[which]
    params = dict(PRESETS[preset_id])
    params.update(json.loads(overrides_json))
    known = {f.name for f in fields(pkg.Parameters) if f.init}
    params = {k: v for k, v in params.items() if k in known and k not in TIME_SERIES_KEYS}
    try:
        model = pkg.ProgressModel(pkg.Parameters(**params), _time_series(pkg))
        model.compute_progress_trajectory(TIME_RANGE, 0.0)
    except Exception as e:  # the model raises ValueError for settings it refuses to run
        return json.dumps({'error': f'{type(e).__name__}: {e}'.splitlines()[0][:300]})
    r = model.results
    ms = {k: _milestone_time(r['milestones'][k]) for k in MILESTONES if k in r['milestones']}
    times = np.asarray(r['times'], dtype=float)
    progress = np.asarray(r['progress'], dtype=float)
    keep = np.flatnonzero((times <= 2060) & np.isfinite(progress))
    keep = keep[::max(1, keep.size // 800)]
    return json.dumps({
        'milestones': ms,
        'times': [round(float(t), 4) for t in times[keep]],
        'progress': [round(float(v), 4) for v in progress[keep]],
        'present_day': _num(r.get('present_day')),
    })
