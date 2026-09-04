/**
 * Service-worker registration, offline status, and the "get the latest
 * version" flow behind the menu button.
 *
 * Added to the Home Screen there is no address bar and no reload button, so
 * pulling a new build has to be something the game itself offers.
 *
 * One constraint worth knowing: service workers and the Cache API only exist
 * in a *secure context* — https, or localhost. Over plain http on a LAN
 * address the browser hides them entirely, and there is no way around that
 * from JavaScript. `status` reports `insecure` in that case rather than
 * pretending something went wrong.
 */

const STATUS = {
  UNSUPPORTED: 'unsupported',
  INSECURE: 'insecure',
  INSTALLING: 'installing',
  READY: 'ready',
  UPDATE_READY: 'update-ready',
  CHECKING: 'checking',
  ERROR: 'error',
};

export function createUpdater({ onChange = () => {} } = {}) {
  let status = STATUS.UNSUPPORTED;
  let registration = null;
  let reloading = false;

  const set = (next, detail) => {
    status = next;
    onChange(status, detail);
  };

  function watch(reg) {
    registration = reg;

    // A worker sitting in `waiting` is a downloaded update ready to go.
    if (reg.waiting && navigator.serviceWorker.controller) {
      set(STATUS.UPDATE_READY);
    } else if (reg.active && navigator.serviceWorker.controller) {
      set(STATUS.READY);
    } else {
      set(STATUS.INSTALLING);
    }

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      if (navigator.serviceWorker.controller) set(STATUS.CHECKING);
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          // With a controller already present this is an update; without one
          // it's the very first install finishing.
          set(navigator.serviceWorker.controller ? STATUS.UPDATE_READY : STATUS.READY);
        } else if (installing.state === 'activated' && !reg.waiting) {
          set(STATUS.READY);
        }
      });
    });
  }

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    // Guard against the classic reload loop.
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  return {
    get status() {
      return status;
    },

    async register() {
      if (!window.isSecureContext) {
        set(STATUS.INSECURE);
        return null;
      }
      if (!('serviceWorker' in navigator)) {
        set(STATUS.UNSUPPORTED);
        return null;
      }
      try {
        const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
        watch(reg);
        // Ask once on load, so a game left on the home screen picks up new
        // builds without anyone opening the menu.
        reg.update().catch(() => {});
        return reg;
      } catch (error) {
        set(STATUS.ERROR, error);
        return null;
      }
    },

    /**
     * Ask the browser to re-fetch sw.js and see if the build changed.
     * @returns {Promise<'update-ready'|'up-to-date'|'unavailable'>}
     */
    async checkForUpdate() {
      if (!registration) return 'unavailable';
      if (registration.waiting) {
        set(STATUS.UPDATE_READY);
        return 'update-ready';
      }
      set(STATUS.CHECKING);
      try {
        await registration.update();
      } catch {
        set(STATUS.READY);
        return 'unavailable';
      }
      // `update()` resolves before a new worker finishes installing, so give
      // the install a moment to land before declaring nothing changed.
      const found = await new Promise((resolve) => {
        if (registration.waiting || registration.installing) return resolve(true);
        const timer = setTimeout(() => resolve(Boolean(registration.waiting)), 2500);
        const onFound = () => {
          clearTimeout(timer);
          resolve(true);
        };
        registration.addEventListener('updatefound', onFound, { once: true });
      });

      if (!found) {
        set(STATUS.READY);
        return 'up-to-date';
      }
      // Wait for it to reach `waiting`, then it's ready to apply.
      await new Promise((resolve) => {
        if (registration.waiting) return resolve();
        const worker = registration.installing;
        if (!worker) return resolve();
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' || worker.state === 'activated') resolve();
        });
        setTimeout(resolve, 8000);
      });
      set(registration.waiting ? STATUS.UPDATE_READY : STATUS.READY);
      return registration.waiting ? 'update-ready' : 'up-to-date';
    },

    /** Activate the waiting worker; the page reloads on controllerchange. */
    applyUpdate() {
      if (registration?.waiting) {
        registration.waiting.postMessage('skip-waiting');
        return true;
      }
      // Nothing waiting — a plain reload is the honest fallback.
      window.location.reload();
      return false;
    },
  };
}

export { STATUS };
