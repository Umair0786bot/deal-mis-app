"""Build dist/deal-mis.artifact.html from dist/deal-mis.html for publishing with the Artifact tool.
The artifact host wraps the file in its own <html>/<head>/<body> and blocks downloads, so the wrappers are stripped
and CSV buttons switch to clipboard mode."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'dist/deal-mis.html').read_text(encoding='utf-8')
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1); body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
head = re.sub(r'<meta[^>]*>\s*', '', head); head = re.sub(r'<link rel="icon"[^>]*>\s*', '', head)
out = root / 'dist/deal-mis.artifact.html'
out.write_text(head.strip() + '\n<script>window.DEAL_MIS_CLIPBOARD=true;</script>\n' + body.strip() + '\n', encoding='utf-8')
print(out, f'{out.stat().st_size/1e6:.2f} MB')
