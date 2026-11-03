# Operation: Gut Feeling

A hospital adventure for Macy: volleyball and softball phenom, gremlin wrangler, and reluctant future returner to school.

**[Play on phone or laptop](https://deusnosmachina.github.io/games/gut-feeling/)** · [Games catalog](../README.md)

## v0.7: the gameplay pass

The first live playtest said the arcades swung between too easy and too hard, with Bedside Blaster the one genuine arcade game. So every other arcade was rebuilt or reworked against that bar, and every one now ships with a human-speed yardstick (`tests/tools/`) that must clear level 1 nearly always, level 2 most of the time and level 3 sometimes at a quarter-second reaction. Drip or Die is no longer an arcade: her room has Fastpitch Fever by day, and the IV is only the recovery, one gentle round that is never a dead end. The MRI has pinball, the CT has a real race, the lounge has a paddle breakout, Gel Yeah! is pure slicing from the first swipe, and the ward plays landscape with a joystick and a big SWING button, a combo slam, snack carts and a paced wave 3.

Six arcade games with three levels each, a ward that fights back properly, a boss named Ralph, music, fullscreen play, and a failure animation that finally earns its name. Level 1 of everything teaches you. Levels 2 and 3 are the real deal.

| Place | Game | What you do |
| --- | --- | --- |
| Your room | **Fastpitch Fever** | Throw softballs from the bed at the gremlins in her room, with real physics: gravity, bank shots off the walls and furniture, lobs that drop behind cover. Tap for a fastball at the spot (taps near a gremlin aim at its depth, so leading a walker works), drag back and release for a pitch with a preview arc, drag up for a lob. Walkers, hoppers, chargers headed for the bed, peekers behind the footboard, bedpan shields that only fall to a bank shot, golden gremlins worth two, Ensure bottles that knock over like carnival cans for extra balls, and the Ump on level 3. Every hit refunds the ball and the bucket refills, so it never stalls. |
| MRI | **Loud Donut Pinball** | Pinball inside the MRI. Flip the steel softball into gremlin bumpers until they move out, ride the scan ramp, light M-R-I, and hold both flippers to fire the magnet and save a drain. Level 2 adds drop targets and meaner outlanes; level 3 adds Clank in his bucket and multiball. |
| Family lounge | **Brick Rebellion** | Paddle breakout with a hospital lunch tray. Slide anywhere to move it, tap to serve, and land the softball on the tray's edges to send it wide. Three racks per level: pink bricks chain-react, gold stars drop pills (wide tray, multiball, sticky catch, pillow ammo, nap; green goo shrinks the tray), and the pillow cannon snipes stragglers. Level 2 adds steel, hopping gremlins, nurse calls and a creeping rack; level 3 is faster and ends at Ralph's fortress. |
| CT | **Gurney Grand Prix** | A pseudo-3D race: steer a gurney through curves, hills and CT donut tunnels against gremlin gurneys, med carts, a runaway IV and Barb. Donut gates add time; finish top three. Level 2 adds S-bends and traffic; level 3 adds night, heavy traffic and Ralph blocking on a motorized bed. |
| Ultrasound | **Gel Yeah!** | Swipe gel gremlins as they hop up the sonar screen. Three or more in one stroke is a combo (big ones get slow motion and a zoom), combos fill a party meter, gold starts a frenzy, and every level ends on a jumbo gel you scribble on. Level 1 is just slicing with one lone bomb; level 2 adds splitters, helmets and bombs one at a time; level 3 is faster with bombs in the lineup. |
| Your room, after dark | **Bedside Blaster** | Tap to shoot, drag to look, hold to charge a piercing shot. Crawlers, bedpan helmets, bruisers and pouncers hide behind furniture and leap at your face. Active reloads reward timing, juice bottles refill charges, and level 3 ends with Ralph Jr. |

**Drip or Die** is no longer an arcade. It is the recovery: zero hearts puts Macy in bed for one gentle round of tap-the-drip (eight drips, three strikes, the same every time), and the third strike is still the staged cartoon explosion. Pop and you can try again or get patched up for 15% of your coins; either way you are back in the ward with a heart. No run is a dead end.

Every game shows its full briefing once. After that you get a 1.2-second GO card with the one-line rule and a 1.5-second countdown. Reduced-motion settings keep the longer reading time.

The game opens on a proper title screen: the hospital at dusk, gremlin eyes in the dark windows, one START. Any key or any tap starts it, and a saved game picks up where you left off. The pause menu has Quit to title.

Each arcade is the canvas plus the minimum, on phones and on laptops: three pills for progress, time and lives along the canvas edge, the instructions as a short toast, and one row of controls under the canvas (or a column beside it when that leaves a bigger game).

The map is a drawn floor plan of the seventh floor of Valley Hospital in Paramus (Pediatrics, Room 5): tap a room to go there, tap PLAY to start its arcade, and the Daily Dose, gift shop and exit sit where you would expect them. Walk the hallway between rooms and talk to the visitors (they keep arm's length and never wander onto her spot, and on a phone a tap only opens a talk when the TALK prompt is up over that visitor; every other tap walks): Dad (a fresh dad joke every single time, from a deck of 144), Riley, Mimi and Dodo, Presley, Norah and Taylor, cousin Casey, nurses Stephanie and Julez, Dr. Lori and Dr. Benedetto, Barb from Dietary with her Ensure, and Rowdy the Ram doing cheers by the nurses' station. Every visit pins a card to the get-well wall above her bed.

## The ward fights back

Four departments have gremlins. Each has three waves, and the first wave of your first visit is a teaching wave with hints. Clear a ward once to unlock its arcade. Clear it again and Ralph's grudge rises: more gremlins, faster, bigger payout. Fights persist if you leave mid-wave, and a cleared room stays calm when you come back.

Hitting a gremlin staggers it. Stuns come only from the third hit of a combo, the spin, a brick, a stomp or a trap, so mashing one button no longer works. Hit a gremlin twice in a row and it hops out of reach, angry.

Three landed attacks in a row (each within four seconds, no whiff, no hit taken) charge a COMBO: a gold ring fills around the attack button and three pips show over Macy. The next attack with a gremlin in reach is a slam that hits everything within 150 px, knocks it back, stuns it for 0.9 s and cancels its wind-up. A slam pays five coins; the first one each room drops a nutrient, then every third.

First clears are paced: waves 2 and 3 keep at most three gremlins up at once (four on Absolute Gutastrophe), the rest come out one at a time, and spit, charge and lob wind-ups run a quarter longer. Rematches have no cap and no longer tells.

- **Nibblers** hunt in pairs, flank, crouch and lunge.
- **Spitters** strafe, lead their shots, back off when you close in, and spread-shoot on wave 3. A pillow swing sends blobs back at them.
- **Bruisers** charge. A charge into furniture or a wall leaves them dizzy, which is when you hit them. From the front they shrug off pillow pokes.
- **Split peas** split on the first hit and re-merge if you leave the halves alone for four seconds.
- **Hurlers** lob gunk bricks that leave sticky puddles. They show up from wave 2 in later rooms.

| Weapon | Primary attack | Ability (E) |
| --- | --- | --- |
| Pillow | Three-hit combo, deflects blobs | Spin |
| Barf bag | Ranged throw that bounces once | Shield |
| Brick | Lob with an area burst, stuns bruisers | Trap |

Jump over low attacks; swing in the air to stomp on landing. Dash through a gremlin mid-wind-up to cancel its attack.

**Ralph** waits in your room once your passport is complete. Phase 1 is a spit barrage you deflect back at him. Phase 2 is charges that leave him dizzy when he hits the bed, plus minions. Phase 3 is leaping slams that shake the room. Beat him to get discharged.

## Phone, tablet and desktop controls

On phones and tablets the joystick scheme is the default: a joystick bottom left, a big smashable SWING / THROW / LOB button bottom right with JUMP beside it, DASH and the ability around them, EAT with its count above, and the weapon strip top right. In landscape the room fills the screen and the controls float over it; in portrait they sit under the room, and a phone held upright gets a one-time "turn your phone sideways" pill. "Tap the room" (the floor is the controller) is one switch away in the pause menu or the settings, and a chosen scheme is kept.

| Action | Joystick scheme | Tap the room | Keyboard |
| --- | --- | --- | --- |
| Move | Left joystick | Tap the floor; drag to steer | WASD / arrows |
| Attack | SWING / THROW / LOB; hold to repeat, drag to aim | Tap a gremlin (hold to keep swinging) | Space |
| Jump | JUMP | Two-finger tap, or JUMP | Shift / J |
| Dash | DASH | Flick | Q |
| Ability | SPIN / SHIELD / TRAP | Long-press the floor, or the ability button | E |
| Equip | Swipe sideways across SWING, or the weapon strip | Weapon strip | 1 / 2 / 3, C for the next one |
| Nutrient | EAT (shows how many you carry) | EAT | F |
| Map | Map button | Map button | M |
| Nearby arcade | Play button, or tap the beacon | Same | Enter |
| Pause | Pause button | Pause button | Escape |

Every touch button acts the moment your finger lands, so JUMP works with a thumb on the joystick. The attack button is 104 px on a phone and 128 on a tablet; a sideways swipe across it of 40 px within a third of a second changes weapons (the canvas flashes the new one), a slow or vertical drag aims.

Fullscreen ("arcade mode") pins the game to the screen, and phones and tablets enter it when you press START. iPad Safari uses the real fullscreen API; iPhones use a CSS fallback because Safari has none for pages. Tablets get bigger buttons, and the lobby and results use the width.

Arcade controls:

- **Fastpitch:** tap, drag back and release, or drag up to lob; arrows aim and Space throws; the THROW button repeats the last throw.
- **Recovery (Drip or Die):** tap anywhere or Space when the line crosses mint.
- **Pinball:** left half or Z / Left flips left, right half or slash / Right flips right, hold both for the magnet, tap or Space to launch, swipe up or Shift to nudge (three quick nudges tilt).
- **Bricks:** slide a finger (or the mouse) to move the tray; press to serve; arrows or A/D slide, Space serves, Up or W fires a pillow.
- **Race:** hold left or right (arrows, A/D) to steer, drag to steer gently, swipe up or Shift to boost, tap a gurney or Space to throw.
- **Gel:** press and swipe; a press on a gremlin slices it at once. Bombs only count on a moving swipe through their middle. E freezes the gel for five seconds.
- **Blaster:** tap to shoot, drag to look, hold and release to pierce. Mouse: the sight follows the pointer, click fires, right-drag looks. R reloads; tap R again in the green for an instant reload.
- **All games:** E uses a limited assist; Escape pauses.

## Progression and difficulty

**Steady hands** gives two assists per run. **Show-off shift** removes them and pays 25% more. The prescriptions are **Pillow Fort**, **Questionable Decisions** and **Absolute Gutastrophe**; they change speed, counts, windows and payouts.

Medals are bronze, silver and gold, worth 1, 2 and 3 discharge stars. Discharge needs 12 stars, a medal in all six games, any level 2 medal, and Ralph beaten.

- **Daily Dose:** the date picks a game and a level. Same run for everyone, local best per day, a streak, and a bonus the first time each day.
- **Gift shop:** eight permanent upgrades (grippy socks, pillow reach, longer shield, thick skin, pocket snacks, Ralph repellent, arcade pass, a lucky scrunchie for a sixth heart) and three wardrobe looks for Macy.
- **Hall of Nonsense:** gremlins evicted, best chain, ward clears, lifetime coins, runs played, daily streak.

Nutrients restore one heart and go in the pocket (three, or five with Pocket snacks). Every room has a snack cart (the lounge has its SNAX machine) that hands out one nutrient and restocks after a ward clear there or two minutes of ward time; a first clear of wave 1 or 2 drops one; every sixth eviction drops one; combo slams drop them too. Floor drops last 30 seconds and leave with you. Zero hearts sends Macy to one gentle IV phase; failing it is where the organs come out, and the nurses patch her up for a few coins either way. All medical mechanics are fictional arcade jokes.

## Her room, and the rest of the hospital

Macy is 5'10", wears 22, and stands around when you leave her alone: she looks about, fixes her scrunchie, bounces a volleyball. Her room has the LEGO water lilies on the sill, the LEGO Jaguar E-Type on the cabinet, a window on Paramus that follows the real clock, and a 75-inch TV with a cat cam (Addie asleep, Stella grooming, Pepper attacking the hand that feeds her), a Rams game, a get-well slideshow and, after dark, the 3 AM channel that should not exist. Every machine on the floor has opinions and one of them is Employee of the Month each day.

Refuse Barb's Ensure often enough and the hospital fills with it: bottles in rows, a storage closet on the map you are not to ask about, gremlins carrying bottles as shields, a cafeteria renamed The Ensure Experience, and finally one bottle that reads FINE. YOU WIN. on a pedestal in her room.

Idle long enough in bed after dark and Macy dreams: a 40-second interlude from a pool of vignettes, with its own woozy theme, until a nurse wakes her.

Medals land with a stamp, confetti and a sting (Rowdy gallops across on gold). There is a sheet of 36 stickers to earn, and a Share button that renders a card as a PNG for the family chat.

## Sound

Everything is synthesized in the browser: a music track per room and per game, a boss theme, win and lose stings, and about fifty sound effects. Sound is on by default and the button in the header or the pause menu turns it off. The preference is saved.

## Build and verify

No package installation, runtime dependencies, remote assets, or backend.

```sh
node gut-feeling/tests/run-all.cjs
```

That builds `index.html` from `src/` and runs every test file. `python3 gut-feeling/build.py` builds on its own. Run from the repository root and commit `src/` and the generated `index.html` together.

Tests: `verify.cjs` (saves, run lifecycle, idle failure in all 54 combinations, discharge, the title screen, touch controls, run-screen sizing, the hallway hooks), `map.cjs` (the floor plan), `combat.cjs` (ward rules, Ralph, and a check that a button-masher dies while a dodging bot wins), `audio.cjs`, `smoke.cjs`, one `game-<name>.cjs` per arcade, and `playthrough.cjs`, which drives an input-only bot from `tests/bots/` through every game, level and prescription. They establish rules and solvability. Human playtesting still decides whether the quotas feel right.

The code layout, the game registry and the rules for editing are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Design references

The implementations, characters, and artwork are specific to this game. Familiar mobile ideas informed it:

- [Halfbrick's Fruit Ninja guide](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja): deliberate multi-target swipes, combos, and power-up windows.
- [Halfbrick's Jetpack Joyride](https://www.halfbrick.com/games/jetpack-joyride-classic): continuous arcade runs and changing obstacles.
- [Supercell's Brawl Stars](https://supercell.com/en/games/brawlstars/): compact combat sessions with varied attacks and modes.

## Saves and hosting

Progress lives in localStorage for the current browser and origin. It does not sync between devices. Saves from v0.5 carry over; v0.6 adds the new counters, the daily record, the shop items and the Ralph flags. A fresh-adventure reset clears progress only after a second deliberate click.

GitHub Pages serves `main` from the repository root. The game also works as a single local HTML file. No account, analytics, cloud save, service worker, or install.
