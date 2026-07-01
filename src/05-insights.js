/* ══ INSIGHTS — RENDER ══ */
// → future file: cosmodex-insights.js
function _insFmtHrs(s) { return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s/60)}m` : `${(s/3600).toFixed(1)}h`; }

function _insDrawSparkline(canvasId, data, color) {
  const cvs = document.getElementById(canvasId); if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || 200, H = cvs.clientHeight || 60;
  cvs.width = W * dpr; cvs.height = H * dpr;
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!data.length) return;
  const max = Math.max(...data, 1), pad = 8;
  const stepX = (W - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => [pad + i * stepX, H - pad - (v / max) * (H - pad * 2)]);
  // Fill area
  ctx.beginPath(); ctx.moveTo(pts[0][0], H);
  pts.forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(pts[pts.length - 1][0], H); ctx.closePath();
  ctx.fillStyle = color.replace(')', ',0.08)').replace('rgb', 'rgba');
  ctx.fill();
  // Stroke line
  ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  // Glow dot on last point
  const last = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(last[0], last[1], 4, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
}

function _insDrawRings(canvasId, rings) {
  // rings = [{ label, pct, color, max }] — up to 3
  const cvs = document.getElementById(canvasId); if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || 260, H = cvs.clientHeight || 260;
  cvs.width = W * dpr; cvs.height = H * dpr;
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const startAngle = -Math.PI / 2; // 12 o'clock
  const ringWidth = 14, gap = 6;
  rings.forEach((ring, i) => {
    const r = (W / 2) - 20 - i * (ringWidth + gap);
    const pct = Math.min(ring.pct / (ring.max || 100), 1);
    const endAngle = startAngle + pct * Math.PI * 2;
    // Track (background)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = ringWidth; ctx.lineCap = 'round'; ctx.stroke();
    // Fill arc
    if (pct > 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = ring.color; ctx.lineWidth = ringWidth; ctx.lineCap = 'round';
      ctx.shadowColor = ring.color; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
    }
    // Percentage text at end of arc
    if (pct > 0.05) {
      const labelAngle = endAngle;
      const lx = cx + (r) * Math.cos(labelAngle);
      const ly = cy + (r) * Math.sin(labelAngle);
      ctx.font = "500 9px 'DM Mono',monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = ring.color; ctx.shadowColor = ring.color; ctx.shadowBlur = 6;
      ctx.fillText(Math.round(ring.pct) + '%', lx, ly);
      ctx.shadowBlur = 0;
    }
  });
  // Center text
  ctx.font = "300 11px 'DM Mono',monospace";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('THIS WEEK', cx, cy);
  // Legend
  const legendEl = document.getElementById('ins-rings-legend');
  if (legendEl) {
    legendEl.innerHTML = rings.map(r =>
      `<div style="display:flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:9px;color:var(--muted);letter-spacing:0.04em">` +
      `<span style="width:8px;height:8px;border-radius:50%;background:${r.color};box-shadow:0 0 6px ${r.color}60"></span>${r.label}</div>`
    ).join('');
  }
}

/* ── Insights creative visualizations ── */
let _insHeroBgParticles = null;
let _insHeroBgLoop = null;
function _insSetupCanvas(cvs) {
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || cvs.width || 300;
  const H = cvs.clientHeight || cvs.height || 200;
  cvs.width = W * dpr; cvs.height = H * dpr;
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  const ctx = cvs.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  return { ctx, W, H };
}

function _insDrawHeroBg(canvasId) {
  const cvs = document.getElementById(canvasId); if (!cvs) return;
  const { ctx, W, H } = _insSetupCanvas(cvs);
  if (!_insHeroBgParticles || _insHeroBgParticles.length === 0 || _insHeroBgParticles._w !== W) {
    _insHeroBgParticles = [];
    _insHeroBgParticles._w = W;
    for (let i = 0; i < 32; i++) {
      _insHeroBgParticles.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.6 + Math.random() * 1.4,
        a: 0.05 + Math.random() * 0.12,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.08,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }
  const draw = () => {
    if (!document.getElementById(canvasId) || cvs.offsetParent === null) {
      _insHeroBgLoop = null; return;
    }
    ctx.clearRect(0, 0, W, H);
    // Dashed radial ring near left third (where score sits)
    const cx = W * 0.18, cy = H / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.arc(cx, cy, 92, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 128, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // Particles with subtle twinkle
    _insHeroBgParticles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.tw += 0.015;
      if (p.x < -5) p.x = W + 5; if (p.x > W + 5) p.x = -5;
      if (p.y < -5) p.y = H + 5; if (p.y > H + 5) p.y = -5;
      const tw = 0.7 + 0.3 * Math.sin(p.tw);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(p.a * tw).toFixed(3)})`;
      ctx.fill();
    });
    _insHeroBgLoop = requestAnimationFrame(draw);
  };
  if (_insHeroBgLoop) cancelAnimationFrame(_insHeroBgLoop);
  draw();
}

