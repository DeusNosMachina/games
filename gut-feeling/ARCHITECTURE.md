# Gut Feeling architecture

One self-contained `index.html`, built from plain scripts that share globals. No modules, bundler, or npm.

## Build

`python3 gut-feeling/build.py` inlines `src/v2.css` into `src/template.html`, appends `src/dialogs.html`, then concatenates the scripts into one `<script>` in this order:

`state` → `art` → `rowdy` → `tvlate` → `dream` → `audio` → `world` → `combat` → `hallway` → `discharge` → `minigames` → `transitions` → `games/iv` → `games/pitch` → `games/magnet` → `games/bricks` → `games/race` → `games/slice` → `games/blaster` → `map` → `stickers` → `input`

At load time a file may only use names from earlier files (each game calls `registerGame` from `state.js`). Everything else runs at runtime, after `input.js` boots the page. No file reassigns another file's functions. Commit `src/` and the rebuilt `index.html` together.

| File | Owns |
| --- | --- |
| `state.js` | Helpers (`$`, `clamp`, `rand`, `dist`, `pick`), `rooms` (name, sub, theme, station, optional `width` and `noArcade`), `ARCADE_COUNT`, `roomWidth()`, `isArcadeRoom()`, difficulties, tiers, save/load, `state`, `player`, ward globals, `mini`, `gore`, the game registry |
| `art.js` | Drawing primitives, Macy and gremlins, furniture, `roomProps`, cached `roomBg`, shared arcade art (`panel`, `glow`, `drawTimingBar`, `miniBed`, `miniBackdrop`, `arcadeBackdrop`, `softball`, `nutrient`, `vomitArt`) |
| `audio.js` | `tone()`, `sfx()`, `music()`, `audio` |
| `world.js` | Title screen, ward HUD, rooms, room-extra hooks, movement, tap-the-room touch control, the light switch (`roomLights()`), pickups, snack carts, floor nutrient and brick drops, the turn-your-phone hint, effects, `drawWorld`, map hookup (`renderMap` mounts `src/map.js`), department cards, frame loop and canvas sizing |
| `combat.js` | The kit (swing, shield and brick and their supplies), gremlin breeds, waves, persistent fights (`state.wardFights`), the rematch, the four room twists, first-clear pacing (`WARD.firstCap`, `firstTell`, `queueGap`), the combo and its slam, attacks, jumping, damage, `drawEnemy` |
| `minigames.js` | Arcade framework: lobby, run lifecycle, canvas shape (`activeCanvas`, portrait flips), HUD, instruction toast, assists, scoring, rewards, results, `drawMini`, pointer plumbing, shared gesture-game helpers |
| `transitions.js` | Briefing, countdown, finish, `lesson()` dispatch, countdown card for games with their own overlay (`paintTransition`, sized to the active canvas) |
| `discharge.js` | The send-off cinematic: `dischargeStart()`, `updateDischarge(dt)`, `dischargeActive()`, `drawDischarge(g, vw, vh)`, `dischargeAction(kind, point)`; it also claims keys and pointer presses through its own capture listeners on `document` while it plays, as dream.js does; writes `state.stats.sendoffs` |
| `games/*.js` | One arcade each: rules, state, art, copy, controls |
| `map.js` | The map dialog's floor plan (its own owner and tests) |
| `input.js` | DOM events, title-screen input, press-to-act buttons, tap-the-room canvas wiring, control scheme setting, shop, difficulty, keyboard, startup |

## Game registry

Each game file calls `const NAME = registerGame({...})`. Hooks are called as `def.hook(...)`; refer to your own definition through the const (for example `MAGNET.info`), not `this`.

