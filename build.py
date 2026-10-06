"""Build the portfolio page.

index.html              the standalone site that GitHub Pages serves
octavio-portfolio.html  the same page without a document shell, for the claude.ai preview
"""
import pathlib

SITE = "https://octagonn.github.io/"
DESC = "Software and security engineer. Shipped apps, security tooling, and a 3D tour of my homelab."

d = pathlib.Path(__file__).parent
page = (d / "src.html").read_text(encoding="utf-8").replace("/*APPJS*/", (d / "app.js").read_text(encoding="utf-8"))
for i in (1, 3, 4):
    page = page.replace("{{SHOT%d}}" % i, (d / f"img/shot{i}.b64").read_text())
(d / "octavio-portfolio.html").write_text(page, encoding="utf-8")

head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F1EFEA" media="(prefers-color-scheme: light)">
<link rel="canonical" href="{SITE}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}">
<meta property="og:title" content="Octavio Albuquerque">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="{SITE}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Octavio Albuquerque, software and security engineer">
<meta name="twitter:card" content="summary_large_image">
"""
cut = page.index("<nav")
body = page[:cut].replace('<div class="progress"', '</head>\n<body>\n<div class="progress"', 1) + page[cut:]
(d / "index.html").write_text(head + body + "\n</body>\n</html>\n", encoding="utf-8")
print("ok", len(page) // 1024, "KB")
