import json
import os
import re
from pathlib import Path
import requests
FUNCTION_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/stats-endpoint"
HTML_FILE = Path("stats.html")
def get_statistics():
    response = requests.get(
        FUNCTION_URL,
        timeout=120,
    )

    response.raise_for_status()

    data = response.json()

    if "general" not in data:
        raise RuntimeError(
            "Statistics response does not contain 'general'."
        )

    if "histograms" not in data:
        raise RuntimeError(
            "Statistics response does not contain 'histograms'."
        )

    return data
def update_html(stats):
    html = HTML_FILE.read_text(encoding="utf-8")

    stats_json = json.dumps(
        stats,
        ensure_ascii=False,
        indent=2,
    )

    replacement = f"const STATS_DATA = {stats_json};"

    pattern = r"const\s+STATS_DATA\s*=\s*\{.*?\};"

    new_html, count = re.subn(
        pattern,
        replacement,
        html,
        count=1,
        flags=re.DOTALL,
    )

    if count != 1:
        raise RuntimeError(
            "Could not find the STATS_DATA block in stats.html."
        )

    HTML_FILE.write_text(
        new_html,
        encoding="utf-8",
    )
def main():
    print("Fetching statistics from Supabase...")
    stats = get_statistics()
    print(
        f"Statistics generated at: "
        f"{stats.get('generated_at', 'unknown')}"
    )
    print("Updating stats.html...")
    update_html(stats)
    print("Done.")
if __name__ == "__main__":
    main()
