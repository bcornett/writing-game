/** Tiny DOM helpers so the screens read like markup. */

export function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

export function button(className, label, onTap, { emoji = null } = {}) {
  const b = el('button', className);
  b.type = 'button';
  if (emoji) {
    const e = el('span', 'btn__emoji', emoji);
    e.setAttribute('aria-hidden', 'true');
    b.appendChild(e);
  }
  b.appendChild(document.createTextNode(label));
  if (onTap) b.addEventListener('click', onTap);
  return b;
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pick one of several praise lines so Dot doesn't repeat herself. */
export function pickOne(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Three stars, lit one at a time. */
export function starRow(count, delayMs = 250) {
  const row = el('div', 'result__stars');
  for (let i = 0; i < 3; i++) {
    const s = el('span', 'result__star', '⭐');
    row.appendChild(s);
    if (i < count) setTimeout(() => s.classList.add('is-lit'), 200 + i * delayMs);
  }
  return row;
}
