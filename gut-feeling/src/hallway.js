// The seventh-floor hallway at Valley Hospital (room 6): the long way between department doors, full of
// people who like Macy. No combat, no damage. Visitors stroll, pause, turn to face her, and talk in a
// typed speech box with voice blips; Barb from Dietary rides the elevator up every few minutes with a
// tray of Ensure, and Rowdy the Ram (src/rowdy.js) cheers from the nurses' station. Every finished
// conversation leaves a get-well card for the wall over Macy's bed (state.cards) and bumps the sticker
// counters (state.stats); see "Get-well cards and counters" below.
//
// Framework contract (world.js and input.js call these when they exist):
//   hallwayInstall()             adds room 6 to rooms and its furniture to roomProps (idempotent)
//   hallwayRoomBg(g)             paints the full 3200 × 625 corridor once for the room cache
//   updateRoomExtras(dt)         every simulation step: visitors, prompts, door zones, Barb's timer
//   roomExtraRenderables(all)    [{y, draw(g)}] depth-sorted with Macy and the furniture
//   drawRoomOverlay(g, vw, vh)   screen space after the camera: barks, prompts, the speech box
//   roomExtrasAction(kind, p)    'attack' | 'use' | 'enter' | 'tap' (p in world coordinates) |
//                                'jump' | 'dash' | 'escape'; true when the hallway handled it
//   hallwayEnter(fromRoom)       the room-exit hotspot: remember the door, then goRoom(6)
//   onRoomLoaded(id)             after loadRoom: puts Macy outside the door she came out of

const HALLWAY_ID = 6,
  HALLWAY_W = 3200,
  HALLWAY_H = 625,
  HALLWAY_LEFT = 60,
  HALLWAY_RIGHT = 3140,
  HALLWAY_TOP = 200,
  HALLWAY_BOTTOM = 560,
  // Heights. Macy is 5'10": girl() stands about 88 units tall, drawn at MACY_SCALE (the room's file
  // exports it; 1.36 if not). Visitors are drawn at Macy's scale, so faces match hers, and each body is
  // sized to a multiple of her height by stretching or shortening the legs and torso, never the head.
  // Rowdy is the exception: his costume is drawn at his own scale. The lineup runs Dad > Rowdy > Macy >
  // Dodo = Taylor > Dr. Benedetto > Casey > everyone else, Mimi shortest; Rowdy and Dr. Benedetto (the two
  // made-up heights) sit where that order puts them.
  HALLWAY_MACY_UNITS = 88,
  HALLWAY_HEIGHTS = {
    dad: 1.086,
    rowdy: 1.075,
    dodo: 0.97,
    taylor: 0.97,
    benedetto: 0.957,
    casey: 0.94,
    julez: 0.93,
    lori: 0.93,
    brother: 0.93,
    presley: 0.93,
    norah: 0.914,
    stephanie: 0.914,
    barb: 0.9,
    mimi: 0.886
  },
  HALLWAY_TALK_RANGE = 70,
  HALLWAY_FACE_RANGE = 115,
  HALLWAY_BARK_RANGE = 175,
  HALLWAY_LEAVE_RANGE = 150,
  HALLWAY_TYPE_CPS = 44,
  HALLWAY_HOLD_GAP = 0.05,
  HALLWAY_DOOR_ZONE_X = 48,
  HALLWAY_DOOR_ZONE_Y = 228,
  HALLWAY_DOOR_IN = 184,
  HALLWAY_ARRIVE_Y = 246,
  HALLWAY_ELEVATOR_X = 160,
  HALLWAY_SHOP_X = 2570,
  HALLWAY_EXIT_X = 3100,
  HALLWAY_MAX_BOTTLES = 9,
  // Where Macy actually is: Valley Hospital in Paramus, seventh floor, Room 5.
  HALLWAY_FLOOR = '7',
  HALLWAY_STRIPE = 'VALLEY · 7F · PEDIATRICS',
  HALLWAY_STRIPE_X = [400, 1300, 2200],
  HALLWAY_ROOM = {
    id: 6,
    name: 'Hallway',
    sub: 'SEVENTH FLOOR / THE LONG WAY ROUND',
    theme: '#cfdcd6',
    station: null,
    width: 3200,
    noArcade: true
  };

// Doors along the back wall. The night version of Macy's room uses the same door: it is still her room.
const HALLWAY_DOORS = [
  { room: 0, x: 600, name: 'Your room', plate: 'ROOM 5' },
  { room: 1, x: 1080, name: 'MRI', plate: 'MRI' },
  { room: 2, x: 1560, name: 'Family lounge', plate: 'FAMILY LOUNGE', double: true },
  { room: 3, x: 2010, name: 'CT scan', plate: 'CT SCAN' },
  { room: 4, x: 2430, name: 'Ultrasound', plate: 'ULTRASOUND' }
];

// Voice ids for sfx('talk', {voice}); audio.js defines each one. Mimi speaks with the 'grandma' voice,
// Dodo with 'grandpa'; Presley, Norah, Taylor and Casey share 'cousin', Stephanie and Julez 'nurse', and
// Dr. Lori and Dr. Benedetto 'doctor', each at her or his own pitch offset. Those are audio.js's ids,
// not names anyone sees.
const HALLWAY_VOICES = ['dad', 'brother', 'grandma', 'grandpa', 'cousin', 'doctor', 'nurse', 'ensure', 'macy', 'rowdy'];

const HALLWAY_FLAVORS = ['#7a4b33', '#e9d39a', '#ef9fb0'];

// ---- What people say ----
// talks: one conversation each, one to four bubbles of [who, text]; who is 'npc', 'macy', or the id of
// someone in the same visiting group who chimes in. A talk with when() only comes up while it is true,
// and comes up first the first time it is. {name} and {NAME} become Macy's name. barks are the
// one-liners people call out as she walks past.
const hallwayWon = () => !!state.won,
  hallwayRalphWaiting = () => !!state.ralphReady && !state.ralph,
  hallwayCleared = () => [1, 2, 3, 4].some(i => (state.wardClears[i] || 0) > 0),
  hallwayGold = () => state.medals.some(m => Array.isArray(m) && m.includes(3)),
  hallwayMedals = () => state.medals.some(m => Array.isArray(m) && m.some(Boolean));

const HALLWAY_LINES = {
  dad: {
    whoa: 'Whoa. Easy, speedster.',
    barks: ['There she is.', 'Hey, kiddo.', 'Look at you, walking laps.', "That's my kid."],
    // Dad's conversations come from hallwayDadConvo(): an encouragement, a joke, sometimes a groan.
    talks: []
  },
  brother: {
    whoa: 'Whoa! Rude.',
    barks: ["Oh. It's you.", 'Sup.', 'Nice socks.', 'They have the good chips here.'],
    talks: [
      {
        say: [
          ['npc', "If you're not back soon can I have your room?"],
          ['macy', 'No.'],
          ['npc', 'What if you ARE back soon?']
        ]
      },
      {
        say: [
          ['npc', 'I fed your fish. Mostly.'],
          ['macy', 'Mostly?'],
          ['npc', "He's fine. He's a fish. He doesn't know."]
        ]
      },
      { say: [['npc', 'Mom says I have to say something nice.'], ['npc', '...Your hair looks fine.']] },
      { say: [['npc', "I beat your high score. Kidding. I couldn't get past level 2."]] },
      {
        say: [
          ['npc', "The house is weird without you. Too quiet. Don't tell anyone I said that."],
          ['macy', 'Telling everyone.'],
          ['npc', "Then I'm taking the room."]
        ]
      },
      { say: [['npc', "Dad keeps buying your cereal. Nobody eats it. It's just sitting there. Waiting."]] },
      { when: hallwayWon, say: [['npc', "You're coming home? Cool."], ['npc', 'I mean. Whatever. Cool.']] },
      {
        when: hallwayGold,
        say: [['npc', 'You got a gold? On what?'], ['macy', 'Hospital stuff.'], ['npc', "...Okay, that's actually sick."]]
      },
      {
        when: hallwayRalphWaiting,
        say: [['npc', "There's a gremlin in your room. So can I have your room?"], ['macy', 'Still no.']]
      }
    ]
  },
  mimi: {
    whoa: 'Whoa! My heart, sweetie.',
    barks: ['My girl!', 'Have you eaten? Oh. Right.', 'You look taller!'],
    talks: [
      {
        say: [
          ['npc', "I baked your favorite cookies. The nurse says you can't have them yet, so I'm holding them. For safety."],
          ['macy', 'Whose safety?'],
          ['npc', "The cookies'."]
        ]
      },
      { say: [['npc', 'Dodo proposed to me in a hospital cafeteria. Terrible Jell-O. Wonderful man.']] },
      { say: [['npc', 'I lit a candle for you at church. And one for the Cubs. Yours is working better.']] },
      { say: [['npc', "The nurses say you're brave and polite. Your father bit a nurse once. He was four."]] },
      { say: [['npc', "Is there a cafeteria up here? I'd like to complain to someone in person."]] },
      { say: [['npc', "Don't show me the video games, sweetheart. I'll just watch you be good at them."]] },
      { when: hallwayWon, say: [['npc', "Home! I'll bring the cookies to the house. They've been very patient."]] },
      {
        when: hallwayCleared,
        say: [
          ['npc', "Dodo says you're fighting monsters in here."],
          ['macy', 'I am.'],
          ['npc', 'Good. Hit one for me.']
        ]
      }
    ]
  },
  dodo: {
    whoa: 'Whoa there. Easy.',
    barks: ['Atta girl.', 'Keep moving, kiddo.', "There's my slugger."],
    talks: [
      {
        say: [
          ['npc', 'When I had my appendix out they kept me a week. Food was terrible. Nurses were angels. Still are.']
        ]
      },
      {
        say: [
          ['npc', "Mimi brought cookies. I've been guarding them."],
          ['macy', 'From who?'],
          ['npc', 'Mostly me.']
        ]
      },
      { say: [['npc', "Brave is being scared and getting out of bed anyway. You've done it every day this week."]] },
      { say: [['npc', "I asked the doctor if you'd be home by the weekend. She said probably. I'm holding her to it."]] },
      {
        say: [
          ['npc', 'In my day we walked to the MRI. Uphill. Both ways.'],
          ['macy', "That's not a thing."],
          ['npc', 'It was a thing.']
        ]
      },
      {
        when: hallwayRalphWaiting,
        say: [
          ['npc', 'This Ralph fella in your room. Want me to have a word?'],
          ['macy', 'Dodo.'],
          ['npc', 'A strongly worded word.']
        ]
      },
      { when: hallwayWon, say: [['npc', 'Going home. Good. The house needs its slugger back.']] }
    ]
  },
  // The friends: Presley, Norah and Taylor visit together. Volleyball in the fall, softball in the spring,
  // all with Macy, all Ramsey Rams. Any of them can chime in on another's conversation: a bubble whose
  // who is 'presley', 'norah' or 'taylor' is spoken by that girl, with her own portrait and pitch.
  presley: {
    whoa: 'Whoa! Watch the ponytail!',
    barks: ['{NAME}!', "Let's gooo!", 'Lap queen!', 'Ponytail check: still perfect.'],
    talks: [
      {
        say: [
          ['npc', "Coach let me serve the last point Thursday. I didn't miss. I'm telling you because nobody else will."],
          ['norah', 'She has told everyone.'],
          ['npc', 'Everyone deserved to know.']
        ]
      },
      {
        say: [
          ['npc', 'I redid my ponytail three times in the parking garage. Hospital lighting is a lot.'],
          ['macy', 'It looks the same.'],
          ['npc', "That's the point. Consistency."]
        ]
      },
      { say: [['npc', "We saved your spot on the bench. Nobody's allowed to sit there. It's weird. We love it."]] },
      {
        say: [
          ['npc', 'Practice is so quiet without you yelling MINE at everything.'],
          ['taylor', 'Presley tried. It came out as a question.'],
          ['npc', 'Mine?']
        ]
      },
      { say: [['npc', "The team signed a ball for you. Coach signed it twice. He's emotional."]] },
      {
        say: [
          ['npc', "New rule: my ponytail doesn't come down until you come back."],
          ['macy', "That's going to get gross."],
          ['npc', "That's commitment."]
        ]
      },
      {
        when: hallwayMedals,
        say: [
          ['npc', 'Coach heard about your medals. He wants them in the trophy case.'],
          ['macy', "They're arcade medals."],
          ['npc', "He doesn't care."]
        ]
      },
      {
        when: hallwayWon,
        say: [
          ['npc', "You're out?! Open gym is Tuesday. Kidding. Mostly."],
          ['taylor', "She's not kidding."]
        ]
      }
    ]
  },
  norah: {
    whoa: 'Whoa! Safe!',
    barks: ['Hey, you!', 'Swing, batter!', 'Looking good, {name}.'],
    talks: [
      {
        say: [
          ['npc', "I brought your softball glove. I don't know why. It felt right."],
          ['macy', 'Break it in for me?'],
          ['npc', 'I would never touch your glove.']
        ]
      },
      {
        say: [
          ['npc', 'Taylor drove. She made us listen to her senior playlist. Twice.'],
          ['taylor', "It's called culture."],
          ['npc', "It's called the same four songs."]
        ]
      },
      { say: [['npc', 'Softball starts in March. Coach already has you batting second. No pressure. Some pressure.']] },
      { say: [['npc', "Mimi tried to give me a cookie from your tin. I said no. I'm loyal. I'm also starving."]] },
      { say: [['npc', "We lost Thursday. I'm not saying it's because you're in here. But you're in here."]] },
      {
        say: [
          ['npc', 'Taylor says I get her car when she goes to college.'],
          ['taylor', 'I said maybe.'],
          ['npc', 'Maybe means yes.'],
          ['taylor', 'Maybe means maybe.']
        ]
      },
      { when: hallwayCleared, say: [['npc', "You cleared a whole ward of gremlins? That's basically a triple play."]] },
      { when: hallwayWon, say: [['npc', 'Discharged! First game back, the sunflower seeds are on me.']] }
    ]
  },
  taylor: {
    whoa: 'Whoa! Easy, freshman.',
    barks: ['Hey, superstar.', "Car's out front whenever you're ready.", 'There she is!'],
    talks: [
      {
        say: [
          ['npc', "I drove these two here. Norah touched the radio. We don't talk about it."],
          ['norah', 'I changed ONE song.'],
          ['npc', 'And now we live with that.']
        ]
      },
      {
        say: [
          ['npc', 'Senior advice: the nurses know everything. Be nice to the nurses.'],
          ['macy', 'I am nice to the nurses.'],
          ['npc', "I know. They told me. That's how I know they know everything."]
        ]
      },
      {
        say: [
          ['npc', "Senior night's in the spring. You have to be there. I already made you a sign."],
          ['presley', 'It has glitter.'],
          ['npc', 'It has a LOT of glitter.']
        ]
      },
      {
        say: [
          ['npc', "When you're out, I'm driving you to practice. Shotgun's yours."],
          ['norah', 'I was born in the back seat.']
        ]
      },
      { say: [['npc', "You've got four years on this team. I've got one. Get better so I can brag about you."]] },
      {
        say: [
          ['npc', "Presley's ponytail got a yellow card in warmups."],
          ['presley', 'It was a warning.'],
          ['npc', 'It hit the down ref.']
        ]
      },
      {
        when: hallwayRalphWaiting,
        say: [
          ['npc', "A gremlin named Ralph is in your room? I'll keep the car running."],
          ['macy', 'For him or for me?'],
          ['npc', 'Yes.']
        ]
      },
      {
        when: hallwayWon,
        say: [
          ['npc', "Discharged? I'll pull the car around. You're up front. Norah, you know the drill."],
          ['norah', 'Back seat. Forever.']
        ]
      }
    ]
  },
  // Casey: the fun older cousin. Thirty, drives, smuggles in gossip and the good Rams blanket.
  casey: {
    whoa: 'Whoa! Easy, slugger. You get that from me.',
    barks: ['Cuz!', 'There she is!', "I brought gossip. Don't tell your dad."],
    talks: [
      { say: [['npc', 'I brought you the Rams blanket. The good one. The one your dad thinks he lost.']] },
      {
        say: [
          ['npc', 'The family group chat is out of control. Mimi discovered the thumbs up.'],
          ['macy', 'Just the thumbs up?'],
          ['npc', 'On everything. Even the sad stuff. Especially the sad stuff.']
        ]
      },
      {
        say: [
          ['npc', 'Contraband gossip, hand delivered.'],
          ['macy', 'Spill.'],
          ['npc', 'Riley has a crush. He denied it so hard he fell off a chair.']
        ]
      },
      {
        say: [
          ['npc', 'Remember when you beat me at wiffle ball? You were seven.'],
          ['macy', 'I remember.'],
          ['npc', "I don't. I've blocked it out. Rematch when you're home."]
        ]
      },
      { say: [['npc', "I drove an hour with snacks you can't eat yet. That's love. I also ate them. Also love."]] },
      { say: [['npc', 'Dodo learned voice-to-text. The group chat has not recovered.']] },
      { when: hallwayCleared, say: [['npc', "You cleared a whole ward? I'm telling the group chat. Mimi will thumbs up it."]] },
      { when: hallwayWon, say: [['npc', "You're out! I'm driving. We're getting real food. Don't tell the doctors what kind."]] }
    ]
  },
  // Dr. Lori: kind and direct. Real advice, then a deadpan joke when you least expect it.
  lori: {
    whoa: 'Whoa. Walk, please. Your gut asked me to say that.',
    barks: ['Good to see you upright.', 'Laps count. Keep going.', 'Walking is medicine. Cheap medicine.'],
    talks: [
      {
        say: [
          ['npc', "Walking helps. Moving wakes your gut back up. It's a lazy organ."],
          ['npc', "More laps, fewer days. That's the deal."]
        ]
      },
      {
        say: [
          ['npc', 'I reviewed your scans. You have a skeleton.'],
          ['macy', 'Is that bad?'],
          ['npc', "Very common. We're keeping an eye on it."]
        ]
      },
      { say: [['npc', 'Small sips when we say so. Not before. Your gut is rebooting and it hates surprises.']] },
      {
        say: [
          ['npc', 'On a scale of one to ten, how annoyed are you?'],
          ['macy', 'Eight.'],
          ['npc', "Eight is great. Annoyed means you're getting better."]
        ]
      },
      { say: [['npc', "I don't say soon unless I mean it."], ['npc', 'Soon.']] },
      { when: hallwayWon, say: [['npc', "Discharge papers are signed. Please don't come back. Kindly."]] },
      {
        when: hallwayRalphWaiting,
        say: [
          ['npc', "There's something in your room called Ralph. He's not on my chart. Can you handle it?"],
          ['macy', 'On it.']
        ]
      },
      { when: hallwayCleared, say: [['npc', 'Radiology says the gremlins left you a one-star review. Great work.']] }
    ]
  },
  // Dr. Benedetto: formal, a little theatrical, finds everything excellent. The mustache is load-bearing.
  benedetto: {
    whoa: 'Whoa! Excellent speed. Terrible idea.',
    barks: ['Excellent.', 'Excellent posture. Excellent socks.', 'Ah. The patient of the hour. Excellent.'],
    talks: [
      {
        say: [
          ['npc', 'Your bloodwork came back. Excellent.'],
          ['macy', 'What did it say?'],
          ['npc', 'Numbers. Excellent numbers.']
        ]
      },
      { say: [['npc', 'I have reviewed your chart, your scans and your laps. Excellent, excellent and, frankly, inspiring.']] },
      {
        say: [
          ['npc', 'People ask about the mustache. It is not a costume. It has been with me since residency.'],
          ['macy', 'Does it have a name?'],
          ['npc', 'It prefers not to say.']
        ]
      },
      { say: [['npc', 'A good mustache is like a good recovery. Patience, grooming and no sudden movements.']] },
      {
        say: [
          ['npc', 'Dr. Lori says I say excellent too much.'],
          ['macy', 'You do.'],
          ['npc', 'Excellent observation.']
        ]
      },
      { say: [['npc', 'Behold. The hallway. The stage upon which you will walk three laps today. Excellent.']] },
      { when: hallwayGold, say: [['npc', 'A gold medal. Excellent. I will tell the mustache.']] },
      { when: hallwayWon, say: [['npc', 'Discharged! Excellent. Truly. I would applaud, but I am holding a clipboard.']] }
    ]
  },
  // Stephanie: young, warm, quick. Your vitals take her ninety seconds and she still has time to chat.
  stephanie: {
    whoa: 'Whoa! Walking feet!',
    barks: ['Look at you go!', 'Lap queen!', 'Bravest on seven.', "That's my favorite patient. Don't tell Room 6."],
    talks: [
      { say: [['npc', 'Vitals look good. Attitude is a little spicy. Also good.']] },
      { say: [['npc', "Almost done. I know everyone says that. I'm saying it with data."]] },
      { say: [['npc', 'If you need anything, press the button. If you need gossip, find me.']] },
      {
        say: [
          ['npc', 'The man in Room 8 asked about you. He is eighty and he wants to talk volleyball.'],
          ['macy', 'Is he any good?'],
          ['npc', 'He says he invented the spike.']
        ]
      },
      {
        say: [
          ['npc', 'The whole station is rooting for you. We made a bracket.'],
          ['macy', 'A bracket for what?'],
          ['npc', "Don't worry about it. You're winning."]
        ]
      },
      {
        say: [
          ['npc', 'I do your vitals fast so I can get to the good part of my shift.'],
          ['macy', 'Which is?'],
          ['npc', 'This. Talking to you. Obviously.']
        ]
      },
      {
        when: () => !!hallwayMachine(),
        say: [
          ['npc', 'Employee of the Month went to {machine}. Again. It cried.'],
          ['macy', 'Machines can cry?'],
          ['npc', 'Not well. There was a lot of beeping.']
        ]
      },
      { when: hallwayWon, say: [['npc', "You're discharged! We'll miss you. Not the gremlins."]] },
      {
        when: hallwayMedals,
        say: [['npc', 'We put your medal count on the whiteboard. Dr. Benedetto called it excellent. He calls everything excellent.']]
      }
    ]
  },
  // Julez: fifties, the one who has seen everything. Drops the title. Unflappable, bone dry.
  julez: {
    whoa: 'Whoa. I have seen faster. Not often.',
    barks: ['Keep walking.', 'Looking good, kid.', "Seen worse. You're not it.", 'Hydrate. Within reason.'],
    talks: [
      { say: [['npc', "You're the bravest one on the floor and I've seen a biker cry at a shot."]] },
      { say: [['npc', "I've had grown men complain more about one blood draw than you have all week."]] },
      {
        say: [
          ['npc', 'Thirty years on this floor. You know what I have never seen?'],
          ['macy', 'What?'],
          ['npc', 'Barb take no for an answer.']
        ]
      },
      { say: [['npc', 'Keep walking. Every lap is one less day in here.']] },
      { say: [['npc', "It's just Julez. Nurse Julez is what my mother calls me when she wants a free consult."]] },
      { say: [['npc', 'People ask how I stay calm. I have seen everything twice. The third time is boring.']] },
      { when: hallwayRalphWaiting, say: [['npc', 'A gremlin named Ralph is in your room. Sure. That is a Wednesday.']] },
      { when: hallwayWon, say: [['npc', 'Discharged. Good. Go home. Do not come back. I mean that with love.']] }
    ]
  },
  ensure: {
    whoa: 'Whoa! Watch the tray!',
    barks: ['Ensure delivery!', 'Shake time, hon!', 'Got your Ensure!'],
    talks: [
      {
        say: [
          ['npc', 'Room service! I brought you an Ensure.'],
          ['macy', "I'm not allowed to have those yet."],
          ['npc', 'The kitchen says otherwise.']
        ]
      },
      {
        say: [
          ['npc', 'Chocolate or vanilla?'],
          ['macy', "I'm not allowed to have those yet."],
          ['npc', 'So... chocolate?']
        ]
      },
      {
        say: [
          ['npc', "Here's your Ensure, hon!"],
          ['macy', 'Still not allowed.'],
          ['npc', "I'll leave it here. For later. For never."]
        ]
      },
      {
        say: [
          ['npc', 'We found strawberry! Nobody finds strawberry!'],
          ['macy', "I'm on clear liquids."],
          ['npc', "It's clear-ish if you hold it up to the light."]
        ]
      },
      {
        say: [
          ['npc', 'Thirty grams of protein, hon!'],
          ['macy', 'And zero permission from my doctor.'],
          ['npc', 'Agree to disagree!']
        ]
      },
      {
        say: [['npc', 'Same tray. Same offer. Ensure?'], ['macy', 'Same answer.'], ['npc', 'Same leaving it right here.']]
      },
      // The more no's, the more creative she gets (hallwayCult.n, read on entry).
      {
        when: () => hallwayCultAt(5),
        say: [['npc', 'New flavor! Butter pecan.'], ['macy', "I'm not allowed."], ['npc', "Nobody's allowed. That's what makes it exclusive."]]
      },
      {
        when: () => hallwayCultAt(5),
        say: [
          ['npc', 'Pumpkin spice Ensure. Seasonal. Limited time.'],
          ['macy', 'Still no.'],
          ['npc', "I'll put you down for next fall."]
        ]
      },
      {
        when: () => hallwayCultAt(10),
        say: [
          ['npc', "I made you a loyalty card. Ten no's and the eleventh one's free."],
          ['macy', 'The eleventh what?'],
          ['npc', 'Ensure, hon. Keep up.']
        ]
      },
      {
        when: () => hallwayCultAt(10),
        say: [
          ['npc', "You're my best customer and you've never bought anything."],
          ['macy', "I'm not a customer."],
          ['npc', "That's what the best ones say."]
        ]
      },
      {
        when: () => hallwayCultAt(20),
        say: [['npc', 'Between us, the kitchen has a quota.'], ['macy', 'For Ensure?'], ['npc', "For you. Specifically. There's a chart."]]
      },
      {
        when: () => hallwayCultAt(20),
        say: [
          ['npc', 'I brought a plain one, a fancy one and a decoy.'],
          ['macy', 'What if I pick the decoy?'],
          ['npc', "It's also Ensure."]
        ]
      },
      {
        when: () => hallwayCultAt(30),
        say: [
          ['npc', 'Have you been to The Ensure Experience? I named it.'],
          ['macy', 'No thank you.'],
          ['npc', "It's a whole cafeteria now. You'd love it. You'd drink it."]
        ]
      },
      {
        when: () => hallwayCultAt(30),
        say: [['npc', 'I had a dream you said yes. I woke up crying. Happy crying.'], ['macy', 'Still no.'], ['npc', 'Back to sleep, then.']]
      },
      {
        when: hallwayWon,
        say: [
          ['npc', 'Going home? Take an Ensure for the road!'],
          ['macy', "I'm literally leaving."],
          ['npc', "That's what the road is for!"]
        ]
      }
    ]
  }
};

// ---- Dad ----
// Every Dad talk is one encouragement, one dad joke (two bubbles for the shaggy-dog ones) and, half the
// time, a groan from Macy. Jokes come off a shuffled deck that never repeats until it runs out, then
// reshuffles so the next joke is never the one just told. The deck order, its position and the
// encouragement and groan rotations live in localStorage, so a reload carries on where Dad left off.
const HALLWAY_DAD_KEY = 'gut-feeling-dad';

