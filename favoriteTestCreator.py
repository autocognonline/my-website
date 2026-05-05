import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from collections import Counter

BASE = "https://nsl36.netlify.app"

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


def generate_html(counter, link_map):
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
      </style>
      <!-- Google tag (gtag.js) -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-3XHMB3NM73"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-3XHMB3NM73', {
          'send_page_view': true,
          'allow_google_signals': true
        });
      </script>

      <link rel="icon" href="favicon.png">
    </head>
    <body>
    
      <h1>Favorite High Range Tests</h1>
    
      <div class="section" style="max-width: 1000px;">
        <p>
          If you are new to high range tests, or simply want to explore new ones,
          please consider the list below.
        </p>
    
        <p>
          It is a compilation of the tests that members of the
          <a href="https://nsl36.netlify.app/cognimetrica/society" target="_blank">
            Cognimetrica Society
          </a>
          used to join the society, inspired by Ivan Ivec’s
          <a href="https://www.ultimaiq.net/ftests.htm" target="_blank">
            World Favorite IQ Tests
          </a>
          list.
        </p>
    
        <p><strong>(with links and number of votes in parentheses)</strong></p>
      </div>
    
      <hr>
    
      <div class="section">
        <ul>
    """]
    
    for name, count in sorted(counter.items(), key=lambda x: (-x[1], x[0].lower())):
      link = link_map.get(name)

      if not link:
          continue  # skip tests without a link

      html.append(f'      <li><a href="{link}" target="_blank">{name}</a> ({count})</li>')
    
    html.append("""    </ul>
      </div>
    
      <p>This list is automatically updated once a month.</p>
    
      <hr>
    
      <div class="section">
        <a class="button" href="index.html">Back to main page</a><br><br>
      </div>
    
    </body>
    </html>
    """)

    with open("favTests.html", "w", encoding="utf-8") as f:
        f.write("\n".join(html))

if __name__ == "__main__":
    counts, links = collect()
    generate_html(counts, links)
    print("Done.")
