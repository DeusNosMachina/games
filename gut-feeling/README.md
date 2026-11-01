# Operation: Gut Feeling

A hospital adventure made for Macy: volleyball and softball phenom, gremlin wrangler, and reluctant future returner to school.

**[Play on phone or desktop](https://deusnosmachina.github.io/games/gut-feeling/)** · [All games](../README.md)

## The adventure

Explore five departments, swat gut gremlins, collect scarce nutrients, and earn a discharge passport through arcade performance. Each game has three levels with additional demands and mechanics. The current version is **v0.4**.

| Department | Game | Skills and progression |
| --- | --- | --- |
| Your room | **Drip or Die** | Three stages: 8–12 alternating timing taps, 10–14 catches matching a changing nutrient recipe, then 14–20 seconds tracking a moving pressure band with momentum. |
| MRI | **Freeze Frame** | Three checkpoints. Accelerate on green, coast or brake on amber, and stop before pink scans. Reach the marker and earn clean scan locks. Later levels shorten warnings and increase the demands. |
| Family lounge | **Brick Brain** | 6–8 fresh builds per run, with growing sequences. Level 2 introduces reverse order; level 3 adds mirrored shapes. |
| CT | **Donut Dash** | Three increasingly fast sectors, each with a token quota. Safe gold routes earn one token; a correctly timed swat through blue foam earns three. Pink barriers cannot be swatted. |
| Ultrasound | **Echo Hunter** | 6–8 scans combining spatial memory and precision. Remember green gremlins, ignore pink decoys, then time each tag inside mint. Higher levels add targets and moving tag windows. |

Runs generally take about one to three minutes including preparation, depending on game, level, and player. Each stage waits at a briefing until Ready is pressed. A 3.2-second countdown provides preparation time without advancing hazards or the timer; results settle over 2.2 seconds. Reduced-motion preferences remove animation movement without shortening preparation time.

## Choose your approach

- **Steady hands:** two assists shared across the entire run. An assist costs five style points and breaks the score chain. Depending on the game, it widens a timing window, filters gunk, recenters pressure, stops the bed, replays a pattern, grants a short shield, or repeats a sonar scan.
- **Show-off shift:** no assists, with 25% more coins on a successful run.

Separately, **Pillow Fort**, **Questionable Decisions**, and **Absolute Gutastrophe** change enemy pressure, arcade speed, precision, mistake allowance, and coin earnings. Change settings between runs.

## Controls

### Exploring

| Action | Phone | Keyboard |
| --- | --- | --- |
| Move | Joystick | WASD / arrow keys |
| Pillow swat / deflect | SWAT | Space |
| Dash | DASH | Q |
| Equipped item | USE | E |
| Switch item | Swap | 1–3 |
| Eat / drink a nutrient | Drink / eat | F |
| Map | Hospital map | M |
| Nearby arcade | Play button | Enter |
| Pause | Tap the game to resume after interruption | Escape |

### Arcade

Every game displays its goal and controls before and during play. All phone controls are on screen.

- **IV:** Space for timing and hold/release pressure; A/S/D selects catch lanes.
- **MRI:** hold Space to move; B brakes.
- **Bricks:** keys 1–4 choose shapes. Follow the announced forward/reverse/mirror rule.
- **CT:** A/D or left/right arrows steer; Space swats.
- **Echo:** tap cells or use 1–9, then Space to tag.
- **All games:** E uses a remaining assist; Escape pauses.

## Scores, rewards, and recovery

Successful runs earn bronze/silver/gold based on mistakes, precision, resource use, and game-specific performance. Clean actions build score chains. Arcade high scores are saved per game and level, and the score contributes to coin payouts.

Best medals add 1/2/3 discharge stars. Replaying earns coins, but only medal improvements add stars. Discharge requires at least 12 stars, a medal in all five departments, and any level 2 medal. Coins buy permanent equipment upgrades.

Nutrients restore one heart, are capped at three carried, and do not respawn when revisiting a room. More supplies unlock at progression milestones. Zero hearts sends Macy to mandatory IV recovery; completing all stages restores health. Failed IV recovery features exaggerated cartoon gore. Vomiting, gremlins, and medical mechanics are fictional arcade jokes.

## Build and verify

Requires Python 3 to build and Node.js to run verification. There are no package installs or runtime dependencies.

```sh
python3 gut-feeling/build.py
node gut-feeling/tests/verify.cjs
```

Run these from the repository root. The generated `index.html` contains all CSS, JavaScript, and canvas artwork. Commit both the editable source and generated file.

Source organization:

- `state.js`: persistence, room definitions, difficulties.
- `world.js`: exploration, collisions, enemies, health, pickups.
- `minigames.js`: challenges, scoring, rewards, recovery.
- `transitions.js`: briefing, countdown, and result flow.
- `art.js`, `mini-art.js`, `smooth.js`, `challenge-art.js`: canvas artwork, frame scheduling, and challenge cues.
- `input.js`: touch, pointer, and keyboard controls.
- `template.html`, `dialogs.html`, `v2.css`: page, dialogs, responsive styles.

The verification script covers all 90 game/level/difficulty/approach combinations, idle-play failure, scoring, limited assists, skill actions, mandatory recovery, scarce health, pause/timer behavior, discharge gates, and frame-rate-independent movement. It is a logic/render smoke harness, not a replacement for human playtesting.

## Saves and compatibility

Progress stays in localStorage on that browser and origin. It does not sync across devices. Moving from a local file to the published site starts a separate save. Existing v0.2/v0.3 saves on the same origin retain medals, coins, upgrades, and Macy's name; v0.4 adds per-level high scores. Resetting the adventure also clears those high scores.

Works as a self-contained local HTML file or a static hosted site. The layout has been checked at phone and laptop widths; actual frame rate depends on the device and browser. There is no install requirement, service worker, cloud account, analytics, or external asset request.
