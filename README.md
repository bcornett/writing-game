# Dot's Writing Quest

A letters-and-numbers game for a kindergartner who writes her 5s and 2s
backwards and mixes up b and d. It runs on an iPad (or any phone or tablet)
as a home-screen app, plays offline, and talks in a real recorded voice.

Dot, a round coral mascot, shows how each letter is written — in the right
stroke order, starting from the right side — then hands over. The child
traces it, writes it freehand, picks the real one out from its backwards
twins, answers "b or d?", and pops bubbles carrying flipped letters. Every
attempt is graded, and a reversal gets called out as exactly that: "Oops,
that one is facing the wrong way. The five's hat points to the right."

```bash
npm start          # serve it on the wifi and print a QR code for the iPad
npm test           # 111 tests, no framework
npm run voices     # (re)generate Dot's voice clips with ElevenLabs
```

No build step, no npm dependencies, no image files. Everything is ES modules
served straight off disk; icons, sounds and confetti are drawn in code. The
only assets are the 212 MP3 voice clips in `audio/voice/`.

---

## The games

| Game | What she does | What it teaches |
| --- | --- | --- |
| **Play!** (the quest) | Six short steps, a different game each, planned around whatever she finds hardest, ending with stars and a sticker. | Everything below, in the right proportion. A reversal in the write step slips in a quick trace of that letter before she writes it again. |
| **Trace** | Dot draws the letter with a voice rhyme ("Line down, big belly around, then a hat on top"). She follows the road with a finger, stroke by stroke, in order and direction. Three rounds; the road fades each round until only the start dot is left. | Stroke order and starting side — the things that actually fix a reversal. |
| **Write** | A blank card. She writes it; Dot grades it. Side-by-side of hers and the real one; a backwards letter flips itself over so she can see the difference. | Production from memory, with specific feedback: great / good / drawn from the wrong end / backwards / upside down / "that looks like a d". |
| **Spot it** | Two to four cards, one real letter and its mirrored, flipped or turned twins. Tap the real one. | Recognising which way a letter faces. |
| **Twins** | "Is this a b, or a d?" A wrong b/d answer brings out the *bed* trick (two fists, thumbs up). | Telling the confusable pairs apart: b/d, p/q, b/p, d/q, 6/9, n/u, m/w, 2/5. |
| **Pop!** | Bubbles float up carrying letters, half of them backwards. Pop only the backwards ones. | Fast discrimination, as a game. |
| **Stickers** | One sticker for every ten stars, fifty in all. | Coming back tomorrow. |

Nothing can be lost. There is no fail state, no timer, no score that goes
down. A wrong tap is a wobble and a hint; a backwards letter is a specific
tip and a chance to trace it with Dot.

## Grown-ups

Press and hold the ⚙️ on the home screen for a second and a half:

- her name (shown in greetings; never leaves the device)
- which letters and numbers to practise (defaults to the reversal-prone
  set: 5 2 b d 3 7 9 6 s z p q j — all 62 are available)
- Dot's voice on/off, tracing strictness
- how it is going: a mastery bar per letter, writes, reversals ("flips"),
  and spot-it accuracy
- offline status, update button, build number, and a QR code of the page for
  another device

Progress lives in `localStorage` on the device.

## Getting it on the iPad

**Hosted (recommended):** open the site address in Safari, tap Share, then
**Add to Home Screen**. It installs like an app, runs full screen, and works
without wifi after the first open. `npm run qr -- https://your-host/path/`
writes a `qr.png` to stick on the fridge.

**From this Mac on the home wifi:** `npm start` prints the address and a QR
code. Scan it with the iPad camera, then Add to Home Screen. Offline play from
a LAN address needs https; `npm run cert` (once) sets up a local certificate
authority and the server walks you through trusting it on the iPad. See
`tools/cert.mjs` for why.

## How the grading works

`src/core/grader.js`. The drawing is moved and scaled onto the template and
compared as a *sequence* of points with dynamic time warping, trying every
stroke order and every stroke direction of the template. Warping forgives
proportions (a fat belly, a long hat) but not order or direction, which is
what tells a c from a backwards c — an unordered comparison can't, because
their ink overlaps almost everywhere. Coverage (did she draw all of it, and
nothing extra?) is added on top.

The same comparison is run against the glyph's mirrored, flipped and turned
twins and against the other letters. Whichever fits best, by a margin, is
what she drew. Thresholds are pinned by `tests/grader.test.js`, which grades
hundreds of synthetic wobbly, shrunken, tilted, mirrored and misdrawn
attempts.

Tracing (`src/core/tracer.js`) is a state machine: the finger has to land on
the start dot, may only advance a few samples per move, and cannot run a
stroke backwards. Wandering off pauses progress; coming back resumes it.

## Voice

Every line Dot says is in `src/core/phrases.js` — greetings, feedback, a
name and a stroke rhyme for each of the 62 glyphs, a "which way it faces"
hint for the reversal-prone ones, and the twin questions. Letter names are
spelled as sounds ("little bee") so text-to-speech never reads a lone "b" as a
letter or a word.

`npm run voices` turns the table into MP3s with ElevenLabs, reading the key
from `.env` (see `.env.example`). It only generates clips whose text or voice
changed, in priority order, and writes `audio/voice/manifest.json`. A test
fails if the clips drift from the table. Any line without a clip falls back to
the device's own voice, so the game never goes silent.

## Commands

```bash
npm start            # serve + QR; https if certs/ exists, else http
npm run start:http   # force http
npm test             # node --test
npm run voices       # generate missing/changed voice clips (needs .env)
npm run voices -- --dry-run
npm run icons        # redraw the home-screen icons
npm run sw           # regenerate the offline cache list — commit the result
npm run qr -- URL    # write qr.png for a URL
npm run cert         # one-time https setup for offline play over the LAN
npm run sweep        # grader threshold report across all glyphs
```

## Layout

```
index.html, style.css, manifest.webmanifest, sw.js (generated)
src/
  main.js              boot, shared app object, screen router
  core/                pure logic, no DOM — everything tested in Node
    glyphs.js          62 glyphs: strokes, spoken names, rhymes, flip hints
    path.js            SVG path → polyline sampling
    geometry.js        transforms, alignment, distances, coverage
    tracer.js          finger-follows-the-road state machine
    grader.js          freehand grading (DTW over stroke order/direction)
    progress.js        save file, mastery model, picker, stars → stickers
    curriculum.js      twins, spot/pop rounds, quest planning
    phrases.js         everything Dot can say
  render/              glyph SVG rendering, the Dot mascot
  audio/               voice player (clips → device voice fallback), synthesised sfx
  ui/                  screens, overlays, confetti, save, offline updates
tools/                 dev server, QR, PNG, icons, service worker, certs, voices
tests/                 node:test suites and the synthetic-drawing helper
dev/                   grader threshold sweep
audio/voice/           generated clips + manifest
```
