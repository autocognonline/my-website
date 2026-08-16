from supabase import create_client
import os
import json
import html

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def safe_json_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def score_from_solved_ids(row, key):
    return len(safe_json_list(row.get(key)))


def load_norm(path):
    data = supabase.storage.from_("public").download(path)
    return json.loads(data.decode("utf-8"))


def norm_lookup(norm_data, score, max_score=None):
    if score is None:
        return "-"

    try:
        score = int(score)
    except Exception:
        return "-"

    value = norm_data.get(str(score))
    if value is None:
        return "-"

    # Round to nearest integer
    try:
        value = round(float(value))
    except Exception:
        pass

    if max_score is not None and score >= max_score:
        return f"≥ {value}"

    return str(value)


# ────────────────────────────────────────────────
# 1. Fetch leaderboard users
# ────────────────────────────────────────────────

noais2_res = (
    supabase.table("nocis_global")
    .select(
        "email, score, leaderboard, end, "
        "finished_s, finished_a, "
        "attempt_n, "
        "solved_ids_spatial, solved_ids_numerical, solved_ids_abstract, "
        "solved_ids_verbal, solved_ids_logical"
    )
    .eq("leaderboard", True)
    .execute()
)

nocis_auth_res = (
    supabase.table("nocis_auth")
    .select("email, name")
    .execute()
)

auth_res = (
    supabase.table("auth")
    .select("email, name")
    .execute()
)


# ────────────────────────────────────────────────
# 2. Build email → name map
# Prefer nocis_auth, fallback to auth
# ────────────────────────────────────────────────

names_by_email = {}

for row in auth_res.data or []:
    email = row.get("email")
    name = row.get("name")
    if email and name:
        names_by_email[email] = name

for row in nocis_auth_res.data or []:
    email = row.get("email")
    name = row.get("name")
    if email and name:
        names_by_email[email] = name


# ────────────────────────────────────────────────
# 3. Load norms
# ────────────────────────────────────────────────

norm_data = load_norm("noais2_norm/norm.json")
norm_nviq_data = load_norm("noais2_norm/norm_nviq.json")


# ────────────────────────────────────────────────
# 4. Build leaderboard entries
# ────────────────────────────────────────────────

combined = []

for row in noais2_res.data or []:
    email = row.get("email")
    if not email:
        continue

    name = names_by_email.get(email) or email

    spatial_score = score_from_solved_ids(row, "solved_ids_spatial")
    numerical_score = score_from_solved_ids(row, "solved_ids_numerical")
    abstract_score = score_from_solved_ids(row, "solved_ids_abstract")
    verbal_score = score_from_solved_ids(row, "solved_ids_verbal")
    logical_score = score_from_solved_ids(row, "solved_ids_logical")

    raw_score = row.get("score")

    if raw_score is None:
        raw_score = (
            spatial_score
            + numerical_score
            + abstract_score
            + verbal_score
            + logical_score
        )

    nviq_raw = spatial_score + numerical_score + abstract_score

    has_spatial = bool(row.get("finished_s"))
    has_abstract = bool(row.get("finished_a"))

    # Numerical is finished when attempt_n reaches 0,
    # based on your current table logic.
    has_numerical = row.get("attempt_n") == 0

    has_nviq = has_spatial and has_abstract and has_numerical

    has_full_iq = row.get("end") is not None

    combined.append({
        "email": email,
        "name": name,
        "raw_score": raw_score,
        "nviq_raw": nviq_raw,
        "has_nviq": has_nviq,
        "has_full_iq": has_full_iq,
    })


# ────────────────────────────────────────────────
# 5. Sort by raw score descending
# ────────────────────────────────────────────────

combined.sort(key=lambda x: -(x["raw_score"] or 0))


# ────────────────────────────────────────────────
# 6. Build HTML rows
# ────────────────────────────────────────────────

if combined:
    rows_html = ""

    for idx, entry in enumerate(combined, start=1):
        raw_score = entry["raw_score"] if entry["raw_score"] is not None else "-"

        nviq = (
            norm_lookup(norm_nviq_data, entry["nviq_raw"])
            if entry["has_nviq"]
            else "-"
        )

        iq = (
            norm_lookup(norm_data, entry["raw_score"], max_score=115)
            if entry["has_full_iq"]
            else "-"
        )

        rows_html += (
            "<tr>"
            f"<td>{idx}</td>"
            f"<td>{html.escape(str(entry['name']))}</td>"
            f"<td>{raw_score}</td>"
            f"<td>{nviq}</td>"
            f"<td>{iq}</td>"
            "</tr>\n"
        )
else:
    rows_html = '<tr><td colspan="5">No leaderboard entries yet.</td></tr>'


# ────────────────────────────────────────────────
# 7. Full HTML output
# ────────────────────────────────────────────────

html_output = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NOAIS 2 Leaderboard</title>
  <link rel="icon" href="favicon.png">

  <script async src="https://www.googletagmanager.com/gtag/js?id=G-3XHMB3NM73"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-3XHMB3NM73');
  </script>

  <style>
    body {{
      font-family: Arial, sans-serif;
      background: #f9f9f9;
      margin: 30px;
      text-align: center;
      line-height: 1.6;
    }}

    h2 {{
      font-size: 28px;
      margin-bottom: 20px;
    }}

    p {{
      max-width: 1000px;
      margin: 10px auto;
      font-size: 18px;
      text-align: justify;
    }}

    a {{
      text-decoration: none;
      font-size: 18px;
    }}

    .section {{
      margin: 25px auto;
    }}

    .button {{
      display: inline-block;
      padding: 12px 28px;
      font-size: 20px;
      border-radius: 8px;
      color: white;
      background-color: #0070ba;
      transition: background-color 0.3s ease;
      margin: 5px;
    }}

    .button:hover {{
      background-color: #005c99;
    }}

    .leaderboard-container {{
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      border: 2px solid #000;
      border-radius: 10px;
      background-color: #ffffff;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }}

    table {{
      border-collapse: collapse;
      width: 100%;
      font-family: sans-serif;
    }}

    th, td {{
      border: 1px solid #ddd;
      padding: 10px 16px;
      text-align: center;
    }}

    thead {{
      background-color: #007acc;
      color: white;
    }}

    tbody tr:nth-child(even) {{
      background-color: #eef6fb;
    }}

    tbody tr:hover {{
      background-color: #d8ecf7;
    }}
  </style>
</head>

<body>
  <div class="section">
    <p>Estimated norm data used. NVIQ = Nonverbal IQ, based on the spatial, abstract and numerical subtests.</p>
  </div>

  <div class="leaderboard-container">
    <h2>NOAIS - Form 2 Leaderboard</h2>

    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Raw score</th>
          <th>NVIQ</th>
          <th>IQ (Wechsler scale)</th>
        </tr>
      </thead>

      <tbody>
        {rows_html}
      </tbody>
    </table>
  </div>

  <div class="section">
    <p>The leaderboard is refreshed every 5 days, showcasing the current scores of participants who opted to be listed.</p>
  </div>

  <div class="section">
    <a class="button" href="index.html">Back to main page</a>
  </div>
</body>
</html>
"""


with open("noais2leaderboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)