// The owner's own three lines come first.
const HALLWAY_DAD_CHEERS = [
  "You've got this. I've seen you dig a ball out of the floor.",
  "The nurses asked if you're always this stubborn. I said yes, proudly.",
  "One more day. Maybe two. I'll bring the good pillow.",
  "I'm proud of you. That's not the joke. The joke's coming.",
  "You're tougher than this week, and this week is pretty tough.",
  "Stubborn is a superpower when you point it at the right thing. You're pointing it at the right thing.",
  "Every lap of this hallway counts. I'm counting. Out loud. Sorry.",
  'The team group chat is ninety percent your name right now.',
  "Your spot on the court isn't going anywhere. Neither am I.",
  "I'm right here. Down the hall, by the coffee, all day.",
  "You walked farther today than yesterday. That's the whole game right now.",
  "You don't have to be brave every minute. You've covered the week. I've got the other minutes.",
  "School emailed. They miss you. I know. I'm as surprised as you are.",
  "You're handling this better than I handle a stubbed toe. Low bar. You cleared it by a mile.",
  "Coach says you're still the loudest voice on the court, and you're not even on it.",
  'Home is ready when you are. Riley made your bed. Badly. With love.',
  "You've been braver this week than I was in my entire twenties.",
  "When this is done we're getting real food. Your pick. Even the place I pretend to hate.",
  "Every nurse on this floor knows your name. That isn't a hospital thing. That's a you thing.",
  "You've had worse days on the court and still served for match point.",
  "Small steps are still steps. You're stepping.",
  "You're allowed to be tired of this. Tired is allowed. Quitting was never your style anyway.",
  "The doctor says you're doing the work. I said that's my kid. She already knew.",
  "You're not behind. You're on a different schedule for a minute. Then you're back.",
  "The softball team made you a banner. It's spelled right. Mostly.",
  "Riley won't admit it, but he asks about you every five minutes. Every. Five.",
  "Bad days happen. You've beaten every single one so far. Undefeated.",
  "I'll be in the chair by your bed tonight. Snoring. Supportively.",
  "You make this look easier than it is. I know it isn't. You can tell me that any time.",
  "You're the kind of tough that's quiet about it. That's the best kind.",
  "School can wait. Algebra isn't going anywhere. Unfortunately for both of us.",
  'Every day is one day closer to your own bed, your own pillow, and a door that actually closes.',
  "You keep getting back up. That's the whole sport. Both sports.",
  'I know the hallway is long. So is a five-set match. You love those.',
  "When you get home you're on couch duty for a week. Doctor's orders. Well. Dad's orders.",
  "The way you treat the nurses makes me proud. That's how I know we did something right.",
  "You've got a whole team in this hallway, plus one very tall assistant coach.",
  "Whatever today throws at you, you've got the better arm.",
  "You don't have to be okay all the time. You just have to be you, and you're nailing it.",
  'Mimi has told every person in the cafeteria about you. Every. Person.',
  "You're getting stronger. I can tell because you're arguing with me again.",
  'Home soon. Not doctor soon. Dad soon. I already vacuumed the car.',
  'I love you, kid. Okay. Now the important part.',
  "Last week this lap was a big deal. Now you're lapping me.",
  'You were born stubborn. The doctors are only now finding out.'
];

// The first time one of these is true, it takes the encouragement's place.
const HALLWAY_DAD_REACTIVE = [
  { id: 'won', when: hallwayWon, text: "Discharge papers. Signed. Let's go home." },
  {
    id: 'ralph',
    when: hallwayRalphWaiting,
    text: "There's a gremlin named Ralph in your room. I'll hold the door. You do the rest."
  },
  { id: 'gold', when: hallwayGold, text: 'A gold medal? Of course. You get that from me. The stubborn part.' },
  {
    id: 'cleared',
    when: hallwayCleared,
    text: "A nurse said you cleared a whole ward. I said that's my kid. She said, of gremlins? I said probably."
  }
];

// A string is one bubble; a pair is a two-bubble shaggy-dog joke.
const HALLWAY_DAD_JOKES = [
  // The IV, the pump and the monitor.
  "I asked the nurse what's in your IV. She said it's on a need-to-drip basis.",
  'The IV bag and I have a lot in common. We both hang around all day and keep things flowing.',
  "The IV pump beeps when it's done, when it's not done, and when it's thinking about being done. Very communicative. Unlike Riley.",
  'My jokes are like your IV. Slow, steady, and only a professional can unplug them.',
  "The monitor keeps saying 88. Either that's your heart rate or the number of Jell-Os I've eaten. Both are accurate.",
  "I'm not saying that last joke was bad, but the monitor just went to 89 in protest.",
  'Every time the monitor beeps I sit up straight. Twenty years of dad reflexes, beaten by a machine that just says 88.',
  "Your IV pole follows you everywhere. That's not a medical device. That's a golden retriever with a drip.",
  ["Two IV bags are hanging out on a pole. One says, 'You look a little drained.'", "The other says, 'I'm fine. Just hanging in there.'"],
  "That IV beep has better timing than I do. It always knows when a conversation's over.",
  // The nurse call button.
  'I pressed the nurse call button by accident once. Now I have to pretend I wanted ice chips for the rest of my life.',
  'I tried the nurse call button trick on Riley at home. Nothing. Faulty model.',
  "The nurse call button gets a faster answer than any text I've ever sent you. I'm not bitter. I'm taking notes.",
  // The gurney.
  'Why did the gurney get a speeding ticket? It was wheely in a hurry.',
  "I asked if I could ride the gurney. They said it's for patients. I said I'm very patient. I've been waiting all week.",
  'Gurney is a great word. It sounds like a guy who sells you a used boat.',
  ["Knock knock. Who's there? Gurney.", "Gurney who? Gurney's almost over, kid."],
  // The gown that doesn't close.
  "I asked why the gowns don't close in the back. The nurse said they'd look into it. That's the problem.",
  'Hospital gowns are the only outfit where the back is the plot twist.',
  'Hospital coffee is a lot like a hospital gown. Weak, lukewarm, and somehow still open in the back.',
  'That gown has more ventilation than the parking garage.',
  // The EXIT sign.
  "I followed the EXIT sign. It led me to another EXIT sign. I'm starting to think it's a pyramid scheme.",
  "The EXIT sign has been glowing at me all week. It's the most encouraging thing on this floor. After me.",
  "Ralph says he's the exit. Buddy, the exit has a green sign and much better manners.",
  // The vending machine and the gift shop.
  'The vending machine took my dollar and gave me nothing. I respect it. It knows what it wants.',
  'I asked the vending machine for something healthy. It gave me pretzels and a look.',
  'The gift shop vending machine sells socks. Somebody in this building finally understands me.',
  "I've spent so much at the vending machine it sent me a holiday card.",
  "I asked the gift shop for a get-well card for a softball player. She handed me one that said 'Batter Soon.' I bought six.",
  // Ensure.
  "The kitchen keeps sending Ensure. At this point it's not a drink. It's a pen pal.",
  "There are six Ensures on the floor of this hallway. I'm building a fort. It's for later. For never.",
  'Ensure is the only drink whose name is a promise and a threat at the same time.',
  ["Knock knock. Who's there? Ensure.", "Ensure who? Ensure you don't want one? Barb's coming either way."],
  "Barb says Ensure is a complete meal. So is Thanksgiving, Barb, and nobody's sliding a turkey under the door.",
  // Jell-O and clear liquids.
  'Jell-O is the only food that gets more nervous than you do.',
  "Clear liquids means water, broth and Jell-O. Jell-O counts because it's emotionally fluid.",
  'I tried to nail Jell-O to the wall. A nurse asked me to stop. Honestly, fair.',
  "The only thing you're allowed to spike this week is the Jell-O.",
  'I asked if the Jell-O was homemade. She said hospital-made. Which is a whole different kind of love.',
  'Broth is just soup that gave up on its dreams.',
  'Ice chips are just water doing a bit.',
  "Clear liquids diet. You're eating like a ghost this week. Very spooky. Very hydrated.",
  "I've watched you sip broth with the focus of a free throw. Wrong sport. Same energy.",
  // Visiting hours and the parking garage.
  "Visiting hours end at eight. I asked when dad hours end. They said that's not a thing. I said watch me.",
  'How do you get a gremlin to leave? Tell it visiting hours are over. Works on me every single night.',
  'They gave me a visitor sticker. I wore it to the grocery store. Nobody questions a man with a sticker.',
  "The parking garage charges by the hour. At this point it's cheaper to live there. I've picked out curtains.",
  "I've circled the parking garage so many times the ticket machine waves at me.",
  "The parking garage has three levels: P1, P2, and 'Pfft, good luck.'",
  // The bill.
  'They gave me an itemized bill. Turns out the ice chips are artisanal.',
  "I asked billing if they take coupons. They said, sir, this is a hospital. I said, so that's a maybe?",
  "I asked what the bill would be. They said don't worry about that right now. Which is exactly what I say before I buy a kayak.",
  // Gut feelings, gut calls, a lot to digest.
  'The doctors had to make a gut call. They said it was a tough one to stomach.',
  'I know this is a lot to digest. Take your time. Small bites. Kidding. No bites yet.',
  "I asked the doctor if your stomach was upset. She said it's more disappointed than upset. Classic. It's growing up.",
  'The gut is the only organ with a feeling named after it. The liver is very hurt about this.',
  'Your stomach did a full flip this week. The judges gave it a 9.5. Lost points on the landing.',
  "I'm not saying your stomach is dramatic, but it just asked for its own agent.",
  'Your gut is basically a long hallway. Same as this one. Neither of you is allowed to rush.',
  'Butterflies in your stomach are fine. The nurses just want to see their visitor stickers first.',
  "I had a gut feeling you'd be fine. Then I remembered my gut thinks Taco Tuesday is a personality.",
  'Your stomach and I have something in common. We both need a minute to settle down after a big game.',
  'Your stomach issued a full recall this week. Very responsible. Great customer service.',
  "Why don't skeletons go to the hospital? They don't have the guts. You've got plenty. Maybe too many, this week.",
  "The doctor says your gut is healing. Your gut says it'll believe it when it sees it. Stubborn. Wonder where it gets that.",
  // The bucket years.
  "I told the nurse you'd been throwing up. She asked if it was a pitch count.",
  'Whatever happened in that bucket, you really put your whole self into it.',
  'They call it throwing up, but yours was more of an underhand. Very softball of you.',
  'Coach always said leave it all on the court. You left it all on the floor. Close enough. Points for effort.',
  'I hear the bucket is retiring your number.',
  "The barf bag says 'for motion sickness.' I'd like to file a complaint. There was no motion. Just sickness.",
  'Upchuck is a terrible name. Chuck never did anything to anybody.',
  "If barfing were a sport you'd be all-conference. The judges loved your follow-through.",
  'The nurse asked how much you threw up. I said, in volleyball terms, a full rotation.',
  "It's not vomit. It's your stomach returning items without a receipt.",
  'Your aim into that bag was so good I want you pitching Saturday.',
  'The night nurse said you had a rough one. Strong effort, though. Very full-throated.',
  'You threw up so hard the bucket asked for a trade.',
  ['A skeleton walks into the cafeteria and orders a coffee and a mop.', 'Your stomach would understand.'],
  // The court and the diamond.
  "Good news: they cleared you to set. Bad news: it's the table.",
  'Why did the volleyball go to the hospital? It got served.',
  "Volleyball players make great patients. You're used to rotations. The nurses rotate every twelve hours. You're basically on a team.",
  "From your door to the nurses' station is sixty feet. I paced it. That's a base path. You could steal it in your socks.",
  'Grippy socks are basically cleats for people with feelings.',
  'Your grippy socks have more traction than my career.',
  "You're batting a thousand on vital signs. The doctor asked me to say that in a less dad way. I declined.",
  "Hospitals and softball are the same. Long waits, matching outfits, and someone always yells 'heads up' a little late.",
  "The IV pole stands next to you all day with its arms up. That's the most committed blocker I've ever seen.",
  "Volleyball tip from the hospital: if you can't spike it, set it down gently. Applies to Jell-O, Ensure and Riley.",
  "Coach says rest is part of training. So technically you're in the best shape of your life. Lying down.",
  // Gremlins and Ralph.
  "I asked the doctor about the gremlins. She said they're not in your chart. I said they're in your room, though. She said that's a facilities issue.",
  'Ralph called. He wants his dignity back. I told him you spiked it.',
  'Ralph is the only one on this floor worse at hospital food than you. He ate the tray.',
  "Ralph filed a complaint. Says the pillows here hit too hard. I said those aren't the pillows. That's the swing.",
  "I tried to tell a gremlin a joke. It didn't laugh. In fairness it's mostly a stomach with teeth. Tough crowd.",
  [
    "So Ralph walks into the nurses' station and says, 'I'd like to report an assault. Somebody keeps hitting me with a pillow.'",
    "The nurse says, 'Sir, that's a fourteen-year-old with great form. That's not a crime. That's a highlight reel.'"
  ],
  [
    'A gremlin walks into the ER holding his head. The nurse asks what happened.',
    "He says, 'I kept wondering why that softball was getting bigger. Then it hit me.'"
  ],
  'Why did the gremlin get kicked out of radiology? Everyone could see right through him.',
  "The gremlins asked for a rematch. I said she's booked. They asked when she's free. I said she's not free. She's undefeated.",
  'Gremlins hate hospitals. Too many people washing their hands of them.',
  // Discharge paperwork.
  'I asked how long discharge paperwork takes. They said it depends. I said on what? They said on the paperwork.',
  'Discharge papers are like a group project. Everybody signs, nobody reads, and somehow you still go home.',
  "Fun fact: 'discharge' sounds gross in every sentence except the one where you get to leave. That one's my favorite sentence.",
  "I've been practicing signing your discharge papers. My signature is ready. My handwriting is not.",
  'The discharge nurse said any time between noon and the heat death of the universe. I respect the precision.',
  'I already packed the car for discharge. Twice. The second time I packed the first packing.',
  // The departments and the doctors.
  'Why did the doctor carry a red pen? In case she needed to draw blood.',
  "I told the MRI tech I have a magnetic personality. She said then you can't come in.",
  "The CT scanner is a giant donut you're not allowed to eat. That's just cruel engineering.",
  "Ultrasound gel is cold on purpose. It's how they find out who you really are.",
  "What did the X-ray say to the patient? I can see you're going through something.",
  "The elevator stops at every floor. It's not slow. It's thorough. Like a good doctor.",
  'The doctor asked if anyone in the family has a history of bad jokes. Everyone pointed at me. Hereditary, apparently. Sorry in advance.',
  "I asked a nurse for a second opinion on my jokes. She said they're bad. I asked for a third. Riley said they're bad. That's a consensus. I'm appealing.",
  "If laughter is the best medicine, I'm practicing without a license.",
  "I asked the doctor what's best for your stomach. She said time. I asked if that comes in chewable.",
  'What do you call a doctor who fixes websites? A URL-ologist.',
  "They took your temperature eleven times today. Either you're very important or the thermometer has trust issues.",
  'This floor is so quiet at night you can hear a pin drop. Then three nurses run in to check on the pin.',
  "What's the difference between a hotel and a hospital? The hotel doesn't wake you at 3 a.m. to ask if you're sleeping okay.",
  "I asked the nurse how long you'll be here. She said it's hard to say. So I said it slowly. Still hard.",
  ["Patient says, 'Doctor, I feel like a pair of curtains.'", "Doctor says, 'Pull yourself together.'"],
  ["Guy says, 'Doc, I think I'm a deck of cards.'", "Doctor says, 'Have a seat. I'll deal with you later.'"],
  ['A man walks into the doctor with a strawberry growing out of his head.', "The doctor says, 'I'll give you some cream to put on that.'"],
  ["Guy says, 'Doc, every time I drink coffee I get a stabbing pain in my eye.'", "Doctor says, 'Try taking the spoon out.'"],
  'I told the doctor I broke my arm in two places. She said stop going to those places.',
  "The doctors here are very patient. So are you. That's a lot of patience for one floor.",
  'Your wristband has a barcode. If I scan you at the grocery store, do you come with a discount?',
  "The doctor says you're recovering ahead of schedule. Which is more than I can say for the elevator.",
  // Cafeteria and snacks.
  "The cafeteria has a dish called Chef's Surprise. The surprise is there's no chef.",
  "I'd tell you a joke about the cafeteria, but nothing on that menu is funny. Or entirely food.",
  "Why did the cookie go to the hospital? It was feeling crummy. Mimi's cookies are on standby for when you're allowed.",
  "Why did the banana go to the doctor? It wasn't peeling well.",
  // Hospital life.
  "I asked for a pillow that doesn't crinkle. The nurse laughed for a full minute. Then she brought me a crinkly one.",
  "Every hand sanitizer here makes the same noise. Pfft. It's the hospital's laugh track. It goes off after all my jokes.",
  "I got lost on the way to the cafeteria. A nurse said I was in the wrong wing. I said I'm a dad, I'm always winging it.",
  'Your bed goes up, down and folds in half. It has more moves than I do at a wedding.',
  'The lounge TV is seventy-five inches. Four channels: news, weather, the hospital channel, and me standing in front of it. I still block all of it.',
  "I asked if they have Wi-Fi. They said the password is 'getwellsoon.' Very manipulative. It worked.",
  "I made you a hospital playlist. 'Under Pressure,' 'Don't Stop Me Now,' and anything called 'Home.' That's a hint.",
  "Hospital socks have grips on both sides so you can't put them on wrong. Finally, a dad-proof design.",
  ["Knock knock. Who's there? Interrupting nurse.", "Interrupting nurse wh... 'Vitals! Sorry, hon, quick vitals.'"],
  "Your hospital bracelet has your name, your birthday and your allergies. Mine would just say 'Dad. Has snacks. Will make jokes.'",
  "The nurse wrote your goals on the whiteboard. 'Walk three laps.' I added 'Laugh at one joke.' She erased it. Medically unrealistic."
];

const HALLWAY_DAD_GROANS = [
  'Dad.',
  'That one hurt more than the IV.',
  "I'm telling the nurse.",
  'Can I have a different dad for five minutes?',
  "I'm pressing the call button.",
  'Even the monitor groaned.',
  'Please discharge me from this conversation.',
  'My stomach was finally settling down.',
  'Is that covered by insurance?',
  "You workshopped that one, didn't you?",
  "I'm walking faster now.",
  "That's going in the family group chat. As evidence.",
  "Barb's jokes are better, and Barb doesn't tell jokes.",
  'Ugh. Okay. That one was decent.',
  'I liked you better before the coffee.',
  "I'm putting my headphones in. Emotionally.",
  "I'm adding that to my list of symptoms.",
  "Lucky for you I'm not allowed to roll my eyes that hard.",
  'Ten out of ten. On the groan scale.',
  "I'm going to need an Ensure. No. Not an Ensure.",
  'How long did you sit on that one?',
  'Dodo told it better.'
];

let hallwayDad = null;

function hallwayDadValid(d) {
  const n = HALLWAY_DAD_JOKES.length;
  if (!d || typeof d !== 'object' || d.n !== n || !Array.isArray(d.order) || d.order.length !== n) return false;
  if (new Set(d.order).size !== n || !d.order.every(i => Number.isInteger(i) && i >= 0 && i < n)) return false;
  return Number.isInteger(d.pos) && d.pos >= 0 && d.pos <= n && Number.isInteger(d.last) && d.last >= -1 && d.last < n;
}

// A fresh shuffle that never starts with the joke just told. The rotations carry over.
function hallwayDadShuffle(last, keep = {}) {
  const order = hallwayShuffle(HALLWAY_DAD_JOKES.map((_, i) => i));
  if (order.length > 1 && order[0] === last) {
    const j = 1 + Math.floor(rand(0, order.length - 1));
    order[0] = order[j];
    order[j] = last;
  }
  return {
    n: HALLWAY_DAD_JOKES.length,
    order,
    pos: 0,
    last,
    cheer: Number.isInteger(keep.cheer) ? keep.cheer : 0,
    groan: Number.isInteger(keep.groan) ? keep.groan : 0
  };
}

function hallwayDadDeck() {
  if (hallwayDad) return hallwayDad;
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(HALLWAY_DAD_KEY) || 'null');
  } catch {
    stored = null;
  }
  if (hallwayDadValid(stored)) {
    hallwayDad = stored;
    if (!Number.isInteger(hallwayDad.cheer)) hallwayDad.cheer = 0;
    if (!Number.isInteger(hallwayDad.groan)) hallwayDad.groan = 0;
  } else hallwayDad = hallwayDadShuffle(-1, stored && typeof stored === 'object' ? stored : {});
  return hallwayDad;
}

function hallwayDadSave() {
  try {
    localStorage.setItem(HALLWAY_DAD_KEY, JSON.stringify(hallwayDad));
  } catch {
    // No storage (a private window, a full quota): Dad still talks, he just forgets on reload.
  }
}

function hallwayDadConvo(npc) {
  let deck = hallwayDadDeck();
  if (deck.pos >= deck.order.length) {
    deck = hallwayDadShuffle(deck.last, deck);
    hallwayDad = deck;
  }
  const joke = deck.order[deck.pos],
    reactive = HALLWAY_DAD_REACTIVE.find(r => r.when() && !npc.heard.includes(r.id));
  deck.pos++;
  deck.last = joke;
  let cheer;
  if (reactive) {
    npc.heard.push(reactive.id);
    cheer = reactive.text;
  } else {
    cheer = HALLWAY_DAD_CHEERS[deck.cheer % HALLWAY_DAD_CHEERS.length];
    deck.cheer = (deck.cheer + 1) % HALLWAY_DAD_CHEERS.length;
  }
  const lines = [{ who: 'npc', text: hallwayFill(cheer), cheer: true }];
  for (const text of [].concat(HALLWAY_DAD_JOKES[joke])) lines.push({ who: 'npc', text: hallwayFill(text), joke });
  if (rand(0, 1) < 0.5) {
    lines.push({ who: 'macy', text: HALLWAY_DAD_GROANS[deck.groan % HALLWAY_DAD_GROANS.length], groan: true });
    deck.groan = (deck.groan + 1) % HALLWAY_DAD_GROANS.length;
  }
  npc.count++;
  hallwayDadSave();
  return lines;
}

// ---- Get-well cards and counters ----
// The first finished conversation with each visitor leaves a card on the wall over Macy's bed:
// state.cards gets {who, name, text, day}. The room's owner draws and saves the cards; this file only
// adds them. who is the cast id (dad, brother, mimi, dodo, presley, norah, taylor, casey, stephanie,
// julez, lori, benedetto, barb, rowdy). The text is picked from the
// visitor's list by a hash of who and the day, so it never touches the random stream. A conversation
// counts once the last bubble is done, or when it is closed after at least one whole bubble.
// state.stats feeds the stickers: talks, dadJokes, ensureRefused, cheers (a Rowdy cheer Macy stayed
// within his watch radius for, on his timer or in a talk) and metEveryone (1 once every cast member
// has a card).
const HALLWAY_CARDS = {
  // Dad's card is an encouragement, never a joke: the owner's own three lines.
  dad: HALLWAY_DAD_CHEERS.slice(0, 3),
  brother: [
    'Get well. Mom made me write this. I mean it anyway.',
    'Your room is still yours. For now. Hurry up.',
    "The fish says hi. I'm translating."
  ],
  mimi: [
    'The cookies are waiting. So am I. Love you, sweetheart.',
    'Eat when they say. Then eat my cookies.',
    "I've bragged about you to the whole cafeteria. Get well, my girl."
  ],
  dodo: [
    'Brave is getting up anyway. You do it every day. Proud of you, slugger.',
    'Home by the weekend. I told the doctor. Twice.',
    "Atta girl. Keep walking. I'm guarding the cookies."
  ],
  presley: [
    "The ponytail stays up until you're back. That's a promise and a threat.",
    'Your spot on the bench is saved. Nobody sits there. Hurry back!',
    'Practice is too quiet. Come back and yell MINE at us.'
  ],
  norah: [
    "Your glove is safe. I haven't touched it. I'm loyal.",
    'Batting second in March. Coach said. So get well, okay?',
    'Taylor says hi. I say it better. Get well soon.'
  ],
  taylor: [
    "Shotgun is yours the day you're out. Norah gets the back.",
    "Senior night needs you in the stands. I made a sign. It's mostly glitter.",
    'Get better so I can brag about you. Four years of you on this team. Lucky us.'
  ],
  casey: [
    'Contraband gossip is waiting at home. Get well so I can tell you in person.',
    'The Rams blanket stays with you. Your dad can find a new one.',
    "Wiffle ball rematch the day you're home. I've been practicing. Secretly."
  ],
  lori: [
    'Rx: more laps, fewer days. Refills: unlimited.',
    "I don't say soon unless I mean it. Soon.",
    "Annoyed means you're getting better. You're doing great."
  ],
  benedetto: [
    'Prognosis: excellent. Patient: excellent. Socks: excellent.',
    'The mustache and I wish you a swift recovery. Excellent work.',
    'Excellent. That is the whole note. Excellent.'
  ],
  stephanie: [
    'Vitals: good. Attitude: spicy. Also good. Get well!',
    'Press the button for help. Find me for gossip.',
    'Bravest patient on seven. We have data.'
  ],
  julez: [
    "I've seen everything. You're still the toughest one on this floor.",
    'Keep walking. Every lap is one less day in here.',
    'A biker cried at a shot once. You did not. Noted.'
  ],
  // Barb's card is a coupon. It is, of course, for Ensure.
  barb: [
    'COUPON: one free Ensure. Valid the day your doctor says yes.',
    'Good for one strawberry Ensure. We found strawberry. Expires never.',
    'Redeem for one Ensure, any flavor. No expiration. No pressure. Some pressure.'
  ],
  rowdy: [
    'Two bits! Four bits! Six bits! A dollar! All for {name}, stand up and holler!',
    "We got spirit, yes we do! Get well, {name}, we're cheering for you!",
    'Blue and gold, ready to roll! Get well, {name}! GO RAMS!'
  ]
};

const hallwayCardWho = npc => npc.id;

