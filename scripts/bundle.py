"""Bundle the Deal MIS into one self-contained HTML file (dist/deal-mis.html).
Inlines the stylesheet, every data file and every script in the order index.html loads them.
Google Fonts stays as a link (allowed by the artifact CSP; falls back to system fonts offline)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
def inline_css(m):
    return '<style>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '\n</style>'
def inline_js(m):
    src = (root / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script')
    return '<script>\n' + src + '\n</script>'
html = re.sub(r'<link rel="stylesheet" href="(assets/[^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
out = root / 'dist' / 'deal-mis.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(out, f'{out.stat().st_size/1e6:.2f} MB')
