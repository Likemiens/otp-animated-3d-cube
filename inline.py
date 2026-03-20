import os
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
with open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()
html = html.replace('<script type="module" src="main.js"></script>', f'<script type="module">\n{js}\n</script>')
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