// Today as YYYY-MM-DD in local time, the same shape as the Daily Dose key.
function hallwayDay(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function hallwayCardText(who, day) {
  const list = HALLWAY_CARDS[who] || ['Get well soon, {name}!'];
  let h = 7;
  for (const ch of who + '|' + day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return hallwayFill(list[h % list.length]);
}

function hallwayStats() {
  if (!state.stats || typeof state.stats !== 'object') state.stats = {};
  return state.stats;
}

function hallwayBump(key, n = 1) {
  const s = hallwayStats();
  s[key] = (Number(s[key]) || 0) + n;
  return s[key];
}

function hallwaySave() {
  if (typeof save === 'function') save();
}

// A bubble comes up: Dad's joke (once per talk, however many bubbles it takes) and Macy's no to Barb.
function hallwayBubble(tk) {
  const line = tk.lines[tk.i];
  if (!line) return;
  if (Number.isInteger(line.joke) && !tk.joked) {
    tk.joked = true;
    hallwayBump('dadJokes');
  }
  // Barb's trophy scene is not an offer, so Macy's line in it is not a refusal.
  if (tk.npc.ensure && line.who === 'macy' && !tk.refused && !line.finale) {
    tk.refused = true;
    hallwayBump('ensureRefused');
  }
  if (line.finale === 'give') hallwayEnsureTrophy(tk.npc);
}

// A conversation that counts: the counters, the card (first time only), then the save.
function hallwayTalked(npc, tk, finished) {
  hallwayBump('talks');
  if (npc.rowdy && finished && tk.lines[0] && tk.lines[0].cheer && dist(npc, player) <= npc.spec.timing.watchRadius)
    hallwayBump('cheers');
  if (!Array.isArray(state.cards)) state.cards = [];
  const who = hallwayCardWho(npc);
  if (!state.cards.some(c => c && c.who === who)) {
    const day = hallwayDay();
    state.cards.push({ who, name: npc.name, text: hallwayCardText(who, day), day });
  }
  const met = new Set(state.cards.map(c => c && c.who));
  if (hallwayCast.length && hallwayCast.every(n => met.has(hallwayCardWho(n)))) hallwayStats().metEveryone = 1;
  hallwaySave();
}

// ---- Hallway state ----
let hallwayCast = [],
  hallwayTalk = null,
  hallwayTarget = null,
  hallwayBottles = [],
  hallwayEnsure = { phase: 'away', due: 20, patience: 0, board: 0, trips: 0 },
  hallwayElevator = { open: 0, hold: 0 },
  hallwayClock = 0,
  hallwayArrival = 0,
  hallwayBarkGap = 0,
  hallwayPressAt = -1,
  hallwayPressTook = false,
  hallwayFrom = null,
  hallwayLastRoom = 0,
  hallwayVisited = false,
  // True from a hallway entry until Macy leaves it, so a repeated onRoomLoaded(6) is the same visit.
  hallwayInside = false,
  hallwayUi = { css: 1, prompt: 13 };

// ---- Small helpers ----
const npcShadeCache = new Map();

// Macy's ward draw scale (the room's file exports MACY_SCALE); visitors are drawn at the same scale.
function hallwayMacyScale() {
  return typeof MACY_SCALE === 'number' && Number.isFinite(MACY_SCALE) && MACY_SCALE > 0 ? MACY_SCALE : 1.36;
}

const hallwayNpcScale = () => hallwayMacyScale(),
  hallwayMacyHeight = () => HALLWAY_MACY_UNITS * hallwayMacyScale();

// Stretch or shorten a look's legs and torso (in proportion) so its drawn top is mult × Macy's height.
// The head, the hair and everything above the shoulders keep their size.
function hallwayFitLook(look, mult) {
  const body = look.leg + look.torso,
    fixed = npcTop(look) - body,
    k = Math.max(30, mult * HALLWAY_MACY_UNITS - fixed) / body;
  look.leg *= k;
  look.torso *= k;
  return look;
}

// Employee of the Month, from the room's file when it is there: {id, name, line}, or null.
function hallwayMachine() {
  if (typeof machineOfTheMonth !== 'function') return null;
  try {
    const m = machineOfTheMonth();
    return m && typeof m === 'object' && typeof m.name === 'string' && m.name ? m : null;
  } catch {
    return null;
  }
}

// Darken (k < 1) or lighten (k > 1) a #rrggbb colour. Cached: figures ask for the same shades every frame.
function npcShade(hex, k = 0.85) {
  const key = hex + '|' + k;
  const hit = npcShadeCache.get(key);
  if (hit) return hit;
  const h = String(hex).replace('#', ''),
    full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h.slice(0, 6),
    n = parseInt(full, 16);
  if (!Number.isFinite(n)) return hex;
  const part = shift => clamp(Math.round(((n >> shift) & 255) * k), 0, 255).toString(16).padStart(2, '0'),
    out = '#' + part(16) + part(8) + part(0);
  npcShadeCache.set(key, out);
  return out;
}

function hallwayShuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    const keep = out[i];
    out[i] = out[j];
    out[j] = keep;
  }
  return out;
}

const hallwayName = () => (typeof state.name === 'string' && state.name.trim()) || 'Macy',
  hallwayFill = text =>
    text
      .replace(/\{name\}/g, hallwayName())
      .replace(/\{NAME\}/g, hallwayName().toUpperCase())
      .replace(/\{machine\}/g, () => (hallwayMachine() || { name: 'The MRI' }).name.replace(/^The /, 'the ')),
  hallwayHere = () => state.room === HALLWAY_ID && hallwayCast.length > 0,
  hallwayBusy = () => mini.open || (typeof isModal === 'function' && isModal()) || state.paused;

// ---- The cast ----
function npcLook(over) {
  return {
    leg: 32,
    torso: 32,
    shoulder: 12.5,
    hip: 7,
    legW: 7,
    armW: 6.4,
    head: 12.3,
    skin: '#ffdab3',
    skinShade: '#e9ad8c',
    hair: '#5a3a28',
    hairDark: '#3a2620',
    hairStyle: 'short',
    eyes: '#6b4226',
    brows: '#4a3020',
    top: 'tee',
    topA: '#7fb8aa',
    topB: '#f2efe2',
    topC: '#3d6c6a',
    pants: '#4f5d6b',
    cuffs: false,
    shoes: 'sneaker',
    shoeColor: '#f4f2ea',
    shoeAccent: '',
    shortSleeve: false,
    item: '',
    glasses: '',
    mustache: '',
    band: '',
    number: '',
    stetho: false,
    badge: false,
    pearls: false,
    stubble: false,
    kneepads: '',
    shades: '',
    letter: '',
    bounce: 0,
    tie: '#3f6fa8',
    tieColor: '',
    handlebar: false,
    age: 0,
    seed: rand(0, 10),
    ...over
  };
}

// Macy's family shares her skin tone and her brown eyes.
const HALLWAY_LOOKS = {
  dad: () =>
    npcLook({
      leg: 47,
      torso: 42,
      shoulder: 12.4,
      hip: 6.6,
      legW: 7.3,
      armW: 6.2,
      head: 12.6,
      hair: '#4b3022',
      hairDark: '#2f1d16',
      hairStyle: 'wavy',
      eyes: '#6b4226',
      brows: '#3f2a1f',
      top: 'zip',
      topA: '#4e6175',
      topB: '#c3c9cc',
      topC: '#2b3746',
      pants: '#6b737c',
      cuffs: true,
      shoes: 'moc',
      shoeColor: '#9a6a45',
      item: 'coffee',
      stubble: true
    }),
  brother: () =>
    npcLook({
      leg: 30,
      torso: 28,
      shoulder: 11,
      hip: 6.1,
      legW: 6.5,
      armW: 5.8,
      head: 12.1,
      hair: '#7a5233',
      hairDark: '#583a24',
      hairStyle: 'straight',
      eyes: '#b07a45',
      brows: '#6a4630',
      top: 'hoodie',
      topA: '#e08a4f',
      topB: '#f6d9b8',
      topC: '#a85e33',
      pants: '#59626e',
      cuffs: true,
      shoes: 'sneaker',
      shoeColor: '#f4f2ea',
      shoeAccent: '#d9534f',
      item: 'chips'
    }),
  mimi: () =>
    npcLook({
      leg: 22,
      torso: 28,
      shoulder: 13,
      hip: 8.4,
      legW: 7.4,
      armW: 6.2,
      head: 12.2,
      skin: '#f6d2b8',
      skinShade: '#e2ad92',
      hair: '#dcd8d2',
      hairDark: '#b3aea8',
      hairStyle: 'bun',
      eyes: '#6f8a9a',
      brows: '#a9a39c',
      age: 1,
      top: 'cardigan',
      topA: '#b49acb',
      topB: '#f4ecd8',
      topC: '#f8f3e6',
      pants: '#7d6f8e',
      shoes: 'flat',
      shoeColor: '#6b5a52',
      item: 'tin',
      glasses: '#8a6d5a',
      pearls: true
    }),
  dodo: () =>
    npcLook({
      leg: 33,
      torso: 34,
      shoulder: 13.4,
      hip: 7.4,
      legW: 7.6,
      armW: 6.6,
      head: 12.5,
      skin: '#f4cfb2',
      skinShade: '#dda88b',
      hair: '#eceae5',
      hairDark: '#c4c0b8',
      hairStyle: 'cap',
      hat: '#8b7b63',
      hatDark: '#6c5e4a',
      eyes: '#5a6e7c',
      brows: '#d8d4cc',
      age: 1,
      top: 'vest',
      topA: '#6f8a5f',
      topB: '#ebe5d2',
      topC: '#55704a',
      pants: '#6e6655',
      shoes: 'loafer',
      shoeColor: '#5a3f30',
      glasses: '#3c3c3c',
      mustache: '#ecebe6'
    }),
  // The friends wear Ramsey Rams blue and gold. Presley: freshman, blond, a high ponytail that never
  // stops moving, the fall volleyball jersey and kneepads, the team ball.
  presley: () =>
    npcLook({
      leg: 36,
      torso: 30,
      shoulder: 11.8,
      hip: 6.7,
      legW: 6.7,
      armW: 5.8,
      head: 12.1,
      skin: '#f6d4b9',
      skinShade: '#e3af93',
      hair: '#efcf7f',
      hairDark: '#c49b4a',
      hairStyle: 'pony',
      band: '#f0c94a',
      bounce: 2.4,
      eyes: '#5b7fa6',
      brows: '#b48a48',
      top: 'jersey',
      topA: '#2f5fb3',
      topB: '#f0c94a',
      topC: '#f6f3e6',
      number: '9',
      shortSleeve: true,
      pants: '#24324a',
      kneepads: '#1b2433',
      shoes: 'sneaker',
      shoeColor: '#f4f2ea',
      shoeAccent: '#2f5fb3',
      item: 'volleyball'
    }),
  // Norah: freshman, brunette, a long braid over one shoulder, her spring softball jersey and her glove.
  norah: () =>
    npcLook({
      leg: 34,
      torso: 30,
      shoulder: 11.8,
      hip: 6.9,
      legW: 6.9,
      armW: 5.9,
      head: 12.1,
      skin: '#f1c7a2',
      skinShade: '#d9a37f',
      hair: '#5c3b28',
      hairDark: '#3b2519',
      hairStyle: 'braid',
      band: '#f0c94a',
      eyes: '#6b4226',
      brows: '#3b2519',
      top: 'softball',
      topA: '#2f5fb3',
      topB: '#f0c94a',
      topC: '#1f3f7a',
      number: '14',
      shortSleeve: true,
      pants: '#dcdde0',
      cuffs: true,
      shoes: 'sneaker',
      shoeColor: '#f4f2ea',
      shoeAccent: '#f0c94a',
      item: 'glove'
    }),
  // Taylor: Norah's big sister, a senior, the same brown hair worn long, sunglasses parked on top. The
  // senior touch is the varsity jacket (a chenille R, class of '27); she has the car keys, because she drives.
  taylor: () =>
    npcLook({
      leg: 39,
      torso: 33,
      shoulder: 12.4,
      hip: 7,
      legW: 7,
      armW: 6.1,
      head: 12.3,
      skin: '#f1c7a2',
      skinShade: '#d9a37f',
      hair: '#563724',
      hairDark: '#352116',
      hairStyle: 'long',
      shades: '#2b2b33',
      eyes: '#6b4226',
      brows: '#352116',
      top: 'letter',
      topA: '#22427f',
      topB: '#f2e6c4',
      topC: '#f0c94a',
      letter: 'R',
      number: '27',
      pants: '#3d5275',
      shoes: 'sneaker',
      shoeColor: '#f4f2ea',
      shoeAccent: '#f0c94a',
      item: 'keys'
    }),
  // Casey: thirty, brunette, braided pigtails, a hoodie, and the good Rams blanket under her arm.
  casey: () =>
    npcLook({
      leg: 38,
      torso: 33,
      shoulder: 12.3,
      hip: 7.1,
      legW: 7,
      armW: 6.1,
      head: 12.3,
      skin: '#f3cdab',
      skinShade: '#deaa88',
      hair: '#5e3b26',
      hairDark: '#3d2618',
      hairStyle: 'pigtails',
      band: '#f0c94a',
      eyes: '#6b4226',
      brows: '#3d2618',
      top: 'hoodie',
      topA: '#3b6e5e',
      topB: '#e9e2cf',
      topC: '#2c5246',
      pants: '#3d5275',
      cuffs: true,
      shoes: 'sneaker',
      shoeColor: '#f4f2ea',
      shoeAccent: '#3b6e5e',
      item: 'blanket'
    }),
  // Dr. Lori: kind and direct. White coat, no tie, auburn bob, readers, clipboard.
  lori: () =>
    npcLook({
      leg: 38,
      torso: 35,
      shoulder: 12.5,
      hip: 7,
      legW: 7,
      armW: 6.2,
      head: 12.3,
      skin: '#f3cfae',
      skinShade: '#dfab89',
      hair: '#9a5634',
      hairDark: '#713c22',
      hairStyle: 'bob',
      eyes: '#4f7d5a',
      brows: '#713c22',
      top: 'coat',
      topA: '#f6f7f2',
      topB: '#c9a6d4',
      topC: '#c9d2d4',
      tie: '',
      pants: '#4c5563',
      shoes: 'loafer',
      shoeColor: '#2f2b2b',
      item: 'clipboard',
      glasses: '#5a3d2e',
      stetho: true,
      badge: true
    }),
  // Dr. Benedetto: tall, formal, a bow tie, slicked dark hair and a magnificent dark mustache.
  benedetto: () =>
    npcLook({
      leg: 41,
      torso: 38,
      shoulder: 13.6,
      hip: 7.2,
      legW: 7.4,
      armW: 6.6,
      head: 12.7,
      skin: '#e2ae88',
      skinShade: '#c99068',
      hair: '#2a1f1c',
      hairDark: '#140e0c',
      hairStyle: 'slick',
      eyes: '#3a261c',
      brows: '#140e0c',
      top: 'coat',
      topA: '#f6f7f2',
      topB: '#a9c4e6',
      topC: '#c9d2d4',
      tie: 'bow',
      tieColor: '#8c2f3f',
      pants: '#2f3540',
      shoes: 'loafer',
      shoeColor: '#1f1a1a',
      item: 'clipboard',
      mustache: '#1d1311',
      handlebar: true,
      stetho: true,
      badge: true
    }),
  // Stephanie: young, Latina, warm and quick. Coral scrubs, a dark bun, a tablet, bright clogs.
  stephanie: () =>
    npcLook({
      leg: 35,
      torso: 31,
      shoulder: 12,
      hip: 7.2,
      legW: 6.9,
      armW: 6,
      head: 12.2,
      skin: '#d9a07a',
      skinShade: '#bf845f',
      hair: '#2b1d1a',
      hairDark: '#160e0d',
      hairStyle: 'bun',
      eyes: '#4a2f22',
      brows: '#21140f',
      top: 'scrubs',
      topA: '#e3897f',
      topB: npcShade('#e3897f', 0.8),
      topC: '#f6f3e6',
      shortSleeve: true,
      pants: '#e3897f',
      shoes: 'clog',
      shoeColor: '#7fc4a2',
      item: 'tablet',
      stetho: true,
      badge: true
    }),
  // Julez: fifties, short blond hair, navy scrubs, readers, coffee. Has seen everything.
  julez: () =>
    npcLook({
      leg: 34,
      torso: 33,
      shoulder: 12.6,
      hip: 7.6,
      legW: 7.1,
      armW: 6.2,
      head: 12.3,
      skin: '#f4cfb2',
      skinShade: '#dda88b',
      hair: '#e6cd92',
      hairDark: '#b99a5c',
      hairStyle: 'short',
      eyes: '#5a6e7c',
      brows: '#b99a5c',
      age: 1,
      top: 'scrubs',
      topA: '#2f4f7a',
      topB: npcShade('#2f4f7a', 0.8),
      topC: '#f6f3e6',
      shortSleeve: true,
      pants: '#2f4f7a',
      shoes: 'clog',
      shoeColor: '#2f3d4c',
      item: 'cup',
      glasses: '#7a5a3a',
      stetho: true,
      badge: true
    }),
  barb: () =>
    npcLook({
      leg: 30,
      torso: 33,
      shoulder: 13.5,
      hip: 8.5,
      legW: 7.4,
      armW: 6.4,
      head: 12.4,
      skin: '#f1c7a2',
      skinShade: '#d9a37f',
      hair: '#b8563a',
      hairDark: '#8a3c27',
      hairStyle: 'net',
      eyes: '#4f7d5a',
      brows: '#8a3c27',
      top: 'apron',
      topA: '#f2a7b8',
      topB: '#fbf8ef',
      topC: '#d97f95',
      shortSleeve: true,
      pants: '#f2a7b8',
      shoes: 'clog',
      shoeColor: '#fbf8ef',
      item: 'tray',
      badge: true
    })
};

function hallwayNpc(id, name, voice, look, x, y, range, speed, extra = {}) {
  const dir = rand(0, 1) < 0.5 ? -1 : 1;
  return {
    id,
    name,
    voice,
    look,
    x,
    y,
    range,
    speed,
    lines: extra.lines || id,
    pitch: extra.pitch || 0,
    tag: extra.tag || '#f3d38b',
    offset: extra.offset || 0,
    ensure: !!extra.ensure,
    present: !extra.ensure,
    // A visiting group (the friends): one lead wanders, the rest hold a slot off the lead.
    group: extra.group || '',
    lead: !!extra.lead,
    slot: extra.slot ? extra.slot.slice() : [0, 0],
    home: extra.slot ? extra.slot.slice() : [0, 0],
    mode: 'idle',
    wait: rand(0.5, 3),
    tx: x,
    ty: y,
    dir,
    vdir: dir,
    walk: 0,
    moving: false,
    stuck: 0,
    heard: [],
    count: 0,
    last: -1,
    bark: null,
    barkN: Math.floor(rand(0, 3)),
    barkCd: rand(0, 3),
    whoa: 0,
    whoaCd: 0
  };
}

function hallwayResetCast() {
  hallwayCast = [
    hallwayNpc('dad', 'Dad', 'dad', HALLWAY_LOOKS.dad(), 700, 300, [420, 1050], 48, { tag: '#f3d38b' }),
    hallwayNpc('stephanie', 'Nurse Stephanie', 'nurse', HALLWAY_LOOKS.stephanie(), 880, 280, [620, 1200], 72, {
      pitch: 2,
      tag: '#f5b9ae'
    }),
    hallwayNpc('lori', 'Dr. Lori', 'doctor', HALLWAY_LOOKS.lori(), 1260, 390, [1000, 1700], 58, { pitch: 2, tag: '#e4d4ee' }),
    hallwayNpc('mimi', 'Mimi', 'grandma', HALLWAY_LOOKS.mimi(), 1500, 330, [1350, 1800], 32, { tag: '#ddc8ec' }),
    hallwayNpc('dodo', 'Dodo', 'grandpa', HALLWAY_LOOKS.dodo(), 1650, 365, [1300, 1850], 30, { tag: '#cfe0b4' }),
    // The friends travel as one loose cluster: Taylor leads (she drove), Presley and Norah keep their slots.
    hallwayNpc('taylor', 'Taylor', 'cousin', HALLWAY_LOOKS.taylor(), 2180, 330, [1850, 2450], 50, {
      pitch: -2,
      tag: '#c9b8ef',
      group: 'friends',
      lead: true
    }),
    hallwayNpc('presley', 'Presley', 'cousin', HALLWAY_LOOKS.presley(), 2134, 306, [1850, 2450], 50, {
      pitch: 3,
      tag: '#f6dd8c',
      group: 'friends',
      slot: [-46, -24]
    }),
    hallwayNpc('norah', 'Norah', 'cousin', HALLWAY_LOOKS.norah(), 2224, 352, [1850, 2450], 50, {
      pitch: 1,
      tag: '#a9c6ef',
      group: 'friends',
      slot: [44, 22]
    }),
    hallwayNpc('julez', 'Julez', 'nurse', HALLWAY_LOOKS.julez(), 2250, 450, [1800, 2600], 58, { pitch: -2, tag: '#9fb6d6' }),
    hallwayNpc('brother', 'Riley', 'brother', HALLWAY_LOOKS.brother(), 2560, 262, [2350, 2800], 55, { tag: '#f2bf8f' }),
    hallwayNpc('casey', 'Casey', 'cousin', HALLWAY_LOOKS.casey(), 2800, 340, [2550, 3050], 56, { pitch: -4, tag: '#bfe0cf' }),
    hallwayNpc('benedetto', 'Dr. Benedetto', 'doctor', HALLWAY_LOOKS.benedetto(), 2980, 430, [2650, 3120], 46, {
      pitch: -4,
      tag: '#cfe3ee'
    }),
    hallwayNpc('barb', 'Barb · Dietary', 'ensure', HALLWAY_LOOKS.barb(), HALLWAY_ELEVATOR_X, HALLWAY_TOP + 6, [80, 3120], 108, {
      lines: 'ensure',
      tag: '#f7c6d2',
      ensure: true
    })
  ];
  const rowdy = hallwayRowdy();
  if (rowdy) hallwayCast.push(rowdy);
  for (const npc of hallwayCast) if (npc.look && HALLWAY_HEIGHTS[npc.id]) hallwayFitLook(npc.look, HALLWAY_HEIGHTS[npc.id]);
  for (const npc of hallwayCast) {
    let tries = 0;
    while (hallwayBlocked(npc.x, npc.y, npc) && tries < 12) {
      npc.y = clamp(npc.y + 28, HALLWAY_TOP, HALLWAY_BOTTOM);
      tries++;
    }
    npc.tx = npc.x;
    npc.ty = npc.y;
  }
  hallwayTalk = null;
  hallwayTarget = null;
  hallwayBottles = [];
  hallwayEnsure = { phase: 'away', due: 20, patience: 0, board: 0, trips: 0 };
  hallwayElevator = { open: 0, hold: 0 };
  hallwayClock = 0;
  hallwayBarkGap = 0;
  hallwayPressAt = -1;
  hallwayPressTook = false;
}

// Adds room 6 and its furniture. world.js calls it at startup; calling it again changes nothing.
function hallwayInstall() {
  if (!rooms.some(r => r.id === HALLWAY_ID)) rooms.push({ ...HALLWAY_ROOM });
  roomProps[HALLWAY_ID] = HALLWAY_PROPS;
  if (!hallwayCast.length) hallwayResetCast();
  return rooms.find(r => r.id === HALLWAY_ID);
}

// ---- Movement ----
function hallwayBlocked(x, y, self) {
  if (x < HALLWAY_LEFT || x > HALLWAY_RIGHT || y < HALLWAY_TOP || y > HALLWAY_BOTTOM) return true;
  for (const p of HALLWAY_PROPS) {
    const [bx, by, bw, bh] = p.box;
    if (x + 13 > bx && x - 13 < bx + bw && y + 5 > by && y - 8 < by + bh) return true;
  }
  for (const o of hallwayCast) {
    // Friends in one group brush past each other instead of blocking.
    if (o === self || !o.present || (self.group && o.group === self.group)) continue;
    const now = Math.hypot(o.x - self.x, o.y - self.y),
      next = Math.hypot(o.x - x, o.y - y);
    if (next < 24 && next < now) return true;
  }
  return false;
}

// One step toward (tx, ty). Returns true on arrival. Blocked both ways, a visitor steps away from the wall.
function hallwayWalkTo(npc, tx, ty, speed, dt) {
  const dx = tx - npc.x,
    dy = ty - npc.y,
    len = Math.hypot(dx, dy);
  if (len < 5) {
    npc.moving = false;
    npc.walk = 0;
    return true;
  }
  const step = Math.min(len, speed * dt),
    mx = (dx / len) * step,
    my = (dy / len) * step,
    x0 = npc.x,
    y0 = npc.y;
  let moved = false;
  if (Math.abs(mx) > 1e-6 && !hallwayBlocked(npc.x + mx, npc.y, npc)) {
    npc.x += mx;
    moved = true;
  }
  if (Math.abs(my) > 1e-6 && !hallwayBlocked(npc.x, npc.y + my, npc)) {
    npc.y += my;
    moved = true;
  }
  // A friend who is blocked, or only sliding along someone, steps sideways around them to whichever side
  // is clear.
  const progress = Math.hypot(npc.x - x0, npc.y - y0);
  if (npc.group && progress < step * 0.5)
    for (const [px, py] of [
      [-my / step, mx / step],
      [my / step, -mx / step]
    ]) {
      if (hallwayBlocked(npc.x + px * step, npc.y + py * step, npc)) continue;
      npc.x += px * step;
      npc.y += py * step;
      moved = true;
      break;
    }
  if (!moved && !hallwayBlocked(npc.x, npc.y + step, npc)) {
    npc.y += step;
    moved = true;
  }
  npc.moving = moved;
  npc.stuck = moved ? 0 : npc.stuck + dt;
  if (moved) {
    npc.walk += dt * (6 + speed / 14);
    if (Math.abs(mx) > 0.01) npc.dir = mx > 0 ? 1 : -1;
  }
  return false;
}

function hallwayPickTarget(npc) {
  for (let i = 0; i < 8; i++) {
    const tx = rand(npc.range[0], npc.range[1]),
      ty = rand(HALLWAY_TOP + 20, HALLWAY_BOTTOM - 10);
    if (hallwayBlocked(tx, ty, npc)) continue;
    npc.tx = tx;
    npc.ty = ty;
    npc.mode = 'walk';
    npc.stuck = 0;
    return;
  }
  npc.wait = rand(1, 2);
}

function hallwayFace(npc) {
  npc.dir = player.x >= npc.x ? 1 : -1;
  if (npc.rowdy) npc.face = npc.dir;
}

function hallwaySay(npc, text, life = 2.6) {
  npc.bark = { text: hallwayFill(text), life, max: life };
  if (typeof sfx === 'function') sfx('talk', { voice: npc.voice, count: npc.barkN, combo: npc.pitch, vol: 0.8 });
}

function hallwayMaybeBark(npc, d) {
  if (d > HALLWAY_BARK_RANGE || npc.barkCd > 0 || hallwayBarkGap > 0 || hallwayTalk || npc.bark) return;
  const barks = HALLWAY_LINES[npc.lines].barks;
  hallwaySay(npc, barks[npc.barkN % barks.length]);
  npc.barkN++;
  npc.barkCd = rand(30, 55);
  hallwayBarkGap = 2.2;
  // A group calls out once per pass, not three times in a row.
  if (npc.group) for (const o of hallwayCast) if (o !== npc && o.group === npc.group) o.barkCd = Math.max(o.barkCd, 14);
}

// ---- The friends ----
// Presley, Norah and Taylor move as one loose cluster. The lead (Taylor) wanders like anyone else; the
// others walk to their slot off her, a little looser each time she sets off, and stop when they get
// there. When Macy comes near any of them, or talks to one, all three stop and turn to her together.
// Standing around on their own, they turn in to talk to each other.
function hallwayCrew(group) {
  return hallwayCast.filter(n => n.group === group && n.present);
}

function hallwayGroupNear(group) {
  if (hallwayTalk && hallwayTalk.npc.group === group) return true;
  return hallwayCast.some(n => n.group === group && n.present && dist(n, player) < HALLWAY_FACE_RANGE);
}

function hallwayGroupTurnIn(npc, crew) {
  const others = crew.filter(o => o !== npc);
  if (!others.length) return;
  const cx = others.reduce((a, o) => a + o.x, 0) / others.length;
  if (Math.abs(cx - npc.x) > 6) npc.dir = cx > npc.x ? 1 : -1;
}

