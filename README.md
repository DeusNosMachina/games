# Games

Small browser games, built to play on a phone or a laptop. Each game lives in its own folder; the root page is the playable catalog.

**[Open the games catalog](https://deusnosmachina.github.io/games/)**

## Game index

| Game | What it is | Play | Project guide |
| --- | --- | --- | --- |
| **Operation: Gut Feeling** | Macy's hospital adventure: gut gremlins, six arcade games with three levels each, a ward that fights back, Ralph the boss, and a discharge passport. | [Play](https://deusnosmachina.github.io/games/gut-feeling/) | [README](gut-feeling/README.md) |

## Repository index

```text
index.html             Playable game catalog
.nojekyll              Serve the static files directly
README.md              This index and repository guide
gut-feeling/
  index.html           Complete, standalone playable game
  README.md            Controls, mechanics, development, and limitations
  build.py             Combines the editable source into index.html
  src/                 HTML, CSS, canvas art, and game logic
  tests/               Regression checks and complete-run simulations
```

## Run locally

From this folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. The game itself can also be opened directly as `gut-feeling/index.html` and does not need a server or an internet connection after loading.

## Update a game

Edit its source, follow its README's build and verification commands, and commit the generated HTML along with the source. GitHub Pages serves the `main` branch from the repository root. Changes pushed to `main` publish the catalog and game folders together.

For a new game, create another folder with an `index.html`, add a project README, and add it to both the table above and the root `index.html` catalog. Keep links relative so the catalog works under `/games/` and on a local server.

## Current status

Operation: Gut Feeling is at v0.6: six arcade games with teaching and real levels, a ward with persistent clears and a boss, synthesized music, fullscreen play on phones, a Daily Dose, and a gift shop. Progress is stored in the player's browser; there is no account, backend, cloud save, analytics, or paid content. Bots prove every level is winnable; a human playtest still decides whether the quotas feel right.
