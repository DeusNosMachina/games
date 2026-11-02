# Operation: Gut Feeling

A hospital adventure for Macy: volleyball and softball phenom, gremlin wrangler, and reluctant future returner to school.

**[Play on phone or laptop](https://deusnosmachina.github.io/games/gut-feeling/)** · [Games catalog](../README.md)

## v0.5 — actually cause some trouble

Six arcade games, eighteen levels, and a ward adventure with three-wave fights. This release replaces four early room games with gesture and physics challenges, adds **Bedside Blaster**, and fixes the equipped-weapon bug.

| Place | Game | What you do |
| --- | --- | --- |
| Your room | **Drip or Die** | Three-stage recovery: precise timing, changing nutrient recipes, and a moving pressure target with momentum. |
| MRI | **Polarity Panic** | Drag a magnet, switch pull/push polarity, and steer drifting nutrients into matching ports. Dispose of pink gunk in the bottom vent. Later shifts add currents. **105–135 seconds.** |
| Family lounge | **Brick Rebellion** | Pull back to aim a volley or switch to velocity-based flick throws. Bank shots, explosive blocks, extra balls, and limited heavy/fan shots. Protect the red line through **12–18 volleys**, with a four-minute ceiling. |
| CT | **Gurney Grand Prix** | Swipe to steer, jump crates, slide under scan bars, and throw softballs at gremlins. Meet both coin and stunt quotas across three continuous sectors. **105–135 seconds.** |
| Ultrasound | **Gel Yeah!** | Slice airborne gremlins, bank multi-target strokes, dodge pink bombs, crack helmets with separate swipes, and chase splitting targets. Combos trigger slow-motion fever. **90–120 seconds.** |
| Your room, after dark | **Bedside Blaster** | From bed, pan a flashlight and sighted blaster around a wide, dark room. Gremlins crawl over furniture, wind up, and leap at the camera. Manage seven-shot magazines, headshots, armor, reloads, and a limited stun. **105–135 seconds.** |

Every run begins with a paused briefing and a 3.2-second countdown. Results settle over 2.2 seconds. The gesture games advance through their phases without stopping for another launch screen. IV recovery still explains each new phase before its clock begins. Reduced-motion settings preserve reading/preparation time.

## The ward fights back

Each combat department has three waves, a short breather between waves, and a 45-coin completion bonus. Cleared encounters can be replayed. Home base and the after-dark room are safe outside their arcade games.

- **Green nibblers:** 3 HP, chase and telegraph bites.
- **Purple spitters:** 4 HP, keep distance and aim blobs; later waves add spread shots.
- **Orange bruisers:** 7 HP, telegraph a fast charge.
- **Blue split peas:** split on the first hit into two faster 2-HP gremlins.

The equipped weapon now determines the primary attack:

| Weapon | Primary attack | Ability (E) |
| --- | --- | --- |
| Pillow | Directional three-hit combo, visible wind-up/follow-through, feather impacts, blob deflection | Wide spinning swing |
| Barf bag | Aimed bouncing projectile | Temporary shield |
| Brick | Aimed lob with area damage and a stun | Drop a trap |

Jump over low attacks; attacking with the pillow during a landing can produce a stomp. Dashing, spacing, reflection, and stun timing provide alternatives to trading hits.

## Phone and desktop controls

| Action | Phone / pointer | Keyboard |
| --- | --- | --- |
| Move | Left joystick | WASD / arrows |
| Attack | Tap equipped attack; drag it to aim and release | Space |
| Jump | JUMP | Shift / J |
| Dash | DASH | Q |
| Ability | SPIN / SHIELD / TRAP | E |
| Equip | SWAP or inventory cards | 1 / 2 / 3 |
| Nutrient | Drink / eat | F |
| Map | Hospital map | M |
| Nearby arcade | Play button | Enter |
| Pause | Pause button; interruptions pause automatically | Escape |

Arcade controls stay visible during play:

- **IV:** Space taps or pumps; A/S/D selects catch lanes.
- **Magnet:** press and drag to apply force; release to coast; Space changes polarity.
- **Bricks:** drag from the ball; choose PULL AIM or FLICK AIM. Keys 1/2/3 select normal/heavy/fan; Space recalls remaining balls.
- **Race:** swipe or use A/D to steer, W to jump, S to slide, Space to throw.
- **Gel:** press and swipe; lift to bank a combo. Helmets require a new stroke.
- **Blaster:** drag to look, or use WASD/arrows; hold FIRE/Space; R reloads. A tap without a drag fires once. Two fingers can aim and fire independently.
- **All games:** E uses a limited assist; Escape pauses.

Touch targets are at least 44 pixels for ward action buttons. On narrow screens, starting play collapses the title area so the room and controls fit more comfortably. Canvas art renders at device pixel density, with requestAnimationFrame rendering and small simulation steps. Performance still depends on the device.

## Progression and difficulty

**Steady hands** supplies two assists for the whole run. **Show-off shift** removes assists and pays 25% more coins. Assists include stabilized magnetic fields, a brick push-back, race shields, gel freeze, and flashlight stuns.

The separate prescriptions are **Pillow Fort**, **Questionable Decisions**, and **Absolute Gutastrophe**. They affect enemy pressure, timing/speed, mistake allowances, volley ball count, and payouts. Difficulty changes do not refill health.

Successful games earn bronze/silver/gold based on performance, mistakes, precision, chains, and assists. Best medals contribute 1/2/3 discharge stars. Replays earn coins; only improved medals add stars. Discharge now requires **12 stars, a medal in all six games, and any level 2 medal**. Existing completed discharges remain completed. Coins buy permanent equipment upgrades.

Nutrients restore one heart and are capped at three carried. Pickups stay collected, with a few additional supplies unlocked at progression milestones. Zero hearts sends Macy to mandatory IV recovery. Failed recovery retains the exaggerated cartoon gore. All medical mechanics are fictional arcade jokes.

## Build and verify

No package installation, runtime dependencies, remote assets, or backend are required.

```sh
python3 gut-feeling/build.py
node gut-feeling/tests/verify.cjs
node gut-feeling/tests/playthrough.cjs
```

Run from the repository root. Commit the editable sources and generated `gut-feeling/index.html` together. The generated file contains all HTML, CSS, JavaScript, and canvas artwork.

Source guide (details, hook reference, and parallel-work rules in [ARCHITECTURE.md](ARCHITECTURE.md)):

- `state.js`: helpers, room table, difficulties, saves, shared run state, and the arcade registry.
- `art.js`: drawing primitives, characters, furniture, cached room backgrounds, and shared arcade art.
- `audio.js`: WebAudio beeps and the named `sfx()` vocabulary.
- `world.js`: ward navigation, pickups, health, effects, map, and the frame loop.
- `combat.js`: equipped attacks, aiming, jumping, enemy behaviors, and wave encounters.
- `minigames.js`, `transitions.js`: the arcade framework (lobby, scoring, rewards, results, shared gesture plumbing) plus briefings and countdowns.
- `games/iv.js`, `magnet.js`, `bricks.js`, `race.js`, `slice.js`, `blaster.js`: one file per arcade game, each with its rules, art, copy, and controls.
- `input.js`: keyboard, pointer capture, independent touch inputs, menus, and startup.
- `template.html`, `dialogs.html`, `v2.css`: interface, instructions, and responsive layout.

Regression checks cover weapon dispatch, wind-up damage, multi-hit/splitting enemies, jumping, health budgets, pause and transition clocks, reward idempotence, aim cancellation, magnetic force direction, swipe rules, race obstacle rules, and shooter sight/ammo/headshot/reload/leap behavior. Input-driven controllers complete **54 game/level/prescription combinations** through the actual simulation. Separate checks reject idle play in all 45 gesture-game combinations. These tests establish mechanics and solvability; they do not replace human difficulty tuning.

Phone-sized and laptop browser layouts have been inspected, including drag aiming, equipment switching, jumping, throwing, and the blaster's fire control. Physical iOS/Android testing is still useful for touch feel, battery use, and device performance.

## Design references

The implementations, characters, and artwork are specific to this game. Familiar mobile ideas informed the redesign:

- [Halfbrick's Fruit Ninja guide](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja): deliberate multi-target swipes, combos, and power-up windows.
- [Halfbrick's Jetpack Joyride](https://www.halfbrick.com/games/jetpack-joyride-classic): continuous arcade runs and changing obstacles.
- [Supercell's Brawl Stars](https://supercell.com/en/games/brawlstars/): compact combat sessions with varied attacks and modes.

## Saves and hosting

Progress uses localStorage in the current browser and origin. It does not sync between phones, laptops, local files, or hosted URLs. Existing saves retain Macy's name, medals, high scores, coins, and upgrades; v0.5 adds the sixth game's medal slots and ward-clear counters. A fresh-adventure reset clears progress only after a second deliberate click.

GitHub Pages serves `main` from the repository root. The game remains usable as a single local HTML file. There is no account, analytics, cloud save, service worker, or install requirement.