function _insDrawHeroConst(canvasId, dayData) {
  // dayData: array of { date, tasks, secs } for last 14 days (oldest first)
  const cvs = document.getElementById(canvasId); if (!cvs) return;
  const { ctx, W, H } = _insSetupCanvas(cvs);
  if (!dayData || !dayData.length) return;
  const maxTasks = Math.max(...dayData.map(d => d.tasks), 1);
  const maxSecs = Math.max(...dayData.map(d => d.secs), 1);
  const padX = 20, padY = 30;
  const plotW = W - padX * 2;
  const stepX = plotW / (dayData.length - 1 || 1);
  // Compute dot positions on a gentle arc (sin curve) plus value-driven Y
  const pts = dayData.map((d, i) => {
    const x = padX + i * stepX;
    const arcY = H * 0.55 + Math.sin((i / (dayData.length - 1)) * Math.PI) * -8;
    const valY = arcY - (d.tasks / maxTasks) * (H * 0.3);
    return { x, y: valY, d };
  });
  // Faint connecting curve
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else {
      const prev = pts[i - 1];
      const cx = (prev.x + p.x) / 2;
      ctx.quadraticCurveTo(cx, prev.y, p.x, p.y);
    }
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1; ctx.stroke();
  // Draw dots
  pts.forEach((p, i) => {
    const d = p.d;
    const size = 1.5 + (d.tasks / maxTasks) * 5;
    const brightness = 0.3 + (d.secs / maxSecs) * 0.65;
    const isToday = i === pts.length - 1;
    const isHot = d.tasks >= 5;
    const col = isHot ? `rgba(53,249,47,${brightness.toFixed(2)})` : `rgba(255,255,255,${brightness.toFixed(2)})`;
    const glow = isHot ? 'rgba(53,249,47,0.5)' : 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(p.x, p.y, isToday ? size + 1.5 : size, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.shadowColor = glow; ctx.shadowBlur = isToday ? 14 : 8;
    ctx.fill(); ctx.shadowBlur = 0;
    if (isToday) {
      // Outer pulse ring on today
      ctx.beginPath(); ctx.arc(p.x, p.y, size + 5, 0, Math.PI * 2);
      ctx.strokeStyle = isHot ? 'rgba(53,249,47,0.35)' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.8; ctx.stroke();
    }
  });
  // Axis labels: 14d ago -> today
  ctx.font = "300 8px 'DM Mono',monospace";
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillText('14d ago', padX, H - 6);
  ctx.textAlign = 'right';
  ctx.fillText('today', W - padX, H - 6);
}

function _insDrawPulseHeatmap(canvasId, data) {
  // data: array of 84 { date, count, secs } (oldest first)
  const cvs = document.getElementById(canvasId); if (!cvs) return;
  const { ctx, W, H } = _insSetupCanvas(cvs);
  if (!data || data.length === 0) return;
  const cols = 12, rows = 7;
  const gap = 3;
  const leftPad = 28, topPad = 20, rightPad = 10, botPad = 16;
  const plotW = W - leftPad - rightPad;
  const plotH = H - topPad - botPad;
  const cellW = (plotW - gap * (cols - 1)) / cols;
  const cellH = (plotH - gap * (rows - 1)) / rows;
  const size = Math.min(cellW, cellH);
  // Row labels (day of week)
  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
  ctx.font = "300 8px 'DM Mono',monospace";
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let r = 0; r < rows; r++) {
    if (!dayLabels[r]) continue;
    ctx.fillText(dayLabels[r], leftPad - 6, topPad + r * (size + gap) + size / 2);
  }
  // Cells — data[0] = 84 days ago, data[83] = today
  // Build grid: col 0 = oldest week, col 11 = current week
  // Each column is 7 days (Mon-Sun). Today's day-of-week determines where "today" sits.
  const todayDow = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
  // Pad the data forward so today lands at col=11, row=todayDow
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // Reverse-compute how many days back from today
      const daysBack = (cols - 1 - c) * 7 + (todayDow - r);
      const x = leftPad + c * (size + gap);
      const y = topPad + r * (size + gap);
      if (daysBack < 0 || daysBack >= data.length) {
        // empty cell
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x, y, size, size);
        continue;
      }
      const d = data[data.length - 1 - daysBack];
      const count = d ? d.count : 0;
      let bg;
      if (count === 0) bg = 'rgba(255,255,255,0.04)';
      else if (count < 2) bg = 'rgba(255,255,255,0.14)';
      else if (count < 4) bg = 'rgba(255,255,255,0.26)';
      else if (count < 5) bg = 'rgba(255,255,255,0.42)';
      else bg = 'rgb(53,249,47)';
      ctx.fillStyle = bg;
      // Rounded rect
      const rad = 2;
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + size, y, x + size, y + size, rad);
      ctx.arcTo(x + size, y + size, x, y + size, rad);
      ctx.arcTo(x, y + size, x, y, rad);
      ctx.arcTo(x, y, x + size, y, rad);
      ctx.closePath();
      ctx.fill();
      if (count >= 5) {
        ctx.shadowColor = 'rgba(53,249,47,0.5)'; ctx.shadowBlur = 6;
        ctx.fill(); ctx.shadowBlur = 0;
      }
    }
  }
  // Legend at bottom
  const legY = H - 6;
  ctx.font = "300 8px 'DM Mono',monospace";
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('less', leftPad, legY);
  const legStart = leftPad + 28;
  const legCells = ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.26)', 'rgba(255,255,255,0.42)', 'rgb(53,249,47)'];
  legCells.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(legStart + i * 10, legY - 8, 8, 8);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'left';
  ctx.fillText('more', legStart + legCells.length * 10 + 4, legY);
}

