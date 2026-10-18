"""Per-cell milestone date differences (days) between two run_grid result files.

    python bugs/harness/compare.py BEFORE AFTER [MILESTONE ...]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, '..', 'results')


def load(label):
    with open(os.path.join(RESULTS, f'{label}.json')) as f:
        return json.load(f)


def main():
    a, b = load(sys.argv[1]), load(sys.argv[2])
    ms = sys.argv[3:] or ['AC', 'ASI']
    for k in a:
        cells = []
        for m in ms:
            x, y = a[k].get(m), b[k].get(m)
            if x is None or y is None:
                cells.append(f'{m} {x!s:>9}->{y!s:<9}')
            else:
                cells.append(f'{m} {x:9.3f}->{y:9.3f} ({(y - x) * 365.25:+8.1f} d)')
        print(f'{k:34s} ' + '  '.join(cells))


if __name__ == '__main__':
    main()
