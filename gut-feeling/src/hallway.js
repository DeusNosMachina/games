// The fourth-floor hallway (room 6): the long way between department doors, full of people who like
// Macy. No combat, no damage. Visitors stroll, pause, turn to face her, and talk in a typed speech box
// with voice blips; Barb from Dietary rides the elevator up every few minutes with a tray of Ensure.
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
  HALLWAY_SCALE = 1.18,
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
  HALLWAY_ROOM = {
    id: 6,
    name: 'Hallway',
    sub: 'FOURTH FLOOR / THE LONG WAY ROUND',
    theme: '#cfdcd6',
    station: null,
    width: 3200,
    noArcade: true
  };

// Doors along the back wall. The night version of Macy's room uses the same door: it is still her room.
const HALLWAY_DOORS = [
  { room: 0, x: 600, name: 'Your room', plate: 'ROOM 412' },
  { room: 1, x: 1080, name: 'MRI', plate: 'MRI' },
  { room: 2, x: 1560, name: 'Family lounge', plate: 'FAMILY LOUNGE', double: true },
  { room: 3, x: 2010, name: 'CT scan', plate: 'CT SCAN' },
  { room: 4, x: 2430, name: 'Ultrasound', plate: 'ULTRASOUND' }
];

// Voice ids for sfx('talk', {voice}); audio.js defines each one.
const HALLWAY_VOICES = ['dad', 'brother', 'grandma', 'grandpa', 'cousin', 'doctor', 'nurse', 'ensure', 'macy'];

const HALLWAY_FLAVORS = ['#7a4b33', '#e9d39a', '#ef9fb0'],
  HALLWAY_SCRUBS = ['#6fb7c9', '#7fc4a2', '#c48fbf', '#5b7fbf', '#e39a8f', '#8a86c9', '#4f9c9a'],
  HALLWAY_SKINS = [
    ['#f6d2b3', '#e2ad8d'],
    ['#e8b48f', '#cf9672'],
    ['#c98e66', '#ad7352'],
    ['#a86d4a', '#8d5638'],
    ['#7d4e33', '#663d27'],
    ['#f1c7a2', '#d9a37f']
  ],
  HALLWAY_HAIRS = [
    ['#2b1d1a', '#160e0d'],
    ['#5a3a28', '#3b2519'],
    ['#8b5a3c', '#663f28'],
    ['#c99a5b', '#a17640'],
    ['#1f1a1c', '#0e0b0c'],
    ['#a9a29a', '#837c74']
  ],
  HALLWAY_NURSE_NAMES = ['Tasha', 'Marco', 'Priya', 'Deb', 'Lou', 'Kim', 'Andre', 'Bea', 'Sam', 'Rosa'];

