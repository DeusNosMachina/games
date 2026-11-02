# Gut Feeling architecture

One self-contained `index.html`, built from plain scripts that share globals. No modules, bundler, or npm.

## Build

`python3 gut-feeling/build.py` inlines `src/v2.css` into `src/template.html`, appends `src/dialogs.html`, then concatenates the scripts into one `<script>` in this order:

`state` → `art` → `audio` → `world` → `combat` → `minigames` → `transitions` → `games/iv` → `games/magnet` → `games/bricks` → `games/race` → `games/slice` → `games/blaster` → `input`

At load time a file may only use names from earlier files (each game calls `registerGame` from `state.js`). Everything else runs at runtime, after `input.js` boots the page. No file reassigns another file's functions. Commit `src/` and the rebuilt `index.html` together.

| File | Owns |
| --- | --- |
| `state.js` | Helpers (`$`, `clamp`, `rand`, `dist`, `pick`), `rooms` (name, sub, theme, station), difficulties, tiers, save/load, `state`, `player`, ward globals, `mini`, `gore`, the game registry |
| `art.js` | Drawing primitives, Macy and gremlins, furniture, `roomProps`, cached `roomBg`, shared arcade art (`panel`, `glow`, `drawTimingBar`, `miniBed`, `miniBackdrop`, `arcadeBackdrop`, `softball`, `nutrient`, `vomitArt`) |
| `audio.js` | `tone()`, `sfx()`, `music()`, `audio` |
| `world.js` | Ward HUD, rooms, movement, pickups, effects, `drawWorld`, map, department cards, frame loop and canvas sizing |
| `combat.js` | Weapons, gremlin breeds, waves, attacks, jumping, damage, `drawEnemy` |
| `minigames.js` | Arcade framework: lobby, run lifecycle, HUD, assists, scoring, rewards, results, `drawMini`, pointer plumbing, shared gesture-game helpers |
| `transitions.js` | Briefing, countdown, finish, `lesson()` dispatch, wide-canvas countdown card |
| `games/*.js` | One arcade each: rules, state, art, copy, controls |
| `input.js` | DOM events, shop, difficulty, keyboard, startup |

## Game registry

Each game file calls `const NAME = registerGame({...})`. Hooks are called as `def.hook(...)`; refer to your own definition through the const (for example `MAGNET.info`), not `this`.

| Field | Meaning |
| --- | --- |
| `id` | Room and arcade index, 0–5. Room data lives in `rooms[id]`. |
| `canvas: {w, h}` | Arcade canvas size. IV is 800 × 450; gesture games are 600 × 600. |
| `layout` | `'iv'` or `'gesture'`; becomes `miniDialog.dataset.arcade` for CSS layout. |
| `info` | `{game, genre, headline, desc}` for map, cards and lobby, plus `{goal, control, avoid, cue}` for gesture-game briefings. |
| `tierNotes` | Three lobby strings, one per level. |
| `shiftName` | Optional banner noun for `updateArcade` shifts (default `SHIFT`). |

| Hook | Called | Default |
| --- | --- | --- |
| `init()` | `startMini()`, right after `mini` is reset for a new run. Gesture games call `initArcadeRun(limit)` first. | required |
| `controls()` | Right after `init()`. Call it again yourself whenever button labels change. Uses `setControls([{id, text, key?, hot?}])`. | none |
| `update(dt)` | Every simulation step while `screen === 'play'` and not paused. `dt` ≤ 1/120 s. Clocks (`t`, `total`, `phaseTime`) and `flash`/`inputLock`/`helpTime` are already advanced. Gesture games call `updateArcade(dt, step)`. | required |
| `draw(g)` | Every frame in briefing, intro, play and outro, after the canvas is cleared to `canvas.w × h`. | required |
| `overlay(g)` | After `draw`. Replaces `drawArcadeOverlays` (particles, shift banner, flash banner, countdown card). | shared overlays |
| `action(a)` | `miniAction(a)` during unpaused play: control buttons (`data-action`), keys, swipes. `'assist'` never arrives here. | none |
| `assist()` | After the framework spends an assist (`helps--`, `helpUsed++`, `quality -= 5`, `combo = 0`). Apply the effect and set `mini.flash`/`flashText`. The HUD refreshes after. | required |
| `key(k, e)` | Keydown during unpaused play, except Escape (pause) and E (assist). `k` is lowercase `e.key`. Return true if handled. | none |
| `down(p)`, `move(p, prev)`, `up(cancel)` | Canvas pointer in canvas coordinates. `mini.pointer` is set before `down` and cleared after `up`. `up(true)` means lost or interrupted: never act on it. A game with none of the three ignores canvas presses. | none |
| `lesson()` | Each briefing. Returns `{title, goal, control, avoid, demo, cue}`; `demo` is a `.control-demo` CSS class. | required |
| `statLabel()`, `stat()`, `tactics()`, `assistText()` | Every HUD refresh (about 12 per second) and on screen changes. `assistText` is the whole assist button label. | required |
| `livesLabel()`, `lives()` | HUD refresh. | `'OOPS ALLOWANCE'`, hearts left |
| `quality()` | On a win; returns 0–100 (medal: 88+ gold, 68+ silver). | `arcadeQuality()` |
| `onWin()` | After the reward is granted. May return the result text. | random quip |
| `onLose(reason)` | On a loss, before the result copy. May push `gore` particles; may return `{gory, medal, heading, text}`. | standard copy |
| `resultArt(g)` | Result canvas (800 × 220) after the shared bedside scene. Return true to replace the default win/lose foreground. | none |
| `scene(g, w, h)` | Department card (260 × 135) and lobby preview (420 × 240). | required |
| `shiftLevel()` | Inside `updateArcade`: current shift 0–2. | thirds of `limit` |
| `shiftMessage(shift)` | When the shift rises; returned text replaces the instruction line. | none |
| `timeUp()` | Inside `updateArcade` once `phaseTime >= limit`. Must call `finishMini`. | `arcadeTimeUp()`: win if `got >= goal` |

