"""Figures for BUGS.md, from the JSON files in bugs/results.

    python bugs/harness/plot.py   -> bugs/figures/*.png
"""
import json
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, '..', 'results')
FIG = os.path.join(HERE, '..', 'figures')

PRESETS = [('daniel-08-16-26', 'Daniel'), ('eli-08-16-26', 'Eli'), ('brendan-08-16-26', 'Brendan')]
ANCHORS = [('uplift-solved', 'coding uplift'), ('time-horizon', 'time horizon'), ('revenue', 'revenue')]
CELLS = [(f'{p}|{a}', f'{pl} · {al}') for p, pl in PRESETS for a, al in ANCHORS]

BEFORE, AFTER = '#2a78d6', '#eb6834'          # categorical slots 1 and 2
INK, MUTED, GRID = '#0b0b0b', '#52514e', '#e4e3df'
FINAL = '14-exact-automation-index'

# (results label, title, setting shown, before label, after label)
SHOWCASES = [
    ('01-eta', 'η conversion for λ', 'λ = 0.3', 'show-before.lambda0.3', 'show-after.lambda0.3'),
    ('02-top-percentile', 'Skill bar ignores top-percentile slider', 'top percentile = 0.99',
     'show-before', 'show-after'),
    ('03-frontier-tail', 'Serial-labor cap collapses at small λ', 'λ = 0.1',
     'show-before.parallel_penalty', 'show-after.parallel_penalty'),
    ('03-frontier-tail', 'Coarse frontier grid near full automation', 'asymptote = 1.0001',
     'show-before.automation_logistic_asymptote', 'show-after.automation_logistic_asymptote'),
    ('07-uplift-date', 'Uplift belief bound at the wrong date', 'present day = 2026.1',
     'show-before', 'show-after'),
    ('08-labor-normalization', 'Labor normalization skipped in calibration', 'normalization = 2',
     'show-before', 'show-after'),
]


def load(label):
    with open(os.path.join(RES, f'{label}.json')) as f:
        return json.load(f)


def style(ax):
    for s in ('top', 'right', 'left'):
        ax.spines[s].set_visible(False)
    ax.spines['bottom'].set_color(MUTED)
    ax.tick_params(colors=MUTED, labelsize=9, length=0)
    ax.grid(axis='x', color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def default_dates():
    up, fx = load('upstream'), load(FINAL)
    fig, axes = plt.subplots(1, 2, figsize=(11, 5.2), sharey=True)
    ys = list(range(len(CELLS)))[::-1]
    for ax, m in zip(axes, ['AC', 'ASI']):
        style(ax)
        for y, (k, _) in zip(ys, CELLS):
            a, b = up[k][m], fx[k][m]
            ax.scatter([a], [y], s=70, facecolor='white', edgecolor=BEFORE, linewidth=2, zorder=3)
            ax.scatter([b], [y], s=22, color=AFTER, zorder=4)
            ax.annotate(f'{(b - a) * 365.25:+.1f} d', (max(a, b), y), xytext=(8, 0),
                        textcoords='offset points', va='center', fontsize=8.5, color=MUTED)
        ax.set_title(m, loc='left', fontsize=12, color=INK, fontweight='bold')
        ax.set_xlabel('date', color=MUTED, fontsize=9)
        lo, hi = ax.get_xlim()
        ax.set_xlim(lo, hi + (hi - lo) * 0.12)
    axes[0].set_yticks(ys)
    axes[0].set_yticklabels([lab for _, lab in CELLS], fontsize=9.5, color=INK)
    h1 = plt.Line2D([], [], marker='o', ls='', mfc='white', mec=BEFORE, mew=2, ms=8, label='upstream')
    h2 = plt.Line2D([], [], marker='o', ls='', color=AFTER, ms=5, label='all fixes')
    fig.legend(handles=[h1, h2], loc='upper right', frameon=False, fontsize=9.5, ncol=2)
    fig.suptitle('Default presets: AC and ASI barely move with every fix applied', x=0.02, ha='left',
                 fontsize=13, color=INK)
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    fig.savefig(os.path.join(FIG, 'default-dates.png'), dpi=160)
    plt.close(fig)


def showcases():
    n = len(SHOWCASES)
    fig, axes = plt.subplots(2, 3, figsize=(15, 9.5), sharey=True)
    ys = list(range(len(CELLS)))[::-1]
    for ax, (lab, title, setting, b, a) in zip(axes.flat, SHOWCASES):
        style(ax)
        rb, ra = load(f'{lab}.{b}'), load(f'{lab}.{a}')
        dac = [(ra[k]['AC'] - rb[k]['AC']) * 365.25 for k, _ in CELLS]
        dasi = [(ra[k]['ASI'] - rb[k]['ASI']) * 365.25 for k, _ in CELLS]
        h = 0.36
        ax.barh([y + h / 2 for y in ys], dac, height=h, color=BEFORE, label='AC')
        ax.barh([y - h / 2 for y in ys], dasi, height=h, color=AFTER, label='ASI')
        ax.axvline(0, color=MUTED, linewidth=0.8)
        ax.set_title(f'{title}\n{setting}', loc='left', fontsize=10.5, color=INK)
        ax.set_xlabel('days moved by the fix', color=MUTED, fontsize=9)
    axes[0][0].set_yticks(ys)
    axes[0][0].set_yticklabels([l for _, l in CELLS], fontsize=9, color=INK)
    axes[1][0].set_yticks(ys)
    axes[1][0].set_yticklabels([l for _, l in CELLS], fontsize=9, color=INK)
    h, l = axes[0][0].get_legend_handles_labels()
    fig.legend(h, l, loc='upper right', frameon=False, fontsize=10, ncol=2)
    fig.suptitle('Where each fix matters: one website-reachable setting per bug, before vs after',
                 x=0.01, ha='left', fontsize=13, color=INK)
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    fig.savefig(os.path.join(FIG, 'where-fixes-matter.png'), dpi=160)
    plt.close(fig)


if __name__ == '__main__':
    os.makedirs(FIG, exist_ok=True)
    default_dates()
    showcases()
