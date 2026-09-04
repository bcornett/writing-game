/**
 * Dot, the mascot: a round coral face who shows the way, cheers, and says
 * "oops" with her whole body. Pure SVG + CSS classes; no images.
 */

import { svgEl } from './glyphSvg.js';

const MOUTHS = {
  happy: 'M-13,6 Q0,20 13,6',
  excited: 'M-14,4 Q0,26 14,4 Z',
  oops: 'M-5,10 a5,6 0 1,0 10,0 a5,6 0 1,0 -10,0',
  think: 'M-9,10 Q0,13 9,10',
};

/**
 * @param {object} [options]
 * @param {number} [options.size] CSS size in px
 * @returns {{ el: SVGElement, setMood(mood: string): void, lookAt(x: number, y: number): void, cheer(): void, wobble(): void, idle(): void }}
 */
export function createDot({ size = 96, className = '' } = {}) {
  const svg = svgEl('svg', { viewBox: '-40 -40 80 80', class: `dot ${className}`.trim(), width: size, height: size, 'aria-hidden': 'true' });
  const defs = svgEl('defs');
  const grad = svgEl('radialGradient', { id: `dot-grad-${Math.random().toString(36).slice(2, 8)}`, cx: '38%', cy: '32%', r: '75%' });
  grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#ff9a8a' }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#e84f5c' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  const body = svgEl('g', { class: 'dot__body' });
  body.appendChild(svgEl('circle', { r: 34, fill: `url(#${grad.id})` }));
  body.appendChild(svgEl('ellipse', { cx: -19, cy: 9, rx: 6, ry: 4, fill: '#ff8aa0', opacity: 0.7 }));
  body.appendChild(svgEl('ellipse', { cx: 19, cy: 9, rx: 6, ry: 4, fill: '#ff8aa0', opacity: 0.7 }));

  const eyes = [];
  for (const ex of [-12, 12]) {
    const eye = svgEl('g', { transform: `translate(${ex},-6)` });
    eye.appendChild(svgEl('circle', { r: 7.5, fill: '#fff' }));
    const pupil = svgEl('circle', { r: 4.2, fill: '#2a2640', class: 'dot__pupil' });
    const shine = svgEl('circle', { cx: 1.6, cy: -1.6, r: 1.4, fill: '#fff' });
    eye.appendChild(pupil);
    eye.appendChild(shine);
    body.appendChild(eye);
    eyes.push({ pupil, shine });
  }
  const lids = svgEl('g', { class: 'dot__lids' });
  for (const ex of [-12, 12]) lids.appendChild(svgEl('rect', { x: ex - 8.5, y: -15, width: 17, height: 9, rx: 4, fill: '#e84f5c', class: 'dot__lid' }));
  body.appendChild(lids);

  const mouth = svgEl('path', { d: MOUTHS.happy, fill: 'none', stroke: '#7a1f33', 'stroke-width': 3.2, 'stroke-linecap': 'round', class: 'dot__mouth' });
  body.appendChild(mouth);
  svg.appendChild(body);

  let mood = 'happy';
  let animTimer = 0;

  const setMood = (m) => {
    mood = MOUTHS[m] ? m : 'happy';
    mouth.setAttribute('d', MOUTHS[mood]);
    mouth.setAttribute('fill', mood === 'excited' ? '#7a1f33' : mood === 'oops' ? '#7a1f33' : 'none');
    svg.dataset.mood = mood;
  };

  /** Point the pupils toward a direction (-1..1 on each axis). */
  const lookAt = (x, y) => {
    const dx = Math.max(-1, Math.min(1, x)) * 2.6;
    const dy = Math.max(-1, Math.min(1, y)) * 2.2;
    for (const { pupil, shine } of eyes) {
      pupil.setAttribute('cx', dx.toFixed(2));
      pupil.setAttribute('cy', dy.toFixed(2));
      shine.setAttribute('cx', (dx + 1.6).toFixed(2));
      shine.setAttribute('cy', (dy - 1.6).toFixed(2));
    }
  };

  const animate = (cls, ms) => {
    clearTimeout(animTimer);
    svg.classList.remove('dot--cheer', 'dot--wobble', 'dot--nod');
    // Reflow so the same animation can restart.
    void svg.getBoundingClientRect();
    svg.classList.add(cls);
    animTimer = setTimeout(() => svg.classList.remove(cls), ms);
  };

  return {
    el: svg,
    get mood() {
      return mood;
    },
    setMood,
    lookAt,
    cheer() {
      setMood('excited');
      animate('dot--cheer', 900);
    },
    wobble() {
      setMood('oops');
      animate('dot--wobble', 700);
    },
    nod() {
      animate('dot--nod', 600);
    },
    idle() {
      setMood('happy');
      lookAt(0, 0);
    },
  };
}

/**
 * A tiny Dot for inside an SVG: the marker that runs along the road while
 * tracing. Returns a <g>; move it with `moveTo(x, y)`.
 */
export function createMiniDot() {
  const g = svgEl('g', { class: 'mini-dot' });
  g.appendChild(svgEl('circle', { r: 6.2, fill: '#ff6b6b', stroke: '#fff', 'stroke-width': 1.2 }));
  for (const ex of [-2.2, 2.2]) {
    g.appendChild(svgEl('circle', { cx: ex, cy: -1.2, r: 1.5, fill: '#fff' }));
    g.appendChild(svgEl('circle', { cx: ex + 0.3, cy: -1.1, r: 0.8, fill: '#2a2640' }));
  }
  g.appendChild(svgEl('path', { d: 'M-2.2,1.8 Q0,3.8 2.2,1.8', fill: 'none', stroke: '#7a1f33', 'stroke-width': 0.9, 'stroke-linecap': 'round' }));
  return {
    el: g,
    moveTo(x, y) {
      g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
    },
    show(on) {
      g.style.display = on ? '' : 'none';
    },
  };
}