// ---- What people say ----
// talks: one conversation each, one to three bubbles of [who, text]; who is 'npc' or 'macy'. A talk
// with when() only comes up while it is true, and comes up first the first time it is. {name} and
// {NAME} become Macy's name. barks are the one-liners people call out as she walks past.
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
  grandma: {
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
      { say: [['npc', 'Your grandfather proposed to me in a hospital cafeteria. Terrible Jell-O. Wonderful man.']] },
      { say: [['npc', 'I lit a candle for you at church. And one for the Cubs. Yours is working better.']] },
      { say: [['npc', "The nurses say you're brave and polite. Your father bit a nurse once. He was four."]] },
      { say: [['npc', "Is there a cafeteria up here? I'd like to complain to someone in person."]] },
      { say: [['npc', "Don't show me the video games, sweetheart. I'll just watch you be good at them."]] },
      { when: hallwayWon, say: [['npc', "Home! I'll bring the cookies to the house. They've been very patient."]] },
      {
        when: hallwayCleared,
        say: [
          ['npc', "Your grandfather says you're fighting monsters in here."],
          ['macy', 'I am.'],
          ['npc', 'Good. Hit one for me.']
        ]
      }
    ]
  },
  grandpa: {
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
          ['npc', "Your grandmother brought cookies. I've been guarding them."],
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
          ['macy', 'Grandpa.'],
          ['npc', 'A strongly worded word.']
        ]
      },
      { when: hallwayWon, say: [['npc', 'Going home. Good. The house needs its slugger back.']] }
    ]
  },
  teammate: {
    whoa: 'Whoa! Wheels!',
    barks: ['{NAME}!', "Let's gooo!", 'Lap queen!'],
    talks: [
      { say: [['npc', "The team signed a ball for you. Coach signed it twice. He's emotional."]] },
      { say: [['npc', "We saved your spot. Nobody's allowed to stand there. It's weird. We love it."]] },
      {
        say: [
          ['npc', 'Practice is so boring without you yelling MINE at everything.'],
          ['macy', 'Somebody has to.'],
          ['npc', 'Nobody else does it right.']
        ]
      },
      { say: [['npc', "You'll be back before playoffs. That's not a guess. I asked a doctor. Kind of."]] },
      { when: hallwayWon, say: [['npc', "You're out?! Practice is Monday. Kidding. Tuesday."]] },
      {
        when: hallwayMedals,
        say: [
          ['npc', 'Coach heard about your medals. He wants them in the trophy case.'],
          ['macy', "They're arcade medals."],
          ['npc', "He doesn't care."]
        ]
      }
    ]
  },
  cousin: {
    whoa: 'Whoa! Safe!',
    barks: ['Cuz!', 'Swing, batter!', 'Looking good, cuz.'],
    talks: [
      {
        say: [
          ['npc', "I brought your glove. I don't know why. It felt right."],
          ['macy', 'Break it in for me?'],
          ['npc', 'I would never touch your glove.']
        ]
      },
      { say: [['npc', "Coach says you're still batting cleanup when you're back. No pressure. Some pressure."]] },
      { say: [['npc', "We lost Saturday. I'm not saying it's because you're in here. But you're in here."]] },
      { say: [['npc', "Grandma tried to give me a cookie from your tin. I said no. I'm loyal. I'm also starving."]] },
      { when: hallwayCleared, say: [['npc', "You cleared a whole ward of gremlins? That's basically a triple play."]] },
      { when: hallwayWon, say: [['npc', "Discharged! First game back, I'm buying the sunflower seeds."]] }
    ]
  },
  doctor: {
    whoa: 'Whoa. No running in the... okay.',
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
      { when: hallwayCleared, say: [['npc', 'Radiology says the gremlins left you a one-star review. Excellent work.']] }
    ]
  },
  nurse: {
    whoa: 'Whoa! Walking feet!',
    barks: ['Look at you go!', 'Lap queen!', 'Bravest on the floor.', "That's my favorite patient. Don't tell 409."],
    talks: [
      { say: [['npc', "You're the bravest one on the floor and I've seen a biker cry at a shot."]] },
      { say: [['npc', 'Vitals look good. Attitude is a little spicy. Also good.']] },
      { say: [['npc', "Almost done. I know everyone says that. I'm saying it with data."]] },
      { say: [['npc', 'If you need anything, press the button. If you need gossip, find me.']] },
      {
        say: [
          ['npc', 'The man in 409 asked about you. He is eighty and he wants to talk volleyball.'],
          ['macy', 'Is he any good?'],
          ['npc', 'He says he invented the spike.']
        ]
      },
      { say: [['npc', "I've had grown men complain more about one blood draw than you have all week."]] },
      {
        say: [
          ['npc', 'The whole station is rooting for you. We made a bracket.'],
          ['macy', 'A bracket for what?'],
          ['npc', "Don't worry about it. You're winning."]
        ]
      },
      { say: [['npc', 'Keep walking. Every lap is one less day in here.']] },
      { when: hallwayWon, say: [['npc', "You're discharged! We'll miss you. Not the gremlins."]] },
      { when: hallwayMedals, say: [['npc', 'We put your medal count on the whiteboard. Dr. Reyes is jealous.']] }
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
  'Home is ready when you are. Your brother made your bed. Badly. With love.',
  "You've been braver this week than I was in my entire twenties.",
  "When this is done we're getting real food. Your pick. Even the place I pretend to hate.",
  "Every nurse on this floor knows your name. That isn't a hospital thing. That's a you thing.",
  "You've had worse days on the court and still served for match point.",
  "Small steps are still steps. You're stepping.",
  "You're allowed to be tired of this. Tired is allowed. Quitting was never your style anyway.",
  "The doctor says you're doing the work. I said that's my kid. She already knew.",
  "You're not behind. You're on a different schedule for a minute. Then you're back.",
  "The softball team made you a banner. It's spelled right. Mostly.",
  "Your brother won't admit it, but he asks about you every five minutes. Every. Five.",
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
  'Grandma has told every person in the cafeteria about you. Every. Person.',
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
  "The IV pump beeps when it's done, when it's not done, and when it's thinking about being done. Very communicative. Unlike your brother.",
  'My jokes are like your IV. Slow, steady, and only a professional can unplug them.',
  "The monitor keeps saying 88. Either that's your heart rate or the number of Jell-Os I've eaten. Both are accurate.",
  "I'm not saying that last joke was bad, but the monitor just went to 89 in protest.",
  'Every time the monitor beeps I sit up straight. Twenty years of dad reflexes, beaten by a machine that just says 88.',
  "Your IV pole follows you everywhere. That's not a medical device. That's a golden retriever with a drip.",
  ["Two IV bags are hanging out on a pole. One says, 'You look a little drained.'", "The other says, 'I'm fine. Just hanging in there.'"],
  "That IV beep has better timing than I do. It always knows when a conversation's over.",
  // The nurse call button.
  'I pressed the nurse call button by accident once. Now I have to pretend I wanted ice chips for the rest of my life.',
  'I tried the nurse call button trick on your brother at home. Nothing. Faulty model.',
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
  "Volleyball tip from the hospital: if you can't spike it, set it down gently. Applies to Jell-O, Ensure and your brother.",
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
  "I asked a nurse for a second opinion on my jokes. She said they're bad. I asked for a third. Your brother said they're bad. That's a consensus. I'm appealing.",
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
  "Why did the cookie go to the hospital? It was feeling crummy. Grandma's cookies are on standby for when you're allowed.",
  "Why did the banana go to the doctor? It wasn't peeling well.",
  // Hospital life.
  "I asked for a pillow that doesn't crinkle. The nurse laughed for a full minute. Then she brought me a crinkly one.",
  "Every hand sanitizer here makes the same noise. Pfft. It's the hospital's laugh track. It goes off after all my jokes.",
  "I got lost on the way to the cafeteria. A nurse said I was in the wrong wing. I said I'm a dad, I'm always winging it.",
  'Your bed goes up, down and folds in half. It has more moves than I do at a wedding.',
  'The TV in your room gets four channels: news, weather, the hospital channel, and me standing in front of it.',
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
  'Grandpa told it better.'
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
  hallwayUi = { css: 1, prompt: 13 };

// ---- Small helpers ----
const npcShadeCache = new Map();

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
  hallwayFill = text => text.replace(/\{name\}/g, hallwayName()).replace(/\{NAME\}/g, hallwayName().toUpperCase()),
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
  grandma: () =>
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
  grandpa: () =>
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
  kenzie: () =>
    npcLook({
      leg: 37,
      torso: 31,
      shoulder: 12,
      hip: 6.8,
      legW: 6.8,
      armW: 5.8,
      head: 12.2,
      skin: '#f3cfae',
      skinShade: '#dfab89',
      hair: '#dcb36a',
      hairDark: '#b48a48',
      hairStyle: 'pony',
      band: '#3f6fc4',
      eyes: '#4f7d5a',
      brows: '#a17c45',
      top: 'jersey',
      topA: '#3f6fc4',
      topB: '#f6f3e6',
      topC: '#f0c94a',
      number: '7',
      shortSleeve: true,
      pants: '#2e3540',
      shoes: 'sneaker',
      shoeColor: '#f4f2ea',
      shoeAccent: '#3f6fc4',
      item: 'volleyball'
    }),
  bri: () =>
    npcLook({
      leg: 31,
      torso: 30,
      shoulder: 12,
      hip: 7,
      legW: 7,
      armW: 6,
      head: 12.2,
      skin: '#c98e66',
      skinShade: '#ad7352',
      hair: '#2b1d1a',
      hairDark: '#160e0d',
      hairStyle: 'puff',
      band: '#f6f3e6',
      eyes: '#4a2f22',
      brows: '#21140f',
      top: 'softball',
      topA: '#c94f4f',
      topB: '#f6f3e6',
      topC: '#7d2c2c',
      number: '12',
      shortSleeve: true,
      pants: '#8b9097',
      cuffs: true,
      shoes: 'sneaker',
      shoeColor: '#f4f2ea',
      shoeAccent: '#c94f4f',
      item: 'glove'
    }),
  doctor: () =>
    npcLook({
      leg: 38,
      torso: 36,
      shoulder: 12.8,
      hip: 7,
      legW: 7,
      armW: 6.3,
      head: 12.3,
      skin: '#a86d4a',
      skinShade: '#8d5638',
      hair: '#1f1a1c',
      hairDark: '#0e0b0c',
      hairStyle: 'bob',
      eyes: '#3a261c',
      brows: '#181213',
      top: 'coat',
      topA: '#f6f7f2',
      topB: '#9fc3d9',
      topC: '#c9d2d4',
      pants: '#4c5563',
      shoes: 'loafer',
      shoeColor: '#2f2b2b',
      item: 'clipboard',
      glasses: '#2b3a4a',
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

// Nurses are random every session: scrubs, skin, hair, height, shoes and what they carry.
function hallwayNurseLook(scrub) {
  const skin = pick(HALLWAY_SKINS),
    hair = pick(HALLWAY_HAIRS);
  return npcLook({
    leg: rand(30, 38),
    torso: rand(29, 35),
    shoulder: rand(11.6, 13.4),
    hip: rand(6.6, 8.4),
    head: rand(11.8, 12.6),
    skin: skin[0],
    skinShade: skin[1],
    hair: hair[0],
    hairDark: hair[1],
    hairStyle: pick(['bob', 'curly', 'short', 'bun', 'pony', 'buzz']),
    band: pick(['#f0c94a', '#ef9fb0', '#f6f3e6', '#7fc4a2']),
    eyes: pick(['#3a261c', '#6b4226', '#4f7d5a', '#5a6e7c']),
    brows: hair[1],
    top: 'scrubs',
    topA: scrub,
    topB: npcShade(scrub, 0.8),
    topC: '#f6f3e6',
    shortSleeve: true,
    pants: scrub,
    shoes: 'clog',
    shoeColor: pick(['#f4f2ea', '#2f3d4c', '#e58c9b', '#7fb8aa', '#f0c94a']),
    item: pick(['', '', 'tablet', 'cup']),
    stetho: rand(0, 1) < 0.5,
    badge: true,
    glasses: rand(0, 1) < 0.25 ? '#3c3c3c' : ''
  });
}

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
  const scrubs = hallwayShuffle(HALLWAY_SCRUBS),
    names = hallwayShuffle(HALLWAY_NURSE_NAMES),
    nurse = (i, x, y, range) =>
      hallwayNpc('nurse' + i, 'Nurse ' + names[i], 'nurse', hallwayNurseLook(scrubs[i]), x, y, range, rand(60, 72), {
        lines: 'nurse',
        pitch: [0, 2, -2][i],
        tag: npcShade(scrubs[i], 1.35),
        offset: i * 3
      });
  hallwayCast = [
    hallwayNpc('dad', 'Dad', 'dad', HALLWAY_LOOKS.dad(), 700, 300, [420, 1050], 48, { tag: '#f3d38b' }),
    nurse(0, 880, 280, [620, 1200]),
    hallwayNpc('doctor', 'Dr. Reyes', 'doctor', HALLWAY_LOOKS.doctor(), 1260, 390, [1000, 1700], 58, { tag: '#cfe3ee' }),
    hallwayNpc('grandma', 'Grandma', 'grandma', HALLWAY_LOOKS.grandma(), 1500, 330, [1350, 1800], 32, { tag: '#ddc8ec' }),
    hallwayNpc('grandpa', 'Grandpa', 'grandpa', HALLWAY_LOOKS.grandpa(), 1650, 365, [1300, 1850], 30, { tag: '#cfe0b4' }),
    hallwayNpc('kenzie', 'Kenzie', 'cousin', HALLWAY_LOOKS.kenzie(), 2060, 320, [1850, 2350], 60, {
      lines: 'teammate',
      tag: '#b4cbf2'
    }),
    nurse(1, 2250, 450, [1800, 2600]),
    hallwayNpc('brother', 'Little Bro', 'brother', HALLWAY_LOOKS.brother(), 2560, 262, [2350, 2800], 55, { tag: '#f2bf8f' }),
    hallwayNpc('bri', 'Cousin Bri', 'cousin', HALLWAY_LOOKS.bri(), 2800, 340, [2550, 3050], 58, {
      lines: 'cousin',
      pitch: 3,
      tag: '#f2b0ad'
    }),
    nurse(2, 2950, 420, [2650, 3120]),
    hallwayNpc('barb', 'Barb · Dietary', 'ensure', HALLWAY_LOOKS.barb(), HALLWAY_ELEVATOR_X, HALLWAY_TOP + 6, [80, 3120], 108, {
      lines: 'ensure',
      tag: '#f7c6d2',
      ensure: true
    })
  ];
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
    if (o === self || !o.present) continue;
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
    my = (dy / len) * step;
  let moved = false;
  if (Math.abs(mx) > 1e-6 && !hallwayBlocked(npc.x + mx, npc.y, npc)) {
    npc.x += mx;
    moved = true;
  }
  if (Math.abs(my) > 1e-6 && !hallwayBlocked(npc.x, npc.y + my, npc)) {
    npc.y += my;
    moved = true;
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
}

function hallwayNpcStep(npc, dt) {
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
  hallwaySay(npc, HALLWAY_LINES.ensure.barks[en.trips % HALLWAY_LINES.ensure.barks.length], 3);
  if (typeof sfx === 'function') sfx('daily', { vol: 0.45 });
}

function hallwayEnsureMove(npc, dt, d) {
  const en = hallwayEnsure;
  if (en.phase === 'out') {
    en.patience -= dt;
    if (en.patience <= 0) {
      hallwayEnsureDrop(npc, true);
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
  hallwayBottles.push(bottle);
  if (hallwayBottles.length > HALLWAY_MAX_BOTTLES) hallwayBottles.shift();
  if (typeof floating === 'function') floating('+1 ENSURE · STILL NOT ALLOWED', bottle.x, bottle.y - 46, '#f7c6d2');
  if (ignored) hallwaySay(npc, "I'll leave it here!", 2.4);
}

// ---- Conversations ----
// Next conversation: a state-reactive one the first time it applies, then any unheard one (nurses start
// at different points), then the rotation, never the same one twice in a row.
function hallwayNextConvo(npc) {
  if (npc.lines === 'dad') return hallwayDadConvo(npc);
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

function hallwayOpenTalk(npc) {
  hallwayTalk = { npc, lines: hallwayNextConvo(npc), i: 0, shown: 0, acc: 0, pause: 0, voiced: 0, age: 0 };
  npc.mode = 'idle';
  npc.moving = false;
  npc.bark = null;
  hallwayFace(npc);
  player.dir = npc.x >= player.x ? 1 : -1;
  hallwayTarget = null;
  return true;
}

function hallwayEndTalk(finished) {
  const tk = hallwayTalk;
  if (!tk) return false;
  hallwayTalk = null;
  const npc = tk.npc;
  npc.wait = rand(1.2, 2.5);
  npc.barkCd = Math.max(npc.barkCd, 20);
  if (npc.ensure && finished && hallwayEnsure.phase === 'out') {
    hallwayEnsureDrop(npc, false);
    hallwayEnsure.phase = 'leaving';
  }
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
}

function hallwayTalkStep(dt) {
  const tk = hallwayTalk;
  if (!tk) return;
  if (!tk.npc.present || dist(tk.npc, player) > HALLWAY_LEAVE_RANGE) {
    hallwayEndTalk(false);
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
      // One voice blip per two letters: a chunk, not a machine gun.
      if (tk.voiced % 2 === 1 && typeof sfx === 'function') {
        const macy = line.who === 'macy';
        sfx('talk', { voice: macy ? 'macy' : tk.npc.voice, count: tk.voiced >> 1, combo: macy ? 0 : tk.npc.pitch });
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
    const top = npc.y - npcTop(npc.look) * HALLWAY_SCALE;
    if (Math.abs(p.x - npc.x) < 26 && p.y > top - 6 && p.y < npc.y + 8) return hallwayOpenTalk(npc);
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
    hallwayEnsureTick(dt, false);
    return;
  }
  if (hallwayBusy()) return;
  hallwayClock += dt;
  hallwayArrival = Math.max(0, hallwayArrival - dt);
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
    return;
  }
  if (!hallwayCast.length) hallwayResetCast();
  // Remember the door, so a second onRoomLoaded(6) for the same visit lands in the same place.
  const from = hallwayFrom ?? hallwayLastRoom;
  hallwayFrom = null;
  hallwayLastRoom = from;
  hallwayPlace(from);
  hallwayArrival = 0.5;
  hallwayTalk = null;
  hallwayTarget = null;
  if (hallwayEnsure.phase === 'away') hallwayEnsure.due = Math.max(hallwayEnsure.due, 5);
  if (typeof music === 'function' && audio.track !== 'room:6') music('room:6');
  if (!hallwayVisited) {
    hallwayVisited = true;
    if (typeof toast === 'function') toast('The long way round. Everyone out here is on your side. Say hi.', 3.4);
  }
}

// ---- Visitor art ----
// In girl()'s style: origin at the feet, drawn facing +x, then flipped by dir. A fractional dir is the
// mid-turn squash when someone turns to face Macy.
function npcTop(k) {
  const extra = { wavy: 9, bun: 9, puff: 13, cap: 5, pony: 4, net: 6, curly: 6 }[k.hairStyle] || 4;
  return k.leg + k.torso + 5 + k.head * 2.24 - 3 + extra;
}

function npcHeadY(k) {
  return -(k.leg + k.torso + 5 + k.head * 1.12 - 3);
}

function npcSleeve(k) {
  return k.top === 'vest' ? k.topB : k.topA;
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
    // Shirt and tie under a white coat that reaches mid-thigh.
    const hem = hipY + k.leg * 0.32;
    rr(g, -S + 3, shY, S * 2 - 6, h - 2, 5, b);
    poly(
      g,
      [
        [-1.6, shY + 2],
        [1.6, shY + 2],
        [2.2, shY + 16],
        [0, shY + 19],
        [-2.2, shY + 16]
      ],
      '#3f6fa8'
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
  ellipse(g, hx + 1.5, hy, 3.1, 3.7, k.skin);
}

// Two hands: Barb's tray of Ensure, Grandma's cookie tin.
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
  const top = hy - hry,
    sway = Math.sin(t * 3.4 + k.seed) * 1.5;
  if (k.hairStyle === 'pony')
    path(
      g,
      p => {
        p.moveTo(-6, top + 1);
        p.bezierCurveTo(-24, top - 4, -21, hy + 12, -15 + sway, hy + 21);
        p.bezierCurveTo(-9, hy + 10, -11, hy - 2, -4, top + 4);
        p.closePath();
      },
      gradient(g, -24, top, 20, 36, k.hair, k.hairDark)
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
  if (k.mustache)
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
    // Little Bro: short, straight, a fringe that needs a cut.
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
    // Grandpa: white fringe over the ears under a tweed flat cap.
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
  } else if (style === 'puff') {
    // Cousin Bri: a curly puff on top, a headband.
    const cx = fx - 1,
      cy = top - 5;
    ellipse(g, cx, cy, 9, 7.5, k.hairDark);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ellipse(g, cx + Math.cos(a) * 7.5, cy + Math.sin(a) * 6, 4.2, 4, i % 2 ? k.hair : k.hairDark);
    }
    path(
      g,
      p => {
        p.moveTo(-hr - 0.5, hy + 2);
        p.bezierCurveTo(-hr - 2, top - 3, hr + 2.5, top - 3, hr + 1.2, hy + 1);
        p.quadraticCurveTo(hr - 2, hy - 7, fx, hy - 7.5);
        p.quadraticCurveTo(-7, hy - 7, -hr + 1.5, hy + 3);
        p.closePath();
      },
      k.hair
    );
    if (k.band)
      path(
        g,
        p => {
          p.moveTo(-hr + 0.5, hy - 3.5);
          p.quadraticCurveTo(fx, top - 3, hr + 0.8, hy - 4.5);
        },
        null,
        k.band,
        2.4
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
  label(g, '4', x + 148, 96, 22, '#f6f3df', 'center');
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
  for (let r = 0; r < 4; r++) {
    const yy = top + 55 + r * 21;
    line(g, [[x + 10, yy + 2], [x + 68, yy + 2]], '#9fd3dc66', 1.5);
    for (let i = 0; i < 3; i++) {
      const xx = x + 19 + i * 20;
      if (r === 0) gremlin(g, xx, yy, 0.24, i, i * 1.3);
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
}

function hallwayDrawNpc(g, npc) {
  const tk = hallwayTalk,
    line = tk && tk.npc === npc ? tk.lines[tk.i] : null,
    speak = (line && line.who === 'npc' && tk.shown < line.text.length) || (npc.bark && npc.bark.life > npc.bark.max - 0.45),
    hop = npc.whoa > 0 ? Math.sin((npc.whoa / 0.45) * Math.PI) * 9 : 0;
  npcFigure(g, npc.x, npc.y, HALLWAY_SCALE, npc.look, npc.moving ? npc.walk : 0, npc.vdir, hallwayClock, { hop, speak });
}

function roomExtraRenderables(all = false) {
  if (!hallwayHere()) return [];
  const vw = typeof viewport === 'object' && viewport ? viewport.w : 1000,
    mid = cameraX + vw / 2,
    seen = x => all || Math.abs(x - mid) < vw / 2 + 160,
    list = [{ y: 150, draw: hallwayDrawWall }];
  for (const b of hallwayBottles) if (seen(b.x)) list.push({ y: b.y, draw: g => hallwayBottle(g, b.x, b.y, b.flavor, 1.3, true) });
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
    return { x: tg.npc.x, y: tg.npc.y - npcTop(tg.npc.look) * HALLWAY_SCALE - 10, text: key + ' · TALK' };
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

function hallwayDrawPrompt(g, tg, vw) {
  const info = hallwayPromptInfo(tg),
    r = hallwayPromptRect(info),
    bob = Math.sin(hallwayClock * 4) * 2,
    sx = clamp(r.x - cameraX, 6, vw - r.w - 6),
    sy = Math.max(6, r.y - wardCameraY + bob),
    tip = clamp(info.x - cameraX, sx + 10, sx + r.w - 10);
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

function hallwayDrawBark(g, npc, vw, fs) {
  const b = npc.bark,
    alpha = clamp(Math.min(b.life * 3, (b.max - b.life) * 8), 0, 1),
    w = hallwayTextW(g, b.text, fs) + 22,
    h = fs + 12,
    ax = npc.x - cameraX,
    ay = npc.y - npcTop(npc.look) * HALLWAY_SCALE - wardCameraY - 12,
    x = clamp(ax - w / 2, 6, vw - w - 6),
    y = Math.max(6, ay - h);
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
  if (npc) {
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
    macy = line.who === 'macy',
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
    name = macy ? hallwayName() : tk.npc.name,
    tagSize = Math.round(size * 0.78),
    tagH = tagSize + 12,
    tagY = y - tagSize * 0.75,
    tagW = hallwayTextW(g, name, tagSize) + 26;
  g.save();
  g.globalAlpha = clamp(tk.age * 7, 0, 1);
  rr(g, x + 3, y + 5, w, h, 18, '#0b1d2666');
  rr(g, x, y, w, h, 18, gradient(g, x, y, 0, h, '#21495a', '#163444'), '#9fd3bd', 2);
  rr(g, x + 18, y + 4, w - 36, 1.4, 1, '#daf0d32e');
  hallwayPortrait(g, x + 12, y + 12, face, face, macy ? null : tk.npc, !macy && !done);
  rr(g, tx - 6, tagY, tagW, tagH, tagH / 2, macy ? '#f1abbd' : tk.npc.tag, '#163444', 2);
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
  if (!hallwayHere()) return;
  const css = hallwayCssScale(vw);
  hallwayUi.css = css;
  hallwayUi.prompt = clamp(Math.round(12 / css), 13, 26);
  const barkSize = clamp(Math.round(11 / css), 12, 24);
  for (const npc of hallwayCast) if (npc.present && npc.bark) hallwayDrawBark(g, npc, vw, barkSize);
  if (!hallwayTalk && hallwayTarget) hallwayDrawPrompt(g, hallwayTarget, vw);
  if (hallwayTalk) hallwaySpeechBox(g, vw, vh, css);
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
