/* ══ ORBIT RECAP ══
   End-of-day constellation: a 24h dial sweeps the day, stars pop where
   tasks were completed, then connect into a constellation (peak-end rule —
   the day is remembered by its sky, not its backlog).
   Open via command palette ("orbit complete") or auto once per evening. */

let _orRaf = null;

function _orStarAngle(task) {
  // Angle on the 24h dial (0h at top, clockwise). Best source wins:
  // doneAt timestamp → linked calEvent start → seeded pseudo-time (9:00–21:00).
  if (task.doneAt) {
    const d = new Date(task.doneAt);
    if (!isNaN(d)) return ((d.getHours() * 60 + d.getMinutes()) / 1440) * Math.PI * 2 - Math.PI / 2;
  }
  const ev = task.calEventId ? CAL_EVENTS.find(e => e.id === task.calEventId) : null;
  if (ev?.startTime) {
    const [h, m] = ev.startTime.split(':').map(Number);
    return ((h * 60 + m) / 1440) * Math.PI * 2 - Math.PI / 2;
  }
  let hash = 0;
  for (const ch of String(task.id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const mins = 540 + (hash % 720); // 9:00–21:00
  return (mins / 1440) * Math.PI * 2 - Math.PI / 2;
}

function openOrbitRecap() {
  if (document.getElementById('orbit-recap')) return;
  const today = localDateStr(new Date());
  const doneToday = TASKS.filter(t => t.done && t.doneDate === today);
  const focusSecs = doneToday.reduce((s, t) =>
    s + (t.sessionTimeSecs || 0) + (t.timeSpentSeconds || 0) + ((t.timeSpentMinutes || 0) * 60), 0);
  const focusStr = focusSecs >= 3600
    ? (focusSecs / 3600).toFixed(1).replace(/\.0$/, '') + ' focus hours'
    : focusSecs > 0 ? Math.round(focusSecs / 60) + ' focus minutes' : null;

  const overlay = document.createElement('div');
  overlay.id = 'orbit-recap';
  overlay.innerHTML = `
    <canvas id="orbit-recap-cvs" width="520" height="520" aria-label="Today as a constellation"></canvas>
    <div class="orbit-recap-line" id="orbit-recap-line"></div>
    <div class="orbit-recap-hint">click anywhere to return to the present</div>`;
  overlay.addEventListener('click', closeOrbitRecap);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  const cvs = document.getElementById('orbit-recap-cvs');
  const ctx = cvs.getContext('2d');
  const W = 520, H = 520, cx = W / 2, cy = H / 2, R = 190;
  const now = new Date();
  const nowAng = ((now.getHours() * 60 + now.getMinutes()) / 1440) * Math.PI * 2 - Math.PI / 2;

  const stars = doneToday
    .map(t => ({ ang: _orStarAngle(t), title: t.title }))
    .sort((a, b) => a.ang - b.ang)
    .map(s => ({ ...s, r: R * (0.55 + 0.35 * Math.abs(Math.sin(s.ang * 7))) }));

  const t0 = performance.now();
  const SWEEP_MS = 1600, LINK_MS = 900;

  function frame() {
    const t = performance.now() - t0;
    ctx.clearRect(0, 0, W, H);

    // Dial
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    for (let h = 0; h < 24; h += 3) {
      const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = "300 10px 'DM Mono',monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(h), cx + (R + 18) * Math.cos(a), cy + (R + 18) * Math.sin(a));
    }

    // Sweep from midnight to now
    const sweepP = Math.min(1, t / SWEEP_MS);
    const eased = 1 - Math.pow(1 - sweepP, 3);
    const sweepAng = -Math.PI / 2 + eased * (nowAng + Math.PI / 2 + (nowAng < -Math.PI / 2 ? Math.PI * 2 : 0));
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, sweepAng); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(sweepAng), cy + R * Math.sin(sweepAng)); ctx.stroke();

    // Stars pop as the sweep passes them
    const visible = stars.filter(s => {
      const norm = (s.ang + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      const swept = (sweepAng + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2.0001);
      return norm <= swept || sweepP >= 1;
    });
    // Constellation lines after the sweep completes
    if (sweepP >= 1 && visible.length > 1) {
      const linkP = Math.min(1, (t - SWEEP_MS) / LINK_MS);
      const segs = (visible.length - 1) * linkP;
      ctx.strokeStyle = 'rgba(57,255,20,0.30)'; ctx.lineWidth = 0.7;
      for (let i = 0; i < Math.floor(segs); i++) {
        const a = visible[i], b = visible[i + 1];
        ctx.beginPath();
        ctx.moveTo(cx + a.r * Math.cos(a.ang), cy + a.r * Math.sin(a.ang));
        ctx.lineTo(cx + b.r * Math.cos(b.ang), cy + b.r * Math.sin(b.ang));
        ctx.stroke();
      }
    }
    visible.forEach(s => {
      const x = cx + s.r * Math.cos(s.ang), y = cy + s.r * Math.sin(s.ang);
      ctx.fillStyle = 'rgba(57,255,20,0.95)';
      ctx.shadowColor = 'rgba(57,255,20,0.8)'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Caption after the constellation forms
    if (t > SWEEP_MS + LINK_MS) {
      const line = document.getElementById('orbit-recap-line');
      if (line && !line.textContent) {
        const parts = [`${doneToday.length} task${doneToday.length === 1 ? '' : 's'}`];
        if (focusStr) parts.push(focusStr);
        line.textContent = doneToday.length
          ? parts.join(' · ') + ' · orbit complete.'
          : 'a quiet orbit. they happen.';
        line.classList.add('show');
      }
    }
    _orRaf = requestAnimationFrame(frame);
  }
  frame();
}

function closeOrbitRecap() {
  if (_orRaf) { cancelAnimationFrame(_orRaf); _orRaf = null; }
  const el = document.getElementById('orbit-recap');
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 350);
}

/* Palette entry + evening auto-open (once per day, only if something got done) */
if (typeof CMD_COMMANDS_BASE !== 'undefined') {
  CMD_COMMANDS_BASE.push({ label: 'Orbit complete — today\'s recap', icon: '✦', action: openOrbitRecap, keys: '' });
}

function _orMaybeAutoOpen() {
  if (new Date().getHours() < 21) return;
  const today = localDateStr(new Date());
  if (localStorage.getItem('cdx_recap_date') === today) return;
  if (!TASKS.some(t => t.done && t.doneDate === today)) return;
  if (document.querySelector('.overlay.open') || document.getElementById('orbit-recap')) return;
  localStorage.setItem('cdx_recap_date', today);
  openOrbitRecap();
}
setInterval(_orMaybeAutoOpen, 10 * 60 * 1000);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('orbit-recap')) closeOrbitRecap();
}, true);