Framework helpers for games: `praise(points, precision)`, `miniOops(message, amount)`, `finishMini(win, reason)`, `setInstructions(text)`, `setControls(buttons)`, `prepareBriefing()` (a paused briefing between phases, as IV does), `initArcadeRun(limit)`, `updateArcade(dt, step)`, `arcadeBurst(x, y, color, n)`, `arcadeQuality(penalty)`, `arcadeTimeUp()`, `ARCADE_QUOTA_MISSED`.

## The `mini` run object

`openMini()` and `startMini()` replace `mini` wholesale, so per-run state never leaks between runs.

Framework-owned (read freely, do not repurpose):
- Lifecycle: `open`, `screen` (`lobby`, `briefing`, `intro`, `play`, `outro`, `result`), `id`, `tier`, `forced` (mandatory IV recovery), `approach`, `initialized`, `paused`, `countdown`, `transition`, `demoTime`, `pendingFinish`.
- Rules and clocks: `rules` (difficulty plus `misses` and `coins`), `t`, `total`, `phaseTime`, `hudClock`, `inputLock`, `helpTime`.
- Scoring: `miss`, `quality`, `score`, `combo`, `maxCombo`, `precisions`, `helps`, `helpUsed`, `win`, `grade`, `qualityFinal`, `reward`, `resultT`.
- Input: `pointer` (`x`, `y`, `startX`, `startY`, `lastX`, `lastY`, `startT`, `stroke`), `held` (HOLD button or a key a game marks held), `fireHeld` (FIRE button). Space keyup and every pause or dialog clear both.
- Gesture runs (`initArcadeRun`): `got`, `shift`, `notice`, `fx`, `trail`, `slow`. Games add to `got` and spawn `fx` through `arcadeBurst`.

Game-owned: `limit` (set it in `init`; the HUD clock and default `timeUp` use it), `goal`, `phase`, `round`, `flash`/`flashText` (write when showing a banner), and any new field the game needs. Prefer distinctive names for new fields.

## Sound vocabulary

`sfx(name, opts)` maps names onto `tone()` beeps today: `ui`, `hit`, `swing`, `jump`, `dash`, `hurt`, `coin`, `pickup`, `eat`, `enemyDie`, `split`, `blob`, `throw`, `bounce`, `explode`, `shot`, `reload`, `slice`, `bomb`, `combo`, `fever`, `drip`, `catch`, `pump`, `wave`, `clear`, `win`, `lose`, `countdown`, `go`, `stun`, `shield`, `trap`, `miss`. `swing` and `slice` read `opts.combo`; `combo` and `drip` read `opts.count`. Existing game code still calls `tone()` directly; the audio pass will migrate it. `music(name)` is a no-op placeholder.

## Parallel work rules

- A game agent edits only `src/games/<name>.js` and `tests/game-<name>.cjs`. Names: `iv`, `magnet`, `bricks`, `race`, `slice`, `blaster`.
- Every top-level name is global across all files. Prefix new ones with your game (`magnetPulse`, `SLICE_LIMIT`) and never redefine or reassign a name from another file.
- Shared files (`state`, `art`, `audio`, `world`, `combat`, `minigames`, `transitions`, `input`, the HTML/CSS, `build.py`, `tests/harness.cjs`) have one owner at a time. If a game needs a framework change, report it rather than editing the shared file.
- Art used by one game belongs in that game's file. Promote it to `art.js` only when a second consumer appears.
- A game's title and copy live in its `info`; room data (`rooms`, `roomProps`) does not belong to any game.
- Keep runs reproducible for tests: use `rand()`/`pick()` (tests seed `Math.random`) and the `dt` you are given, never wall-clock time.

## Tests

```sh
node gut-feeling/tests/run-all.cjs      # build, then every tests/*.cjs except the harness, in name order
python3 gut-feeling/build.py            # build only
node gut-feeling/tests/smoke.cjs        # one file (build first)
```

`tests/harness.cjs` runs the built `index.html` in a Node VM with stub DOM and canvas objects and exports `run(code)`, `close()` (closes dialogs and resets the arcade screen), `nodes`, `events`, `box`, and `assert`. Each test file gets a fresh page because `run-all` starts it in its own process. `verify.cjs` covers mechanics rules, `playthrough.cjs` wins all 54 game/level/difficulty combinations with input-only controllers, and `smoke.cjs` checks the registry and draws every game and room. A new `tests/game-<name>.cjs` is picked up automatically.