function _insDrawEnergyMatrix(canvasId, catData) {
  // catData: [{ cat, label, color, avgPrio, avgEnergy, totalSecs }]
  const cvs = document.getElementById(canvasId); if (!cvs) return;
  const { ctx, W, H } = _insSetupCanvas(cvs);
  const padL = 50, padR = 30, padT = 20, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  // Grid background
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
    const x = padL + (i / 4) * plotW;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
  }
  // Center crosshair (divides 4 quadrants)
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  const midX = padL + plotW / 2, midY = padT + plotH / 2;
  ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(padL + plotW, midY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(midX, padT); ctx.lineTo(midX, padT + plotH); ctx.stroke();
  ctx.setLineDash([]);
  // Quadrant labels
  ctx.font = "300 9px 'DM Mono',monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillText('DEEP WORK', padL + plotW - 4, padT + 4);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillText('HARD SLOG', padL + 4, padT + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.textBaseline = 'bottom';
  ctx.fillText('BUSYWORK', padL + 4, padT + plotH - 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillText('QUICK WINS', padL + plotW - 4, padT + plotH - 4);
  // Axis labels
  ctx.font = "300 9px 'DM Mono',monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('← LOW  PRIORITY  HIGH →', padL + plotW / 2, padT + plotH + 8);
  ctx.save();
  ctx.translate(padL - 16, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('← QUICK  ENERGY  DEEP →', 0, 0);
  ctx.restore();
  // Bubbles
  if (!catData || !catData.length) return;
  const maxSecs = Math.max(...catData.map(c => c.totalSecs), 1);
  catData.forEach(c => {
    // x: priority 1..3 -> 0..1, y: energy 1..3 -> 1..0 (deep at top)
    const x = padL + ((c.avgPrio - 1) / 2) * plotW;
    const y = padT + (1 - (c.avgEnergy - 1) / 2) * plotH;
    const r = 8 + Math.sqrt(c.totalSecs / maxSecs) * 32;
    const color = c.color || 'rgba(255,255,255,0.5)';
    // Fill
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color + '24'; // append low alpha (hex)
    // Fallback: use globalAlpha instead
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();
    // Stroke
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.stroke(); ctx.shadowBlur = 0;
    // Label inside bubble
    ctx.font = "400 10px 'Instrument Sans',sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(c.label, x, y);
  });
}

function _insDrawDayRhythm(canvasId, hoursThis, hoursPrev) {
  // hoursThis, hoursPrev: arrays of 24 values (tasks per hour)
  const cvs = document.getElementById(canvasId); if (!cvs) return;
  const { ctx, W, H } = _insSetupCanvas(cvs);
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 30;
  const innerR = 40;
  const maxV = Math.max(...hoursThis, ...hoursPrev, 1);
  // Background rings
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const r = innerR + (outerR - innerR) * (i / 3);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  // Radial spokes every 3 hours
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.setLineDash([2, 4]);
  for (let h = 0; h < 24; h += 3) {
    const ang = (h / 24) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
    ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Draw bars
  const drawBars = (data, color, alpha) => {
    for (let h = 0; h < 24; h++) {
      if (data[h] <= 0) continue;
      const ang = ((h + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
      const barLen = (data[h] / maxV) * (outerR - innerR);
      const r1 = innerR;
      const r2 = innerR + barLen;
      const barW = 10;
      const sin = Math.sin(ang), cos = Math.cos(ang);
      const perpX = -sin * barW / 2, perpY = cos * barW / 2;
      ctx.beginPath();
      ctx.moveTo(cx + cos * r1 - perpX, cy + sin * r1 - perpY);
      ctx.lineTo(cx + cos * r2 - perpX, cy + sin * r2 - perpY);
      ctx.lineTo(cx + cos * r2 + perpX, cy + sin * r2 + perpY);
      ctx.lineTo(cx + cos * r1 + perpX, cy + sin * r1 + perpY);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  };
  // Last week in white (behind)
  drawBars(hoursPrev, 'rgba(255,255,255,0.35)', 1);
  // This week in green (front)
  const weekAvg = hoursThis.reduce((a, b) => a + b, 0) / 7;
  const useGreen = weekAvg >= 5;
  drawBars(hoursThis, useGreen ? 'rgb(53,249,47)' : 'rgba(255,255,255,0.75)', 1);
  // Hour labels at cardinals
  ctx.font = "300 9px 'DM Mono',monospace";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  const cardinals = [[0, '00'], [6, '06'], [12, '12'], [18, '18']];
  cardinals.forEach(([h, lbl]) => {
    const ang = (h / 24) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(ang) * (outerR + 14);
    const y = cy + Math.sin(ang) * (outerR + 14);
    ctx.fillText(lbl, x, y);
  });
  // Peak hour text in center
  let peakH = 0, peakV = 0;
  hoursThis.forEach((v, h) => { if (v > peakV) { peakV = v; peakH = h; } });
  ctx.font = "300 9px 'DM Mono',monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PEAK', cx, cy - 10);
  ctx.font = "300 16px 'Fraunces',serif";
  ctx.fillStyle = useGreen && peakV > 0 ? 'rgb(53,249,47)' : 'rgba(255,255,255,0.85)';
  ctx.fillText(peakV > 0 ? String(peakH).padStart(2, '0') + ':00' : '—', cx, cy + 6);
  ctx.font = "300 9px 'DM Mono',monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(peakV > 0 ? `${peakV} tasks` : '', cx, cy + 22);
}

function _insDrawTrend(canvasId, data, labels, color) {
  color = color || 'rgba(255,255,255,0.5)';
  const cvs = document.getElementById(canvasId); if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || 600, H = cvs.clientHeight || 180;
  cvs.width = W * dpr; cvs.height = H * dpr;
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const max = Math.max(...data, 1), padL = 4, padR = 4, padT = 10, padB = 20;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const stepX = plotW / Math.max(data.length - 1, 1);
  // Gridlines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = padT + (g / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  }
  const pts = data.map((v, i) => [padL + i * stepX, padT + plotH - (v / max) * plotH]);
  // Fill — derive a semi-transparent version of the color
  ctx.beginPath(); ctx.moveTo(pts[0][0], padT + plotH);
  pts.forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(pts[pts.length - 1][0], padT + plotH); ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  const fillColor = color.includes('53,249,47') ? 'rgba(53,249,47,' : 'rgba(255,255,255,';
  grad.addColorStop(0, fillColor + '0.10)'); grad.addColorStop(1, fillColor + '0.01)');
  ctx.fillStyle = grad; ctx.fill();
  // Stroke
  ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  const glowColor = color.includes('53,249,47') ? 'rgba(53,249,47,0.4)' : 'rgba(255,255,255,0.15)';
  ctx.shadowColor = glowColor; ctx.shadowBlur = 4; ctx.stroke(); ctx.shadowBlur = 0;
  // Dot on today
  const last = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(last[0], last[1], 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.shadowColor = glowColor; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
  // X-axis labels (every 7th day)
  ctx.font = "300 9px 'DM Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  labels.forEach((lbl, i) => { if (lbl) ctx.fillText(lbl, pts[i][0], padT + plotH + 4); });
  // White vertical bars for each data point (subtle pulse effect)
  pts.forEach((p, i) => {
    if (data[i] > 0) {
      ctx.beginPath(); ctx.moveTo(p[0], padT + plotH); ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 3; ctx.stroke();
    }
  });
}

function renderInsights() {
  const logs = _habitLogs, habits = _habits;
  const today = localDateStr(new Date());
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  // Defer canvas drawing if panel not visible (clientWidth=0)
  const panelVisible = document.getElementById('panel-insights')?.offsetParent !== null;

  // ── Hero: Ambient Constellation ───────────────────────
  const momentum = typeof computeMomentumScore === 'function' ? computeMomentumScore() : { score: 0, habitPts: 0, taskPts: 0, overduePenalty: 0 };
  setEl('ins-hero-score', momentum.score);
  const scoreEl = document.getElementById('ins-hero-score');
  if (scoreEl) {
    scoreEl.classList.toggle('green', momentum.score >= 50);
  }
  // 14-day dot data for constellation
  const constData = [];
  for (let i = 13; i >= 0; i--) {
    const ds = localDateStr(new Date(Date.now() - i * 86400000));
    const dayTasks = TASKS.filter(t => t.done && t.doneDate === ds);
    const secs = dayTasks.reduce((s, t) => s + (t.sessionTimeSecs || 0) + (t.timeSpentSeconds || 0), 0);
    constData.push({ date: ds, tasks: dayTasks.length, secs });
  }
  if (panelVisible) {
    _insDrawHeroBg('ins-hero-bg');
    _insDrawHeroConst('ins-hero-const', constData);
  }
  // Mini-gauges in hero right zone
  const gaugesEl = document.getElementById('ins-hero-gauges');
  if (gaugesEl) {
    const tasksDoneToday = TASKS.filter(t => t.done && t.doneDate === today).length;
    const habitPct = momentum.habitPts;  // 0-50
    const taskTodayPct = Math.min(100, tasksDoneToday * 20); // 5 tasks = 100%
    const overdueRaw = momentum.overduePenalty; // 0-20
    const habitGreen = habitPct >= 35;
    const taskGreen = tasksDoneToday >= 5;
    gaugesEl.innerHTML = `
      <div class="ins-hero-gauge">
        <span class="ins-hero-gauge-label">Habits</span>
        <div class="ins-hero-gauge-bar"><div class="ins-hero-gauge-fill" style="width:${Math.round(habitPct * 2)}%;background:${habitGreen ? 'rgb(53,249,47)' : 'rgba(255,255,255,0.5)'};box-shadow:${habitGreen ? '0 0 6px rgba(53,249,47,0.4)' : 'none'}"></div></div>
        <span class="ins-hero-gauge-val">${momentum.habitPts}</span>
      </div>
      <div class="ins-hero-gauge">
        <span class="ins-hero-gauge-label">Tasks</span>
        <div class="ins-hero-gauge-bar"><div class="ins-hero-gauge-fill" style="width:${taskTodayPct}%;background:${taskGreen ? 'rgb(53,249,47)' : 'rgba(255,255,255,0.5)'};box-shadow:${taskGreen ? '0 0 6px rgba(53,249,47,0.4)' : 'none'}"></div></div>
        <span class="ins-hero-gauge-val">${tasksDoneToday}</span>
      </div>
      <div class="ins-hero-gauge">
        <span class="ins-hero-gauge-label">Overdue</span>
        <div class="ins-hero-gauge-bar"><div class="ins-hero-gauge-fill" style="width:${Math.min(100, overdueRaw * 5)}%;background:rgba(255,255,255,0.35)"></div></div>
        <span class="ins-hero-gauge-val">-${momentum.overduePenalty}</span>
      </div>`;
  }
  // Delta badge (week-over-week tasks)
  const deltaEl = document.getElementById('ins-hero-delta');
  if (deltaEl) {
    const thisWeek = constData.slice(-7).reduce((s, d) => s + d.tasks, 0);
    const prevWeek = constData.slice(0, 7).reduce((s, d) => s + d.tasks, 0);
    const diff = thisWeek - prevWeek;
    deltaEl.textContent = diff > 0 ? `▲ ${diff} more vs last week` : diff < 0 ? `▼ ${Math.abs(diff)} fewer vs last week` : 'Same as last week';
    deltaEl.classList.toggle('up', diff > 0);
  }

  // ── Focus Time ────────────────────────────────────────
  const focusThreshold = 4 * 3600; // 4h = neon green threshold
  const weekAgo = localDateStr(new Date(Date.now() - 6 * 86400000));
  let weekSecs = 0, pomoSecs = 0, commitSecs = 0;
  const byCat = {};
  TASKS.forEach(task => {
    const pomo = task.sessionTimeSecs || 0, commit = task.timeSpentSeconds || 0;
    const taskSecs = pomo + commit;
    if (taskSecs <= 0) return;
    pomoSecs += pomo; commitSecs += commit;
    const dd = task.doneDate || task.dueDate || '';
    if (dd >= weekAgo) weekSecs += taskSecs;
    const cat = task.category || 'uncategorised';
    byCat[cat] = (byCat[cat] || 0) + taskSecs;
  });
  CAL_EVENTS.forEach(ev => {
    if (ev.allDay || !ev.duration) return;
    const lt = ev.taskId ? TASKS.find(t => t.id === ev.taskId) : null;
    if (lt && (lt.sessionTimeSecs || lt.timeSpentSeconds)) return;
    const secs = (ev.duration || 0) * 60;
    if (ev.date >= weekAgo) weekSecs += secs;
    const cat = (lt?.category) || 'scheduled';
    byCat[cat] = (byCat[cat] || 0) + secs;
  });
  setEl('ins-focus-time', weekSecs > 0 ? _insFmtHrs(weekSecs) : '—');
  const focusBar = document.getElementById('ins-focus-bar');
  if (focusBar) {
    focusBar.style.width = Math.min(100, Math.round(weekSecs / (8 * 3600) * 100)) + '%';
    focusBar.style.background = weekSecs >= focusThreshold ? 'rgb(53,249,47)' : 'rgba(255,255,255,0.5)';
    focusBar.style.boxShadow = weekSecs >= focusThreshold ? '0 0 8px rgba(53,249,47,0.3)' : 'none';
  }
  const focusSub = document.getElementById('ins-focus-sub');
  if (focusSub) focusSub.textContent = `Pomo ${_insFmtHrs(pomoSecs)} · Commit ${_insFmtHrs(commitSecs)}`;

  // ── Habit Rate (7-day) ────────────────────────────────
  const last7 = []; let h7Done = 0, h7Total = 0;
  for (let i = 6; i >= 0; i--) {
    const ds = localDateStr(new Date(Date.now() - i * 86400000));
    const log = logs[ds];
    const cnt = log ? Object.values(log.completions || {}).filter(Boolean).length : 0;
    const possible = habits.length;
    h7Done += cnt; h7Total += possible;
    last7.push(possible > 0 ? cnt >= possible : false);
  }
  const h7Pct = h7Total > 0 ? Math.round(h7Done / h7Total * 100) : 0;
  setEl('ins-habit-rate', habits.length ? h7Pct + '%' : '—');
  const dotsEl = document.getElementById('ins-habit-dots');
  if (dotsEl) dotsEl.innerHTML = last7.map(ok => `<div class="ins-habit-dot ${ok ? 'filled' : ''}"></div>`).join('');
  const habitSub = document.getElementById('ins-habit-sub');
  if (habitSub) habitSub.textContent = habits.length ? `${h7Done}/${h7Total} completions` : 'No habits tracked';

  // ── Overdue ───────────────────────────────────────────
  const overdueTasks = TASKS.filter(t => !t.someday && !t.done && t.dueDate && t.dueDate < today);
  setEl('ins-overdue-count', overdueTasks.length);
  const overdueSub = document.getElementById('ins-overdue-sub');
  if (overdueSub) {
    if (overdueTasks.length) {
      const avgAge = Math.round(overdueTasks.reduce((s, t) => s + (Date.now() - new Date(t.dueDate + 'T00:00').getTime()) / 86400000, 0) / overdueTasks.length);
      overdueSub.textContent = `avg ${avgAge}d overdue`;
    } else { overdueSub.textContent = 'All clear'; overdueSub.style.color = 'rgba(53,249,47,0.6)'; }
  }

  // ── Tabbed Visualization: compute all 3 datasets ───────
  // 1. Pulse Heatmap data — last 84 days
  const pulseData = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = localDateStr(d);
    const dayTasks = TASKS.filter(t => t.done && t.doneDate === ds);
    const secs = dayTasks.reduce((s, t) => s + (t.sessionTimeSecs || 0) + (t.timeSpentSeconds || 0), 0);
    pulseData.push({ date: ds, count: dayTasks.length, secs });
  }
  // Compute streaks + best day
  let curStreak = 0, longestStreak = 0, tempStreak = 0;
  for (let i = pulseData.length - 1; i >= 0; i--) {
    if (pulseData[i].count > 0) { tempStreak++; if (curStreak === 0 || i === pulseData.length - 1 - (pulseData.length - 1 - i)) curStreak = tempStreak; }
    else break;
  }
  // Proper longest streak pass
  tempStreak = 0;
  for (const d of pulseData) {
    if (d.count > 0) { tempStreak++; if (tempStreak > longestStreak) longestStreak = tempStreak; }
    else tempStreak = 0;
  }
  // Best day of week (avg over period)
  const dowCounts = [0,0,0,0,0,0,0], dowTotals = [0,0,0,0,0,0,0];
  pulseData.forEach(d => {
    const dow = new Date(d.date + 'T00:00').getDay();
    dowCounts[dow] += d.count;
    dowTotals[dow] += 1;
  });
  const dowAvgs = dowCounts.map((c, i) => dowTotals[i] > 0 ? c / dowTotals[i] : 0);
  const bestDowIdx = dowAvgs.indexOf(Math.max(...dowAvgs));
  const dowNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const pulseStats = { curStreak, longestStreak, bestDow: dowNames[bestDowIdx], bestDowAvg: dowAvgs[bestDowIdx].toFixed(1) };

  // 2. Energy × Priority Matrix data — categories
  const catDataMap = {};
  const prioMap = { high: 3, med: 2, low: 1 };
  const energyMap = { deep: 3, shallow: 2, quick: 1, admin: 1.5 };
  TASKS.forEach(t => {
    if (!t.category) return;
    const pomo = t.sessionTimeSecs || 0, commit = t.timeSpentSeconds || 0;
    const secs = pomo + commit;
    if (secs <= 0) return;
    const cat = t.category;
    if (!catDataMap[cat]) catDataMap[cat] = { cat, label: CATEGORIES[cat]?.label || cat, color: getCatColor(cat), prioSum: 0, energySum: 0, count: 0, totalSecs: 0 };
    catDataMap[cat].prioSum += prioMap[t.priority] || 2;
    catDataMap[cat].energySum += energyMap[t.energyType] || 2;
    catDataMap[cat].count += 1;
    catDataMap[cat].totalSecs += secs;
  });
  const matrixData = Object.values(catDataMap).map(c => ({
    cat: c.cat, label: c.label, color: c.color,
    avgPrio: c.prioSum / c.count,
    avgEnergy: c.energySum / c.count,
    totalSecs: c.totalSecs,
  }));

  // 3. Day Rhythm data — this week vs last week by hour
  const thisWeekStart = new Date(Date.now() - 6 * 86400000);
  const prevWeekStart = new Date(Date.now() - 13 * 86400000);
  const prevWeekEnd = new Date(Date.now() - 7 * 86400000);
  const hoursThis = new Array(24).fill(0);
  const hoursPrev = new Array(24).fill(0);
  TASKS.filter(t => t.done && t.doneDate).forEach(t => {
    const d = new Date(t.doneDate + 'T00:00');
    let hour = 12; // default bucket if no event
    if (t.calEventId) {
      const ev = CAL_EVENTS.find(e => e.id === t.calEventId);
      if (ev?.startTime) hour = parseInt(ev.startTime.split(':')[0], 10);
    }
    if (d >= thisWeekStart) hoursThis[hour] += 1;
    else if (d >= prevWeekStart && d <= prevWeekEnd) hoursPrev[hour] += 1;
  });

  // Dispatch: draw the active viz
  const vizTab = window._insVizTab || 'pulse';
  const emptyEl = document.getElementById('ins-viz-empty');
  const statsEl = document.getElementById('ins-viz-stats');
  if (emptyEl) emptyEl.style.display = 'none';
  if (panelVisible) {
    if (vizTab === 'pulse') {
      _insDrawPulseHeatmap('ins-viz-canvas', pulseData);
      if (statsEl) statsEl.innerHTML = `
        <div class="ins-viz-stat">🔥 Current streak <span class="val ${curStreak > 0 ? 'green' : ''}">${curStreak}d</span></div>
        <div class="ins-viz-stat">⚡ Longest streak <span class="val">${longestStreak}d</span></div>
        <div class="ins-viz-stat">⭐ Best day <span class="val">${pulseStats.bestDow} · ${pulseStats.bestDowAvg} avg</span></div>
        <div class="ins-viz-stat">📈 84-day total <span class="val">${pulseData.reduce((s, d) => s + d.count, 0)} tasks</span></div>`;
    } else if (vizTab === 'matrix') {
      _insDrawEnergyMatrix('ins-viz-canvas', matrixData);
      if (statsEl) {
        if (matrixData.length) {
          statsEl.innerHTML = matrixData.sort((a, b) => b.totalSecs - a.totalSecs).slice(0, 6).map(c =>
            `<div class="ins-viz-stat"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c.color};margin-right:6px"></span>${c.label} <span class="val">${_insFmtHrs(c.totalSecs)}</span></div>`
          ).join('');
        } else {
          statsEl.innerHTML = '<div class="ins-viz-stat">Set priority and energy type on tasks to see your distribution</div>';
        }
      }
      if (!matrixData.length && emptyEl) {
        emptyEl.style.display = 'flex';
        emptyEl.textContent = 'Track priority and energy types on tasks to see your distribution';
      }
    } else if (vizTab === 'rhythm') {
      _insDrawDayRhythm('ins-viz-canvas', hoursThis, hoursPrev);
      const thisTotal = hoursThis.reduce((a, b) => a + b, 0);
      const prevTotal = hoursPrev.reduce((a, b) => a + b, 0);
      let peakH = 0, peakV = 0;
      hoursThis.forEach((v, h) => { if (v > peakV) { peakV = v; peakH = h; } });
      if (statsEl) statsEl.innerHTML = `
        <div class="ins-viz-stat"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:rgb(53,249,47);margin-right:6px;box-shadow:0 0 6px rgba(53,249,47,0.4)"></span>This week <span class="val">${thisTotal} tasks</span></div>
        <div class="ins-viz-stat"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.4);margin-right:6px"></span>Last week <span class="val">${prevTotal} tasks</span></div>
        <div class="ins-viz-stat">Peak hour <span class="val">${peakV > 0 ? String(peakH).padStart(2,'0') + ':00' : '—'}</span></div>
        <div class="ins-viz-stat">Peak count <span class="val ${peakV >= 5 ? 'green' : ''}">${peakV}</span></div>`;
    }
  }

  // ── Completion Trend (28-day) ─────────────────────────
  const trendData = [], trendLabels = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = localDateStr(d);
    trendData.push(TASKS.filter(t => t.done && t.doneDate === ds).length);
    trendLabels.push(i % 7 === 0 ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
  }
  // Use green if weekly average >= 5 tasks/day, else white
  const weekAvg = trendData.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const trendColor = weekAvg >= 5 ? 'rgb(53,249,47)' : 'rgba(255,255,255,0.5)';
  if (panelVisible) _insDrawTrend('ins-trend-canvas', trendData, trendLabels, trendColor);

  // ── Time by Category ──────────────────────────────────
  const breakdownEl = document.getElementById('ins-time-breakdown');
  if (breakdownEl) {
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] || 1;
    breakdownEl.innerHTML = sorted.map(([cat, secs], idx) => {
      const pct = Math.round(secs / max * 100);
      const opacity = Math.max(0.25, 1 - idx * 0.15);
      const catLabel = CATEGORIES[cat]?.label || cat;
      return `<div class="ins-time-bar-row">
        <div class="ins-time-bar-label">${catLabel}</div>
        <div class="ins-time-bar-track"><div class="ins-time-bar-fill" style="width:${pct}%;background:rgba(255,255,255,${opacity})"></div></div>
        <div class="ins-time-bar-val">${_insFmtHrs(secs)}</div>
      </div>`;
    }).join('') || '<div style="font-size:10px;color:var(--muted);font-family:var(--font-mono)">No time logged yet</div>';
  }

  if (!habits.length) {
    _renderInsightsEmpty();
    return;
  }

  // ── Friction Detector ───────────────────────────────────
  const window28 = 28;
  const habitStats = habits.map(h => {
    let possible = 0, done = 0, streak = 0, streakRunning = true;
    for (let i = 0; i < window28; i++) {
      const ds  = localDateStr(new Date(Date.now() - i * 86400000));
      const log = logs[ds];
      const completed = !!(log?.completions?.[h.id]);
      possible++;
      if (completed) done++;
      if (streakRunning) { if (completed) streak++; else if (i > 0) streakRunning = false; }
    }
    const pct = possible > 0 ? Math.round(done / possible * 100) : 0;
    return { ...h, pct, done, possible, streak };
  });

  // Sort: worst first (warn), then ok
  habitStats.sort((a, b) => a.pct - b.pct);

  const frictionEl = document.getElementById('ins-friction-list');
  if (frictionEl) {
    frictionEl.innerHTML = habitStats.map(h => {
      const skipped = h.possible - h.done;
      if (h.pct < 40) {
        return `<div class="hb-fi-habit warn">
          <div class="hb-fi-info">
            <div class="hb-fi-name">${escHtml(h.name)} — skipped ${skipped}× last 4 weeks (${h.pct}%)</div>
            <div class="hb-fi-reason">Needs attention — completion below 40%</div>
          </div>
          <div class="hb-fi-action">⚠ Flagged</div>
        </div>`;
      } else if (h.pct >= 80) {
        return `<div class="hb-fi-habit ok">
          <div class="hb-fi-info">
            <div class="hb-fi-name">${escHtml(h.name)} — ${h.streak > 0 ? h.streak + ' day streak' : h.pct + '% rate'}</div>
            <div class="hb-fi-reason">${h.pct >= 95 ? 'Near automatic · no willpower required' : 'Consistent performance · building momentum'}</div>
          </div>
          <div class="hb-fi-action ok">${h.streak >= 21 ? '✓ Locked in' : '✓ Growing'}</div>
        </div>`;
      } else {
        return `<div class="hb-fi-habit" style="border-left-color:var(--amber)">
          <div class="hb-fi-info">
            <div class="hb-fi-name">${escHtml(h.name)} — ${h.pct}% this month</div>
            <div class="hb-fi-reason">Inconsistent — ${skipped} skips in ${h.possible} days</div>
          </div>
          <div class="hb-fi-action" style="color:var(--amber)">~ Watch</div>
        </div>`;
      }
    }).join('');
    if (!habitStats.length) frictionEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);padding:20px 0;text-align:center;">No habits tracked yet.</div>';
  }

  // Pattern insight
  const insightEl = document.getElementById('ins-pattern-insight');
  if (insightEl) {
    const locked = habitStats.filter(h => h.pct >= 80).map(h => h.name);
    const flagged = habitStats.filter(h => h.pct < 40).map(h => h.name);
    let msg = '';
    if (locked.length && flagged.length) {
      msg = locked.slice(0,2).join(' and ') + (locked.length > 2 ? ' and others are' : ' is') + ' locked in. ' +
            flagged.slice(0,2).join(' and ') + ' need attention — focus your energy on protecting these next week.';
    } else if (locked.length) {
      msg = locked.slice(0,3).join(', ') + (locked.length === 1 ? ' is' : ' are') + ' running on autopilot. Build on this momentum by stacking a new habit.';
    } else if (flagged.length) {
      msg = 'Your habits are in an early-building phase. ' + flagged[0] + ' is the most inconsistent — reduce friction by pairing it with a habit you already do.';
    } else {
      msg = 'Your habits are developing consistently. Keep showing up — automaticity builds between days 21 and 66.';
    }
    insightEl.textContent = msg;
  }

  // ── Context Patterns (day of week) ──────────────────────
  const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dowStats = Array(7).fill(null).map(() => ({ done: 0, possible: 0 }));
  const totalDays = Math.min(Object.keys(logs).length, 56); // up to 8 weeks

  for (let i = 0; i < totalDays; i++) {
    const d  = new Date(Date.now() - i * 86400000);
    const ds = localDateStr(d);
    const dow = d.getDay();
    const log = logs[ds];
    const cnt = log ? Object.values(log.completions || {}).filter(Boolean).length : 0;
    dowStats[dow].possible += habits.length;
    dowStats[dow].done += cnt;
  }

  // Group into weekday vs weekend
  const weekdayDone = [1,2,3,4,5].reduce((s,d) => s + dowStats[d].done, 0);
  const weekdayPoss = [1,2,3,4,5].reduce((s,d) => s + dowStats[d].possible, 0);
  const weekendDone = [0,6].reduce((s,d) => s + dowStats[d].done, 0);
  const weekendPoss = [0,6].reduce((s,d) => s + dowStats[d].possible, 0);
  const weekdayPct  = weekdayPoss > 0 ? Math.round(weekdayDone / weekdayPoss * 100) : null;
  const weekendPct  = weekendPoss > 0 ? Math.round(weekendDone / weekendPoss * 100) : null;

  // Best and worst individual days
  const dowRanked = DOW.map((name, i) => {
    const pct = dowStats[i].possible > 0 ? Math.round(dowStats[i].done / dowStats[i].possible * 100) : null;
    return { name, pct };
  }).filter(d => d.pct !== null).sort((a, b) => b.pct - a.pct);

  const makeBar = (label, pct, note) => {
    const col = pct >= 70 ? 'var(--sage)' : pct >= 40 ? 'var(--amber)' : 'var(--rust)';
    return `<div class="hb-pw-item">
      <div class="hb-pw-top"><div class="hb-pw-name">${escHtml(label)}</div><div class="hb-pw-score" style="color:${col};">${pct}%</div></div>
      <div class="hb-pw-bar"><div class="hb-pw-fill" style="width:${pct}%;background:${col};"></div></div>
      <div class="hb-pw-note">${escHtml(note)}</div>
    </div>`;
  };

  const contextEl = document.getElementById('ins-context-list');
  if (contextEl) {
    let html = '';
    if (weekdayPct !== null) html += makeBar('Weekdays', weekdayPct, weekdayPct >= 70 ? 'Your strongest context — protect weekday mornings.' : weekdayPct >= 40 ? 'Room to improve on workdays.' : 'Weekdays need attention — consider a simpler routine.');
    if (weekendPct !== null) html += makeBar('Weekends', weekendPct, weekendPct >= 70 ? 'Excellent weekend discipline.' : weekendPct >= 40 ? 'Weekend drift is common — anchor to a fixed time.' : 'Weekend routines are fragile — build a minimal 2-step version.');
    if (dowRanked.length >= 2) {
      const best = dowRanked[0];
      html += makeBar('Best day — ' + best.name, best.pct, 'Leverage this: schedule anchoring habits here.');
      const worst = dowRanked[dowRanked.length - 1];
      if (worst.name !== best.name) html += makeBar('Weakest — ' + worst.name, worst.pct, 'Consider a stripped-down routine on ' + worst.name + 's.');
    }
    contextEl.innerHTML = html || '<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);padding:20px 0;text-align:center;">Log more days to see patterns.</div>';
  }

  // ── Week Debrief ────────────────────────────────────────
  _renderWeekDebrief();
}

function _renderInsightsEmpty() {
  const frictionEl = document.getElementById('ins-friction-list');
  const contextEl  = document.getElementById('ins-context-list');
  const msg = '<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em;padding:20px 0;text-align:center;">Add habits in the Tracker tab to see insights.</div>';
  if (frictionEl) frictionEl.innerHTML = msg;
  if (contextEl)  contextEl.innerHTML  = msg;
}

function _renderWeekDebrief() {
  const debriefEl = document.getElementById('ins-week-debrief');
  if (!debriefEl) return;
  const habits = _habits;

  // Compute this week (Mon–today)
  const now      = new Date();
  const dow      = now.getDay();
  const daysBack = (dow === 0) ? 6 : dow - 1;
  const weekDates = [];
  for (let i = daysBack; i >= 0; i--) weekDates.push(localDateStr(new Date(Date.now() - i * 86400000)));
  const prevWeekDates = [];
  for (let i = daysBack + 7; i >= daysBack + 1; i--) prevWeekDates.push(localDateStr(new Date(Date.now() - i * 86400000)));

  const startLabel = weekDates[0] ? weekDates[0].slice(5).replace('-','/') : '';
  const endLabel   = weekDates[weekDates.length-1] ? weekDates[weekDates.length-1].slice(5).replace('-','/') : '';

  // Task-based insights (always available)
  const thisWeekTasks = TASKS.filter(t => t.done && weekDates.includes(t.doneDate));
  const prevWeekTasks = TASKS.filter(t => t.done && prevWeekDates.includes(t.doneDate));
  const taskDelta = thisWeekTasks.length - prevWeekTasks.length;
  const taskDeltaStr = taskDelta > 0 ? `▲ ${taskDelta} more` : taskDelta < 0 ? `▼ ${Math.abs(taskDelta)} fewer` : 'same as';

  // Focus time this week vs last
  const focusThis = thisWeekTasks.reduce((s, t) => s + (t.sessionTimeSecs || 0) + (t.timeSpentSeconds || 0), 0);
  const focusPrev = prevWeekTasks.reduce((s, t) => s + (t.sessionTimeSecs || 0) + (t.timeSpentSeconds || 0), 0);

  // Top categories this week
  const catSecs = {};
  thisWeekTasks.forEach(t => {
    const cat = t.category || 'uncategorised';
    catSecs[cat] = (catSecs[cat] || 0) + (t.sessionTimeSecs || 0) + (t.timeSpentSeconds || 0);
  });
  const topCats = Object.entries(catSecs).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Best day this week (most tasks completed)
  const dayCounts = weekDates.map(ds => ({ ds, count: TASKS.filter(t => t.done && t.doneDate === ds).length }));
  const bestDay = dayCounts.reduce((a, b) => b.count > a.count ? b : a, { ds: '', count: 0 });
  const bestDayName = bestDay.ds ? new Date(bestDay.ds + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long' }) : '—';

  // Habit section (only if habits tracked)
  let habitSection = '';
  if (habits.length) {
    const weekPct = _weekPct(weekDates, habits);
    const prevPct = _weekPct(prevWeekDates, habits);
    const delta = weekPct - prevPct;
    const deltaStr = delta >= 0 ? '▲ up ' + delta + '%' : '▼ down ' + Math.abs(delta) + '%';
    const habitTags = habits.map(h => {
      const doneCount = weekDates.filter(ds => !!_habitLogs[ds]?.completions?.[h.id]).length;
      const total = weekDates.length;
      const cls = doneCount >= total ? 'win' : doneCount >= Math.ceil(total/2) ? 'partial' : 'miss';
      return `<span class="hb-wc-tag ${cls}">${escHtml(h.name)} · ${doneCount}/${total}</span>`;
    }).join('');
    habitSection = `
      <div style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin:16px 0 10px;">Habit Performance · ${weekPct}% ${prevPct > 0 ? '(' + deltaStr + ')' : ''}</div>
      <div class="hb-wc-habits">${habitTags}</div>`;
  }

  debriefEl.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:300;color:var(--cream);margin-bottom:2px">${startLabel} – ${endLabel}</div>
    <div style="font-family:var(--font-mono);font-size:8px;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);margin-bottom:14px">Current Week</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-family:var(--font-display);font-size:28px;font-weight:300;color:${thisWeekTasks.length >= 25 ? 'rgb(53,249,47)' : 'var(--cream)'}">${thisWeekTasks.length}</span>
        <span style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.08em;color:var(--muted)">tasks done · ${taskDeltaStr} last week</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-family:var(--font-display);font-size:20px;font-weight:300;color:var(--cream)">${_insFmtHrs(focusThis)}</span>
        <span style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.08em;color:var(--muted)">focus time${focusPrev > 0 ? ` · was ${_insFmtHrs(focusPrev)}` : ''}</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-family:var(--font-display);font-size:16px;font-weight:300;color:var(--cream)">${bestDayName}</span>
        <span style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.08em;color:var(--muted)">best day · ${bestDay.count} tasks</span>
      </div>
    </div>
    ${topCats.length ? `<div style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px">Top Categories</div>
    <div style="display:flex;flex-direction:column;gap:5px">
      ${topCats.map(([cat, secs]) => {
        const color = getCatColor(cat);
        const label = CATEGORIES[cat]?.label || cat;
        return `<div style="display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:10px">
          <span style="width:7px;height:7px;border-radius:50%;background:${color};box-shadow:0 0 5px ${color}80"></span>
          <span style="flex:1;color:var(--cream)">${escHtml(label)}</span>
          <span style="color:var(--muted)">${_insFmtHrs(secs)}</span>
        </div>`;
      }).join('')}
    </div>` : ''}
    ${habitSection}
  `;
}

function _weekPct(dates, habits) {
  if (!dates.length || !habits.length) return 0;
  let done = 0;
  dates.forEach(ds => {
    habits.forEach(h => { if (_habitLogs[ds]?.completions?.[h.id]) done++; });
  });
  return Math.round(done / (dates.length * habits.length) * 100);
}