function hallwayGroupStep(npc, dt) {
  const crew = hallwayCrew(npc.group),
    lead = crew.find(n => n.lead) || crew[0];
  if (hallwayGroupNear(npc.group)) {
    npc.moving = false;
    npc.walk = 0;
    npc.mode = 'idle';
    if (npc === lead) npc.wait = Math.max(npc.wait, 0.8);
    hallwayFace(npc);
    return;
  }
  if (npc === lead) {
    if (npc.mode !== 'walk') {
      npc.moving = false;
      npc.walk = 0;
      npc.wait -= dt;
      // She waits for the others to catch up (three seconds at most) before setting off again.
      const together = crew.every(o => o === npc || Math.hypot(o.x - npc.x - o.slot[0], o.y - npc.y - o.slot[1]) < 40);
      if (npc.wait > 0 || (!together && npc.wait > -3)) hallwayGroupTurnIn(npc, crew);
      else {
        hallwayPickTarget(npc);
        if (npc.mode === 'walk')
          for (const o of crew) if (o !== npc) o.slot = [o.home[0] + rand(-8, 8), o.home[1] + rand(-6, 6)];
      }
      return;
    }
    if (hallwayWalkTo(npc, npc.tx, npc.ty, npc.speed, dt) || npc.stuck > 0.6) {
      npc.mode = 'idle';
      npc.wait = rand(2.5, 6);
      npc.moving = false;
      npc.walk = 0;
    }
    return;
  }
  const tx = clamp(lead.x + npc.slot[0], HALLWAY_LEFT, HALLWAY_RIGHT),
    ty = clamp(lead.y + npc.slot[1], HALLWAY_TOP, HALLWAY_BOTTOM),
    gap = Math.hypot(tx - npc.x, ty - npc.y);
  if (npc.mode === 'walk' || gap > 16) {
    npc.mode = 'walk';
    if (hallwayWalkTo(npc, tx, ty, lead.speed * (gap > 70 ? 1.7 : 1.2), dt) || npc.stuck > 1) {
      npc.mode = 'idle';
      npc.moving = false;
      npc.walk = 0;
      npc.stuck = 0;
    }
    return;
  }
  npc.moving = false;
  npc.walk = 0;
  hallwayGroupTurnIn(npc, crew);
}

function hallwayNpcStep(npc, dt) {
  if (npc.rowdy) {
    hallwayRowdyStep(npc, dt);
    return;
  }
  npc.barkCd = Math.max(0, npc.barkCd - dt);
  npc.whoa = Math.max(0, npc.whoa - dt);
  npc.whoaCd = Math.max(0, npc.whoaCd - dt);
  if (npc.bark) {
    npc.bark.life -= dt;
    if (npc.bark.life <= 0) npc.bark = null;
  }
  npc.vdir += (npc.dir - npc.vdir) * (1 - Math.exp(-dt * 12));
  if (!npc.present) return;
  const d = dist(npc, player);
  // A dash through someone gets a "whoa" and a little hop.
  if (player.dash > 0 && d < 40 && npc.whoaCd <= 0) {
    npc.whoa = 0.45;
    npc.whoaCd = 0.8;
    hallwayFace(npc);
    hallwaySay(npc, HALLWAY_LINES[npc.lines].whoa, 1.6);
  }
  if (hallwayTalk && hallwayTalk.npc === npc) {
    npc.moving = false;
    npc.walk = 0;
    hallwayFace(npc);
    return;
  }
  if (npc.ensure) {
    hallwayEnsureMove(npc, dt, d);
    return;
  }
  hallwayMaybeBark(npc, d);
  if (npc.group) {
    hallwayGroupStep(npc, dt);
    return;
  }
  if (d < HALLWAY_FACE_RANGE) {
    npc.moving = false;
    npc.walk = 0;
    npc.mode = 'idle';
    npc.wait = Math.max(npc.wait, 0.8);
    hallwayFace(npc);
    return;
  }
  if (npc.mode !== 'walk') {
    npc.moving = false;
    npc.walk = 0;
    npc.wait -= dt;
    if (npc.wait <= 0) hallwayPickTarget(npc);
    return;
  }
  if (hallwayWalkTo(npc, npc.tx, npc.ty, npc.speed, dt) || npc.stuck > 0.6) {
    npc.mode = 'idle';
    npc.wait = rand(1.4, 4.4);
    npc.moving = false;
    npc.walk = 0;
  }
}

// ---- Barb from Dietary ----
// Away, she counts down everywhere; once due she rides up while Macy is in the hallway, follows her
// with the tray, offers an Ensure, leaves one on the floor whatever the answer, and rides back down.
function hallwayEnsureTick(dt, here) {
  const en = hallwayEnsure;
  if (en.phase !== 'away') return;
  // After the trophy she only comes up once per visit, sheepishly.
  if (hallwayTrophy() && hallwayCult.barbDone) return;
  en.due -= dt;
  if (en.due > 0 || !here) return;
  const npc = hallwayCast.find(n => n.ensure);
  if (npc) hallwayEnsureArrive(npc);
}

function hallwayEnsureArrive(npc) {
  const en = hallwayEnsure;
  npc.present = true;
  npc.x = HALLWAY_ELEVATOR_X;
  npc.y = HALLWAY_TOP + 6;
  npc.dir = 1;
  npc.vdir = 1;
  npc.mode = 'walk';
  npc.stuck = 0;
  en.phase = 'out';
  en.patience = 45;
  en.trips++;
  hallwayElevator.hold = 1.6;
  // The last delivery is one bottle with a bow on it; after that she comes up sheepish, once a visit.
  const finale = hallwayTrophyDue(),
    sheepish = hallwayTrophy(),
    barks = finale ? [HALLWAY_ENSURE_FINALE.bark] : sheepish ? HALLWAY_ENSURE_SHEEPISH.barks : HALLWAY_LINES.ensure.barks;
  npc.look.item = finale ? 'trophy' : 'tray';
  if (sheepish) hallwayCult.barbDone = true;
  hallwaySay(npc, barks[en.trips % barks.length], 3);
  if (typeof sfx === 'function') sfx('daily', { vol: 0.45 });
}

function hallwayEnsureMove(npc, dt, d) {
  const en = hallwayEnsure;
  if (en.phase === 'out') {
    en.patience -= dt;
    if (en.patience <= 0) {
      // Ignored with the trophy in hand, she keeps it for next time.
      if (hallwayTrophyDue()) hallwaySay(npc, "Fine. I'll come back. I always come back.", 2.6);
      else hallwayEnsureDrop(npc, true);
      en.phase = 'leaving';
      return;
    }
    if (d > 64) {
      const side = player.x >= npc.x ? -1 : 1,
        tx = clamp(player.x + side * 52, HALLWAY_LEFT, HALLWAY_RIGHT),
        ty = clamp(player.y, HALLWAY_TOP, HALLWAY_BOTTOM);
      hallwayWalkTo(npc, tx, ty, npc.speed, dt);
      return;
    }
    npc.moving = false;
    npc.walk = 0;
    hallwayFace(npc);
    return;
  }
  if (en.phase === 'leaving') {
    // Down into the open lane, along it, then up to the elevator: the furniture hugs the wall.
    const lane = 290,
      column = Math.abs(npc.x - HALLWAY_ELEVATOR_X) < 8;
    let goal = [HALLWAY_ELEVATOR_X, npc.y];
    if (column) goal = [HALLWAY_ELEVATOR_X, HALLWAY_TOP + 6];
    else if (npc.y < lane - 8) goal = [npc.x, lane];
    if (hallwayWalkTo(npc, goal[0], goal[1], 120, dt) && column) {
      en.phase = 'boarding';
      en.board = 0.6;
      hallwayElevator.hold = 1.3;
    }
    return;
  }
  if (en.phase === 'boarding') {
    npc.moving = false;
    npc.walk = 0;
    en.board -= dt;
    if (en.board <= 0) {
      npc.present = false;
      npc.bark = null;
      en.phase = 'away';
      en.due = rand(100, 160);
    }
  }
}

function hallwayEnsureDrop(npc, ignored) {
  const side = npc.dir || 1,
    bottle = {
      x: clamp(npc.x + side * 24, HALLWAY_LEFT, HALLWAY_RIGHT),
      y: clamp(npc.y + 8, HALLWAY_TOP, HALLWAY_BOTTOM),
      flavor: hallwayEnsure.trips % HALLWAY_FLAVORS.length
    };
  const fx = bottle.x,
    fy = bottle.y - 46;
  hallwayBottles.push(bottle);
  if (hallwayCultAt(HALLWAY_CULT.rows)) hallwayBottleRows();
  else if (hallwayBottles.length > HALLWAY_MAX_BOTTLES) hallwayBottles.shift();
  if (typeof floating === 'function') floating('+1 ENSURE · STILL NOT ALLOWED', fx, fy, '#f7c6d2');
  if (ignored) hallwaySay(npc, "I'll leave it here!", 2.4);
}

// ---- The Ensure situation ----
// Barb is not alone. The longer Macy says no, the more the floor quietly fills with Ensure. n is
// state.stats.ensureRefused, read once per hallway entry (hallwayCultRead, from onRoomLoaded):
//   5+   Barb's bottles stop capping at nine and line up in neat rows; two vending slots are Ensure.
//   10+  a crate of Ensure by the elevator (and ENSURE STORAGE on the map, in map.js).
//   20+  every nurse carries a bottle; the vending machine is all Ensure; one Rowdy cheer a visit
//        spells it out with Ensure bottles for pom-poms.
//   30+  a PA announcement once per entry; a "Proudly stocked" sticker on the nurses' station sign.
//   50+  Barb's last delivery: one bottle labeled FINE. YOU WIN. in a three-bubble scene that sets
//        state.stats.ensureTrophy. After that she comes up once per visit, sheepishly.
const HALLWAY_CULT = { rows: 5, crate: 10, nurses: 20, pa: 30, trophy: 50 },
  HALLWAY_ROW_CAP = 60,
  HALLWAY_ROWS_X = 92,
  HALLWAY_CRATE = [98, 236],
  HALLWAY_PA_TEXT = 'Attention: the cafeteria has been renamed The Ensure Experience.',
  HALLWAY_ENSURE_FINALE = {
    bark: 'Special delivery, hon. The last one. I mean it this time.',
    say: [
      ['npc', "Fifty no's, hon. The kitchen held a meeting about you."],
      ['macy', 'Was it about Ensure?'],
      ['npc', "It was. This one says FINE. YOU WIN. It's yours. Don't drink it. Frame it."]
    ]
  },
  HALLWAY_ENSURE_SHEEPISH = {
    barks: ['Just passing through, hon.', 'No pressure. None at all.', 'Ensure? Kidding. Unless?'],
    talks: [
      [['npc', "I'm not here to offer you anything."], ['npc', '...Unless you want one.'], ['macy', 'No.'], ['npc', 'Respect.']],
      [['npc', 'Just walking by with a tray of Ensure. Total coincidence.'], ['macy', 'Barb.'], ['npc', 'Old habits, hon.']],
      [['npc', 'The kitchen says hi. The kitchen says nothing else. The kitchen is sulking.']]
    ]
  },
  // One of Rowdy's cheers, past twenty: he holds Ensure bottles where the pom-poms go.
  HALLWAY_ROWDY_ENSURE = {
    id: 'ensure',
    name: 'E-N-S-U-R-E',
    bubbles: [
      { text: 'Gimme an E! Gimme an N! Gimme an S!', pose: 'cheer' },
      { text: 'Gimme a U! Gimme an R! Gimme an E!', pose: 'cheer' },
      { text: 'E-N-S-U-R-E! ...wait.', pose: 'cheer' },
      { text: 'Who swapped my pom-poms? BARB.', pose: 'point' }
    ]
  };

let hallwayCult = { n: 0, paDue: 0, pa: null, paCount: 0, barbDone: false };

function hallwayEnsureCount() {
  const s = state.stats;
  return Math.max(0, Math.floor(Number(s && s.ensureRefused) || 0));
}

const hallwayCultAt = k => hallwayCult.n >= k,
  hallwayTrophy = () => !!(state.stats && state.stats.ensureTrophy),
  hallwayTrophyDue = () => hallwayCultAt(HALLWAY_CULT.trophy) && !hallwayTrophy();

// A fresh hallway entry: read n, then dress the floor to match.
function hallwayCultRead() {
  const c = hallwayCult;
  c.n = hallwayEnsureCount();
  c.pa = null;
  c.paDue = hallwayCultAt(HALLWAY_CULT.pa) ? 1.2 : 0;
  c.barbDone = false;
  for (const npc of hallwayCast) {
    if (npc.rowdy) npc.ensureCheered = false;
    if (npc.voice !== 'nurse' || !npc.look) continue;
    if (npc.look.baseItem === undefined) npc.look.baseItem = npc.look.item;
    npc.look.item = hallwayCultAt(HALLWAY_CULT.nurses) ? 'ensure' : npc.look.baseItem;
  }
  if (!hallwayCultAt(HALLWAY_CULT.rows)) return;
  const want = Math.min(c.n, HALLWAY_ROW_CAP);
  while (hallwayBottles.length < want) hallwayBottles.push({ x: 0, y: 0, flavor: hallwayBottles.length % HALLWAY_FLAVORS.length });
  hallwayBottleRows();
}

// Neat rows by the elevator, twelve to a row, oldest first; past sixty the oldest goes back to the kitchen.
function hallwayBottleRows() {
  while (hallwayBottles.length > HALLWAY_ROW_CAP) hallwayBottles.shift();
  hallwayBottles.forEach((b, i) => {
    b.x = HALLWAY_ROWS_X + (i % 12) * 16;
    b.y = HALLWAY_BOTTOM - 10 - Math.floor(i / 12) * 13;
    b.row = true;
  });
}

function hallwayPaStep(dt) {
  const c = hallwayCult;
  if (c.paDue > 0) {
    c.paDue -= dt;
    if (c.paDue <= 0) {
      c.paDue = 0;
      c.pa = { text: HALLWAY_PA_TEXT, life: 5.5, max: 5.5 };
      c.paCount++;
      if (typeof sfx === 'function') sfx('ui');
    }
  }
  if (c.pa) {
    c.pa.life -= dt;
    if (c.pa.life <= 0) c.pa = null;
  }
}

// Barb's conversation when the cult has a say: the trophy scene, or a sheepish one after it.
function hallwayEnsureConvo(npc) {
  if (hallwayTrophyDue())
    return HALLWAY_ENSURE_FINALE.say.map(([who, text], i) => ({ who, text: hallwayFill(text), finale: i === 2 ? 'give' : 'scene' }));
  if (!hallwayTrophy()) return null;
  const talks = HALLWAY_ENSURE_SHEEPISH.talks,
    say = talks[(npc.sheep = (npc.sheep || 0) + 1) % talks.length];
  return say.map(([who, text]) => ({ who, text: hallwayFill(text) }));
}

// The hand-over: the flag, the save, and Barb's hands are finally empty.
function hallwayEnsureTrophy(npc) {
  if (hallwayTrophy()) return;
  hallwayStats().ensureTrophy = 1;
  npc.look.item = '';
  if (typeof floating === 'function') floating('FINE. YOU WIN.', npc.x, npc.y - 70, '#ffd36e');
  if (typeof sfx === 'function') sfx('win', { vol: 0.6 });
  hallwaySave();
}

// ---- Rowdy the Ram ----
// Ramsey's mascot (src/rowdy.js) works the nurses' station. His own brain (spec.tick) runs his day:
// bouncing at home, a cheer every 40 to 70 s whether or not anyone is watching (one bark and one pose
// per bubble), a gallop and a wave the first time Macy comes into the hallway each visit, and a sulk
// then a farewell if she walks off mid-cheer. Talking to him pauses the brain and runs one of his
// cheers or lines through the speech box, a pose per bubble. The first cheer after Ralph turns up at
// the exit, from either path, is the Ralph cheer.
const HALLWAY_ROWDY_HOME = [812, 270],
  HALLWAY_ROWDY_POSES = ['cheer', 'point', 'flex', 'hug', 'wave'],
  HALLWAY_ROWDY_FLAG = ['ramsey', 'blue-gold'],
  HALLWAY_ROWDY_WHOA = 'Whoa! Fast break! Do that at regionals!',
  HALLWAY_ROWDY_BABBLE = 1 / 14,
  HALLWAY_BLIP_GAP = { rowdy: 1 / 15 };

function hallwayRowdy() {
  if (typeof rowdyNpcSpec !== 'function') return null;
  const spec = rowdyNpcSpec(),
    [hx, hy] = HALLWAY_ROWDY_HOME,
    npc = hallwayNpc('rowdy', spec.name, spec.voice, null, hx, hy, [hx, hx], spec.timing.homeSpeed, {
      lines: 'rowdy',
      tag: '#f2cf6b'
    });
  npc.rowdy = true;
  npc.spec = spec;
  // The costume, horns and all, stands a head over Macy and a touch under Dad.
  npc.scale = (HALLWAY_HEIGHTS.rowdy * hallwayMacyHeight()) / spec.baseHeight;
  npc.homeX = hx;
  npc.homeY = hy;
  npc.mode = 'idle';
  npc.pose = 'idle';
  npc.face = -1;
  npc.dir = -1;
  npc.vdir = -1;
  npc.timer = 0;
  npc.say = null;
  npc.cheer = null;
  npc.prop = null;
  npc.nextCheer = rand(spec.timing.autoCheer[0], spec.timing.autoCheer[1]);
  npc.greeted = false;
  npc.entered = false;
  npc.ralphCheered = false;
  npc.talks = 0;
  npc.lastPick = '';
  npc.babble = 0;
  npc.babbleAt = 0;
  npc.babbleN = 0;
  return npc;
}

// Where a visitor's speech bubble and TALK prompt hang: above the head, in world units.
function hallwayNpcTop(npc) {
  return npc.rowdy ? Math.round(npc.spec.baseHeight * (npc.scale || npc.spec.scale)) : npcTop(npc.look) * hallwayNpcScale();
}

// One Rowdy syllable, quieter and panned with distance so a cheer at the far end sounds far away.
function hallwayRowdyBlip(npc, n) {
  if (typeof sfx !== 'function') return;
  const d = dist(npc, player);
  sfx('talk', {
    voice: 'rowdy',
    count: n,
    vol: clamp(1.1 - d / 900, 0.12, 1),
    pan: clamp((npc.x - player.x) / 700, -0.8, 0.8)
  });
}

// A bubble from his brain: show it as a bark for as long as he holds it, and babble while it starts.
function hallwayRowdyBark(npc, text) {
  const hold = Math.max(0.4, npc.timer);
  npc.bark = { text, life: hold, max: hold };
  npc.babble = clamp(text.length / HALLWAY_TYPE_CPS, 0.3, 1.8);
  npc.babbleAt = 0;
  npc.babbleN = 0;
}

function hallwayRowdyStep(npc, dt) {
  const spec = npc.spec,
    tk = hallwayTalk;
  npc.whoaCd = Math.max(0, npc.whoaCd - dt);
  if (npc.bark) {
    npc.bark.life -= dt;
    if (npc.bark.life <= 0) npc.bark = null;
  }
  if (npc.babble > 0) {
    npc.babble -= dt;
    npc.babbleAt -= dt;
    if (npc.babbleAt <= 0) {
      npc.babbleAt += HALLWAY_ROWDY_BABBLE;
      hallwayRowdyBlip(npc, npc.babbleN);
      npc.babbleN++;
    }
  }
  if (tk && tk.npc === npc) {
    // In the speech box he holds the pose of the bubble on screen and faces Macy.
    const line = tk.lines[tk.i];
    npc.pose = (line && line.pose) || 'idle';
    npc.prop = line && HALLWAY_ROWDY_FLAG.includes(line.cheer) ? 'flag' : null;
    npc.ensurePoms = !!line && line.cheer === 'ensure';
    npc.moving = false;
    hallwayFace(npc);
    npc.vdir = npc.dir;
    return;
  }
  const macy = {
      x: clamp(player.x, HALLWAY_LEFT + 70, HALLWAY_RIGHT - 70),
      y: clamp(player.y, HALLWAY_TOP, HALLWAY_BOTTOM)
    },
    cheering = npc.mode === 'cheer' && !!npc.cheer;
  let said = spec.tick(npc, dt, { macy, entered: npc.entered, st: state });
  npc.entered = false;
  // Past twenty no's, the first timer cheer of a visit becomes the Ensure cheer.
  if (said && !cheering && npc.mode === 'cheer' && npc.bubble === 0 && npc.cheer && npc.cheer.id !== 'ralph')
    if (hallwayCultAt(HALLWAY_CULT.nurses) && !npc.ensureCheered) {
      const b = HALLWAY_ROWDY_ENSURE.bubbles[0],
        text = spec.format(b.text, state);
      npc.ensureCheered = true;
      npc.cheer = HALLWAY_ROWDY_ENSURE;
      npc.say = text;
      npc.pose = b.pose;
      npc.timer = spec.bubbleTime(text);
      said = { text, pose: b.pose };
    }
  // A timer cheer that ran to the end with Macy inside his watch radius counts for the stickers.
  if (cheering && npc.mode === 'idle' && !npc.cheer && npc.watched) {
    hallwayBump('cheers');
    hallwaySave();
  }
  if (said) hallwayRowdyBark(npc, said.text);
  else if (!npc.say && npc.bark && !npc.bark.whoa) npc.bark = null;
  if (player.dash > 0 && dist(npc, player) < 44 && npc.whoaCd <= 0 && npc.mode === 'idle') {
    npc.whoaCd = 0.8;
    npc.bark = { text: HALLWAY_ROWDY_WHOA, life: 1.6, max: 1.6, whoa: true };
    hallwayRowdyBlip(npc, 0);
  }
  npc.prop = npc.mode === 'cheer' && npc.cheer && HALLWAY_ROWDY_FLAG.includes(npc.cheer.id) ? 'flag' : null;
  npc.ensurePoms = npc.mode === 'cheer' && !!npc.cheer && npc.cheer.id === 'ensure';
  npc.x = clamp(npc.x, HALLWAY_LEFT, HALLWAY_RIGHT);
  npc.y = clamp(npc.y, HALLWAY_TOP, HALLWAY_BOTTOM);
  npc.dir = npc.face;
  npc.vdir = npc.face;
  npc.moving = npc.pose === 'gallop';
}

// Talking to Rowdy: a cheer on odd talks, one of his lines on even ones, never the same pick twice running.
function hallwayRowdyConvo(npc) {
  const spec = npc.spec,
    st = state;
  npc.talks++;
  if (npc.talks % 2 === 1) {
    const ralphFirst = !!st.ralphReady && !st.ralph && !st.won && !npc.ralphCheered;
    let cheer = ralphFirst ? spec.cheers.find(c => c.id === 'ralph') : spec.pickCheer(st);
    for (let i = 0; i < 4 && !ralphFirst && cheer.id === npc.lastPick; i++) cheer = spec.pickCheer(st);
    if (!ralphFirst && hallwayCultAt(HALLWAY_CULT.nurses) && !npc.ensureCheered) {
      npc.ensureCheered = true;
      cheer = HALLWAY_ROWDY_ENSURE;
    }
    if (cheer.id === 'ralph') npc.ralphCheered = true;
    npc.lastPick = cheer.id;
    return cheer.bubbles.map(b => ({ who: 'npc', text: spec.format(b.text, st), pose: b.pose, cheer: cheer.id }));
  }
  let text = spec.line(st);
  for (let i = 0; i < 4 && text === npc.lastPick; i++) text = spec.line(st);
  npc.lastPick = text;
  return [{ who: 'npc', text, pose: pick(HALLWAY_ROWDY_POSES) }];
}

// ---- Conversations ----
// Next conversation: a state-reactive one the first time it applies, then any unheard one (nurses start
// at different points), then the rotation, never the same one twice in a row.
function hallwayNextConvo(npc) {
  if (npc.rowdy) return hallwayRowdyConvo(npc);
  if (npc.lines === 'dad') return hallwayDadConvo(npc);
  if (npc.ensure) {
    const special = hallwayEnsureConvo(npc);
    if (special) return special;
  }
  const talks = HALLWAY_LINES[npc.lines].talks,
    open = talks.map((_, i) => i).filter(i => !talks[i].when || talks[i].when()),
    shift = open.length ? npc.offset % open.length : 0,
    order = open.slice(shift).concat(open.slice(0, shift)),
    fresh = order.filter(i => !npc.heard.includes(i)),
    reactive = fresh.filter(i => talks[i].when);
  let i = reactive[0] ?? fresh[0] ?? order[npc.count % Math.max(1, order.length)];
  if (i === npc.last && order.length > 1) i = order[(order.indexOf(i) + 1) % order.length];
  npc.count++;
  npc.last = i;
  if (!npc.heard.includes(i)) npc.heard.push(i);
  return talks[i].say.map(([who, text]) => ({ who, text: hallwayFill(text) }));
}

// Who says a bubble: Macy (null), the visitor she is talking to, or a friend who chimes in by id.
function hallwaySpeaker(tk, line) {
  if (!tk || !line || line.who === 'macy') return null;
  if (line.who === 'npc') return tk.npc;
  return hallwayCast.find(n => n.id === line.who) || tk.npc;
}

function hallwayOpenTalk(npc) {
  hallwayTalk = { npc, lines: hallwayNextConvo(npc), i: 0, shown: 0, acc: 0, pause: 0, voiced: 0, age: 0, blipAt: -1 };
  hallwayBubble(hallwayTalk);
  npc.mode = npc.rowdy ? 'talk' : 'idle';
  npc.moving = false;
  npc.bark = null;
  if (npc.rowdy) {
    npc.say = null;
    npc.cheer = null;
    npc.babble = 0;
  }
  hallwayFace(npc);
  player.dir = npc.x >= player.x ? 1 : -1;
  hallwayTarget = null;
  return true;
}

// walked: Macy left mid-conversation (rather than finishing it or pressing Escape).
function hallwayEndTalk(finished, walked = false) {
  const tk = hallwayTalk;
  if (!tk) return false;
  hallwayTalk = null;
  const npc = tk.npc,
    line = tk.lines[tk.i],
    seen = finished ? tk.lines.length : tk.i + (line && tk.shown >= line.text.length ? 1 : 0);
  npc.wait = rand(1.2, 2.5);
  npc.barkCd = Math.max(npc.barkCd, 20);
  if (npc.rowdy) {
    // Walk out on a cheer and he sulks for a second, then waves you off; his brain does the rest.
    const T = npc.spec.timing;
    npc.say = null;
    npc.cheer = null;
    npc.bark = null;
    npc.prop = null;
    if (walked && !finished && tk.lines[0] && tk.lines[0].cheer) {
      npc.mode = 'sad';
      npc.pose = 'sad';
      npc.timer = T.sad;
    } else {
      npc.mode = 'idle';
      npc.pose = 'idle';
      npc.timer = 0;
      npc.nextCheer = rand(T.autoCheer[0], T.autoCheer[1]);
    }
  }
  if (npc.ensure && finished && hallwayEnsure.phase === 'out') {
    // The trophy was handed over, not left on the floor.
    if (!tk.lines.some(l => l.finale)) hallwayEnsureDrop(npc, false);
    hallwayEnsure.phase = 'leaving';
  }
  if (seen > 0) hallwayTalked(npc, tk, finished);
  return true;
}

function hallwayCloseTalk() {
  return hallwayEndTalk(false);
}

