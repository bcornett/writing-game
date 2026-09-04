/**
 * Dot's Writing Quest — offline cache.
 *
 * GENERATED FILE. Do not edit by hand; run `npm run sw`.
 * Source: tools/sw.mjs
 *
 * Strategy is cache-first, which is what you want for a game with no server
 * state: once it is installed it never touches the network, so it works on a
 * plane. Updates are handled by version: any change to any file produces a new
 * VERSION, the browser installs the new worker alongside the old one, and the
 * game's menu offers an "Update" button that activates it.
 */

const VERSION = 'ddc7ad4dd3f1';
const CACHE = 'writing-quest-' + VERSION;

const ASSETS = [
  'index.html',
  'audio/voice/all_done.mp3',
  'audio/voice/amazing.mp3',
  'audio/voice/backward.mp3',
  'audio/voice/bed_trick.mp3',
  'audio/voice/fading.mp3',
  'audio/voice/find_real.mp3',
  'audio/voice/flipped.mp3',
  'audio/voice/glyph.d0.name.mp3',
  'audio/voice/glyph.d0.rhyme.mp3',
  'audio/voice/glyph.d1.name.mp3',
  'audio/voice/glyph.d1.rhyme.mp3',
  'audio/voice/glyph.d2.flip.mp3',
  'audio/voice/glyph.d2.name.mp3',
  'audio/voice/glyph.d2.rhyme.mp3',
  'audio/voice/glyph.d3.flip.mp3',
  'audio/voice/glyph.d3.name.mp3',
  'audio/voice/glyph.d3.rhyme.mp3',
  'audio/voice/glyph.d4.flip.mp3',
  'audio/voice/glyph.d4.name.mp3',
  'audio/voice/glyph.d4.rhyme.mp3',
  'audio/voice/glyph.d5.flip.mp3',
  'audio/voice/glyph.d5.name.mp3',
  'audio/voice/glyph.d5.rhyme.mp3',
  'audio/voice/glyph.d6.flip.mp3',
  'audio/voice/glyph.d6.name.mp3',
  'audio/voice/glyph.d6.rhyme.mp3',
  'audio/voice/glyph.d7.flip.mp3',
  'audio/voice/glyph.d7.name.mp3',
  'audio/voice/glyph.d7.rhyme.mp3',
  'audio/voice/glyph.d8.name.mp3',
  'audio/voice/glyph.d8.rhyme.mp3',
  'audio/voice/glyph.d9.flip.mp3',
  'audio/voice/glyph.d9.name.mp3',
  'audio/voice/glyph.d9.rhyme.mp3',
  'audio/voice/glyph.la.flip.mp3',
  'audio/voice/glyph.la.name.mp3',
  'audio/voice/glyph.la.rhyme.mp3',
  'audio/voice/glyph.lb.flip.mp3',
  'audio/voice/glyph.lb.name.mp3',
  'audio/voice/glyph.lb.rhyme.mp3',
  'audio/voice/glyph.lc.flip.mp3',
  'audio/voice/glyph.lc.name.mp3',
  'audio/voice/glyph.lc.rhyme.mp3',
  'audio/voice/glyph.ld.flip.mp3',
  'audio/voice/glyph.ld.name.mp3',
  'audio/voice/glyph.ld.rhyme.mp3',
  'audio/voice/glyph.le.flip.mp3',
  'audio/voice/glyph.le.name.mp3',
  'audio/voice/glyph.le.rhyme.mp3',
  'audio/voice/glyph.lf.flip.mp3',
  'audio/voice/glyph.lf.name.mp3',
  'audio/voice/glyph.lf.rhyme.mp3',
  'audio/voice/glyph.lg.flip.mp3',
  'audio/voice/glyph.lg.name.mp3',
  'audio/voice/glyph.lg.rhyme.mp3',
  'audio/voice/glyph.lh.name.mp3',
  'audio/voice/glyph.lh.rhyme.mp3',
  'audio/voice/glyph.li.name.mp3',
  'audio/voice/glyph.li.rhyme.mp3',
  'audio/voice/glyph.lj.flip.mp3',
  'audio/voice/glyph.lj.name.mp3',
  'audio/voice/glyph.lj.rhyme.mp3',
  'audio/voice/glyph.lk.flip.mp3',
  'audio/voice/glyph.lk.name.mp3',
  'audio/voice/glyph.lk.rhyme.mp3',
  'audio/voice/glyph.ll.name.mp3',
  'audio/voice/glyph.ll.rhyme.mp3',
  'audio/voice/glyph.lm.name.mp3',
  'audio/voice/glyph.lm.rhyme.mp3',
  'audio/voice/glyph.ln.name.mp3',
  'audio/voice/glyph.ln.rhyme.mp3',
  'audio/voice/glyph.lo.name.mp3',
  'audio/voice/glyph.lo.rhyme.mp3',
  'audio/voice/glyph.lp.flip.mp3',
  'audio/voice/glyph.lp.name.mp3',
  'audio/voice/glyph.lp.rhyme.mp3',
  'audio/voice/glyph.lq.flip.mp3',
  'audio/voice/glyph.lq.name.mp3',
  'audio/voice/glyph.lq.rhyme.mp3',
  'audio/voice/glyph.lr.flip.mp3',
  'audio/voice/glyph.lr.name.mp3',
  'audio/voice/glyph.lr.rhyme.mp3',
  'audio/voice/glyph.ls.flip.mp3',
  'audio/voice/glyph.ls.name.mp3',
  'audio/voice/glyph.ls.rhyme.mp3',
  'audio/voice/glyph.lt.name.mp3',
  'audio/voice/glyph.lt.rhyme.mp3',
  'audio/voice/glyph.lu.name.mp3',
  'audio/voice/glyph.lu.rhyme.mp3',
  'audio/voice/glyph.lv.name.mp3',
  'audio/voice/glyph.lv.rhyme.mp3',
  'audio/voice/glyph.lw.name.mp3',
  'audio/voice/glyph.lw.rhyme.mp3',
  'audio/voice/glyph.lx.name.mp3',
  'audio/voice/glyph.lx.rhyme.mp3',
  'audio/voice/glyph.ly.name.mp3',
  'audio/voice/glyph.ly.rhyme.mp3',
  'audio/voice/glyph.lz.flip.mp3',
  'audio/voice/glyph.lz.name.mp3',
  'audio/voice/glyph.lz.rhyme.mp3',
  'audio/voice/glyph.ua.name.mp3',
  'audio/voice/glyph.ua.rhyme.mp3',
  'audio/voice/glyph.ub.flip.mp3',
  'audio/voice/glyph.ub.name.mp3',
  'audio/voice/glyph.ub.rhyme.mp3',
  'audio/voice/glyph.uc.flip.mp3',
  'audio/voice/glyph.uc.name.mp3',
  'audio/voice/glyph.uc.rhyme.mp3',
  'audio/voice/glyph.ud.flip.mp3',
  'audio/voice/glyph.ud.name.mp3',
  'audio/voice/glyph.ud.rhyme.mp3',
  'audio/voice/glyph.ue.flip.mp3',
  'audio/voice/glyph.ue.name.mp3',
  'audio/voice/glyph.ue.rhyme.mp3',
  'audio/voice/glyph.uf.flip.mp3',
  'audio/voice/glyph.uf.name.mp3',
  'audio/voice/glyph.uf.rhyme.mp3',
  'audio/voice/glyph.ug.flip.mp3',
  'audio/voice/glyph.ug.name.mp3',
  'audio/voice/glyph.ug.rhyme.mp3',
  'audio/voice/glyph.uh.name.mp3',
  'audio/voice/glyph.uh.rhyme.mp3',
  'audio/voice/glyph.ui.name.mp3',
  'audio/voice/glyph.ui.rhyme.mp3',
  'audio/voice/glyph.uj.flip.mp3',
  'audio/voice/glyph.uj.name.mp3',
  'audio/voice/glyph.uj.rhyme.mp3',
  'audio/voice/glyph.uk.flip.mp3',
  'audio/voice/glyph.uk.name.mp3',
  'audio/voice/glyph.uk.rhyme.mp3',
  'audio/voice/glyph.ul.flip.mp3',
  'audio/voice/glyph.ul.name.mp3',
  'audio/voice/glyph.ul.rhyme.mp3',
  'audio/voice/glyph.um.name.mp3',
  'audio/voice/glyph.um.rhyme.mp3',
  'audio/voice/glyph.un.flip.mp3',
  'audio/voice/glyph.un.name.mp3',
  'audio/voice/glyph.un.rhyme.mp3',
  'audio/voice/glyph.uo.name.mp3',
  'audio/voice/glyph.uo.rhyme.mp3',
  'audio/voice/glyph.up.flip.mp3',
  'audio/voice/glyph.up.name.mp3',
  'audio/voice/glyph.up.rhyme.mp3',
  'audio/voice/glyph.uq.name.mp3',
  'audio/voice/glyph.uq.rhyme.mp3',
  'audio/voice/glyph.ur.flip.mp3',
  'audio/voice/glyph.ur.name.mp3',
  'audio/voice/glyph.ur.rhyme.mp3',
  'audio/voice/glyph.us.flip.mp3',
  'audio/voice/glyph.us.name.mp3',
  'audio/voice/glyph.us.rhyme.mp3',
  'audio/voice/glyph.ut.name.mp3',
  'audio/voice/glyph.ut.rhyme.mp3',
  'audio/voice/glyph.uu.name.mp3',
  'audio/voice/glyph.uu.rhyme.mp3',
  'audio/voice/glyph.uv.name.mp3',
  'audio/voice/glyph.uv.rhyme.mp3',
  'audio/voice/glyph.uw.name.mp3',
  'audio/voice/glyph.uw.rhyme.mp3',
  'audio/voice/glyph.ux.name.mp3',
  'audio/voice/glyph.ux.rhyme.mp3',
  'audio/voice/glyph.uy.name.mp3',
  'audio/voice/glyph.uy.rhyme.mp3',
  'audio/voice/glyph.uz.flip.mp3',
  'audio/voice/glyph.uz.name.mp3',
  'audio/voice/glyph.uz.rhyme.mp3',
  'audio/voice/great.mp3',
  'audio/voice/hello.mp3',
  'audio/voice/just_dots.mp3',
  'audio/voice/keep_going.mp3',
  'audio/voice/lets_go.mp3',
  'audio/voice/lets_write.mp3',
  'audio/voice/look_again.mp3',
  'audio/voice/looks_like.mp3',
  'audio/voice/manifest.json',
  'audio/voice/next_one.mp3',
  'audio/voice/nice.mp3',
  'audio/voice/one_star.mp3',
  'audio/voice/other_end.mp3',
  'audio/voice/pair.25.mp3',
  'audio/voice/pair.69.mp3',
  'audio/voice/pair.bd.mp3',
  'audio/voice/pair.bp.mp3',
  'audio/voice/pair.dq.mp3',
  'audio/voice/pair.mw.mp3',
  'audio/voice/pair.nu.mp3',
  'audio/voice/pair.pq.mp3',
  'audio/voice/pick_game.mp3',
  'audio/voice/pop_backwards.mp3',
  'audio/voice/quest_done.mp3',
  'audio/voice/so_close.mp3',
  'audio/voice/start_at_dot.mp3',
  'audio/voice/stay_on_road.mp3',
  'audio/voice/sticker.mp3',
  'audio/voice/super.mp3',
  'audio/voice/tap_check.mp3',
  'audio/voice/tap_real.mp3',
  'audio/voice/that_backwards.mp3',
  'audio/voice/that_upside.mp3',
  'audio/voice/that_was_right.mp3',
  'audio/voice/three_stars.mp3',
  'audio/voice/try_again.mp3',
  'audio/voice/two_stars.mp3',
  'audio/voice/upside.mp3',
  'audio/voice/watch_dot.mp3',
  'audio/voice/watch_me.mp3',
  'audio/voice/welcome.mp3',
  'audio/voice/which_one.mp3',
  'audio/voice/wow.mp3',
  'audio/voice/write_it.mp3',
  'audio/voice/yes_thats.mp3',
  'audio/voice/you_did_it.mp3',
  'audio/voice/your_turn.mp3',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'manifest.webmanifest',
  'src/audio/sfx.js',
  'src/audio/voice.js',
  'src/core/curriculum.js',
  'src/core/geometry.js',
  'src/core/glyphs.js',
  'src/core/grader.js',
  'src/core/path.js',
  'src/core/phrases.js',
  'src/core/progress.js',
  'src/core/qr.js',
  'src/core/rng.js',
  'src/core/tracer.js',
  'src/input/pointer.js',
  'src/main.js',
  'src/render/dot.js',
  'src/render/glyphSvg.js',
  'src/ui/confetti.js',
  'src/ui/demo.js',
  'src/ui/dom.js',
  'src/ui/save.js',
  'src/ui/screens/home.js',
  'src/ui/screens/parent.js',
  'src/ui/screens/pop.js',
  'src/ui/screens/quest.js',
  'src/ui/screens/spot.js',
  'src/ui/screens/stickers.js',
  'src/ui/screens/trace.js',
  'src/ui/screens/twins.js',
  'src/ui/screens/write.js',
  'src/ui/updates.js',
  'style.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)),
  );
  // Deliberately no skipWaiting(): swapping files under a running game would
  // be rude. The page asks for the swap when the player taps Update.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('writing-quest-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
  if (event.data === 'version') {
    event.source?.postMessage({ type: 'version', version: VERSION });
  }
});

const indexUrl = new URL('index.html', self.registration.scope).href;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A navigation (opening the app, or the home-screen icon) always resolves to
  // the cached page when we have it, so a dead server never shows an error.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match(indexUrl);
        if (cached) return cached;
        try {
          return await fetch(request);
        } catch {
          return new Response('Offline and nothing cached yet.', {
            status: 503,
            headers: { 'content-type': 'text/plain' },
          });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        // Cache anything else same-origin we happen to need later.
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const fallback = await caches.match(request, { ignoreSearch: true });
        if (fallback) return fallback;
        // Offline and never cached. Answer with a plain 404 rather than
        // throwing: the voice player treats a missing clip as "use the
        // device voice", and a rejected fetch would just spam the console.
        return new Response('', { status: 404, statusText: 'Offline' });
      }
    })(),
  );
});
