"""Pack the model sources the browser page needs into web/model.zip.

The zip holds two copies of the model: the fixed one from this checkout
(progress_model/) and the original from the upstream commit this repository
started from (renamed progress_model_upstream/), so the page can run both.
Run from the repository root: python web/bundle.py
"""
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
# The upstream "Initial release" commit that every fix in this repository sits on.
UPSTREAM = '1c40ecdb246c25980515441a66571931c5604e11'
DATA = ['inputs/input_data.csv', 'inputs/metr/benchmark_results_1_1.yaml', 'LICENSE']


def git(*args):
    return subprocess.run(['git', '-C', str(ROOT), *args], check=True, capture_output=True).stdout


def main():
    out = ROOT / 'web/model.zip'
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        fixed = sorted((ROOT / 'progress_model').glob('*.py'))
        for f in fixed:
            z.write(f, f.relative_to(ROOT).as_posix())
        names = [n for n in git('ls-tree', '--name-only', UPSTREAM, 'progress_model/').decode().split()
                 if n.endswith('.py')]
        for name in names:
            src = git('show', f'{UPSTREAM}:{name}').decode()
            # Absolute self-imports must point at the renamed package.
            src = src.replace('from progress_model ', 'from progress_model_upstream ')
            src = src.replace('from progress_model.', 'from progress_model_upstream.')
            z.writestr(name.replace('progress_model/', 'progress_model_upstream/', 1), src)
        for name in DATA:
            z.write(ROOT / name, name)
        z.write(ROOT / 'bugs/harness/presets.json', 'presets.json')
    print(f'Wrote {out} ({out.stat().st_size // 1024} KB, {len(fixed)} fixed and {len(names)} upstream files)')


if __name__ == '__main__':
    main()
