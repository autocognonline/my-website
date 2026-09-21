import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from collections import Counter
from html import escape
from supabase import create_client, Client


# ============================================================
# Configuration
# ============================================================

BASE = "https://nsl36.netlify.app"

SUPABASE_URL = os.environ["SUPABASE_URL_2"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY_2"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ============================================================
# Get member links
# ============================================================

def get_member_links():
    url = f"{BASE}/cognimetrica/society"

    r = requests.get(url, timeout=20)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")

    links = []

    for a in soup.select("table td a"):
        href = a.get("href")

        if href and "/cognimetrica/members/" in href:
            full = urljoin(BASE, href)
            links.append(full)

    return links


# ============================================================
# Extract tests from a member page
# ============================================================

def extract_tests(member_url):
    r = requests.get(member_url, timeout=20)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")

    results = []

    scores_header = soup.find("h2", string="Scores")

    if not scores_header:
        return results

    table = scores_header.find_next("table")

    if not table:
        return results

    for row in table.find_all("tr")[1:]:
        cols = row.find_all("td")

        if len(cols) < 2:
            continue

        test_cell = cols[1]
        a = test_cell.find("a")

        if a:
            name = a.text.strip()
            link = urljoin(member_url, a.get("href"))
        else:
            name = test_cell.text.strip()
            link = None

        results.append((name, link))

    return results


# ============================================================
# Collect favorite test information
# ============================================================

def collect():
    member_links = get_member_links()

    counter = Counter()
    link_map = {}

    for link in member_links:
        tests = extract_tests(link)

        for name, test_link in tests:

            if test_link:
                counter[name] += 1

                if name not in link_map:
                    link_map[name] = test_link

    return counter, link_map


# ============================================================
# Get all tests from Supabase
# ============================================================

def get_all_tests():
    response = (
        supabase
        .table("tests")
        .select("test_name, author")
        .order("test_name", desc=False)
        .execute()
    )

    tests = response.data or []

    # Exclude subtests
    tests = [
        test for test in tests
        if not test["test_name"].endswith("_Subtest")
    ]

    return tests


# ============================================================
# Generate HTML page
# ============================================================

def generate_html(counter, link_map, all_tests):

    html = ["""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">

  <title>Favorite High Range Tests</title>

  <style>

  body {
    font-family: Arial, sans-serif;
    background: #f9f9f9;
    margin: 30px;
    text-align: center;
    line-height: 1.6;
  }

  h1 {
    font-size: 36px;
    margin-bottom: 30px;
  }

  p {
    max-width: 1000px;
    margin: 10px auto;
    font-size: 18px;
    text-align: justify;
  }

  a {
    text-decoration: none;
    font-size: 18px;
  }

  .section {
    margin: 50px auto;
  }

  ul {
    max-width: 800px;
    margin: 20px auto;
    text-align: left;
    font-size: 17px;
    line-height: 1.5;
    padding-left: 20px;
  }

  li {
    padding: 2px 0;
  }

  hr {
    border: none;
    height: 1px;
    background-color: #ccc;
    margin: 60px auto;
    width: 80%;
  }

  .tabs {
    width: 80%;
    margin: 0 auto 30px auto;
    border-bottom: 2px solid #ddd;
  }

  .tab-button {
    border: none;
    background: #e9e9e9;
    padding: 12px 28px;
    margin-right: 4px;
    font-size: 18px;
    cursor: pointer;
    border-radius: 8px 8px 0 0;
  }

  .tab-button:hover {
    background: #ddd;
  }

  .tab-button.active {
    background-color: #0070ba;
    color: white;
  }

  .tab-content {
    display: none;
  }

  .tab-content.active {
    display: block;
  }

  .button {
    display: inline-block;
    padding: 12px 28px;
    font-size: 20px;
    border-radius: 8px;
    color: white;
    background-color: #0070ba;
    transition: background-color 0.3s ease;
    margin: 5px;
    min-width: 150px;
  }

  .button:hover {
    background-color: #005c99;
  }

  .table-container {
    max-width: 1200px;
    margin: 30px auto;
    text-align: left;
  }

  .search-box {
    width: 100%;
    max-width: 600px;
    box-sizing: border-box;
    padding: 12px;
    margin: 0 auto 20px auto;
    display: block;
    font-size: 17px;
    border: 1px solid #ccc;
    border-radius: 6px;
  }

  .tests-table-wrapper {
    max-height: 70vh;
    overflow-y: auto;
    border: 1px solid #ddd;
    background: white;
  }

  .tests-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 15px;
  }

  .tests-table th {
    position: sticky;
    top: 0;
    background: #0070ba;
    color: white;
    padding: 10px;
    text-align: left;
    z-index: 1;
    border-right: 1px solid #ddd;
  }

  .tests-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #ddd;
    border-right: 1px solid #ddd;
  }

  .tests-table th:last-child,
  .tests-table td:last-child {
    border-right: none;
  }

  .tests-table tr:nth-child(even) {
    background: #f5f5f5;
  }

  .tests-table tr.visible-even {
    background: white;
  }

  .tests-table tr.visible-odd {
    background: #f5f5f5;
  }

  .tests-table tr.visible-even:hover,
  .tests-table tr.visible-odd:hover,
  .tests-table tr:hover {
    background: #e8f3fa;
  }

  .author {
    color: #555;
  }

  @media (max-width: 700px) {

    body {
      margin: 15px;
    }

    h1 {
      font-size: 28px;
    }

    .tab-button {
      padding: 10px 15px;
      font-size: 16px;
    }

    .tests-table {
      font-size: 14px;
    }

    .tests-table th,
    .tests-table td {
      padding: 7px;
    }

  }

  </style>

  <!-- Google tag (gtag.js) -->

  <script async src="https://www.googletagmanager.com/gtag/js?id=G-3XHMB3NM73"></script>

  <script>

    window.dataLayer = window.dataLayer || [];

    function gtag(){
      dataLayer.push(arguments);
    }

    gtag('js', new Date());

    gtag('config', 'G-3XHMB3NM73', {
      'send_page_view': true,
      'allow_google_signals': true
    });

  </script>

  <link rel="icon" href="favicon.png">

</head>

<body>

<h1>Cognitive Tests</h1>

<div class="tabs">

  <button    class="tab-button active"    onclick="openTab('favorites', this)"  >
    Favorite High Range Tests
  </button>

  <button    class="tab-button"    onclick="openTab('all-tests', this)"  >
    All Tests
  </button>
</div>

<div id="favorites" class="tab-content active">


  <div class="section" style="max-width: 1000px;">

    <p>
      If you are new to high range tests, or simply want to explore new ones,
      please consider the list below.
    </p>


    <p>
      It is a compilation of tests taken by members of the
      <a
        href="https://nsl36.netlify.app/cognimetrica/society"
        target="_blank"
      >
        Cognimetrica Society
      </a>
      upon joining the society, inspired by Ivan Ivec's
      <a
        href="https://www.ultimaiq.net/ftests.htm"
        target="_blank"
      >
        World Favorite IQ Tests
      </a>
      list.
    </p>


    <p>
      <strong>
        (with links and number of uses in parentheses)
      </strong>
    </p>

  </div>


  <hr>


  <div class="section">

    <ul>
"""]


    # ========================================================
    # Favorite tests list
    # ========================================================

    for name, count in sorted(
        counter.items(),
        key=lambda x: (-x[1], x[0].lower())
    ):

        link = link_map.get(name)

        if not link:
            continue

        safe_name = escape(name)
        safe_link = escape(link, quote=True)

        html.append(
            f'      <li>'
            f'<a href="{safe_link}" target="_blank">'
            f'{safe_name}'
            f'</a> ({count})'
            f'</li>'
        )


    html.append("""
    </ul>

  </div>


  <p>
    This list is automatically updated every 30 days.
  </p>


</div>

<div id="all-tests" class="tab-content">


  <div class="section" style="max-width: 1000px;">

    <p>
      Complete list of tests in the database.
      You can find a great number of tests to take in this table but some of them are not scored anymore.
    </p>

  </div>


  <div class="table-container">


    <input
      type="text"
      id="testSearch"
      class="search-box"
      placeholder="Search by test name or author..."
      onkeyup="filterTests()"
    >


    <div class="tests-table-wrapper">

      <table class="tests-table">

        <thead>

          <tr>
            <th>Test name</th>
            <th>Author</th>
          </tr>

        </thead>


        <tbody id="testsTableBody">
""")


    # ========================================================
    # All tests table
    # ========================================================

    # Sort again in Python as an additional guarantee that the
    # generated HTML is alphabetically ordered.
    all_tests_sorted = sorted(
        all_tests,
        key=lambda test: (test.get("test_name") or "").lower()
    )


    for test in all_tests_sorted:

        name = escape(test.get("test_name") or "")
        author = escape(test.get("author") or "")

        html.append(
            f"""          <tr>
            <td>{name}</td>
            <td class="author">{author}</td>
          </tr>
"""
        )


    html.append("""
        </tbody>

      </table>

    </div>

  </div>

</div>

<hr>

<div class="section">

  <a
    class="button"
    href="index.html"
  >
    Back to main page
  </a>

</div>


<script>

function openTab(tabName, button) {

  const tabs = document.querySelectorAll(".tab-content");
  tabs.forEach(function(tab) {
    tab.classList.remove("active");
  });
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach(function(btn) {
    btn.classList.remove("active");
  });
  document.getElementById(tabName).classList.add("active");
  button.classList.add("active");
}

function filterTests() {
  const input = document.getElementById("testSearch");
  const filter = input.value.toLowerCase();
  const rows = document
    .getElementById("testsTableBody")
    .getElementsByTagName("tr");

  let visibleRow = 0;

  for (let i = 0; i < rows.length; i++) {

    const text = rows[i].textContent.toLowerCase();

    if (text.includes(filter)) {

      rows[i].style.display = "";
      if (visibleRow % 2 === 0) {
        rows[i].classList.add("visible-even");
        rows[i].classList.remove("visible-odd");
      } else {
        rows[i].classList.add("visible-odd");
        rows[i].classList.remove("visible-even");
      }

      visibleRow++;

    } else {

      rows[i].style.display = "none";
      rows[i].classList.remove("visible-even");
      rows[i].classList.remove("visible-odd");
    }
  }
}


</script>


</body>
</html>
""")


    # ========================================================
    # Write HTML file
    # ========================================================

    with open("favTests.html", "w", encoding="utf-8") as f:
        f.write("\n".join(html))


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":

    counts, links = collect()
    all_tests = get_all_tests()
    generate_html(
        counts,
        links,
        all_tests
    )
    print("Done.")