| Field | Meaning |
| --- | --- |
| `id` | Room and arcade index, 0–5. Room data lives in `rooms[id]`. |
| `canvas: {w, h}` | Arcade canvas size: 600 × 600 for most gesture games, 800 × 500 for the race, 800 × 600 for pinball, 800 × 450 for the IV recovery. It may be a getter, read afresh on every `activeCanvas()` and re-fitted by `fitMiniCanvas()` on every resize or turn: Bedside Blaster's is 600 × 600 with a mouse and, on a touch screen, the screen's own shape at a 600 px short side (`600 × innerWidth / innerHeight` wide, up to 1400; its `portraitCanvas` likewise tall, up to 1300), so its room fills the screen with no letterbox and its own canvas-drawn controls float over the bottom of the room (it calls `setControls([], { assist: false })` on touch, so `mini.frame.cover` is zero). |
| `portraitCanvas: {w, h}` | Optional, taller than wide. Used instead of `canvas` while `mini.portrait` is true: the dialog is open on a screen taller than wide. It can flip mid-run when the phone turns (`resize()` re-checks and re-sizes `#miniCanvas`), so read `activeCanvas()` or `mini.portrait` whenever you lay out or draw; never cache the size from `init`. |
| `layout` | `'iv'` or `'gesture'`; becomes `miniDialog.dataset.arcade` for CSS layout. |
| `controlsPlace` | Optional. `'bottom'` (default): on touch screens in arcade mode the buttons are a strip along the canvas's bottom edge. `'sides'`: the first button sits in the bottom-left corner and the second in the bottom-right, thumb-tall and clear of the HUD, with any others (the assist) small between them; with a mouse it keeps one row ordered first, others, second. Pinball uses `'sides'`. What the buttons cover is `mini.frame.cover`. |
| `info` | `{game, genre, headline, desc}` for map, cards and lobby, plus `{goal, control, avoid, cue}` for gesture-game briefings. |
| `tierNotes` | One lobby string per level: three, or four with `legendary`. |
| `legendary` | `true` when the game has a fourth level, Legendary (tier 3): the lobby offers it once level 3 has a medal, the idle and playthrough tests cover it, and its ruleset should be one a quarter-second player wins about one time in four. `tiers`, `TIER_COUNT` (4) and `miniTierCount(def)` live in state.js and minigames.js. A Legendary run always uses Questionable Decisions rules (`legendaryCfg(tier)` in `startMini`), so its one-in-four holds on every prescription. |
| `shiftName` | Optional banner noun for `updateArcade` shifts (default `SHIFT`). |
| `music` | Optional track key for the run (default `'game:' + id`). |

A game registered with `id: 'recovery'` is the mandatory recovery run: `openMini(room, true)` opens it in place of the room's own arcade (`miniGame()` in minigames.js resolves the definition for the current run; use it, never `games[mini.id]`, in framework code). It is not an arcade: it is not on the map, in the Daily Dose or in the passport, and `ARCADE_COUNT` does not count it. Bots for it export `{id: 'recovery', room: 0, forced: true, policy}`.

| Hook | Called | Default |
| --- | --- | --- |
| `init()` | `startMini()`, right after `mini` is reset for a new run. Gesture games call `initArcadeRun(limit)` first. | required |
| `controls()` | Right after `init()`. Call it again yourself whenever button labels change. Uses `setControls([{id, text, key?, hot?}])`. | none |
| `update(dt)` | Every simulation step while `screen === 'play'` and not paused. `dt` ≤ 1/120 s. Clocks (`t`, `total`, `phaseTime`) and `flash`/`inputLock`/`helpTime` are already advanced. Gesture games call `updateArcade(dt, step)`. | required |
| `draw(g)` | Every frame in briefing, intro, play and outro, after the canvas is cleared to `activeCanvas()`. | required |
| `overlay(g)` | After `draw`. Replaces `drawArcadeOverlays` (particles, shift banner, flash banner, countdown card). | shared overlays |
| `action(a)` | `miniAction(a)` during unpaused play: control buttons (`data-action`), keys, swipes. `'assist'` never arrives here. | none |
| `assist()` | After the framework spends an assist (`helps--`, `helpUsed++`, `quality -= 5`, `combo = 0`). Apply the effect and set `mini.flash`/`flashText`. The HUD refreshes after. | required |
| `key(k, e)` | Keydown during unpaused play, except Escape (pause) and E (assist). `k` is lowercase `e.key`. Return true if handled. | none |
| `briefKey()` | Optional. The key the full briefing is remembered under in `state.briefed` (default `'<id>:<phase>'`, or `'recovery:<phase>'` for a forced run). The recovery keys on which of its two phases is playing. | none |
| `touch(kind, p, pointerId)` | Every finger on the canvas during unpaused play: `kind` is `'down'`, `'move'`, `'up'` or `'cancel'`, `p` in active-canvas coordinates. Defining it replaces the one-pointer gesture path (`down`/`move`/`up` and `mini.pointer` are not called), for games with two controls at once such as flippers. | none |
| `patchUp()`, `patchUpLabel()` | Recovery game only. When defined, a lost forced run can still end from the result screen: the button reads `patchUpLabel()` (default `Get patched up`), `patchUp()` applies the price (coins, never progress) and the ward resumes with at least one heart. Without it a lost recovery must be retried. | none |
| `down(p)`, `move(p, prev)`, `up(cancel)` | Canvas pointer in active-canvas coordinates (`miniPoint` maps letterboxing and portrait canvases). `mini.pointer` is set before `down` and cleared after `up`. `up(true)` means lost or interrupted: never act on it. A game with none of the three ignores canvas presses. | none |
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

