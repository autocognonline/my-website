import numpy as np
import json
import tkinter as tk
from tkinter import filedialog

def item_disc(rawData, decimals=9):
    X = np.asarray(rawData, dtype=float)
    if X.min() < 0 or X.max() > 1:
        raise ValueError("Item scores must be in [0, 1]; divide by each item's max points.")
    N, k = X.shape
    total = X.sum(axis=1)
    quality = np.full(k, np.nan)
    for i in range(k):
        x = X[:, i]
        if np.ptp(x) == 0:
            continue                                   # constant item: undefined
        K = x.sum()                                    # total credit, not necessarily an integer
        rest = np.round(total - x, decimals)
        # Fill the "top K" mass from the best rest score down; tied testees share the mass.
        _, inv, counts = np.unique(-rest, return_inverse=True, return_counts=True)
        before = np.cumsum(counts) - counts            # mass already used by better groups
        w = np.clip((K - before) / counts, 0.0, 1.0)[inv]
        R = x @ w
        # Largest possible R: put the full weight on the highest item scores
        xs = np.sort(x)[::-1]
        m = int(np.floor(K + 1e-9))
        frac = max(K - m, 0.0)
        R_max = xs[:m].sum() + (frac * xs[m] if m < N else 0.0)
        expected = K * K / N                           # R under independence
        quality[i] = (R - expected) / (R_max - expected)
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
    discrimination = item_disc(rawData)
 
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
        input("Press Enter to exit...")