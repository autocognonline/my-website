from supabase import create_client
import os
import json

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

try:
    norm_file = supabase.storage.from_("naitor_questions").download("norm.json")
    norm_data = {int(k): v for k, v in json.loads(norm_file.decode("utf-8")).items()}
except Exception as e:
    print("Error fetching norm.json:", e)
    norm_data = {}

def score_to_iq(score):
    if not score:
        return "N/A"

    iq = norm_data.get(score, "N/A")

    if isinstance(iq, (int, float)):
        iq = round(iq)

    return iq

def compute_attempts_left(attempts):
    if not attempts:
        return 0

    if isinstance(attempts, str):
        try:
            attempts = json.loads(attempts)
        except Exception:
            return 0

    if not isinstance(attempts, list):
        return 0

    return sum(int(x) for x in attempts)

res = (
    supabase.table("data_naitor")
    .select("name, score, contest, leaderboard, attempts")
    .execute()
)

rows = res.data

contest_rows = [
    r for r in rows
    if r.get("contest") and r.get("name") and len(r["name"]) >= 2
]

contest_rows.sort(
    key=lambda r: (
        -(r.get("score") or 0),
        -compute_attempts_left(r.get("attempts"))
    )
)

contest_rank_map = {
    r["name"]: i
    for i, r in enumerate(contest_rows, 1)
}

entries = []

for r in rows:
    name = r.get("name")
    if not name or len(name) < 2:
        continue
    if not r.get("leaderboard"):
        continue

    score = r.get("score") or 0
    iq = score_to_iq(score)
    if score == 80 and isinstance(iq, (int, float)):
        iq = f"≥ {iq}"

    attempts_left = compute_attempts_left(r.get("attempts"))
    contest_rank = contest_rank_map.get(name, " ") if r.get("contest") else " "

    entries.append({
        "name": name,
        "score": score,
        "iq": iq,
        "contest_rank": contest_rank,
        "attempts_left": attempts_left,
    })

entries.sort(
    key=lambda r: (
        -r["score"],
        -r["attempts_left"]
    )
)

rows_html = "\n".join(
    f"<tr><td>{i}</td>"
    f"<td>{e['name']}</td>"
    f"<td>{e['score']}</td>"
    f"<td>{e['iq']}</td>"
    f"<td>{e['contest_rank']}</td></tr>"
    for i, e in enumerate(entries, 1)
)

# (rest of the HTML is unchanged from what you already have)
html_output = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NAITOR Leaderboard</title>
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
      background-color: #f9f9f9;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }}
    .leaderboard-container::-webkit-scrollbar {{
      height: 6px;
    }}
    .leaderboard-container::-webkit-scrollbar-thumb {{
      background: rgba(0,0,0,0.2);
      border-radius: 3px;
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

    .orange-header {{
      background-color: rgb(243, 174, 45) !important;
      color: white;
    }}
  </style>
</head>
<body>
  <div class="section">
    <p>First preliminary norm data used.</p>
  </div>
  <div class="leaderboard-container">
    <h2>NAITOR Leaderboard</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Raw score</th>
          <th>I.Q. (Wechsler scale)</th>
          <th class="orange-header">Contest rank</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
  </div>

  <div class="section">
    <p>The leaderboard is refreshed every 5 days, showcasing the scores of participants who opted to be listed.</p>
  </div>
  
  <div class="section">
    <a class="button" href="https://nsl36.netlify.app/events/naitor-certamen-ingenii">Contest Information</a>
  </div>

  <div class="section">
    <a class="button" href="index.html">Back to main page</a>
  </div>
</body>
</html>
"""

with open("naitorleaderboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)