Framework helpers for games: `activeCanvas()` (the `{w, h}` the run draws at right now), `praise(points, precision)`, `miniOops(message, amount)`, `finishMini(win, reason)`, `setInstructions(text)`, `setControls(buttons)`, `prepareBriefing()` (a paused briefing between phases, as IV does), `initArcadeRun(limit)`, `updateArcade(dt, step)`, `arcadeBurst(x, y, color, n)`, `arcadeQuality(penalty)`, `arcadeTimeUp()`, `ARCADE_QUOTA_MISSED`.

Every run screen (briefing, countdown, play, finish) is canvas-first, in every mode. `applyMiniFrame()` (minigames.js) fits the active canvas into the screen and places the controls (`data-side` and `mini.frame`). With a mouse the controls sit in one row under the canvas or a column on the right, whichever leaves the bigger canvas (`data-side` `row` or `col`; a `'sides'` game always gets the row, ordered LEFT, assist, RIGHT), and the dialog hugs the canvas inside 96% × 94% of the window, so there is never an empty panel. In arcade mode on a touch screen (`data-side="over"`, `miniOverlayFrame`) the canvas takes the whole screen less the safe areas and the buttons float over its bottom edge at 80% opacity, sitting in any spare height under the canvas first; only the buttons take touches, so taps and drags between them still reach the canvas. They come in two shapes (`data-ctl`): a centered `strip` of thumb-height buttons (52 px on phones, 62 on tablets), or `corners`: the first button in the bottom-left corner and the second in the bottom-right, thumb-tall (96 × 86 on phones, 132 × 112 on tablets), the rest small and centered between them (`data-mid="center"`) or stacked above the right corner when the canvas leaves a gutter beside it (`data-mid="stack"`). A `'sides'` game always gets corners; a `'bottom'` game gets corners only when those gutters exist (a square game on a landscape phone), so nothing has to sit on its canvas. `mini.frame.cover = { bottom, left, right }` says what the buttons hide, in active-canvas pixels, refreshed on every `applyMiniFrame()` (a resize, a portrait flip, a relabel that changes the button count): `bottom` is the band along the bottom edge with buttons in it, `left` and `right` the corner blocks' widths, 0 where nothing is covered (always 0 with a mouse). Games may read it to move must-read art out from under the buttons; none has to. The HUD is three translucent pills on the canvas's top edge (progress, time, lives): above the canvas when there is room, over its top 44 to 50 px when there is not, with pause and close sharing the right end of that row (atop the column in a column layout). Keep must-read art out of the top corners. The instruction line is a toast under the pills through the countdown, for the first 3 seconds of play, and again whenever `setInstructions` changes it. Every control acts on pointerdown; a column holds two across from five buttons. `#miniDialog` also carries `data-portrait="1"`, `data-place` (the game's `controlsPlace`) and `--mini-a` (width / height of the active canvas).

The lobby fits one screen without scrolling on a phone in either orientation and on common laptop windows: the hook (`info.headline`), the levels as one segmented row (`#tierGrid`, locked ones visible but disabled) with the chosen level's name and note under it (`#tierNote`), the nerve as a two-way switch (`#approachOptions`), then START (`#miniStart`) and BACK TO THE HOSPITAL (`#miniLobbyBack`, hidden for a recovery) at the bottom. `info.desc`, the best score and the prescription link sit behind How to play (`#lobbyHow`): an overlay on phones and small windows, open beside the preview on a roomy laptop window. A phone on its side puts the levels left and the switch and buttons right.

## The `mini` run object

`openMini()` and `startMini()` replace `mini` wholesale, so per-run state never leaks between runs.

Framework-owned (read freely, do not repurpose):
- Lifecycle: `open`, `screen` (`lobby`, `briefing`, `intro`, `play`, `outro`, `result`), `id`, `tier`, `forced` (mandatory IV recovery), `approach`, `initialized`, `paused`, `countdown`, `transition`, `demoTime`, `pendingFinish`.
- Screen: `portrait` (the run is on its `portraitCanvas`; set before `init`, re-checked on every resize), `tipT` and `tipShown` (the instruction toast clock), `frame` (the run-screen geometry `applyMiniFrame` computed: `side` 'row', 'col' or 'over', `place`, `ctl` and `mid` on touch screens, canvas fit and position, and `cover`: `{bottom, left, right}`, what the control buttons hide in active-canvas pixels, 0 where nothing is covered; games may read it to lift must-read art, never write it).
- Rules and clocks: `rules` (difficulty plus `misses` and `coins`), `t`, `total`, `phaseTime`, `hudClock`, `inputLock`, `helpTime`.
- Scoring: `miss`, `quality`, `score`, `combo`, `maxCombo`, `precisions`, `helps`, `helpUsed`, `win`, `grade`, `qualityFinal`, `reward`, `resultT`.
- Input: `pointer` (`x`, `y`, `startX`, `startY`, `lastX`, `lastY`, `startT`, `stroke`), `held` (HOLD button or a key a game marks held), `fireHeld` (FIRE button). Space keyup and every pause or dialog clear both.
- Gesture runs (`initArcadeRun`): `got`, `shift`, `notice`, `fx`, `trail`, `slow`. Games add to `got` and spawn `fx` through `arcadeBurst`.

Game-owned: `limit` (set it in `init`; the HUD clock and default `timeUp` use it), `goal`, `phase`, `round`, `flash`/`flashText` (write when showing a banner), and any new field the game needs. Prefer distinctive names for new fields.

## Sound

`audio.js` synthesizes everything with the Web Audio API; there are no audio files. `audio.unlock()` runs on the first gesture (registered by both audio.js and input.js), `audio.toggle()` / `audio.setEnabled(bool)` / `audio.enabled` / `audio.volume` control it, and `state.sound` (default true) is the persisted preference.

`sfx(name, opts)` names: `ui select back hit swing jump dash hurt coin pickup eat enemyDie split blob throw bounce explode shot reload slice bomb combo fever drip catch pump wave clear win lose countdown go stun shield trap miss headshot leap boss bossHit bossDie wallSplat organ squelch ricochet powerup lock unlock daily talk` (`talk` takes `opts.voice`: dad, brother, grandma, grandpa, cousin, doctor, nurse, ensure, macy, rowdy). Unknown names play a generic blip. `opts.combo` and `opts.count` raise pitch for swing/slice/combo/drip; `opts.pan` (-1..1) and `opts.vol` work everywhere. Loud effects duck the music briefly.

`music(name)` crossfades between looped tracks: `title`, `room:0` to `room:6` (6 is the hallway), `game:0` to `game:5`, `boss`, and the one-shot stings `result:win` and `result:lose`; `music(null)` stops. `loadRoom` plays the room track before `startEncounter` so a boss intro can take over, `launchMini` plays the game track, results play a sting, and `leaveMini` returns to the room.

## Saved state

`save()` persists: `hp coins name difficulty food medals records taken defeated upgrades cosmetics won wardClears wardFights evictions bestChain coinsEarned runs ralphReady ralph sound played briefed arcade controls controlsChosen recoveries lastTier daily stats stickers cards jersey`. Notes:

- `wardClears[room]` is the grudge level; `wardLocked(id)` (combat.js) is true until the first clear. Rooms 0 and 5 have no combat.
- `ralphReady` is set by `checkDischarge()` when the passport is complete; combat spawns Ralph in room 0 and sets `ralph` on defeat, then calls `checkDischarge()` again for the win dialog.
- `briefed` holds `"<id>:<phase>"` keys; a game's full briefing shows once, then a 1.2 s GO card. Countdown is 1.5 s (3.2 s under reduced motion).
- `daily` holds the Daily Dose record (date, best, streak, paid). During a daily run `mini.daily` is true and a date-seeded RNG replaces `Math.random` around the game hooks (`dailyScoped`).
- `arcade` remembers fullscreen ("arcade mode", `body.arcade`), which phones and tablets enter on first start.
- `controls` is the touch scheme: `'stick'` (joystick bottom left with EAT beside it, the action buttons bottom right; the default on coarse pointers) or `'tap'` (the room is the controller; the default with a mouse). `controlsChosen` marks a scheme the player picked, which is then kept. `body.tap-controls` / `body.stick-controls` follow it.
- `cosmetics.worn` feeds `macyLook()` for `girl()`.
- `recoveries` counts forced IV recoveries (the Frequent Flyer sticker reads it); games/iv.js increments it. A lost recovery can end through `patchUp()` at a price in coins. `grantReward()` still resets the count on any medal outside a recovery.
- `stats.knocks` counts knocks on the map's restroom door (map.js); the Knock Knock sticker reads it.
- `lastTier` is the level of the last arcade run she started (`startMini`, never a recovery); the recovery opens on it (`ivRecoveryPlan()` reads it).
- Discharge needs `DISCHARGE_STARS` (21) stars, a medal in every arcade, any level 2 medal and Ralph. `dischargeMissing()` (minigames.js) lists what is still missing for the exit and the passport. Once `state.won`, the hallway exit calls `dischargeStart()` (src/discharge.js, the send-off); world.js hands the frame to `updateDischarge(dt)`, draws `drawDischarge(g, vw, vh)` while `dischargeActive()`, routes every action to `dischargeAction(kind, point)`, and toggles `body.discharging`.
- `medals`, `records` and `wardClears` stay `ARCADE_COUNT` (six) long even when extra rooms join `rooms`.

## Title screen

`#titleScreen` covers the page on every load (and after Quit to title in the pause menu). world.js draws the hospital at dusk on `#titleArt` with the art primitives while `titleUp` is true, and plays `music('title')`. START, any key or any tap calls `titleStart()`: `sfx('go')`, a 250 ms iris (none under reduced motion), then `begin()`. `begin()` also clears the title, so any other way into the game works too. Nothing in the ward runs until `state.started`.

## Room extras (the hallway)

The hooks below run in every room. hallway.js answers in room 6 and in any room with visitors in it (the roaming rules and scheduler live under "Visitors in the rooms"); elsewhere it returns early, and `roomExtrasAction` returns false when there is nobody to talk to.

Another file may add places that are not arcades. Every call below is guarded with `typeof`, so the game runs the same without them.

| Hook | Called |
| --- | --- |
| `hallwayInstall()` | Once at startup, before the department cards and the first `loadRoom`. Pushes its room (`{ id: 6, name, sub, theme, station: null, width, noArcade: true }`) into `rooms` and its props into `roomProps`. |
| `onRoomLoaded(id)` | At the end of every `loadRoom`. |
| `updateRoomExtras(dt)` | Every ward step, right after `updateCombat`. |
| `roomExtraRenderables()` | Every frame; returns `[{ y, draw(g) }]`, depth-sorted with the furniture, Macy and the gremlins. |
| `drawRoomOverlay(g, vw, vh)` | Every frame, in screen space, after the room. |
| `hallwayRoomBg(g)` | Once per room wider than 1000 px, to paint its cached background (else a plain floor). |
| `roomExtrasAction(kind, point)` | Before Macy acts: kind is `attack`, `jump`, `dash`, `use`, `enter` or `tap` (point in room coordinates). Return true to take the action. |
| `hallwayEnter(id)` | The "MAP →" corner of a room, instead of opening the map. |

Rooms may set `width` (default 1000): the camera, walls and tap goals use `roomWidth()`. Rooms with `noArcade` get no beacon, no play button, no department card, passport row, Daily Dose pick or grudge row, and `tryOpenArcade` says no. `ARCADE_COUNT` (six) is the arcade count everywhere (discharge, Daily Dose, resets).

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

`tests/harness.cjs` runs the built `index.html` in a Node VM with stub DOM and canvas objects and exports `run(code)`, `close()` (closes dialogs and resets the arcade screen), `nodes`, `events`, `box`, and `assert`. Each test file gets a fresh page because `run-all` starts it in its own process. Two environment variables shape a page: `GF_REDUCED_MOTION=1` makes `prefers-reduced-motion` match, and `GF_PRELUDE` is code run in the page before the game script (verify.cjs uses it to stub the hallway hooks in a child process).

| File | Covers | Owner |
| --- | --- | --- |
| `verify.cjs` | Saves, nutrients, run lifecycle, idle failure for every game, tier and prescription, frame-rate independence, discharge, press-to-act buttons (JUMP and BRICK with the joystick held), the joystick double-tap dash, EAT, portrait canvases, the instruction toast, tap the room, the title screen, recoveries, run-screen sizing, the room-extra hooks | framework |
| `combat.cjs` | Ward rules, breeds, spawns, grudge, Ralph, first-clear pacing, the combo, health drops, and the masher-vs-kiter tuning check | combat |
| `game-<name>.cjs` | That game's mechanics rules | that game |
| `bots/<name>.cjs` | `{id, policy}` (or `{id: 'recovery', room, forced, policy}`): input-only controller code run every play tick by `playthrough.cjs`, with a persistent `bot` object for its memory. It must win every tier and difficulty. | that game |
| `tools/<name>-human.cjs` | Not run by the suite. A human-speed yardstick: an input-only policy that sees the game a quarter second late and plays like a person. Run one before changing a game's pace or quotas; bots prove solvable, these say whether a person can. | that game |
| `playthrough.cjs` | Runs every bot through all 54 combinations | framework |
| `smoke.cjs` | Registry shape; every game and room draws; tall and wide ward views; games with a portrait canvas run on it | framework |
| `discharge.cjs` | The send-off: hooks, exit gating, beat timing, advancing and skipping, every beat drawn at five sizes, the share card, reduced motion | discharge |

When you change a game's rules, update its bot and its `game-<name>.cjs` in the same commit. Do not edit another owner's test file.