// Space, Enter or a tap: finish the typing, then the next bubble, then close.
function hallwayAdvance() {
  const tk = hallwayTalk,
    line = tk.lines[tk.i];
  if (tk.shown < line.text.length) {
    tk.shown = line.text.length;
    return;
  }
  tk.i++;
  tk.shown = 0;
  tk.acc = 0;
  tk.pause = 0;
  tk.voiced = 0;
  if (tk.i >= tk.lines.length) hallwayEndTalk(true);
  else hallwayBubble(tk);
}

function hallwayTalkStep(dt) {
  const tk = hallwayTalk;
  if (!tk) return;
  if (!tk.npc.present || dist(tk.npc, player) > HALLWAY_LEAVE_RANGE) {
    hallwayEndTalk(false, true);
    return;
  }
  tk.age += dt;
  const line = tk.lines[tk.i],
    text = line.text;
  if (tk.pause > 0) {
    tk.pause -= dt;
    return;
  }
  tk.acc += dt * HALLWAY_TYPE_CPS;
  while (tk.acc >= 1 && tk.shown < text.length && tk.pause <= 0) {
    tk.acc -= 1;
    const ch = text[tk.shown];
    tk.shown++;
    if (/[A-Za-z0-9]/.test(ch)) {
      tk.voiced++;
      // One voice blip per two letters (a chunk, not a machine gun); Rowdy blips by the clock instead.
      const who = hallwaySpeaker(tk, line),
        voice = who ? who.voice : 'macy',
        gap = HALLWAY_BLIP_GAP[voice],
        due = gap ? hallwayClock - tk.blipAt >= gap - 1e-6 : tk.voiced % 2 === 1;
      if (due && typeof sfx === 'function') {
        tk.blipAt = hallwayClock;
        sfx('talk', { voice, count: tk.voiced >> 1, combo: who ? who.pitch : 0 });
      }
    } else if ('.!?'.includes(ch)) tk.pause = 0.16;
    else if (ch === ',') tk.pause = 0.07;
  }
  if (tk.shown >= text.length) tk.acc = 0;
}

// ---- Prompts, doors, the shop and the exit ----
function hallwayDoorAt(x, y) {
  return HALLWAY_DOORS.find(d => Math.abs(x - d.x) < HALLWAY_DOOR_ZONE_X && y < HALLWAY_DOOR_ZONE_Y) || null;
}

function hallwayFindTarget() {
  if (hallwayTalk) return null;
  const door = hallwayDoorAt(player.x, player.y);
  if (door) return { kind: 'door', door };
  let best = null,
    bestD = HALLWAY_TALK_RANGE;
  for (const npc of hallwayCast) {
    if (!npc.present) continue;
    const d = dist(npc, player);
    if (d < bestD) {
      best = npc;
      bestD = d;
    }
  }
  if (best) return { kind: 'talk', npc: best };
  if (Math.abs(player.x - HALLWAY_SHOP_X) < 70 && player.y < 252) return { kind: 'shop' };
  if (player.x > HALLWAY_EXIT_X - 120 && player.y < 262) return { kind: 'exit' };
  return null;
}

function hallwayUseDoor(door) {
  hallwayArrival = 0.6;
  hallwayTalk = null;
  hallwayTarget = null;
  if (typeof sfx === 'function') sfx('ui');
  if (typeof goRoom === 'function') goRoom(door.room);
  return true;
}

function hallwayExitNote() {
  const text = state.won
    ? 'Discharged. The doors are open and the parking lot has never looked better. Go home.'
    : hallwayRalphWaiting()
      ? 'Ralph is still in your room. The exit can wait. He cannot.'
      : `The exit wants 12 stars (you have ${stars()}), every arcade stamped and Ralph evicted. Soon.`;
  if (typeof toast === 'function') toast(text, 3.4);
  if (typeof sfx === 'function') sfx(state.won ? 'win' : 'ui');
  return true;
}

function hallwayAct(tg) {
  if (!tg) return false;
  if (tg.kind === 'talk') return hallwayOpenTalk(tg.npc);
  if (tg.kind === 'door') return hallwayUseDoor(tg.door);
  if (tg.kind === 'shop') {
    if (typeof showShop === 'function') showShop();
    return true;
  }
  if (tg.kind === 'exit') return hallwayExitNote();
  return false;
}

function hallwayInteract() {
  if (hallwayTalk) {
    hallwayAdvance();
    return true;
  }
  return hallwayAct(hallwayFindTarget());
}

// A tap in world coordinates: the speech box, a prompt, a nearby visitor, a nearby door.
function hallwayTap(p) {
  if (hallwayTalk) {
    hallwayAdvance();
    return true;
  }
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  const tg = hallwayFindTarget();
  if (tg) {
    const r = hallwayPromptRect(hallwayPromptInfo(tg));
    if (p.x > r.x - 8 && p.x < r.x + r.w + 8 && p.y > r.y - 8 && p.y < r.y + r.h + 8) return hallwayAct(tg);
  }
  for (const npc of hallwayCast) {
    if (!npc.present || dist(npc, player) > 140) continue;
    const top = npc.y - hallwayNpcTop(npc);
    if (Math.abs(p.x - npc.x) < (npc.rowdy ? 32 : 26) && p.y > top - 6 && p.y < npc.y + 8) return hallwayOpenTalk(npc);
  }
  for (const d of HALLWAY_DOORS) {
    const half = d.double ? 74 : 50;
    if (Math.abs(player.x - d.x) < 150 && player.y < 340 && Math.abs(p.x - d.x) < half && p.y > 22 && p.y < 230)
      return hallwayUseDoor(d);
  }
  if (tg && (tg.kind === 'shop' || tg.kind === 'exit')) {
    const x = tg.kind === 'shop' ? HALLWAY_SHOP_X : HALLWAY_EXIT_X;
    if (Math.abs(p.x - x) < 80 && p.y < 230) return hallwayAct(tg);
  }
  return false;
}

// ---- Framework hooks ----
function updateRoomExtras(dt) {
  if (!Number.isFinite(dt) || dt <= 0 || !hallwayCast.length) return;
  if (state.room !== HALLWAY_ID) {
    hallwayLastRoom = state.room;
    hallwayTalk = null;
    hallwayInside = false;
    hallwayEnsureTick(dt, false);
    return;
  }
  if (hallwayBusy()) return;
  hallwayClock += dt;
  hallwayArrival = Math.max(0, hallwayArrival - dt);
  hallwayPaStep(dt);
  hallwayBarkGap = Math.max(0, hallwayBarkGap - dt);
  hallwayElevator.hold = Math.max(0, hallwayElevator.hold - dt);
  hallwayElevator.open += ((hallwayElevator.hold > 0 ? 1 : 0) - hallwayElevator.open) * (1 - Math.exp(-dt * 7));
  hallwayEnsureTick(dt, true);
  for (const npc of hallwayCast) hallwayNpcStep(npc, dt);
  hallwayTalkStep(dt);
  hallwayTarget = hallwayFindTarget();
  // Walking fully into a door (pushing up against it) goes through.
  const door = hallwayTarget && hallwayTarget.kind === 'door' ? hallwayTarget.door : null;
  if (door && hallwayArrival <= 0 && player.y < HALLWAY_DOOR_IN && player.moving && player.lastDy < -0.4)
    hallwayUseDoor(door);
}

function roomExtrasAction(kind, point) {
  if (!hallwayHere() || hallwayBusy()) return false;
  if (kind === 'escape' || kind === 'back' || kind === 'cancel') return hallwayCloseTalk();
  if (kind === 'tap') return hallwayTap(point);
  if (kind !== 'attack' && kind !== 'use' && kind !== 'enter') return false;
  // attack() runs every step while Space is held: only a fresh press acts; a held one repeats the answer.
  const held = hallwayClock - hallwayPressAt < HALLWAY_HOLD_GAP;
  hallwayPressAt = hallwayClock;
  if (held) return hallwayPressTook;
  hallwayPressTook = hallwayInteract();
  if (!hallwayPressTook && kind === 'enter') {
    if (typeof toast === 'function') toast('Walk up to a door to go in, or say hi to someone.', 2.2);
    hallwayPressTook = true;
  }
  return hallwayPressTook;
}

function hallwayEnter(fromRoom = state.room) {
  if (fromRoom === HALLWAY_ID || state.room === HALLWAY_ID) return false;
  hallwayInstall();
  hallwayFrom = fromRoom;
  if (typeof goRoom === 'function') goRoom(HALLWAY_ID);
  return true;
}

// Macy steps out of the door she came through (room 5 is her room at night), facing down the corridor.
function hallwayPlace(from) {
  const room = from === 5 ? 0 : from,
    door = HALLWAY_DOORS.find(d => d.room === room) || HALLWAY_DOORS[0];
  player.x = door.x;
  player.y = HALLWAY_ARRIVE_Y;
  player.dir = door.x < HALLWAY_W / 2 ? 1 : -1;
  player.visualDir = player.dir;
  player.lastDx = player.dir;
  player.lastDy = 0;
  player.z = 0;
  player.vz = 0;
  player.dash = 0;
  const vw = typeof viewport === 'object' && viewport ? viewport.w : 1000;
  cameraX = clamp(player.x - vw / 2, 0, Math.max(0, HALLWAY_W - vw));
  return door;
}

function onRoomLoaded(id) {
  if (id !== HALLWAY_ID) {
    hallwayLastRoom = id;
    hallwayTalk = null;
    hallwayInside = false;
    return;
  }
  if (!hallwayCast.length) hallwayResetCast();
  // A fresh entry (not a repeated load of the same visit) reads the Ensure count and dresses the floor.
  if (!hallwayInside) hallwayCultRead();
  hallwayInside = true;
  // Remember the door, so a second onRoomLoaded(6) for the same visit lands in the same place.
  const from = hallwayFrom ?? hallwayLastRoom;
  hallwayFrom = null;
  hallwayLastRoom = from;
  hallwayPlace(from);
  // A new visit: Rowdy gallops over to say hi once.
  for (const npc of hallwayCast) {
    if (!npc.rowdy) continue;
    npc.greeted = false;
    npc.entered = true;
  }
  hallwayArrival = 0.5;
  hallwayTalk = null;
  hallwayTarget = null;
  if (hallwayEnsure.phase === 'away') hallwayEnsure.due = Math.max(hallwayEnsure.due, 5);
  if (typeof music === 'function' && audio.track !== 'room:6') music('room:6');
  if (!hallwayVisited) {
    hallwayVisited = true;
    if (typeof toast === 'function') toast('The long way round. Everyone out here is on your side. Say hi.', 3.4);
    // The PA waits for the welcome toast to clear.
    if (hallwayCult.paDue > 0) hallwayCult.paDue = 3.8;
  }
}

// ---- Visitor art ----
// In girl()'s style: origin at the feet, drawn facing +x, then flipped by dir. A fractional dir is the
// mid-turn squash when someone turns to face Macy.
function npcTop(k) {
  const extra = { wavy: 9, bun: 9, cap: 5, pony: 4, net: 6, curly: 6 }[k.hairStyle] || 4;
  return k.leg + k.torso + 5 + k.head * 2.24 - 3 + extra;
}

function npcHeadY(k) {
  return -(k.leg + k.torso + 5 + k.head * 1.12 - 3);
}

// Sleeves: the shirt under Dodo's vest, the leather sleeves on Taylor's varsity jacket.
function npcSleeve(k) {
  return k.top === 'vest' || k.top === 'letter' ? k.topB : k.topA;
}

// The varsity jacket's striped knit cuff, just above the hand.
function npcCuff(g, k, hx, hy) {
  if (k.top !== 'letter') return;
  ellipse(g, hx, hy - 3.2, 3.7, 1.9, k.topA);
  line(g, [[hx - 3, hy - 3.2], [hx + 3, hy - 3.2]], k.topC, 0.8);
}

function npcText(g, text, x, y, size, color, flip) {
  g.save();
  g.translate(x, y);
  g.scale(flip < 0 ? -1 : 1, 1);
  label(g, text, 0, 0, size, color, 'center');
  g.restore();
}

function npcFigure(g, x, y, s, k, pose = 0, dir = 1, t = 0, opts = {}) {
  const L = k.leg,
    T = k.torso,
    S = k.shoulder,
    hipY = -L,
    shY = hipY - T,
    hr = k.head,
    hry = hr * 1.12,
    hy = shY - 5 - hry + 3,
    walk = Math.sin(pose),
    bob = pose ? Math.abs(walk) * 1.6 : Math.sin(t * 2.1 + k.seed) * 0.45,
    flip = Math.abs(dir) < 0.16 ? (dir < 0 ? -0.16 : 0.16) : dir,
    both = k.item === 'tray' || k.item === 'tin';
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (opts.shadow !== false) shadow(g, 0, 2, S + 7, 5);
  g.translate(0, -bob - (opts.hop || 0));
  g.scale(flip, 1);
  npcBackHair(g, k, hy, hr, hry, t);
  if (!both) npcArm(g, k, -1, shY, walk);
  npcLegs(g, k, hipY, walk);
  npcTorso(g, k, shY, hipY, flip);
  rr(g, -3.2, shY - 6, 6.4, 8, 3, k.skinShade);
  npcCollar(g, k, shY);
  if (both) npcHoldBoth(g, k, shY, t);
  else if (k.item) npcHold(g, k, shY, t);
  else npcArm(g, k, 1, shY, walk);
  npcHead(g, k, hy, hr, hry, t, opts.speak);
  g.restore();
}

function npcArm(g, k, side, shY, walk) {
  const swing = -side * walk * 3,
    sx = side * (k.shoulder - 2.5),
    sy = shY + 5,
    hx = side * (k.shoulder + 3.5) + swing,
    hy = sy + k.torso * 0.86,
    sleeve = npcSleeve(k);
  path(
    g,
    p => {
      p.moveTo(sx, sy);
      p.quadraticCurveTo(side * (k.shoulder + 4.5), sy + k.torso * 0.45, hx, hy - 3);
    },
    null,
    k.shortSleeve ? k.skinShade : sleeve,
    k.shortSleeve ? k.armW - 1 : k.armW
  );
  if (k.shortSleeve)
    path(
      g,
      p => {
        p.moveTo(sx, sy);
        p.quadraticCurveTo(side * (k.shoulder + 3), sy + 4, side * (k.shoulder + 3.6), sy + k.torso * 0.3);
      },
      null,
      sleeve,
      k.armW + 1.2
    );
  npcCuff(g, k, hx, hy);
  ellipse(g, hx, hy, 3.1, 3.9, k.skin);
}

function npcLegs(g, k, hipY, walk) {
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1,
      step = side * walk * k.leg * 0.16,
      hx = side * k.hip * 0.55,
      fx = side * k.hip * 0.6 + step,
      col = i ? k.pants : npcShade(k.pants, 0.86);
    line(
      g,
      [
        [hx, hipY + 3],
        [hx + step * 0.3, hipY * 0.5],
        [fx, -4]
      ],
      col,
      k.legW
    );
    // Volleyball kneepads.
    if (k.kneepads) rr(g, hx + step * 0.3 - k.legW * 0.78, hipY * 0.5 - 3.6, k.legW * 1.56, 7.2, 3, k.kneepads);
    if (k.cuffs) line(g, [[fx, -9], [fx, -4]], npcShade(k.pants, 0.76), k.legW + 1.6);
    npcShoe(g, k, fx);
  }
}

function npcShoe(g, k, fx) {
  const c = k.shoeColor;
  if (k.shoes === 'moc') {
    // Moccasin slippers: suede, a fleece collar, a stitched toe.
    rr(g, fx - 6, -5.5, 16, 7.5, 3.8, c, npcShade(c, 0.7), 0.8);
    ellipse(g, fx - 1, -5.2, 6.2, 2.2, '#efe2c8');
    path(
      g,
      p => {
        p.moveTo(fx + 2, -3.4);
        p.quadraticCurveTo(fx + 5.5, -5.2, fx + 8.5, -3);
      },
      null,
      '#e2bf92',
      1
    );
  } else if (k.shoes === 'sneaker') {
    rr(g, fx - 6, -5, 16, 7, 3, c, '#71858c', 0.8);
    line(g, [[fx - 4, 1], [fx + 8, 1]], '#9eb4b4', 1.4);
    if (k.shoeAccent) line(g, [[fx - 2, -2.6], [fx + 4.5, -1.2]], k.shoeAccent, 1.6);
  } else if (k.shoes === 'clog') {
    rr(g, fx - 6, -6.5, 15, 8.5, 4.2, c, npcShade(c, 0.72), 0.8);
    ellipse(g, fx + 1, -3.6, 0.8, 0.8, npcShade(c, 0.7));
    ellipse(g, fx + 4, -3.4, 0.8, 0.8, npcShade(c, 0.7));
  } else if (k.shoes === 'loafer') {
    rr(g, fx - 6, -4.5, 16, 6.5, 3, c, npcShade(c, 0.7), 0.8);
    line(g, [[fx + 1, -3.4], [fx + 6, -3.4]], npcShade(c, 1.5), 1);
  } else rr(g, fx - 5, -4, 14, 5.5, 2.6, c, npcShade(c, 0.7), 0.8);
}

function npcTorso(g, k, shY, hipY, flip) {
  const a = k.topA,
    b = k.topB,
    c = k.topC,
    S = k.shoulder,
    T = k.torso,
    dark = npcShade(a, 0.82),
    h = T + 6;
  if (k.top === 'zip') {
    // Unzipped sweatshirt over a heather t-shirt: hood bunched at the neck, zipper tape, ribbed hem.
    ellipse(g, 0, shY + 1.5, S * 0.74, 4.6, dark);
    rr(g, -S + 3.5, shY, S * 2 - 7, h - 1, 6, b);
    rr(g, -S, shY - 0.5, S - 3, h, 7, gradient(g, -S, shY, S, h, npcShade(a, 1.1), a));
    rr(g, 3, shY - 0.5, S - 3, h, 7, gradient(g, 0, shY, S, h, a, dark));
    line(g, [[-3.2, shY + 3], [-3.2, hipY + 4]], c, 1.3);
    line(g, [[3.2, shY + 3], [3.2, hipY + 4]], c, 1.3);
    rr(g, -S, hipY + 1, S - 3, 4.6, 2, dark);
    rr(g, 3, hipY + 1, S - 3, 4.6, 2, dark);
    line(g, [[-S + 3, hipY - 10], [-S + 6, hipY - 2]], npcShade(a, 0.7), 1.2);
    line(g, [[S - 3, hipY - 10], [S - 6, hipY - 2]], npcShade(a, 0.7), 1.2);
  } else if (k.top === 'hoodie') {
    ellipse(g, 0, shY + 1, S * 0.82, 5, dark);
    rr(g, -S, shY - 0.5, S * 2, h, 8, gradient(g, -S, shY, S * 2, h, npcShade(a, 1.1), a), dark, 0.8);
    rr(g, -S * 0.62, hipY - 10, S * 1.24, 10, 4, dark);
    rr(g, -S, hipY + 1, S * 2, 4.6, 2, dark);
    poly(
      g,
      [
        [1, shY + 7],
        [-2.5, shY + 13],
        [0.5, shY + 13],
        [-1.5, shY + 19],
        [3.5, shY + 11.5],
        [0.8, shY + 11.5]
      ],
      b
    );
  } else if (k.top === 'scrubs') {
    rr(g, -S, shY - 0.5, S * 2, h + 2, 7, gradient(g, -S, shY, S * 2, h, npcShade(a, 1.08), a));
    rr(g, S - 9, shY + 9, 7, 7, 1.5, npcShade(a, 0.86));
    line(g, [[S - 6.5, shY + 6], [S - 6.5, shY + 10]], '#3b5b7a', 1.4);
  } else if (k.top === 'coat') {
    // A shirt under a white coat that reaches mid-thigh, with a long tie (k.tie, a colour), a bow tie
    // (k.tie 'bow', in k.tieColor) or none at all.
    const hem = hipY + k.leg * 0.32;
    rr(g, -S + 3, shY, S * 2 - 6, h - 2, 5, b);
    if (k.tie === 'bow') {
      const bc = k.tieColor || '#8c2f3f';
      poly(g, [[0, shY + 2.6], [-5, shY - 0.2], [-5, shY + 5.4]], bc);
      poly(g, [[0, shY + 2.6], [5, shY - 0.2], [5, shY + 5.4]], bc);
      rr(g, -1.4, shY + 1.2, 2.8, 2.8, 1, npcShade(bc, 0.8));
    } else if (k.tie)
      poly(
        g,
        [
          [-1.6, shY + 2],
          [1.6, shY + 2],
          [2.2, shY + 16],
          [0, shY + 19],
          [-2.2, shY + 16]
        ],
        k.tie
      );
    for (const side of [-1, 1]) {
      path(
        g,
        p => {
          p.moveTo(side * (S + 0.5), shY + 2);
          p.lineTo(side * 3, shY);
          p.lineTo(side * 1.5, shY + 18);
          p.lineTo(side * 2.5, hem);
          p.lineTo(side * (S + 2), hem);
          p.closePath();
        },
        side < 0 ? a : npcShade(a, 0.95),
        c,
        0.9
      );
      poly(
        g,
        [
          [side * 3, shY],
          [side * 7.5, shY + 4],
          [side * 2.2, shY + 14]
        ],
        c
      );
      line(g, [[side * (S - 1.5), hipY - 1], [side * 5, hipY - 1]], c, 1.2);
    }
    line(g, [[-S + 3, shY + 9], [-S + 3, shY + 13]], '#5b8ac9', 1.4);
  } else if (k.top === 'cardigan') {
    rr(g, -S + 3, shY, S * 2 - 6, h, 6, b);
    rr(g, -S, shY - 0.5, S - 2.5, h + 1, 7, a);
    rr(g, 2.5, shY - 0.5, S - 2.5, h + 1, 7, npcShade(a, 0.9));
    for (let i = 0; i < 3; i++) ellipse(g, -3.8, shY + 7 + i * (T / 3.4), 1.2, 1.2, c);
    rr(g, -S, hipY + 1.5, S - 2.5, 4, 2, dark);
    rr(g, 2.5, hipY + 1.5, S - 2.5, 4, 2, dark);
  } else if (k.top === 'vest') {
    rr(g, -S, shY - 0.5, S * 2, h, 7, b);
    path(
      g,
      p => {
        p.moveTo(-S + 1.5, shY + 3);
        p.lineTo(-3.5, shY + 1);
        p.lineTo(0, shY + 12);
        p.lineTo(3.5, shY + 1);
        p.lineTo(S - 1.5, shY + 3);
        p.lineTo(S - 0.5, hipY + 5);
        p.lineTo(-S + 0.5, hipY + 5);
        p.closePath();
      },
      a,
      dark,
      0.8
    );
    for (let i = 0; i < 4; i++) {
      const xx = -S + 4.5 + i * ((S * 2 - 9) / 3);
      line(g, [[xx, shY + 14], [xx, hipY + 3]], dark + '66', 0.7);
    }
  } else if (k.top === 'jersey') {
    rr(g, -S, shY - 0.5, S * 2, h, 7, gradient(g, -S, shY, S * 2, h, npcShade(a, 1.12), a));
    rr(g, -S, shY + 7, 3, h - 10, 1.5, b);
    rr(g, S - 3, shY + 7, 3, h - 10, 1.5, b);
    npcText(g, k.number, 0.5, shY + T * 0.62, 12, b, flip);
  } else if (k.top === 'softball') {
    rr(g, -S, shY - 0.5, S * 2, h, 7, gradient(g, -S, shY, S * 2, h, npcShade(a, 1.1), a));
    line(g, [[1.5, shY + 3], [1.5, hipY + 4]], b, 1.4);
    for (let i = 0; i < 4; i++) ellipse(g, 3.4, shY + 7 + i * 7, 0.9, 0.9, b);
    npcText(g, k.number, -5.5, shY + 15, 8, b, flip);
    line(g, [[-S, hipY + 3], [S, hipY + 3]], c, 1.6);
  } else if (k.top === 'letter') {
    // A varsity jacket worn open over a white tee: wool body, striped knit hem, snaps, a chenille letter
    // with a cream edge, and the class year. Leather sleeves come from npcSleeve.
    rr(g, -S + 3.5, shY, S * 2 - 7, h - 1, 6, '#f6f3e6');
    rr(g, -S, shY - 0.5, S - 2.5, h, 7, gradient(g, -S, shY, S, h, npcShade(a, 1.18), a));
    rr(g, 2.5, shY - 0.5, S - 2.5, h, 7, gradient(g, 0, shY, S, h, a, dark));
    for (const [x0, w0] of [
      [-S, S - 2.5],
      [2.5, S - 2.5]
    ]) {
      rr(g, x0, hipY + 0.5, w0, 5, 2, a);
      line(g, [[x0 + 1, hipY + 2.2], [x0 + w0 - 1, hipY + 2.2]], c, 1);
      line(g, [[x0 + 1, hipY + 3.9], [x0 + w0 - 1, hipY + 3.9]], b, 0.8);
    }
    for (let i = 0; i < 4; i++) ellipse(g, -3.6, shY + 6 + i * (T / 4.6), 0.9, 0.9, b);
    if (k.letter) {
      npcText(g, k.letter, -S * 0.52 + 0.7, shY + T * 0.5 + 0.7, 12, b, flip);
      npcText(g, k.letter, -S * 0.52, shY + T * 0.5, 12, c, flip);
    }
    if (k.number) npcText(g, k.number, S * 0.48, shY + T * 0.32, 6, b, flip);
  } else if (k.top === 'apron') {
    rr(g, -S, shY - 0.5, S * 2, h, 8, a);
    path(
      g,
      p => {
        p.moveTo(-S + 3, shY + 4);
        p.lineTo(S - 3, shY + 4);
        p.lineTo(S - 1, hipY + 10);
        p.quadraticCurveTo(0, hipY + 13, -S + 1, hipY + 10);
        p.closePath();
      },
      b,
      npcShade(b, 0.85),
      0.8
    );
    rr(g, -5, hipY - 5, 10, 7, 2, npcShade(b, 0.93));
    line(g, [[-S, hipY - 12], [S, hipY - 12]], npcShade(b, 0.82), 1.4);
  } else rr(g, -S, shY - 0.5, S * 2, h, 7, a);
}

