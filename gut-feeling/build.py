from pathlib import Path
root = Path(__file__).resolve().parent
src = root / 'src'
html = (src/'template.html').read_text().replace('/* V2_STYLES */', (src/'v2.css').read_text())
html += (src/'dialogs.html').read_text()
js = '\n'.join((src/name).read_text() for name in ['state.js','art.js','world.js','minigames.js','transitions.js','mini-art.js','smooth.js','challenge-art.js','combat.js','arcade.js','arcade-art.js','bedside.js','input.js'])
html += '<script>\n'+js+'\n</script>\n</body>\n</html>\n'
(root/'index.html').write_text(html)
print(f'Built self-contained index.html ({len(html.encode()):,} bytes).')
