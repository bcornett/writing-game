/**
 * Confetti, on a full-screen canvas that stays out of the way until asked.
 */

const COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#8338ec', '#ff9f1c', '#ff85c8'];

export function createConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  let pieces = [];
  let raf = 0;

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener('resize', resize);
  resize();

  const frame = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const now = performance.now();
    pieces = pieces.filter((p) => now < p.dies);
    for (const p of pieces) {
      p.vy += 0.18;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      p.vx *= 0.99;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, (p.dies - now) / 400);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
    if (pieces.length) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      canvas.classList.remove('is-active');
    }
  };

  return {
    /** Fire a burst from a point (CSS pixels); defaults to the middle of the screen. */
    burst({ x = window.innerWidth / 2, y = window.innerHeight * 0.4, count = 90, spread = 9 } = {}) {
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * spread;
        pieces.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.3,
          size: 6 + Math.random() * 8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: Math.random() < 0.4 ? 'circle' : 'rect',
          dies: now + 1400 + Math.random() * 900,
        });
      }
      canvas.classList.add('is-active');
      if (!raf) raf = requestAnimationFrame(frame);
    },
    /** A gentle rain from the top, for the big celebrations. */
    rain({ count = 140 } = {}) {
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        pieces.push({
          x: Math.random() * window.innerWidth,
          y: -20 - Math.random() * 200,
          vx: (Math.random() - 0.5) * 2,
          vy: 1 + Math.random() * 3,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.2,
          size: 7 + Math.random() * 9,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: Math.random() < 0.4 ? 'circle' : 'rect',
          dies: now + 2200 + Math.random() * 1500,
        });
      }
      canvas.classList.add('is-active');
      if (!raf) raf = requestAnimationFrame(frame);
    },
  };
}