function npcCollar(g, k, shY) {
  if (k.top === 'zip') {
    path(
      g,
      p => {
        p.moveTo(-3.6, shY + 0.5);
        p.quadraticCurveTo(0, shY + 4.6, 3.6, shY + 0.5);
      },
      null,
      npcShade(k.topB, 0.78),
      1.4
    );
    line(g, [[-4.8, shY + 2], [-5.2, shY + 13]], '#eeeae0', 1.1);
    line(g, [[4.8, shY + 2], [5.4, shY + 12]], '#eeeae0', 1.1);
  } else if (k.top === 'hoodie') {
    line(g, [[-3.5, shY + 2], [-4, shY + 12]], k.topB, 1.1);
    line(g, [[3.5, shY + 2], [4.2, shY + 11]], k.topB, 1.1);
  } else if (k.top === 'letter') {
    // Striped knit collar on the varsity jacket.
    const neck = p => {
      p.moveTo(-5.6, shY + 0.5);
      p.quadraticCurveTo(0, shY + 5, 5.6, shY + 0.5);
    };
    path(g, neck, null, k.topA, 3.2);
    path(g, neck, null, k.topC, 1);
  } else if (k.top === 'scrubs' || k.top === 'jersey') {
    poly(
      g,
      [
        [-4.6, shY - 0.5],
        [4.6, shY - 0.5],
        [0, shY + 8]
      ],
      k.skinShade
    );
    line(g, [[-5, shY - 0.5], [0, shY + 8.5], [5, shY - 0.5]], k.top === 'jersey' ? k.topC : k.topB, 1.5);
  } else if (k.top === 'vest') {
    poly(
      g,
      [
        [-3.6, shY - 0.5],
        [-6.8, shY + 3.6],
        [-0.8, shY + 2.4]
      ],
      k.topB
    );
    poly(
      g,
      [
        [3.6, shY - 0.5],
        [6.8, shY + 3.6],
        [0.8, shY + 2.4]
      ],
      npcShade(k.topB, 0.94)
    );
  } else if (k.top === 'softball' || k.top === 'apron') {
    path(
      g,
      p => {
        p.moveTo(-4.2, shY);
        p.quadraticCurveTo(0, shY + 5, 4.2, shY);
      },
      null,
      k.top === 'apron' ? k.topC : k.topB,
      1.6
    );
  } else if (k.top === 'coat') {
    poly(
      g,
      [
        [-3, shY - 0.5],
        [-5.5, shY + 3],
        [-0.6, shY + 2]
      ],
      k.topB
    );
    poly(
      g,
      [
        [3, shY - 0.5],
        [5.5, shY + 3],
        [0.6, shY + 2]
      ],
      k.topB
    );
  }
  if (k.pearls) for (let i = 0; i < 7; i++) ellipse(g, -4.5 + i * 1.5, shY + 1.4 + Math.sin((i / 6) * Math.PI) * 2.4, 0.9, 0.9, '#fbf6ea');
  if (k.stetho) {
    path(
      g,
      p => {
        p.moveTo(-4.4, shY - 1);
        p.quadraticCurveTo(-7.4, shY + 9, -2.4, shY + 15);
        p.moveTo(4.4, shY - 1);
        p.quadraticCurveTo(7.4, shY + 9, 2.4, shY + 15);
        p.moveTo(-2.4, shY + 15);
        p.quadraticCurveTo(0, shY + 17.5, 2.4, shY + 15);
        p.moveTo(0, shY + 16.5);
        p.lineTo(-0.5, shY + 20);
      },
      null,
      '#3d4f5c',
      1.5
    );
    ellipse(g, -0.5, shY + 21.5, 2.4, 2.4, '#b9c4c8');
  }
  if (k.badge) {
    line(g, [[-3.5, shY], [3.5, shY + 13]], '#3f6fc4', 1);
    rr(g, 1.5, shY + 13, 6, 8, 1.2, '#fbf8ef', '#71858c', 0.6);
    rr(g, 2.8, shY + 14.2, 3.4, 2.8, 0.8, '#7fb8aa');
  }
}

// The front hand holds the item at chest height.
function npcHold(g, k, shY, t) {
  const S = k.shoulder,
    T = k.torso,
    sx = S - 2.5,
    sy = shY + 5,
    hx = S + 1,
    hy = shY + T * 0.55,
    sleeve = npcSleeve(k);
  path(
    g,
    p => {
      p.moveTo(sx, sy);
      p.quadraticCurveTo(S + 5, sy + T * 0.32, hx, hy);
    },
    null,
    k.shortSleeve ? k.skinShade : sleeve,
    k.armW
  );
  if (k.shortSleeve)
    path(
      g,
      p => {
        p.moveTo(sx, sy);
        p.quadraticCurveTo(S + 3, sy + 4, S + 3.6, sy + T * 0.28);
      },
      null,
      sleeve,
      k.armW + 1.2
    );
  npcItem(g, k.item, hx + 3, hy - 1, t);
  npcCuff(g, k, hx + 0.8, hy);
  ellipse(g, hx + 1.5, hy, 3.1, 3.7, k.skin);
}

// Two hands: Barb's tray of Ensure, Mimi's cookie tin.
function npcHoldBoth(g, k, shY, t) {
  const S = k.shoulder,
    T = k.torso,
    tray = k.item === 'tray',
    hy = shY + T * (tray ? 0.46 : 0.62),
    sleeve = npcSleeve(k);
  for (const side of [-1, 1]) {
    path(
      g,
      p => {
        p.moveTo(side * (S - 2.5), shY + 5);
        p.quadraticCurveTo(side * (S + 4), shY + T * 0.36, side * (S - 3.5) + 2, hy + 2);
      },
      null,
      k.shortSleeve ? k.skinShade : sleeve,
      k.armW
    );
    if (k.shortSleeve)
      path(
        g,
        p => {
          p.moveTo(side * (S - 2.5), shY + 5);
          p.quadraticCurveTo(side * (S + 3), shY + 8, side * (S + 3.4), shY + T * 0.28);
        },
        null,
        sleeve,
        k.armW + 1.2
      );
  }
  if (tray) {
    rr(g, -S - 3, hy - 1, S * 2 + 14, 4, 2, '#c9d3d2', '#8fa2a4', 0.7);
    for (let i = 0; i < 5; i++) hallwayBottle(g, -S + 2 + i * ((S * 2 + 6) / 4), hy - 0.5, i % 3, 0.64, false);
  } else {
    ellipse(g, 2, hy + 3, 12, 8, '#2f5b94');
    ellipse(g, 2, hy - 1, 12, 5, '#3e6aa6');
    path(g, p => p.ellipse(2, hy - 1, 12, 5, 0, 0, Math.PI * 2), null, '#e8c35a', 1.2);
    for (let i = 0; i < 4; i++) ellipse(g, -5 + i * 4.5, hy + 4, 1.4, 1, '#e8c35a');
  }
  for (const side of [-1, 1]) ellipse(g, side * (S - 3.5) + 2, hy + 2, 3.1, 3.7, k.skin);
}

function npcItem(g, item, x, y, t) {
  if (item === 'coffee') {
    rr(g, x - 4, y - 10, 9, 13, 2, '#f1ede2', '#9a8f80', 0.6);
    rr(g, x - 4.5, y - 6, 10, 5, 1.5, '#b98a5e');
    rr(g, x - 4.6, y - 12.5, 10.2, 3, 1.4, '#3f3a37');
    path(
      g,
      p => {
        p.moveTo(x, y - 14);
        p.quadraticCurveTo(x - 3, y - 18 + Math.sin(t * 3) * 1.5, x + 1, y - 22);
      },
      null,
      '#ffffff66',
      1.2
    );
  } else if (item === 'clipboard') {
    g.save();
    g.translate(x + 1, y - 5);
    g.rotate(-0.14);
    rr(g, -8, -11, 16, 22, 2, '#b88a5c');
    rr(g, -6.5, -8, 13, 17, 1, '#fbf8ec');
    rr(g, -3, -12.5, 6, 3.5, 1, '#9aa5a8');
    for (let i = 0; i < 4; i++) line(g, [[-4.5, -4 + i * 3.6], [i % 2 ? 2 : 4.5, -4 + i * 3.6]], '#9bb0b4', 0.9);
    g.restore();
  } else if (item === 'chips') {
    g.save();
    g.translate(x + 1, y - 4);
    g.rotate(0.16);
    rr(g, -6.5, -9, 13, 17, 2, '#e9b44c', '#b5822a', 0.7);
    poly(
      g,
      [
        [-6.5, -9],
        [-4.5, -11],
        [-2.5, -9],
        [-0.5, -11],
        [1.5, -9],
        [3.5, -11],
        [6.5, -9]
      ],
      '#e9b44c'
    );
    rr(g, -6.5, -4, 13, 4.5, 1, '#d9534f');
    ellipse(g, 0, 3.5, 3.2, 2.2, '#f6d58a');
    g.restore();
  } else if (item === 'volleyball') {
    // The team ball: signed all over.
    ellipse(g, x + 3, y + 2, 8.5, 8.5, '#f6f2e3');
    path(
      g,
      p => {
        p.arc(x - 2, y - 3, 9, 0.2, 1.5);
      },
      null,
      '#3f6fc4',
      1.8
    );
    path(
      g,
      p => {
        p.arc(x + 9, y + 7, 9, 3.4, 4.7);
      },
      null,
      '#f0c94a',
      1.8
    );
    line(g, [[x - 1, y + 4], [x + 1, y + 2], [x + 3, y + 4], [x + 5, y + 2]], '#40404088', 0.7);
    line(g, [[x + 2, y - 3], [x + 5, y - 4], [x + 7, y - 2]], '#40404088', 0.7);
  } else if (item === 'glove') {
    path(
      g,
      p => {
        p.moveTo(x - 6, y + 6);
        p.quadraticCurveTo(x - 9, y - 4, x - 4, y - 9);
        p.quadraticCurveTo(x + 1, y - 12, x + 6, y - 8);
        p.quadraticCurveTo(x + 10, y - 2, x + 7, y + 6);
        p.quadraticCurveTo(x, y + 9, x - 6, y + 6);
        p.closePath();
      },
      '#a8693c',
      '#6e4222',
      0.9
    );
    line(g, [[x - 3, y - 8], [x - 2, y + 2]], '#6e4222', 0.8);
    line(g, [[x + 1, y - 9], [x + 2, y + 2]], '#6e4222', 0.8);
    line(g, [[x + 5, y - 6], [x + 5, y + 3]], '#6e4222', 0.8);
    ellipse(g, x + 2, y + 5, 3, 1.5, '#e8c39a');
  } else if (item === 'tablet') {
    rr(g, x - 5, y - 9, 11, 15, 2, '#2f3d4c');
    rr(g, x - 3.6, y - 7.6, 8.2, 11, 1, '#9ad7e0');
    line(g, [[x - 2.4, y - 4], [x + 3, y - 4]], '#ffffff99', 0.8);
  } else if (item === 'blanket') {
    // The good Rams blanket, folded under Casey's arm: blue, a gold stripe, a ram horn in the corner.
    g.save();
    g.translate(x - 2, y - 2);
    g.rotate(-0.1);
    rr(g, -9, -6, 18, 12, 3, '#2f5fb3', '#1f3f7a', 0.8);
    line(g, [[-9, -1], [9, -1]], '#f0c94a', 1.6);
    line(g, [[-9, 2.6], [9, 2.6]], '#1f3f7a88', 0.8);
    path(g, p => p.arc(5, 2.8, 2.2, Math.PI, Math.PI * 2.6), null, '#f0c94a', 1.1);
    g.restore();
  } else if (item === 'ensure') {
    // Every nurse, once the floor has gone all in on Ensure.
    hallwayBottle(g, x + 1, y + 6, 1, 0.66, false);
  } else if (item === 'trophy') {
    // The last bottle Barb ever brings: a gold bow and a tag that says FINE. YOU WIN.
    hallwayBottle(g, x + 1, y + 8, 2, 0.86, false);
    poly(g, [[x + 1, y - 9], [x - 4, y - 12], [x - 4, y - 6]], '#f0c94a');
    poly(g, [[x + 1, y - 9], [x + 6, y - 12], [x + 6, y - 6]], '#f0c94a');
    line(g, [[x + 3, y - 2], [x + 9, y + 3]], '#9a8a6a', 0.6);
    rr(g, x + 6, y + 2, 13, 7, 1.2, '#fffaf0', '#9a8a6a', 0.5);
    label(g, 'FINE. YOU WIN.', x + 12.5, y + 6.6, 2.2, '#3f3a37', 'center');
  } else if (item === 'keys') {
    // Taylor drives: a ring, a car key, a house key and a Rams fob, swinging a little.
    g.save();
    g.translate(x - 1.5, y + 2);
    g.rotate(Math.sin(t * 2.6) * 0.22);
    path(g, p => p.arc(0, 2, 2.6, 0, Math.PI * 2), null, '#c9ccd1', 1);
    rr(g, -3.6, 4, 4.6, 4, 1.6, '#3a3f47');
    rr(g, -2.2, 7.5, 1.8, 6, 0.8, '#d9dce0');
    rr(g, 0.4, 4.2, 1.8, 7, 0.8, '#d9b45a');
    rr(g, 1.6, 4.6, 5.6, 7, 2, '#2f5fb3', '#f0c94a', 0.7);
    ellipse(g, 4.4, 8.1, 1.3, 1.3, '#f0c94a');
    g.restore();
  } else if (item === 'cup') {
    poly(
      g,
      [
        [x - 4, y - 9],
        [x + 4, y - 9],
        [x + 3, y + 2],
        [x - 3, y + 2]
      ],
      '#f6f3e6'
    );
    line(g, [[x - 3.6, y - 5], [x + 3.6, y - 5]], '#7fb8aa', 1.4);
  }
}

function npcBackHair(g, k, hy, hr, hry, t) {
  // bounce: a ponytail with a life of its own (Presley's), faster and wider.
  const top = hy - hry,
    sway = Math.sin(t * (3.4 + k.bounce) + k.seed) * (1.5 + k.bounce),
    flick = k.bounce ? Math.abs(Math.sin(t * (3.4 + k.bounce) + k.seed)) * 2 : 0;
  if (k.hairStyle === 'pony')
    path(
      g,
      p => {
        p.moveTo(-6, top + 1);
        p.bezierCurveTo(-24, top - 4 - flick, -21, hy + 12, -15 + sway, hy + 21 - flick);
        p.bezierCurveTo(-9, hy + 10, -11, hy - 2, -4, top + 4);
        p.closePath();
      },
      gradient(g, -24, top, 20, 36, k.hair, k.hairDark)
    );
  else if (k.hairStyle === 'long')
    // Long and straight, falling past the shoulders behind her.
    path(
      g,
      p => {
        p.moveTo(-hr - 1.5, hy - 5);
        p.bezierCurveTo(-hr - 4.5, hy + 8, -hr - 4, hy + 20, -hr + 0.5 + sway * 0.3, hy + 27);
        p.quadraticCurveTo(0.5, hy + 30, hr + 2 + sway * 0.3, hy + 27);
        p.bezierCurveTo(hr + 5.5, hy + 20, hr + 5.5, hy + 8, hr + 2.5, hy - 5);
        p.closePath();
      },
      gradient(g, 0, hy - 5, 0, 34, k.hair, k.hairDark)
    );
  else if (k.hairStyle === 'bob') rr(g, -hr - 2.6, hy - 6, hr * 2 + 5, hry + 9, 7, k.hairDark);
  else if (k.hairStyle === 'curly' || k.hairStyle === 'net') ellipse(g, 0.5, hy - 2, hr + 4, hry + 3, k.hairDark);
}

function npcHead(g, k, hy, hr, hry, t, speak) {
  const fx = 0.9,
    es = hr / 12.5,
    blink = (t + k.seed * 1.3) % 4.8 > 4.64;
  ellipse(g, -hr + 0.4, hy + 2, 2.8, 4, k.skinShade);
  ellipse(g, hr + 1.2, hy + 2, 2.6, 3.8, k.skinShade);
  ellipse(g, fx, hy, hr, hry, gradient(g, -hr, hy - hry, hr * 1.7, hry * 1.8, k.skin, k.skinShade));
  if (k.stubble)
    path(
      g,
      p => {
        p.moveTo(fx - hr + 2.5, hy + 4);
        p.quadraticCurveTo(fx, hy + hry + 3, fx + hr - 2.5, hy + 4);
        p.quadraticCurveTo(fx, hy + hry - 2.5, fx - hr + 2.5, hy + 4);
        p.closePath();
      },
      '#4b302214'
    );
  for (const ex of [-4.4, 5.4]) {
    const x = fx + ex * es,
      y = hy + 0.5;
    if (blink) line(g, [[x - 2.2, y], [x + 2.2, y]], '#4a3a33', 1.1);
    else {
      ellipse(g, x, y, 2.3, 3.1, '#fff8e9');
      ellipse(g, x + 0.5, y + 0.2, 1.55, 2.3, k.eyes);
      ellipse(g, x + 0.75, y + 0.45, 0.78, 1.35, '#2a2427');
      ellipse(g, x, y - 0.8, 0.55, 0.7, '#ffffff');
    }
    line(g, [[x - 2.3, y - 5], [x + 2.1, y - 5.5]], k.brows, k.age ? 1.6 : 1.2);
    if (k.age) {
      const out = ex < 0 ? -1 : 1;
      line(g, [[x + out * 3.4, y + 0.6], [x + out * 4.6, y - 0.6]], npcShade(k.skinShade, 0.86), 0.7);
    }
  }
  path(
    g,
    p => {
      p.moveTo(fx + 1.8, hy + 2.6);
      p.quadraticCurveTo(fx + 3.4, hy + 5.6, fx + 1.2, hy + 6.2);
    },
    null,
    npcShade(k.skinShade, 0.86),
    1
  );
  const open = speak ? Math.max(0, Math.sin(t * 19)) : 0;
  if (open > 0.3) ellipse(g, fx + 1.2, hy + 9.2, 2.5, 0.9 + open * 1.6, '#8a4a4a');
  else
    path(
      g,
      p => {
        p.moveTo(fx - 2.2, hy + 8.4);
        p.quadraticCurveTo(fx + 1.2, hy + 11.2, fx + 4.4, hy + 8.2);
      },
      null,
      '#a7645d',
      1.1
    );
  ellipse(g, fx - 6.5, hy + 5.6, 2.6, 1.3, '#ef9e8b44');
  ellipse(g, fx + 8.2, hy + 5.6, 2.2, 1.2, '#ef9e8b44');
  if (k.mustache && k.handlebar) {
    // Dr. Benedetto's: thick, dark, and curled up at both ends. It has been with him since residency.
    const mx = fx + 1.2;
    for (const side of [-1, 1])
      path(
        g,
        p => {
          p.moveTo(mx, hy + 5.4);
          p.quadraticCurveTo(mx + side * 4.5, hy + 4.2, mx + side * 7.4, hy + 7.4);
          p.quadraticCurveTo(mx + side * 9.4, hy + 8.8, mx + side * 9.6, hy + 5.6);
          p.quadraticCurveTo(mx + side * 10.4, hy + 9.6, mx + side * 7, hy + 9.4);
          p.quadraticCurveTo(mx + side * 3.6, hy + 9.2, mx, hy + 7.8);
          p.closePath();
        },
        k.mustache
      );
    line(g, [[mx - 3, hy + 6], [mx - 1, hy + 5.6]], '#ffffff22', 0.8);
  } else if (k.mustache)
    path(
      g,
      p => {
        p.moveTo(fx - 4, hy + 7.8);
        p.quadraticCurveTo(fx + 1.2, hy + 4.4, fx + 6.4, hy + 7.8);
        p.quadraticCurveTo(fx + 1.2, hy + 6.6, fx - 4, hy + 7.8);
        p.closePath();
      },
      k.mustache
    );
  npcHair(g, k, hy, hr, hry, fx);
  if (k.shades) {
    // Sunglasses parked on top of her head: the senior who drives.
    const sy = hy - hry + 2;
    rr(g, fx - 8.5, sy - 2.4, 7.4, 4.6, 2.2, k.shades);
    rr(g, fx + 1.6, sy - 2.6, 7.4, 4.6, 2.2, k.shades);
    line(g, [[fx - 1.2, sy - 0.8], [fx + 1.6, sy - 0.8]], k.shades, 1);
    line(g, [[fx - 7, sy - 1.6], [fx - 4.6, sy - 1.6]], '#ffffff55', 0.8);
    line(g, [[fx + 3, sy - 1.8], [fx + 5.4, sy - 1.8]], '#ffffff55', 0.8);
  }
  if (k.glasses) {
    rr(g, fx - 7.8, hy - 2.2, 6.6, 5.2, 2, null, k.glasses, 1);
    rr(g, fx + 2.2, hy - 2.2, 6.6, 5.2, 2, null, k.glasses, 1);
    line(g, [[fx - 1.2, hy - 0.4], [fx + 2.2, hy - 0.4]], k.glasses, 1);
    line(g, [[fx - 7.8, hy - 0.8], [-hr + 1, hy - 1.5]], k.glasses, 0.9);
  }
}

