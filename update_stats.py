import json
import os
from pathlib import Path

import requests


FUNCTION_URL = os.environ["SUPABASE_FUNCTION_URL"]
API_SECRET = os.environ["STATS_API_SECRET"]

HTML_FILE = Path("stats.html")


def get_statistics():
    response = requests.get(
        FUNCTION_URL,
        headers={
            "x-stats-secret": API_SECRET
        },
        timeout=120,
    )

    response.raise_for_status()

    data = response.json()

    if "general" not in data:
        raise RuntimeError("Statistics response does not contain 'general'.")

    if "histograms" not in data:
        raise RuntimeError("Statistics response does not contain 'histograms'.")

    return data


def update_html(stats):
    html = HTML_FILE.read_text(encoding="utf-8")

    marker = "const STATS_DATA = __STATS_DATA__;"

    if marker not in html:
        raise RuntimeError(
            "Could not find statistics marker in stats.html."
        )

    stats_json = json.dumps(
        stats,
        ensure_ascii=False,
        indent=2,
    )

    replacement = f"const STATS_DATA = {stats_json};"

    html = html.replace(marker, replacement)

    HTML_FILE.write_text(
        html,
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
