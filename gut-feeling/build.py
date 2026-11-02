"""Builds the self-contained gut-feeling/index.html from src/.

Every script is concatenated, in this order, into one inline <script>. Later files may use
globals from earlier ones at runtime, but nothing reassigns another file's functions.
"""
from pathlib import Path

root = Path(__file__).resolve().parent
src = root / 'src'
SCRIPTS = [
    'state.js', 'art.js', 'audio.js', 'world.js', 'combat.js', 'minigames.js', 'transitions.js',
    'games/iv.js', 'games/magnet.js', 'games/bricks.js', 'games/race.js', 'games/slice.js', 'games/blaster.js',
    'map.js', 'input.js',
]
html = (src / 'template.html').read_text().replace('/* V2_STYLES */', (src / 'v2.css').read_text())
html += (src / 'dialogs.html').read_text()
js = '\n'.join((src / name).read_text() for name in SCRIPTS)
html += '<script>\n' + js + '\n</script>\n</body>\n</html>\n'
(root / 'index.html').write_text(html)
print(f'Built self-contained index.html ({len(html.encode()):,} bytes).')
