/**
 * Grown-ups: her name, which letters and numbers to practise, how it is
 * going (mastery and reversals per glyph), voice and strictness, offline
 * status, and a QR code of this very page for another device.
 */

import { GLYPH_BY_ID } from '../../core/glyphs.js';
import { GLYPH_GROUPS, REVERSAL_PRONE } from '../../core/curriculum.js';
import { mastery, reversalRate, DEFAULT_FOCUS } from '../../core/progress.js';
import { encodeQr } from '../../core/qr.js';
import { svgEl } from '../../render/glyphSvg.js';
import { STATUS } from '../updates.js';
import { el, button } from '../dom.js';

const OFFLINE_COPY = {
  [STATUS.READY]: { text: 'Saved on this device — plays without wifi', tone: 'is-ready' },
  [STATUS.UPDATE_READY]: { text: 'A new version is ready', tone: 'is-warn' },
  [STATUS.INSTALLING]: { text: 'Saving for offline…', tone: '' },
  [STATUS.CHECKING]: { text: 'Checking for a new version…', tone: '' },
  [STATUS.INSECURE]: { text: 'Needs https to save for offline play', tone: 'is-warn' },
  [STATUS.UNSUPPORTED]: { text: 'This browser cannot save for offline', tone: 'is-warn' },
  [STATUS.ERROR]: { text: 'Could not save for offline', tone: 'is-warn' },
};

function panel(title, ...children) {
  const p = el('section', 'panel');
  p.appendChild(el('h2', '', title));
  for (const c of children) if (c) p.appendChild(c);
  return p;
}

function segmented(options, value, onChange) {
  const seg = el('div', 'seg');
  const buttons = options.map(([val, label]) => {
    const b = el('button', `seg__btn${val === value ? ' is-on' : ''}`, label);
    b.type = 'button';
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.classList.remove('is-on'));
      b.classList.add('is-on');
      onChange(val);
    });
    seg.appendChild(b);
    return b;
  });
  return seg;
}

export function qrSvg(text) {
  const qr = encodeQr(text, { ecc: 'M' });
  const quiet = 2;
  const n = qr.size + quiet * 2;
  const svg = svgEl('svg', { viewBox: `0 0 ${n} ${n}`, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': 'QR code for this page' });
  svg.appendChild(svgEl('rect', { width: n, height: n, fill: '#fff' }));
  let d = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) d += `M${x + quiet},${y + quiet}h1v1h-1z`;
  }
  svg.appendChild(svgEl('path', { d, fill: '#2d2a3e' }));
  return svg;
}