function npcHair(g, k, hy, hr, hry, fx) {
  const top = hy - hry,
    fill = gradient(g, -hr, top - 6, hr * 2, hry + 4, k.hair, k.hairDark),
    style = k.hairStyle;
  if (style === 'wavy') {
    // Dad: short, bushy, wavy. A cap of hair, a crown of waves, a fringe pushed up off the forehead.
    path(
      g,
      p => {
        p.moveTo(-hr - 0.5, hy + 2);
        p.bezierCurveTo(-hr - 3, top - 7, hr + 4, top - 7, hr + 1.5, hy + 0.5);
        p.bezierCurveTo(hr - 1.5, hy - 6, hr - 5, hy - 8.5, fx + 2, hy - 8.5);
        p.bezierCurveTo(-3, hy - 9.5, -8, hy - 5.5, -hr + 2.5, hy + 3);
        p.closePath();
      },
      fill
    );
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.04 + i * 0.153),
        r = i % 2 ? 4.6 : 4;
      ellipse(g, Math.cos(a) * (hr + 0.6) + 0.5, hy - 2.5 + Math.sin(a) * (hry + 0.8), r + 0.6, r, i % 2 ? k.hair : k.hairDark);
    }
    ellipse(g, fx - 3.5, hy - 9.2, 5.2, 3.2, k.hair);
    ellipse(g, fx + 3.5, hy - 10.2, 5.4, 3.4, k.hairDark);
    ellipse(g, fx + 8, hy - 7.6, 3.6, 2.8, k.hair);
    for (const [x0, y0] of [
      [-7, top - 1],
      [0, top - 4.5],
      [7, top - 1.5]
    ])
      path(
        g,
        p => {
          p.moveTo(x0 - 3, y0 + 1);
          p.quadraticCurveTo(x0, y0 - 2, x0 + 3, y0 + 1);
        },
        null,
        '#ffffff26',
        1.2
      );
    rr(g, -hr + 0.4, hy - 2, 2.6, 6, 1.2, k.hairDark);
    rr(g, hr - 1.4, hy - 2, 2.4, 5.5, 1.2, k.hairDark);
  } else if (style === 'straight') {
    // Riley: short, straight, a fringe that needs a cut.
    path(
      g,
      p => {
        p.moveTo(-hr - 0.6, hy + 2.5);
        p.bezierCurveTo(-hr - 2, top - 5.5, hr + 2.5, top - 5.5, hr + 1.2, hy + 1);
        p.lineTo(hr - 0.8, hy - 3.6);
        p.lineTo(fx + 7.5, hy - 5.4);
        p.lineTo(fx + 4.5, hy - 3.8);
        p.lineTo(fx + 1, hy - 5.8);
        p.lineTo(fx - 2.5, hy - 3.6);
        p.lineTo(fx - 6, hy - 5);
        p.lineTo(-hr + 2, hy - 3.2);
        p.lineTo(-hr + 1.2, hy + 3.5);
        p.closePath();
      },
      fill
    );
    for (const sx of [-6, -1, 4, 8]) line(g, [[sx * 0.9, top - 2.5], [sx, hy - 6]], k.hairDark, 0.8);
    path(
      g,
      p => {
        p.moveTo(-7, top + 0.5);
        p.quadraticCurveTo(0, top - 3.5, 7, top);
      },
      null,
      '#ffffff26',
      1.4
    );
  } else if (style === 'bun') {
    ellipse(g, fx - 1, top - 4.5, 6.8, 5.8, k.hairDark);
    ellipse(g, fx - 1.5, top - 5.2, 5.2, 4.2, k.hair);
    path(
      g,
      p => {
        p.moveTo(-hr - 0.5, hy + 3);
        p.bezierCurveTo(-hr - 2.5, top - 5, hr + 3, top - 5, hr + 1.5, hy + 1);
        p.quadraticCurveTo(hr - 1, hy - 7, fx + 5, hy - 7.5);
        p.quadraticCurveTo(fx + 1, hy - 4.5, fx - 2, hy - 8);
        p.quadraticCurveTo(-6, hy - 4.5, -hr + 1.5, hy - 3);
        p.lineTo(-hr + 1, hy + 4);
        p.closePath();
      },
      fill
    );
    ellipse(g, -hr + 0.5, hy - 1, 3, 3.4, k.hair);
    ellipse(g, hr + 0.8, hy - 1.5, 2.8, 3.2, k.hair);
  } else if (style === 'cap') {
    // Dodo: white fringe over the ears under a tweed flat cap.
    ellipse(g, -hr + 1, hy - 1, 3.2, 4.5, k.hair);
    ellipse(g, hr + 0.4, hy - 1, 3, 4.2, k.hair);
    path(
      g,
      p => {
        p.moveTo(-hr - 1.5, hy - 2.5);
        p.bezierCurveTo(-hr - 1, top - 7, hr * 0.6, top - 7.5, hr + 3, hy - 6.5);
        p.lineTo(-hr - 1.5, hy - 2.5);
        p.closePath();
      },
      gradient(g, -hr, top - 7, hr * 2, 10, k.hat, k.hatDark)
    );
    path(
      g,
      p => {
        p.moveTo(hr - 3, hy - 6.8);
        p.quadraticCurveTo(hr + 6, hy - 7.5, hr + 8.5, hy - 4.6);
        p.quadraticCurveTo(hr + 3, hy - 3.6, hr - 4, hy - 4.4);
        p.closePath();
      },
      k.hatDark
    );
    line(g, [[-hr, hy - 3], [hr + 2, hy - 6.2]], npcShade(k.hatDark, 0.8), 1);
    for (let i = 0; i < 6; i++) ellipse(g, -hr + 3 + i * 3.6, top - 1 + (i % 2) * 2, 0.6, 0.6, '#c9b99a');
  } else if (style === 'pony') {
    path(
      g,
      p => {
        p.moveTo(-hr - 0.5, hy + 3);
        p.bezierCurveTo(-hr - 2.5, top - 6, hr + 3, top - 6, hr + 1.5, hy + 0.5);
        p.bezierCurveTo(hr - 2, hy - 6, fx + 3, hy - 8.5, fx - 2, hy - 8);
        p.bezierCurveTo(-6, hy - 7.5, -9, hy - 3, -hr + 2, hy + 3.5);
        p.closePath();
      },
      fill
    );
    if (k.band) {
      path(
        g,
        p => {
          p.moveTo(-hr + 0.5, hy - 4);
          p.quadraticCurveTo(fx, top - 4, hr + 0.5, hy - 5);
        },
        null,
        k.band,
        2.2
      );
      ellipse(g, -hr + 1, top + 2, 2.6, 2.4, k.band);
    }
  } else if (style === 'braid') {
    // Norah: pulled back with a side part, one long braid over her shoulder, a gold tie at the end.
    path(
      g,
      p => {
        p.moveTo(-hr - 0.5, hy + 3);
        p.bezierCurveTo(-hr - 2.5, top - 5.5, hr + 3, top - 5.5, hr + 1.5, hy + 1.5);
        p.bezierCurveTo(hr - 1.5, hy - 5, fx + 5, hy - 8.5, fx + 3.5, hy - 8);
        p.bezierCurveTo(-4, hy - 8, -9, hy - 3, -hr + 2, hy + 3.5);
        p.closePath();
      },
      fill
    );
    line(g, [[fx + 3.5, top - 0.5], [fx + 3.5, hy - 8]], k.hairDark, 0.9);
    const S = k.shoulder,
      at = u => [
        (1 - u) * (1 - u) * (hr + 1.5) + 2 * (1 - u) * u * (hr + 5) + u * u * (S - 1),
        (1 - u) * (1 - u) * (hy + 8) + 2 * (1 - u) * u * (hy + 17) + u * u * (hy + 31)
      ];
    for (let i = 0; i < 7; i++) {
      const [bx, by] = at(i / 6.5);
      ellipse(g, bx + (i % 2 ? 0.8 : -0.8), by, 2.9 - i * 0.12, 3.1, i % 2 ? k.hair : k.hairDark);
    }
    const [ex, ey] = at(1);
    rr(g, ex - 2, ey + 1, 4, 2.4, 1, k.band || k.hairDark);
    poly(g, [[ex - 2, ey + 3.2], [ex + 2, ey + 3.2], [ex + 0.8, ey + 7], [ex - 1, ey + 6.4]], k.hair);
  } else if (style === 'long') {
    // Taylor: long and straight with a side part, framing her face to the chin.
    path(
      g,
      p => {
        p.moveTo(-hr - 2, hy + 12);
        p.bezierCurveTo(-hr - 3.5, top - 6, hr + 3.5, top - 6, hr + 2, hy + 12);
        p.lineTo(hr - 1, hy + 12);
        p.quadraticCurveTo(hr - 0.5, hy - 4, fx + 5, hy - 8);
        p.quadraticCurveTo(fx - 2, hy - 5.5, -hr + 1.5, hy - 1);
        p.lineTo(-hr + 0.5, hy + 12);
        p.closePath();
      },
      fill
    );
    line(g, [[fx + 5, top - 0.5], [fx + 4.5, hy - 8]], k.hairDark, 0.9);
    path(
      g,
      p => {
        p.moveTo(-6, top + 0.5);
        p.quadraticCurveTo(0, top - 3.5, 6, top);
      },
      null,
      '#ffffff22',
      1.3
    );
  } else if (style === 'pigtails') {
    // Casey: a centre part and two braided pigtails over the shoulders, gold ties at the ends.
    path(
      g,
      p => {
        p.moveTo(-hr - 0.5, hy + 3);
        p.bezierCurveTo(-hr - 2.5, top - 5.5, hr + 3, top - 5.5, hr + 1.5, hy + 3);
        p.quadraticCurveTo(hr - 1, hy - 6, fx + 1, hy - 8.5);
        p.quadraticCurveTo(-5, hy - 6.5, -hr + 1.5, hy + 3.5);
        p.closePath();
      },
      fill
    );
    line(g, [[fx + 1, top - 0.5], [fx + 1, hy - 8.5]], k.hairDark, 0.9);
    const S = k.shoulder;
    for (const side of [-1, 1]) {
      const at = u => [
        (1 - u) * (1 - u) * side * (hr + 1) + 2 * (1 - u) * u * side * (hr + 4) + u * u * side * (S - 1.5) + fx * 0.5,
        (1 - u) * (1 - u) * (hy + 5) + 2 * (1 - u) * u * (hy + 15) + u * u * (hy + 27)
      ];
      for (let i = 0; i < 6; i++) {
        const [bx, by] = at(i / 5.5);
        ellipse(g, bx + (i % 2 ? 0.7 : -0.7), by, 2.7 - i * 0.12, 2.9, i % 2 ? k.hair : k.hairDark);
      }
      const [ex, ey] = at(1);
      rr(g, ex - 1.8, ey + 0.8, 3.6, 2.2, 1, k.band || k.hairDark);
      poly(g, [[ex - 1.8, ey + 2.8], [ex + 1.8, ey + 2.8], [ex + 0.7, ey + 6.2], [ex - 0.9, ey + 5.6]], k.hair);
    }
  } else if (style === 'slick') {
    // Dr. Benedetto: slicked straight back, a high shine, not one hair out of place.
    path(
      g,
      p => {
        p.moveTo(-hr - 0.4, hy + 1.5);
        p.bezierCurveTo(-hr - 1.8, top - 5, hr + 2.4, top - 5, hr + 1.2, hy + 0.5);
        p.quadraticCurveTo(hr - 1.5, hy - 6, fx + 3, hy - 7);
        p.quadraticCurveTo(-5, hy - 6.5, -hr + 1.4, hy + 2.5);
        p.closePath();
      },
      fill
    );
    for (const dy of [-1, 1.6])
      path(
        g,
        p => {
          p.moveTo(-6, top + 1 + dy);
          p.quadraticCurveTo(0, top - 2.5 + dy, 7, top + 0.5 + dy);
        },
        null,
        '#ffffff30',
        1.1
      );
  } else if (style === 'bob') {
    path(
      g,
      p => {
        p.moveTo(-hr - 2.4, hy + 7);
        p.bezierCurveTo(-hr - 3, top - 6, hr + 3, top - 6, hr + 2.2, hy + 6);
        p.lineTo(hr - 0.5, hy + 6);
        p.quadraticCurveTo(hr - 1, hy - 5, fx + 4, hy - 7.5);
        p.quadraticCurveTo(-4, hy - 5, -hr + 1, hy + 1);
        p.lineTo(-hr + 0.5, hy + 7);
        p.closePath();
      },
      fill
    );
  } else if (style === 'curly' || style === 'net') {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.0 + i * 0.125);
      ellipse(g, Math.cos(a) * (hr + 0.5) + 0.5, hy - 2 + Math.sin(a) * (hry + 0.5), 3.8, 3.6, i % 2 ? k.hair : k.hairDark);
    }
    path(
      g,
      p => {
        p.moveTo(-hr, hy + 1);
        p.bezierCurveTo(-hr - 1, top - 4, hr + 2, top - 4, hr + 1, hy);
        p.quadraticCurveTo(fx, hy - 9, -hr, hy + 1);
        p.closePath();
      },
      k.hair
    );
    if (style === 'net') {
      // Dietary regulation hairnet, worn with pride.
      ellipse(g, 0.5, hy - 5, hr + 4, hry - 2, '#ffffff38');
      for (let i = -2; i <= 2; i++) {
        line(g, [[i * 4.5 - 3, top - 2], [i * 4.5 + 3, hy - 1]], '#ffffff55', 0.6);
        line(g, [[i * 4.5 + 3, top - 2], [i * 4.5 - 3, hy - 1]], '#ffffff55', 0.6);
      }
      path(
        g,
        p => {
          p.moveTo(-hr - 1.5, hy - 1);
          p.quadraticCurveTo(fx, hy - 7.5, hr + 2.5, hy - 1.5);
        },
        null,
        '#ffffff99',
        1.2
      );
    }
  } else if (style === 'buzz') {
    path(
      g,
      p => {
        p.moveTo(-hr + 0.2, hy - 1);
        p.bezierCurveTo(-hr - 0.5, top - 3, hr + 1.5, top - 3, hr + 0.8, hy - 1.5);
        p.quadraticCurveTo(fx, hy - 6.5, -hr + 0.2, hy - 1);
        p.closePath();
      },
      k.hairDark
    );
  } else {
    path(
      g,
      p => {
        p.moveTo(-hr - 0.5, hy + 1.5);
        p.bezierCurveTo(-hr - 2, top - 5, hr + 2.5, top - 5, hr + 1.2, hy + 0.5);
        p.quadraticCurveTo(hr - 2, hy - 6.5, fx - 1, hy - 7);
        p.quadraticCurveTo(-6, hy - 6, -hr + 1.5, hy + 2.5);
        p.closePath();
      },
      fill
    );
    line(g, [[fx - 3, top - 1.5], [fx - 1, hy - 7]], k.hairDark, 0.8);
  }
}

// An Ensure bottle: origin at its base. flavor: 0 chocolate, 1 vanilla, 2 strawberry.
function hallwayBottle(g, x, y, flavor = 0, s = 1, ground = false) {
  const band = HALLWAY_FLAVORS[flavor % HALLWAY_FLAVORS.length];
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (ground) shadow(g, 0, 1, 8, 2.6);
  rr(g, -5, -17, 10, 17, 3, '#f4efe2', '#a59c8a', 0.7);
  rr(g, -5, -12, 10, 7, 1.5, band);
  rr(g, -3.4, -21, 6.8, 5, 1.6, npcShade(band, 0.8));
  line(g, [[-2.6, -15], [-2.6, -3]], '#ffffff88', 1);
  g.restore();
}

// ---- The corridor ----
// Painted once into the room cache: floor, wall, wayfinding, windows, doors, the elevator frame, signs.
function hallwayRoomBg(g) {
  const w = HALLWAY_W,
    h = HALLWAY_H;
  rect(g, 0, 0, w, h, gradient(g, 0, 145, 0, 480, '#c9dbc8', '#a3c6bb'));
  rect(g, 0, 0, w, 153, gradient(g, 0, 0, 0, 160, HALLWAY_ROOM.theme, '#c3d4be'));
  for (let x = 100; x < w; x += 200) line(g, [[x, 0], [x, 98]], '#9fb8ae26', 1);
  rect(g, 0, 104, w, 25, '#9fb8ae1f');
  rr(g, 0, 96, w, 6, 3, '#e3c99e', '#b69a72', 0.8);
  for (let x = 80; x < w; x += 160) rr(g, x - 2, 101, 4, 6, 1, '#b69a72');
  rr(g, 0, 129, w, 12, 2, '#edf1d8');
  rect(g, 0, 141, w, 12, '#527f8744');
  // The wall stripe says where we are, between the doors, about once a screen.
  for (const x of HALLWAY_STRIPE_X) {
    for (const side of [-1, 1]) line(g, [[x + side * 96, 135], [x + side * 112, 135]], '#7fb8aa', 2);
    label(g, HALLWAY_STRIPE, x, 138.5, 9, '#476c66', 'center');
  }
  for (let yy = 155; yy < h; yy += 58) line(g, [[0, yy], [w, yy]], '#487c7920', 1);
  for (let xx = 0; xx < w; xx += 80) line(g, [[xx, 155], [xx, h]], '#487c7920', 1);
  // Ceiling lights pool on the floor; daylight falls in from each window.
  for (let x = 160; x < w; x += 320) ellipse(g, x, 330, 150, 46, '#fff9dc14');
  for (const [wx, ww] of [
    [360, 150],
    [1240, 150],
    [2110, 150],
    [2720, 120]
  ])
    poly(
      g,
      [
        [wx, 155],
        [wx + ww, 155],
        [wx + ww + 150, 470],
        [wx + 110, 470]
      ],
      '#fff5be17'
    );
  // Wayfinding: a cream trunk line down the corridor, a coloured branch up to each door.
  rr(g, 40, 372, w - 80, 7, 3, '#f4ecd066');
  for (let x = 300; x < w - 200; x += 400)
    poly(
      g,
      [
        [x, 368],
        [x + 12, 375.5],
        [x, 383]
      ],
      '#f0c94a88'
    );
  for (const d of HALLWAY_DOORS) {
    const col = (rooms[d.room] && rooms[d.room].theme) || '#8fbfb0';
    rr(g, d.x - 3, 170, 6, 206, 3, col + '88');
    poly(
      g,
      [
        [d.x - 9, 180],
        [d.x + 9, 180],
        [d.x, 167]
      ],
      col + 'bb'
    );
  }
  rect(g, 0, 153, 19, h, '#376b7850');
  rect(g, w - 19, 153, 19, h, '#244c6550');
  rect(g, 0, h - 22, w, 22, gradient(g, 0, h - 22, 0, 22, '#67989b', '#2c586c'));
  // The wall, left to right.
  hallwayElevatorFrame(g, HALLWAY_ELEVATOR_X);
  windowArt(g, 360, 24, 150, 94);
  for (const d of HALLWAY_DOORS) hallwayDoorArt(g, d);
  hallwayClockArt(g, 810, 42);
  wallSign(g, 712, 196, 'NURSES’ STATION', 'PRESS THE BUTTON. OR YELL.');
  hallwayMagnetSign(g, 1152, 70);
  windowArt(g, 1240, 24, 150, 94);
  hallwayDailyPoster(g, 1664, 70);
  poster(g, 1782, WALL_SIGN_TOP + 2, 1, 0.78);
  hallwayXrayLamp(g, 1912, 72);
  windowArt(g, 2110, 24, 150, 94);
  poster(g, 2652, WALL_SIGN_TOP + 2, 0, 0.66);
  windowArt(g, 2720, 24, 120, 94);
  hallwayExitArt(g);
}

function hallwayElevatorFrame(g, x) {
  rr(g, x - 96, 20, 192, 136, 9, gradient(g, x - 96, 20, 192, 0, '#b9cccc', '#93acae'), '#6f8f96', 1.4);
  rr(g, x - 78, 36, 156, 120, 4, '#2f4952');
  rr(g, x - 30, 24, 60, 9, 3, '#203a44');
  poly(
    g,
    [
      [x - 18, 31],
      [x - 12, 26],
      [x - 6, 31]
    ],
    '#f6d36b'
  );
  poly(
    g,
    [
      [x + 6, 26],
      [x + 12, 31],
      [x + 18, 26]
    ],
    '#5d7b82'
  );
  rr(g, x + 104, 82, 16, 36, 5, '#cfd9d6', '#8fa2a4', 0.8);
  ellipse(g, x + 112, 93, 4, 4, '#f6d36b');
  ellipse(g, x + 112, 107, 4, 4, '#e6ecea');
  rr(g, x + 126, 70, 44, 42, 6, '#3f7887', '#e9f2ea', 1);
  label(g, HALLWAY_FLOOR, x + 148, 96, 22, '#f6f3df', 'center');
  label(g, 'FLOOR', x + 148, 107, 8, '#cfe6e3', 'center');
}

function hallwayDoorArt(g, d) {
  const x = d.x,
    col = (rooms[d.room] && rooms[d.room].theme) || '#8fbfb0',
    w = d.double ? 140 : 88,
    left = x - w / 2;
  rr(g, left - 7, 24, w + 14, 132, 7, '#e6e2cc', '#a9b9b0', 1);
  rr(g, left - 2, 29, w + 4, 127, 4, '#5f7f86');
  if (d.double) {
    for (const side of [0, 1]) {
      const dx = left + side * (w / 2 + 1),
        dw = w / 2 - 1;
      rr(g, dx, 30, dw, 125, 3, gradient(g, dx, 30, dw, 125, npcShade(col, 1.14), npcShade(col, 0.92)));
      ellipse(g, dx + dw / 2, 50, 11, 11, '#e6ecdf');
      ellipse(g, dx + dw / 2, 50, 8, 8, gradient(g, dx, 42, 0, 16, '#a9d6df', '#e7efd9'));
      rr(g, dx + (side ? 6 : dw - 12), 102, 6, 26, 3, '#c8d3d2', '#93a7a6', 0.6);
    }
  } else {
    rr(g, left, 30, w, 125, 3, gradient(g, left, 30, w, 125, npcShade(col, 1.14), npcShade(col, 0.9)));
    rr(g, x - 13, 38, 26, 26, 3, '#e9efe2');
    rr(g, x - 10, 41, 20, 20, 2, gradient(g, x, 41, 0, 20, '#9fd2dc', '#e4ecd4'));
    line(g, [[x - 6, 58], [x + 4, 44]], '#ffffff88', 1.4);
    rr(g, left + w - 20, 114, 13, 4, 2, '#d7dedb', '#7d8e90', 0.8);
    ellipse(g, left + w - 17, 116, 3, 3, '#aebdbd');
    // Hand sanitizer by every single door.
    rr(g, x + 56, 86, 12, 22, 3, '#eef3ea', '#9fb5b0', 0.8);
    rr(g, x + 59, 98, 6, 6, 2, '#7fc4a2');
  }
  rr(g, left + 4, 138, w - 8, 14, 2, '#b8c6c4', '#93a7a6', 0.7);
  const pw = Math.max(54, d.plate.length * 7.6 + 16);
  rr(g, x - pw / 2, 70, pw, 22, 5, '#f6f3df', '#476c66', 1.2);
  label(g, d.plate, x, 85.5, 11, '#355a58', 'center');
  if (d.room === 0) {
    // Macy's door: a taped-up drawing of a volleyball and a heart.
    g.save();
    g.translate(x - 30, 120);
    g.rotate(-0.08);
    rr(g, 0, 0, 22, 16, 1, '#fffaf0', '#c9bfa9', 0.6);
    ellipse(g, 7, 8, 4.5, 4.5, '#f0c94a');
    heart(g, 11, 4, 0.5, '#ef8f89');
    rect(g, 7, -2, 8, 3, '#f6e7b866');
    g.restore();
  }
  if (d.room === 1) {
    for (let i = 0; i < 8; i++)
      poly(
        g,
        [
          [left + 4 + i * 10, 130],
          [left + 9 + i * 10, 130],
          [left + 6 + i * 10, 136],
          [left + 1 + i * 10, 136]
        ],
        i % 2 ? '#3f3a37' : '#f3d34a'
      );
  }
}

function hallwayClockArt(g, x, y) {
  ellipse(g, x, y, 17, 17, '#476c66');
  ellipse(g, x, y, 14.5, 14.5, '#fbf8ec');
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    line(g, [[x + Math.cos(a) * 11, y + Math.sin(a) * 11], [x + Math.cos(a) * 13, y + Math.sin(a) * 13]], '#476c66', 1.2);
  }
  line(g, [[x, y], [x + 6, y - 5]], '#2f4952', 2);
  line(g, [[x, y], [x - 1, y - 10]], '#2f4952', 1.4);
}

function hallwayMagnetSign(g, x, y) {
  rr(g, x, y, 44, 50, 5, '#f6e7b8', '#3f3a37', 1.2);
  poly(
    g,
    [
      [x + 22, y + 5],
      [x + 38, y + 32],
      [x + 6, y + 32]
    ],
    '#f3d34a'
  );
  path(g, p => p.arc(x + 22, y + 23, 5.5, Math.PI, 0), null, '#d9534f', 3.2);
  line(g, [[x + 16.5, y + 23], [x + 16.5, y + 28]], '#b9c4c8', 3.2);
  line(g, [[x + 27.5, y + 23], [x + 27.5, y + 28]], '#b9c4c8', 3.2);
  label(g, 'MAGNET ON', x + 22, y + 44, 7, '#3f3a37', 'center');
}

function hallwayDailyPoster(g, x, y) {
  rr(g, x - 4, y - 4, 92, 86, 6, '#507d7a');
  rr(g, x, y, 84, 78, 4, gradient(g, x, y, 0, 78, '#fff3cf', '#f6dca9'));
  label(g, 'DAILY DOSE', x + 42, y + 16, 11, '#b2504f', 'center');
  g.save();
  g.translate(x + 42, y + 37);
  g.rotate(-0.45);
  rr(g, -16, -7, 32, 14, 7, '#f6f3e6', '#c9b79a', 0.8);
  rr(g, -16, -7, 16, 14, 7, '#ef8f89');
  rect(g, -8, -7, 8, 14, '#ef8f89');
  g.restore();
  spark(g, x + 66, y + 30, '#f0c94a', 0.45);
  label(g, 'ONE GAME A DAY', x + 42, y + 60, 7.5, '#4d7468', 'center');
  label(g, 'SAME FOR EVERYONE', x + 42, y + 70, 6.5, '#6d8b7a', 'center');
}

function hallwayXrayLamp(g, x, y) {
  glow(g, x + 20, y + 10, 30, '#f6d36b33');
  rr(g, x, y, 40, 20, 5, '#3f3a37');
  rr(g, x + 3, y + 3, 34, 14, 3, '#f6d36b');
  label(g, 'X-RAY', x + 20, y + 14, 8, '#7a4b1f', 'center');
}

function hallwayExitArt(g) {
  const x = 3025,
    w = 150;
  wallSign(g, 2884, 128, 'DISCHARGE', 'THE WAY OUT');
  rr(g, x - 6, 22, w + 12, 134, 8, '#5d8f84', '#3e6d66', 1.5);
  rr(g, x, 28, w, 127, 3, gradient(g, 0, 28, 0, 127, '#8fd0e6', '#f4ecc8'));
  glow(g, x + 112, 52, 40, '#fff1c099');
  ellipse(g, x + 112, 52, 12, 12, '#fff1c0');
  ellipse(g, x + 34, 140, 44, 22, '#7fb88e');
  ellipse(g, x + 118, 146, 52, 20, '#6aa77c');
  line(g, [[x + 46, 140], [x + 46, 112]], '#7a5a44', 4);
  ellipse(g, x + 46, 104, 16, 14, '#5f9f73');
  rect(g, x, 146, w, 9, '#b9b4a6');
  for (let i = 0; i < 4; i++) rect(g, x + 10 + i * 38, 150, 18, 2, '#f6f3df');
  line(g, [[x + w / 2, 28], [x + w / 2, 155]], '#3e6d66', 4);
  rr(g, x + 2, 30, w / 2 - 4, 123, 2, null, '#e9f2ea88', 1.5);
  rr(g, x + w / 2 + 2, 30, w / 2 - 4, 123, 2, null, '#e9f2ea88', 1.5);
  rr(g, x + 10, 106, w / 2 - 20, 6, 3, '#d7dedb', '#7d8e90', 0.8);
  rr(g, x + w / 2 + 10, 106, w / 2 - 20, 6, 3, '#d7dedb', '#7d8e90', 0.8);
  poly(
    g,
    [
      [x + 12, 30],
      [x + 30, 30],
      [x + 10, 152],
      [x + 3, 152]
    ],
    '#ffffff22'
  );
  rr(g, x + w / 2 - 26, 72, 52, 20, 4, '#2f8f5b', '#e9f6dc', 1.2);
  label(g, 'EXIT', x + w / 2, 87, 13, '#f2ffe8', 'center');
  rr(g, x + 12, 160, w - 24, 16, 5, '#7a6a5a');
  label(g, 'GO HOME', x + w / 2, 172, 9, '#e8dcc0', 'center');
}

// ---- Furniture ----
function hallwayStation(g) {
  const x = 690,
    w = 240;
  shadow(g, x + w / 2, 233, w * 0.55, 10);
  rr(g, x, 160, w, 70, 8, gradient(g, 0, 160, 0, 70, '#e7d2b2', '#c4a483'), '#a98a6e', 1);
  rr(g, x - 4, 150, w + 8, 14, 6, gradient(g, 0, 150, 0, 14, '#f6e7c9', '#dcc4a2'), '#b89a7e', 1);
  rr(g, x + 8, 176, w - 16, 9, 4, '#7fb8aa');
  rr(g, x + 4, 222, w - 8, 8, 3, '#9a7f68');
  heart(g, x + w / 2 - 7, 194, 1.1, '#ef9f9a');
  // A small brass plaque: where this counter, and Macy, actually are.
  rr(g, x + 142, 191, 86, 23, 3, gradient(g, 0, 191, 0, 23, '#f1e3b4', '#d8c08a'), '#9a7f58', 1);
  label(g, 'VALLEY HOSPITAL', x + 185, 202, 7.5, '#5b4a2e', 'center');
  label(g, 'PARAMUS · 7TH FLOOR', x + 185, 210.5, 5.5, '#7a6544', 'center');
  rr(g, x + 47, 147, 10, 6, 2, '#678d98');
  rr(g, x + 28, 120, 48, 30, 5, gradient(g, 0, 120, 0, 30, '#82a6ac', '#4a7284'), '#c3d5cf', 1.2);
  rr(g, x + 32, 124, 40, 21, 3, '#153b50');
  line(g, [[x + 35, 135], [x + 44, 135], [x + 47, 130], [x + 51, 140], [x + 55, 132], [x + 58, 135], [x + 69, 135]], '#b5e7be', 1.4);
  rr(g, x + 100, 142, 34, 6, 2, '#7fb8aa');
  rr(g, x + 102, 136, 32, 6, 2, '#f0c94a');
  rr(g, x + 99, 130, 34, 6, 2, '#e58c9b');
  ellipse(g, x + 160, 138, 11, 13, '#e9f4f2aa');
  for (let i = 0; i < 6; i++) ellipse(g, x + 154 + (i % 3) * 6, 134 + Math.floor(i / 3) * 7, 2.4, 2.4, ['#ef8f89', '#f0c94a', '#7fc4a2'][i % 3]);
  rr(g, x + 152, 122, 16, 5, 2, '#476c66');
  rr(g, x + 186, 136, 12, 15, 3, '#f6f3e6', '#9fb5b0', 0.8);
  path(g, p => p.arc(x + 199, 143, 3.5, -1.2, 1.2), null, '#9fb5b0', 1.4);
  ellipse(g, x + 216, 148, 8, 6, '#e8c35a');
  rr(g, x + 207, 148, 18, 4, 2, '#8a7a62');
}

function hallwayGurney(g, x, blue) {
  shadow(g, x + 69, 212, 72, 8);
  for (const lx of [x + 16, x + 122]) {
    line(g, [[lx, 182], [lx, 203]], '#9fb2b6', 4);
    ellipse(g, lx, 206, 5, 5, '#3c596e');
    ellipse(g, lx, 206, 2, 2, '#a7c5c9');
  }
  line(g, [[x + 10, 194], [x + 128, 194]], '#b8c8ca', 3);
  rr(g, x + 2, 176, 134, 8, 4, '#cfdcdc', '#8fa2a4', 0.8);
  rr(g, x + 4, 160, 130, 18, 7, gradient(g, 0, 160, 0, 18, '#f7f9f2', '#d7e3df'), '#a9bcbc', 0.8);
  rr(g, x + 40, 157, 92, 12, 5, blue ? '#9cc7d8' : '#a9d6c2');
  rr(g, x + 8, 152, 28, 13, 6, '#ffffff', '#c7d4d2', 0.8);
  line(g, [[x + 134, 178], [x + 142, 150], [x + 147, 150]], '#9fb2b6', 3);
}

function hallwayVending(g, x) {
  const top = 74,
    w = 100,
    bottom = 214;
  shadow(g, x + w / 2, bottom + 2, 58, 8);
  glow(g, x + w / 2, 130, 90, '#fff3c21c');
  rr(g, x, top, w, bottom - top, 9, gradient(g, x, top, w, 0, '#5c9caa', '#3f7887'), '#2f5d6b', 1.5);
  rr(g, x + 7, top + 6, w - 14, 22, 6, '#f6e7b8');
  label(g, 'GIFT SHOP', x + w / 2, top + 22, 12, '#3f5f5a', 'center');
  rr(g, x + 7, top + 34, 64, 90, 5, '#1d4352', '#9fd3dc', 1);
  // Past five no's two slots are Ensure; past twenty, every slot is.
  const ensureSlots = hallwayCultAt(HALLWAY_CULT.nurses) ? 12 : hallwayCultAt(HALLWAY_CULT.rows) ? 2 : 0;
  for (let r = 0; r < 4; r++) {
    const yy = top + 55 + r * 21;
    line(g, [[x + 10, yy + 2], [x + 68, yy + 2]], '#9fd3dc66', 1.5);
    for (let i = 0; i < 3; i++) {
      const xx = x + 19 + i * 20,
        slot = r * 3 + i;
      if (ensureSlots === 12 || (ensureSlots && (slot === 7 || slot === 11))) hallwayBottle(g, xx, yy + 1, slot % 3, 0.62, false);
      else if (r === 0) gremlin(g, xx, yy, 0.24, i, i * 1.3);
      else if (r === 1) heart(g, xx - 7, yy - 13, 0.9, ['#ef8f89', '#f0c94a', '#c9b0ec'][i]);
      else if (r === 2) {
        rr(g, xx - 6, yy - 14, 12, 15, 2, ['#e9b44c', '#7fc4a2', '#e58c4f'][i]);
        rr(g, xx - 6, yy - 9, 12, 4, 1, '#ffffff55');
      } else {
        rr(g, xx - 4, yy - 15, 6, 12, 2, ['#f6f3e6', '#ef9fb0', '#a9c4f0'][i]);
        rr(g, xx - 4, yy - 5, 10, 5, 2, ['#f6f3e6', '#ef9fb0', '#a9c4f0'][i]);
        line(g, [[xx - 4, yy - 12], [xx + 2, yy - 12]], '#de5b66', 1.2);
      }
    }
  }
  rr(g, x + 77, top + 36, 16, 44, 4, '#cfdcd6');
  for (let i = 0; i < 9; i++) ellipse(g, x + 81 + (i % 3) * 4, top + 44 + Math.floor(i / 3) * 6, 1.2, 1.2, '#476c66');
  rr(g, x + 81, top + 86, 8, 12, 2, '#2f5d6b');
  rr(g, x + 9, top + 127, 60, 10, 3, '#163542');
  rr(g, x + 6, bottom - 4, 10, 6, 2, '#2f4952');
  rr(g, x + w - 16, bottom - 4, 10, 6, 2, '#2f4952');
}

