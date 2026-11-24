import numpy as np
import json
import tkinter as tk
from tkinter import filedialog

def item_disc(rawData, decimals=9, min_correct=3, min_incorrect=3):
    X = np.asarray(rawData, dtype=float)
    if X.ndim != 2:
        raise ValueError("Raw data must be a 2D array.")
    if X.min() < 0 or X.max() > 1:
        raise ValueError("Item scores must be in [0, 1]; divide by each item's max points.")
    N, k = X.shape
    total = X.sum(axis=1)
    quality = np.full(k, np.nan)
    for i in range(k):
        x = X[:, i]
        if np.ptp(x) == 0:
            continue
        correct = np.count_nonzero(x == 1.0)
        incorrect = np.count_nonzero(x == 0.0)
        # Require sufficient observations at both extremes
        if correct < min_correct or incorrect < min_incorrect:
            continue
        K = x.sum()
        rest = np.round(total - x, decimals)
        _, inv, counts = np.unique(-rest, return_inverse=True, return_counts=True)
        before = np.cumsum(counts) - counts
        w = np.clip((K - before) / counts, 0.0, 1.0)[inv]
        R = x @ w
        xs = np.sort(x)[::-1]
        m = int(np.floor(K + 1e-9))
        frac = max(K - m, 0.0)
        R_max = xs[:m].sum()
        if m < N:
            R_max += frac * xs[m]
        expected = K * K / N
        denominator = R_max - expected
        if denominator <= 1e-12:
            continue
        quality[i] = (R - expected) / denominator
    return quality

def main():
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(title="Select file", filetypes=[("JSON files", "*.json"), ("All files", "*.*")])
    root.destroy()
    if not file_path:
        return
    with open(file_path, "r", encoding="utf-8") as f:
        raw_json = json.load(f)
    max_items = max(len(row) for row in raw_json)
    rawData = np.full((len(raw_json), max_items), np.nan)
    for i, row in enumerate(raw_json):
        rawData[i, :len(row)] = row
    discrimination = item_disc(rawData, min_correct=3, min_incorrect=3)
 
    print("DISCRIMINATION")
    print(f"Candidates: {len(rawData)}")
    print(f"Number of item positions: {max_items}")
    print()
    print(f"{'Item':>6} {'Discrimination':>18}")

    for i in range(max_items):
        q = discrimination[i]
        if np.isnan(q):
            q_text = "Undefined"
        else:
            q_text = f"{q:.9f}"
        print(
            f"{i + 1:>6} "
            f"{q_text:>18}"
        )

if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
