import os
import html
from collections import defaultdict
from supabase import create_client
import math

OUTPUT_FILE = "contributorLeaderboard.html"
INTERNAL_AUTHOR = "M.-A. Nydegger"

SUPABASE_URL_2 = os.environ["SUPABASE_URL_2"]
SUPABASE_SERVICE_KEY_2 = os.environ["SUPABASE_SERVICE_KEY_2"]

supabase = create_client(
    SUPABASE_URL_2,
    SUPABASE_SERVICE_KEY_2
)

def fetch_all(table, select="*", filters=None, page_size=1000):
    rows = []
    start = 0

    while True:
        query = supabase.table(table).select(select)

        if filters:
            for method, args in filters:
                query = getattr(query, method)(*args)

        response = query.range(start, start + page_size - 1).execute()
        batch = response.data or []
        rows.extend(batch)

        if len(batch) < page_size:
            break

        start += page_size

    return rows


def main():
    # Users who opted into leaderboard
    submitters = fetch_all(
        "score_submitters",
        select="email, leaderboard",
        filters=[("eq", ("leaderboard", True))]
    )

    opted_emails = [row["email"] for row in submitters]

    if not opted_emails:
        leaderboard_rows = []
    else:
        # Candidate names
        candidates = fetch_all(
            "candidates",
            select="email, name",
        )

        name_by_email = {
            row["email"]: row.get("name") or row["email"]
            for row in candidates
            if row["email"] in opted_emails
        }

        # Internal tests = your tests/subtests
        tests = fetch_all(
            "tests",
            select="test_id, author"
        )

        internal_test_ids = {
            row["test_id"]
            for row in tests
            if INTERNAL_AUTHOR.lower() in str(row.get("author") or "").lower()
        }

        internal_taken = defaultdict(int)
        known_external = defaultdict(int)

        test_results = fetch_all(
            "test_results",
            select="email, test_id"
        )

        for row in test_results:
            email = row["email"]
            test_id = row["test_id"]

            if email not in opted_emails:
                continue

            if test_id in internal_test_ids:
                internal_taken[email] += 1
            else:
                known_external[email] += 1

        # External scores shared = approved pending submissions
        external_shared = defaultdict(int)

        submissions = fetch_all(
            "pending_score_submissions",
            select="email, status"
        )

        for row in submissions:
            if (
                row["email"] in opted_emails
                and row.get("status") == "approved"
            ):
                external_shared[row["email"]] += 1

        leaderboard_rows = []

        for email in opted_emails:
          taken = internal_taken[email]
          shared = external_shared[email]
          known = known_external[email]

          score = math.floor((taken * (3 * shared + known + 1))**0.5 + 0.5)

          leaderboard_rows.append({
              "name": name_by_email.get(email, email),
              "score": score,
              "taken": taken,
              "shared": shared,
              "known": known,
          })

        leaderboard_rows.sort(
            key=lambda row: (
                -row["score"],
                -row["taken"],
                -row["shared"],
                -row["known"],
                row["name"].lower()
            )
        )

    table_rows = "\n".join(
        f"""
        <tr>
          <td>{rank}</td>
          <td>{html.escape(row["name"])}</td>
          <td>{row["score"]}</td>
          <td>{row["taken"]}</td>
          <td>{row["shared"]}</td>
          <td>{row["known"]}</td>
        </tr>
        """
        for rank, row in enumerate(leaderboard_rows, start=1)
    )

    if not table_rows:
      table_rows = """
      <tr>
        <td colspan="6">No listed contributors yet.</td>
      </tr>
      """

    html_output = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Contributors Leaderboard</title>
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

    h1 {{
      font-size: 36px;
      margin-bottom: 25px;
    }}

    h2 {{
      font-size: 28px;
      margin-bottom: 20px;
    }}

    p {{
      max-width: 1200px;
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
      max-width: 1200px;
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

    .note {{
      font-size: 16px;
      color: #555;
      text-align: center;
    }}
  </style>
</head>

<body>
  <h1>Project Contributors Leaderboard</h1>

  <div class="section">
    <p>
      This leaderboard recognizes the participants who contribute the most to the project by taking tests on this website
      and by sharing verified scores from other cognitive tests.
    </p>

    <p>
      <strong>Contribution score = √(Internal tests taken × (3 × External scores shared + Total external scores + 1)), rounded to the nearest whole number.</strong>
    </p>

    <p>
      Standalone tests and subtests are counted separately. For example, completing a test
      composed of 5 subtests counts as 6 completed tests in total.
      Combined tests count once.
    </p>
  </div>

  <div class="leaderboard-container">
    <h2>Leaderboard</h2>

    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Contribution score</th>
          <th>Internal tests taken</th>
          <th>External scores shared</th>
          <th>Total external scores</th>
        </tr>
      </thead>

      <tbody>
        {table_rows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <p class="note">
      The leaderboard is refreshed every 2 days and includes only participants who opted to be listed.
    </p>
  </div>

  <div class="section">
    <a class="button" href="previousScores.html">Submit Scores</a>
    <a class="button" href="index.html">Back to main page</a>
  </div>
</body>
</html>
"""

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html_output)

    print(f"Generated {OUTPUT_FILE} with {len(leaderboard_rows)} listed contributors.")


if __name__ == "__main__":
    main()