function hallwayChairs(g, x) {
  shadow(g, x + 75, 212, 80, 8);
  line(g, [[x + 6, 196], [x + 144, 196]], '#8fa2a4', 3);
  for (let i = 0; i < 3; i++) {
    const cx = x + 8 + i * 48;
    line(g, [[cx + 6, 196], [cx + 4, 210]], '#7d8e90', 3);
    line(g, [[cx + 34, 196], [cx + 36, 210]], '#7d8e90', 3);
    rr(g, cx, 150, 40, 30, 8, i === 1 ? '#e8a07f' : '#7fb8aa');
    rr(g, cx - 1, 176, 42, 14, 6, i === 1 ? '#d98f6f' : '#6aa597');
  }
  // A teddy bear someone left on the end chair, and a balloon tied to the middle one.
  ellipse(g, x + 28, 168, 9, 10, '#b98a5e');
  ellipse(g, x + 28, 152, 7.5, 7, '#c99a6e');
  ellipse(g, x + 22, 146, 3, 3, '#b98a5e');
  ellipse(g, x + 34, 146, 3, 3, '#b98a5e');
  ellipse(g, x + 28, 154, 2.6, 2, '#e8cfa8');
  ellipse(g, x + 26, 151, 0.9, 0.9, '#2a2427');
  ellipse(g, x + 30.5, 151, 0.9, 0.9, '#2a2427');
  line(g, [[x + 74, 178], [x + 70, 140], [x + 78, 108]], '#7d8e90', 1);
  ellipse(g, x + 78, 88, 21, 22, '#f0c94a');
  ellipse(g, x + 71, 80, 5, 7, '#fff3c288');
  poly(
    g,
    [
      [x + 75, 110],
      [x + 81, 110],
      [x + 78, 106]
    ],
    '#d9a62a'
  );
  label(g, 'GET', x + 78, 86, 8, '#7a5a1f', 'center');
  label(g, 'WELL', x + 78, 96, 8, '#7a5a1f', 'center');
}

function hallwayWheelchair(g, x, y) {
  shadow(g, x, y + 2, 26, 6);
  path(g, p => p.arc(x - 4, y - 14, 15, 0, Math.PI * 2), null, '#4f6872', 3);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    line(g, [[x - 4 - Math.cos(a) * 13, y - 14 - Math.sin(a) * 13], [x - 4 + Math.cos(a) * 13, y - 14 + Math.sin(a) * 13]], '#9fb2b6', 1);
  }
  rr(g, x - 13, y - 31, 28, 6, 3, '#3f6f88');
  rr(g, x - 15, y - 54, 6, 27, 3, '#3f6f88');
  line(g, [[x - 13, y - 54], [x - 21, y - 56]], '#4f6872', 3);
  line(g, [[x + 13, y - 27], [x + 18, y - 7], [x + 24, y - 7]], '#4f6872', 2.5);
  ellipse(g, x + 18, y - 2, 3.5, 3.5, '#3c596e');
}

function hallwayWetFloor(g, x, y) {
  shadow(g, x, y + 1, 16, 4);
  poly(
    g,
    [
      [x - 11, y],
      [x - 4, y - 38],
      [x + 4, y - 38],
      [x + 11, y]
    ],
    '#f3d34a'
  );
  line(g, [[x - 4, y - 38], [x + 4, y - 38]], '#c9a62a', 2);
  poly(
    g,
    [
      [x, y - 33],
      [x - 5, y - 24],
      [x + 5, y - 24]
    ],
    '#3f3a37'
  );
  label(g, 'GOOD', x, y - 12, 6.5, '#3f3a37', 'center');
  label(g, 'VIBES', x, y - 5, 6.5, '#3f3a37', 'center');
}

// Furniture: draw order follows y, and box is the collision rectangle, as in roomProps.
const HALLWAY_PROPS = [
  { y: 236, box: [690, 172, 240, 58], draw: g => hallwayStation(g) },
  { y: 214, box: [1180, 180, 138, 30], draw: g => hallwayGurney(g, 1180, false) },
  { y: 214, box: [2120, 180, 138, 30], draw: g => hallwayGurney(g, 2120, true) },
  { y: 216, box: [2520, 172, 100, 42], draw: g => hallwayVending(g, 2520) },
  { y: 212, box: [2690, 178, 150, 30], draw: g => hallwayChairs(g, 2690) },
  { y: 214, box: [1876, 186, 46, 26], draw: g => hallwayWheelchair(g, 1898, 210) },
  { y: 212, box: [287, 194, 30, 16], draw: g => plant(g, 302, 210, 0.95) },
  { y: 212, box: [1435, 194, 30, 16], draw: g => plant(g, 1450, 210, 0.95) },
  { y: 212, box: [2857, 194, 30, 16], draw: g => plant(g, 2872, 210, 0.95) },
  { y: 484, box: [1330, 470, 26, 12], draw: g => hallwayWetFloor(g, 1343, 484) }
];

// ---- Drawing the live hallway ----
function hallwayDoorChip(d) {
  if (d.room === 0) return hallwayRalphWaiting() ? ['RALPH INSIDE', '#d9534f'] : ['HOME BASE', '#4f9c7a'];
  return (state.wardClears[d.room] || 0) > 0 ? ['CLEARED', '#4f9c7a'] : ['GREMLINS', '#c9604f'];
}

// The live parts of the wall: elevator doors, door status chips, the glow on the door Macy is at.
function hallwayDrawWall(g) {
  const x = HALLWAY_ELEVATOR_X,
    half = 78,
    gap = hallwayElevator.open * (half - 3);
  rr(g, x - half, 36, half * 2, 120, 4, gradient(g, 0, 36, 0, 120, '#6a8d96', '#33505a'));
  ellipse(g, x, 42, 50, 5, '#fff3c866');
  rr(g, x - half + 10, 118, half * 2 - 20, 4, 2, '#8fb0b4');
  if (half - gap > 0.5) {
    rr(g, x - half, 36, half - gap, 120, 2, gradient(g, x - half, 0, half, 0, '#d3e0e0', '#a3babd'), '#7d989e', 1);
    rr(g, x + gap, 36, half - gap, 120, 2, gradient(g, x, 0, half, 0, '#a3babd', '#d3e0e0'), '#7d989e', 1);
  }
  for (const d of HALLWAY_DOORS) {
    const [text, col] = hallwayDoorChip(d),
      cw = text.length * 6.2 + 14;
    rr(g, d.x - cw / 2, 96, cw, 15, 7, col, '#ffffff66', 1);
    label(g, text, d.x, 107, 8.5, '#fffaf0', 'center');
  }
  const tg = hallwayTarget;
  if (tg && tg.kind === 'door') {
    const d = tg.door,
      w = d.double ? 140 : 88,
      pulse = 0.5 + Math.sin(hallwayClock * 5) * 0.5;
    ellipse(g, d.x, 172, w * 0.62, 11, '#fff3c255');
    rr(g, d.x - w / 2 - 8, 23, w + 16, 134, 8, null, `rgba(255,241,194,${0.45 + pulse * 0.45})`, 2.5);
  }
  hallwayEmployeeArt(g, HALLWAY_EOTM[0], HALLWAY_EOTM[1]);
  if (hallwayCultAt(HALLWAY_CULT.pa)) hallwayStockedSticker(g, 886, 116);
}

// Employee of the Month, framed on the wall past the nurses' station (below WALL_SIGN_TOP, so the HUD
// cards never cover it). The machine and its portrait come from the room's file (machineOfTheMonth,
// drawMachineIcon(g, id, cx, cy, size)); without them the frame says voting is open.
const HALLWAY_EOTM = [924, 70];

function hallwayEmployeeArt(g, x, y) {
  const w = 66,
    h = 62,
    m = hallwayMachine(),
    cx = x + w / 2,
    cy = y + 35;
  shadow(g, cx, y + h + 3, w * 0.42, 3);
  rr(g, x, y, w, h, 4, gradient(g, x, y, 0, h, '#b98a5e', '#8a5f3c'), '#6b4426', 1.2);
  rr(g, x + 4, y + 4, w - 8, h - 8, 2, '#fbf6e6');
  label(g, 'EMPLOYEE', cx, y + 13, 7, '#8a3c27', 'center');
  label(g, 'OF THE MONTH', cx, y + 20, 5.2, '#8a5f3c', 'center');
  rr(g, cx - 14, cy - 11, 28, 22, 3, '#e3eef0', '#b9c8ca', 0.6);
  let drew = false;
  if (m && typeof drawMachineIcon === 'function') {
    g.save();
    try {
      // The room's portraits are about 48 units square at scale 1; this box is about 22.
      drawMachineIcon(g, m.id, cx, cy, 0.42);
      drew = true;
    } catch {
      drew = false;
    }
    g.restore();
  }
  if (!drew) label(g, '?', cx, cy + 5.5, 15, '#9fb2b6', 'center');
  // "BRRR 3000, the MRI" is a lot of name for a small frame: past eighteen letters, the part before the comma.
  let name = m ? m.name.toUpperCase() : 'VOTING OPEN';
  if (name.length > 18 && name.includes(',')) name = name.split(',')[0];
  label(g, name.length > 18 ? name.slice(0, 17) + '.' : name, cx, y + h - 8, 5.4, '#3f3a37', 'center');
  // A gold star sticker in the corner, slightly crooked, because the nurses made it.
  spark(g, x + w - 8, y + 8, '#f0c94a', 0.45);
}

// Past thirty no's, the nurses' station sign gets a sticker. Nobody admits to putting it there.
function hallwayStockedSticker(g, x, y) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.12);
  rr(g, -30, -7, 60, 14, 7, '#fbe3ea', '#d97f95', 0.9);
  hallwayBottle(g, -22, 5, 2, 0.42, false);
  label(g, 'PROUDLY STOCKED', 5, 2.4, 6, '#a3485f', 'center');
  g.restore();
}

// Past ten no's, a crate of Ensure waits by the elevator. Nobody ordered it.
function hallwayCrateArt(g, x, y) {
  shadow(g, x, y + 2, 34, 6);
  rr(g, x - 30, y - 30, 60, 30, 3, gradient(g, 0, y - 30, 0, 30, '#c89c66', '#a77a48'), '#7a5530', 1);
  for (const yy of [y - 20, y - 10]) line(g, [[x - 29, yy], [x + 29, yy]], '#8a6038', 0.9);
  line(g, [[x - 30, y - 30], [x + 30, y]], '#8a603888', 1.2);
  rr(g, x - 20, y - 22, 40, 11, 2, '#f6efdc');
  label(g, 'ENSURE', x, y - 13.6, 8, '#a3485f', 'center');
  for (let i = 0; i < 5; i++) {
    rr(g, x - 24 + i * 11, y - 36, 7, 6, 2, npcShade(HALLWAY_FLAVORS[i % 3], 0.8));
    rr(g, x - 25 + i * 11, y - 31, 9, 2, 1, '#f4efe2');
  }
}

// Rowdy's Ensure cheer: bottles where the pom-poms go. His skeleton comes from rowdy.js's rowdyPose,
// so the bottles ride his hands through the same transforms drawRowdy uses.
function hallwayRowdyBottles(g, npc) {
  if (typeof rowdyPose !== 'function') return;
  const P = rowdyPose('cheer', hallwayClock, {}),
    s = npc.scale || npc.spec.scale || 1,
    fx = (npc.face < 0 ? -1 : 1) * Math.max(0.14, Math.abs(Number.isFinite(P.spin) ? P.spin : 1)),
    pv = -27 + (P.dip || 0),
    c = Math.cos(P.lean || 0),
    sn = Math.sin(P.lean || 0);
  for (const arm of P.arms) {
    if (arm.kind !== 'pom') continue;
    const ang = Math.atan2(arm.h[1] - arm.e[1], arm.h[0] - arm.e[0]),
      px = arm.h[0] + Math.cos(ang) * 2.4,
      py = arm.h[1] + Math.sin(ang) * 2.4 - pv,
      lx = px * c - py * sn,
      ly = px * sn + py * c + pv;
    g.save();
    g.translate(npc.x + lx * fx * s, npc.y + (ly - (P.lift || 0)) * s);
    g.scale(s, s);
    g.rotate(arm.s * 0.25);
    hallwayBottle(g, 0, 11, arm.s > 0 ? 2 : 0, 1.3, false);
    g.restore();
  }
}

function hallwayDrawNpc(g, npc) {
  if (npc.rowdy) {
    npc.spec.draw(g, npc, hallwayClock);
    if (npc.ensurePoms && npc.pose === 'cheer') hallwayRowdyBottles(g, npc);
    return;
  }
  const tk = hallwayTalk,
    line = tk ? tk.lines[tk.i] : null,
    speak = (line && hallwaySpeaker(tk, line) === npc && tk.shown < line.text.length) || (npc.bark && npc.bark.life > npc.bark.max - 0.45),
    hop = npc.whoa > 0 ? Math.sin((npc.whoa / 0.45) * Math.PI) * 9 : 0;
  npcFigure(g, npc.x, npc.y, hallwayNpcScale(), npc.look, npc.moving ? npc.walk : 0, npc.vdir, hallwayClock, { hop, speak });
}

function roomExtraRenderables(all = false) {
  if (!hallwayHere()) return [];
  const vw = typeof viewport === 'object' && viewport ? viewport.w : 1000,
    mid = cameraX + vw / 2,
    seen = x => all || Math.abs(x - mid) < vw / 2 + 160,
    list = [{ y: 150, draw: hallwayDrawWall }];
  if (hallwayCultAt(HALLWAY_CULT.crate) && seen(HALLWAY_CRATE[0]))
    list.push({ y: HALLWAY_CRATE[1], draw: g => hallwayCrateArt(g, HALLWAY_CRATE[0], HALLWAY_CRATE[1]) });
  for (const b of hallwayBottles)
    if (seen(b.x)) list.push({ y: b.y, draw: g => hallwayBottle(g, b.x, b.y, b.flavor, b.row ? 1.1 : 1.3, true) });
  for (const npc of hallwayCast) if (npc.present && seen(npc.x)) list.push({ y: npc.y, draw: g => hallwayDrawNpc(g, npc) });
  return list;
}

// ---- Screen-space overlay: barks, prompts, the speech box ----
const hallwayFont = size => `700 ${size}px "Trebuchet MS", Arial, sans-serif`;

function hallwayTextW(g, text, size) {
  g.font = hallwayFont(size);
  const m = typeof g.measureText === 'function' ? g.measureText(text) : null;
  return m && Number.isFinite(m.width) ? m.width : text.length * size * 0.56;
}

function hallwayWrap(g, text, width, size) {
  const rows = [];
  let row = '';
  for (const word of text.split(' ')) {
    const next = row ? row + ' ' + word : word;
    if (row && hallwayTextW(g, next, size) > width) {
      rows.push(row);
      row = word;
    } else row = next;
  }
  if (row) rows.push(row);
  return rows;
}

// How many CSS pixels one canvas unit takes, so text stays readable on a phone-sized canvas.
function hallwayCssScale(vw) {
  let css = 1;
  try {
    const r = canvas.getBoundingClientRect();
    if (r && r.width > 0) css = r.width / Math.max(1, vw);
  } catch {
    css = 1;
  }
  return clamp(css, 0.3, 2);
}

function hallwayPromptInfo(tg) {
  const key = typeof wardCoarsePointer !== 'undefined' && wardCoarsePointer ? 'TAP' : 'SPACE';
  if (tg.kind === 'talk')
    return { x: tg.npc.x, y: tg.npc.y - hallwayNpcTop(tg.npc) - 10, text: key + ' · TALK' };
  if (tg.kind === 'door') return { x: tg.door.x, y: 66, text: key + ' · ENTER ' + tg.door.name.toUpperCase() };
  if (tg.kind === 'shop') return { x: HALLWAY_SHOP_X, y: 66, text: key + ' · GIFT SHOP' };
  return { x: HALLWAY_EXIT_X, y: 66, text: key + (state.won ? ' · GO HOME' : ' · DISCHARGE?') };
}

// The prompt pill in world coordinates (the overlay subtracts the camera; taps hit-test this).
function hallwayPromptRect(info) {
  const fs = hallwayUi.prompt,
    h = fs + 12,
    w = info.text.length * fs * 0.6 + 24;
  return { x: info.x - w / 2, y: info.y - h, w, h, fs };
}

// The prompt pill in screen space this frame.
function hallwayPromptBox(tg, vw) {
  const info = hallwayPromptInfo(tg),
    r = hallwayPromptRect(info),
    bob = Math.sin(hallwayClock * 4) * 2,
    sx = clamp(r.x - cameraX, 6, vw - r.w - 6),
    sy = Math.max(6, r.y - wardCameraY + bob);
  return { info, r, sx, sy, x: sx, y: sy, w: r.w, h: r.h, tip: clamp(info.x - cameraX, sx + 10, sx + r.w - 10) };
}

function hallwayDrawPrompt(g, tg, vw) {
  const { info, r, sx, sy, tip } = hallwayPromptBox(tg, vw);
  rr(g, sx + 2, sy + 3, r.w, r.h, r.h / 2, '#0b1d2655');
  rr(g, sx, sy, r.w, r.h, r.h / 2, '#244d53f0', '#b9ebbb', 1.6);
  poly(
    g,
    [
      [tip - 6, sy + r.h - 1],
      [tip + 6, sy + r.h - 1],
      [tip, sy + r.h + 7]
    ],
    '#244d53f0'
  );
  label(g, info.text, sx + r.w / 2, sy + r.h / 2 + r.fs * 0.36, r.fs, '#fff1c2', 'center');
}

// avoid: the TALK prompt's screen box; a bark that would sit on it steps up above it.
function hallwayDrawBark(g, npc, vw, fs, avoid = null) {
  const b = npc.bark,
    alpha = clamp(Math.min(b.life * 3, (b.max - b.life) * 8), 0, 1),
    w = hallwayTextW(g, b.text, fs) + 22,
    h = fs + 12,
    ax = npc.x - cameraX,
    ay = npc.y - hallwayNpcTop(npc) - wardCameraY - 12,
    x = clamp(ax - w / 2, 6, vw - w - 6);
  let y = Math.max(6, ay - h);
  if (avoid && x < avoid.x + avoid.w + 6 && x + w > avoid.x - 6 && y < avoid.y + avoid.h + 10 && y + h + 8 > avoid.y)
    y = Math.max(6, avoid.y - h - 12);
  if (ax < -60 || ax > vw + 60) return;
  g.save();
  g.globalAlpha = alpha;
  rr(g, x, y, w, h, h / 2, '#fffaf0', '#244d53', 1.6);
  poly(
    g,
    [
      [clamp(ax, x + 12, x + w - 12) - 6, y + h - 1],
      [clamp(ax, x + 12, x + w - 12) + 6, y + h - 1],
      [clamp(ax, x + 12, x + w - 12), y + h + 7]
    ],
    '#fffaf0'
  );
  label(g, b.text, x + w / 2, y + h / 2 + fs * 0.36, fs, '#244656', 'center');
  g.restore();
}

// Head and shoulders in a rounded frame: the speaker, or Macy when she answers.
function hallwayPortrait(g, x, y, w, h, npc, speak) {
  g.save();
  rr(g, x, y, w, h, 12, npc ? npc.tag : '#f6c9d3', '#0f2733', 2);
  g.beginPath();
  g.roundRect(x + 2, y + 2, w - 4, h - 4, 10);
  g.clip();
  glow(g, x + w * 0.5, y + h * 0.4, w * 0.7, '#ffffff55');
  if (npc && npc.rowdy) npc.spec.portrait(g, x + w * 0.5, y + h * 0.5, w * 0.8, hallwayClock);
  else if (npc) {
    const k = npc.look,
      s = h / 50;
    npcFigure(g, x + w * 0.5, y + h * 0.44 - npcHeadY(k) * s, s, k, 0, 1, hallwayClock, { shadow: false, speak });
  } else {
    const s = h / 48;
    girl(g, x + w * 0.5, y + h * 0.46 + 65 * s, s, 0, 1, false, false);
  }
  g.restore();
}

function hallwaySpeechBox(g, vw, vh, css) {
  const tk = hallwayTalk,
    line = tk.lines[tk.i],
    who = hallwaySpeaker(tk, line),
    macy = !who,
    size = clamp(Math.round(14 / css), 17, 30),
    lh = Math.round(size * 1.32),
    pad = 12,
    face = clamp(Math.round(size * 5.4), 92, 150),
    x = pad,
    w = vw - pad * 2,
    tx = x + face + 30,
    tw = w - face - 52,
    rows = hallwayWrap(g, line.text, tw, size),
    h = Math.max(face + 24, rows.length * lh + 44),
    y = vh - h - pad,
    done = tk.shown >= line.text.length,
    name = macy ? hallwayName() : who.name,
    tagSize = Math.round(size * 0.78),
    tagH = tagSize + 12,
    tagY = y - tagSize * 0.75,
    tagW = hallwayTextW(g, name, tagSize) + 26;
  g.save();
  g.globalAlpha = clamp(tk.age * 7, 0, 1);
  rr(g, x + 3, y + 5, w, h, 18, '#0b1d2666');
  rr(g, x, y, w, h, 18, gradient(g, x, y, 0, h, '#21495a', '#163444'), '#9fd3bd', 2);
  rr(g, x + 18, y + 4, w - 36, 1.4, 1, '#daf0d32e');
  hallwayPortrait(g, x + 12, y + 12, face, face, who, !macy && !done);
  rr(g, tx - 6, tagY, tagW, tagH, tagH / 2, macy ? '#f1abbd' : who.tag, '#163444', 2);
  label(g, name, tx + 7, tagY + tagH / 2 + tagSize * 0.36, tagSize, '#1d3440');
  let left = tk.shown;
  rows.forEach((row, i) => {
    if (left <= 0) return;
    label(g, row.slice(0, left), tx, y + 24 + size + i * lh, size, '#f4f1dc');
    left -= row.length + 1;
  });
  const coarse = typeof wardCoarsePointer !== 'undefined' && wardCoarsePointer,
    last = tk.i >= tk.lines.length - 1,
    hint = (coarse ? 'TAP' : 'SPACE') + (last ? ' · DONE' : ' · NEXT') + (coarse ? '' : ' · ESC'),
    hs = Math.round(size * 0.62);
  if (done) {
    const blink = 0.55 + Math.sin(hallwayClock * 6) * 0.45;
    g.globalAlpha = blink;
    poly(
      g,
      [
        [x + w - 34, y + 15],
        [x + w - 20, y + 15],
        [x + w - 27, y + 24]
      ],
      '#ffe29b'
    );
    g.globalAlpha = 1;
  }
  const count = tk.lines.length > 1 ? `${tk.i + 1}/${tk.lines.length} · ` : '';
  label(g, count + hint, x + w - 42, y + 23, hs, '#9fc4bd', 'right');
  g.restore();
}

function drawRoomOverlay(g, vw = 1000, vh = 625) {
  // The ward strip pill sits where the speech box goes on phones; hide it while anyone is talking.
  if (typeof document !== 'undefined' && document.body && document.body.classList) document.body.classList.toggle('talking', !!hallwayTalk);
  if (!hallwayHere()) return;
  const css = hallwayCssScale(vw);
  hallwayUi.css = css;
  hallwayUi.prompt = clamp(Math.round(12 / css), 13, 26);
  const barkSize = clamp(Math.round(11 / css), 12, 24);
  const prompt = !hallwayTalk && hallwayTarget ? hallwayPromptBox(hallwayTarget, vw) : null;
  for (const npc of hallwayCast) if (npc.present && npc.bark) hallwayDrawBark(g, npc, vw, barkSize, prompt);
  if (prompt) hallwayDrawPrompt(g, hallwayTarget, vw);
  if (hallwayCult.pa) hallwayDrawPa(g, vw, barkSize);
  if (hallwayTalk) hallwaySpeechBox(g, vw, vh, css);
}

// The PA announcement: a wide caption across the top, between the hearts and the pocket money.
function hallwayDrawPa(g, vw, fs) {
  const pa = hallwayCult.pa,
    alpha = clamp(Math.min(pa.life * 2, (pa.max - pa.life) * 4), 0, 1),
    margin = Math.min(170, vw * 0.18),
    maxW = Math.max(160, vw - margin * 2),
    rows = hallwayWrap(g, pa.text, maxW - 60, fs),
    lh = Math.round(fs * 1.3),
    w = Math.min(maxW, Math.max(...rows.map(r => hallwayTextW(g, r, fs))) + 60),
    h = rows.length * lh + 16,
    x = (vw - w) / 2,
    y = 8;
  g.save();
  g.globalAlpha = alpha;
  rr(g, x + 2, y + 3, w, h, 10, '#0b1d2666');
  rr(g, x, y, w, h, 10, '#13303cee', '#f7c6d2', 1.5);
  // A little speaker, mid-announcement.
  const sx = x + 18,
    sy = y + h / 2;
  rr(g, sx - 6, sy - 3.5, 5, 7, 1, '#f7c6d2');
  poly(g, [[sx - 1.5, sy - 3.5], [sx + 4, sy - 7.5], [sx + 4, sy + 7.5], [sx - 1.5, sy + 3.5]], '#f7c6d2');
  path(g, p => p.arc(sx + 5, sy, 6, -0.8, 0.8), null, '#f7c6d288', 1.4);
  rows.forEach((row, i) => label(g, row, x + 36 + (w - 48) / 2, y + 8 + lh * i + fs * 0.95, fs, '#fff1c2', 'center'));
  g.restore();
}

// Escape closes a conversation instead of pausing (input.js's own handler runs later, on window).
function hallwayKeydown(e) {
  if (!e || e.key !== 'Escape' || !hallwayTalk || !hallwayHere() || hallwayBusy()) return;
  hallwayCloseTalk();
  if (typeof e.preventDefault === 'function') e.preventDefault();
  if (typeof e.stopPropagation === 'function') e.stopPropagation();
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function')
  document.addEventListener('keydown', hallwayKeydown, true);