export function mountParent(root, app) {
  app.setTitle('Grown-ups');
  app.bubble('Settings and progress. Tap Done when you are finished.');
  app.dot.setMood('think');
  const p = app.progress;
  const wrap = el('div', 'parent');

  // --- name --------------------------------------------------------------
  const nameField = el('div', 'field');
  const nameLabel = el('label', '', "Child's name");
  const nameInput = el('input', 'text-input');
  nameInput.type = 'text';
  nameInput.maxLength = 24;
  nameInput.value = p.name;
  nameInput.placeholder = 'Optional';
  nameInput.autocomplete = 'off';
  nameInput.addEventListener('input', () => {
    p.name = nameInput.value.trim().slice(0, 24);
    app.save();
  });
  nameField.append(nameLabel, nameInput);
  wrap.appendChild(panel('Who is playing', nameField));

  // --- focus -------------------------------------------------------------
  const focusIntro = el('p', '', 'Tap the letters and numbers to practise. The quest leans toward whichever she finds hardest.');
  const chipsWrap = el('div');
  const renderChips = () => {
    chipsWrap.innerHTML = '';
    for (const group of GLYPH_GROUPS) {
      const cg = el('div', 'chip-group');
      cg.appendChild(el('div', 'chip-group__title', group.title));
      for (const id of group.ids) {
        const chip = el('button', `chip${p.focus.includes(id) ? ' is-on' : ''}`, id);
        chip.type = 'button';
        chip.addEventListener('click', () => {
          app.sfx.play('tap');
          if (p.focus.includes(id)) {
            if (p.focus.length === 1) return;
            p.focus = p.focus.filter((x) => x !== id);
          } else p.focus = [...p.focus, id];
          app.save();
          chip.classList.toggle('is-on', p.focus.includes(id));
          renderProgress();
        });
        cg.appendChild(chip);
      }
      chipsWrap.appendChild(cg);
    }
  };
  renderChips();
  const focusActions = el('div', 'field');
  focusActions.appendChild(
    button('small-btn', 'Reset to the usual suspects', () => {
      p.focus = [...DEFAULT_FOCUS];
      app.save();
      renderChips();
      renderProgress();
    }),
  );
  focusActions.appendChild(
    button('small-btn', 'All the reversal-prone ones', () => {
      p.focus = [...REVERSAL_PRONE];
      app.save();
      renderChips();
      renderProgress();
    }),
  );
  wrap.appendChild(panel('What to practise', focusIntro, chipsWrap, focusActions));

  // --- settings ----------------------------------------------------------
  const voiceField = el('div', 'field');
  voiceField.appendChild(el('label', '', "Dot's voice"));
  voiceField.appendChild(
    segmented([[true, 'On'], [false, 'Off']], p.voice, (v) => {
      p.voice = v;
      app.voice.setEnabled(v);
      app.sfx.setEnabled(true);
      app.save();
    }),
  );
  const strictField = el('div', 'field');
  strictField.appendChild(el('label', '', 'Tracing'));
  strictField.appendChild(
    segmented([['easy', 'Easy'], ['normal', 'Normal'], ['tricky', 'Tricky']], p.strictness, (v) => {
      p.strictness = v;
      app.save();
    }),
  );
  const clips = app.voice.clipCount;
  const voiceNote = el('p', '', clips ? `${clips} of Dot's lines have her recorded voice; anything else uses the device voice.` : "No recorded voice clips found — Dot is using the device's voice. Run `npm run voices` to make them.");
  wrap.appendChild(panel('Settings', voiceField, strictField, voiceNote));

  // --- progress ----------------------------------------------------------
  const table = el('div', 'progress-table');
  const renderProgress = () => {
    table.innerHTML = '';
    for (const h of ['', 'Getting it', 'Writes', 'Flips', 'Spotted']) table.appendChild(el('div', 'progress-table__head', h));
    for (const id of p.focus) {
      const g = GLYPH_BY_ID[id];
      if (!g) continue;
      const r = p.glyphs[id] ?? { write: 0, writeOk: 0, flips: 0, spot: 0, spotOk: 0 };
      table.appendChild(el('div', 'progress-table__glyph', g.label));
      const bar = el('div', 'bar');
      const fill = el('div', 'bar__fill');
      fill.style.width = `${Math.round(mastery(p, id) * 100)}%`;
      bar.appendChild(fill);
      table.appendChild(bar);
      table.appendChild(el('div', '', r.write ? `${r.writeOk} / ${r.write}` : '—'));
      const flips = el('div', '', r.write ? `${r.flips}${reversalRate(p, id) >= 0.5 ? ' ⚠️' : ''}` : '—');
      table.appendChild(flips);
      table.appendChild(el('div', '', r.spot ? `${Math.round((r.spotOk / r.spot) * 100)}%` : '—'));
    }
  };
  renderProgress();
  const summary = el('p', '', `${p.stars} stars · ${p.stickers} stickers · ${p.quests} quest${p.quests === 1 ? '' : 's'} finished`);
  const resetRow = el('div', 'field');
  let armed = false;
  const resetBtn = button('small-btn small-btn--danger', 'Reset all progress', () => {
    if (!armed) {
      armed = true;
      resetBtn.textContent = 'Tap again to really reset';
      setTimeout(() => {
        armed = false;
        resetBtn.textContent = 'Reset all progress';
      }, 4000);
      return;
    }
    app.resetProgress();
    app.go('parent');
  });
  resetRow.appendChild(resetBtn);
  wrap.appendChild(panel('How it is going', summary, table, el('p', '', '"Flips" counts writes that came out backwards or upside down. "Getting it" blends her recent results, newest first.'), resetRow));

  // --- offline & install -------------------------------------------------
  const status = el('div', 'status-row');
  const statusDot = el('span', 'status-row__dot');
  const statusText = el('span', '', 'Checking…');
  status.append(statusDot, statusText);
  const renderStatus = () => {
    const copy = OFFLINE_COPY[app.updater.status] ?? OFFLINE_COPY[STATUS.UNSUPPORTED];
    statusText.textContent = copy.text;
    status.classList.remove('is-ready', 'is-warn');
    if (copy.tone) status.classList.add(copy.tone);
    updateBtn.textContent = app.updater.status === STATUS.UPDATE_READY ? 'Update now' : 'Check for a new version';
  };
  const updateBtn = button('small-btn', 'Check for a new version', async () => {
    if (app.updater.status === STATUS.UPDATE_READY) {
      app.updater.applyUpdate();
      return;
    }
    updateBtn.textContent = 'Checking…';
    const result = await app.updater.checkForUpdate();
    renderStatus();
    if (result === 'up-to-date') updateBtn.textContent = 'You have the latest version';
  });
  const unsubscribe = app.onUpdaterChange(renderStatus);
  renderStatus();
  const install = el('p', '', 'To put Dot on the iPad home screen: open this page in Safari, tap the Share button, then "Add to Home Screen".');
  const qrRow = el('div', 'qr');
  const url = window.location.href.split('#')[0];
  try {
    qrRow.appendChild(qrSvg(url));
  } catch {
    /* an unencodable URL just skips the picture */
  }
  const urlBox = el('div');
  urlBox.appendChild(el('div', '', 'Scan with another phone or iPad to open the game there:'));
  urlBox.appendChild(el('div', 'qr__url', url));
  qrRow.appendChild(urlBox);
  const build = el('div', 'build', `Build ${app.version ?? '—'}`);
  wrap.appendChild(panel('Offline and install', status, updateBtn, install, qrRow, build));

  wrap.appendChild(
    button('btn btn--coral btn--big', 'Done', () => {
      app.sfx.play('tap');
      app.home();
    }, { emoji: '✓' }),
  );
  root.appendChild(wrap);

  return () => {
    unsubscribe();
  };
}
