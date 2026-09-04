/**
 * One finger on an SVG, in the SVG's own coordinates.
 *
 * Pointer events cover touch, pencil and mouse alike. Only the first pointer
 * counts — a resting palm or a second finger is ignored rather than turned
 * into a second stroke — and the element captures the pointer so a stroke
 * that runs off the edge still ends cleanly.
 */

export function attachPointer(svg, { down, move, up } = {}) {
  let active = null;

  const toLocal = (event) => {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const sx = vb.width / rect.width;
    const sy = vb.height / rect.height;
    return [vb.x + (event.clientX - rect.left) * sx, vb.y + (event.clientY - rect.top) * sy];
  };

  const onDown = (event) => {
    if (active !== null) return;
    if (event.button !== undefined && event.button !== 0) return;
    active = event.pointerId;
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      /* not all browsers allow capture on SVG; events still arrive */
    }
    event.preventDefault();
    down?.(toLocal(event), event);
  };
  const onMove = (event) => {
    if (event.pointerId !== active) return;
    event.preventDefault();
    move?.(toLocal(event), event);
  };
  const onUp = (event) => {
    if (event.pointerId !== active) return;
    active = null;
    event.preventDefault();
    up?.(toLocal(event), event);
  };

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === active) onUp(event);
  });
  svg.style.touchAction = 'none';

  return () => {
    svg.removeEventListener('pointerdown', onDown);
    svg.removeEventListener('pointermove', onMove);
    svg.removeEventListener('pointerup', onUp);
    svg.removeEventListener('pointercancel', onUp);
  };
}
