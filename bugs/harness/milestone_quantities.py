"""Print each milestone's time and the quantities reported at it, for one preset/anchor.

    python bugs/harness/milestone_quantities.py PRESET MODE [k=v ...]
"""
import sys

from run_grid import compute, load_presets, _parse

pid, mode = sys.argv[1], sys.argv[2]
ov = {k: _parse(v) for k, v in (a.split('=', 1) for a in sys.argv[3:])}
r = compute(dict(load_presets()[pid], ac_anchor_mode=mode, **ov))
ms = r['raw']['milestones']
for name, m in sorted(ms.items(), key=lambda kv: kv[1].get('time') or 1e9):
    if m.get('time') is None:
        continue
    print(f"{name:42s} t={m['time']:.4f}  sw_mult={m.get('progress_multiplier', float('nan')):.4g}  "
          f"RE={m.get('research_effort', float('nan')):.4g}  RS={m.get('research_stock', float('nan')):.4g}")
