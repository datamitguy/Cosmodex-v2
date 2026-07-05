/* ═══════════════════════════════════════════════════════════════════════
   INSIGHTS X — design-system rebuild (Overview · Time · Focus · Energy · Patterns)
   Ported from the design-system Insights.jsx into vanilla JS, bound to the
   app's REAL data (TASKS, CAL_EVENTS, _habits/_habitLogs). READ-ONLY — this
   module never writes to Firestore. Rendered into #panel-insights.
   ═══════════════════════════════════════════════════════════════════════ */

let _ixTab   = 'overview';                 // overview | time | focus | energy | patterns
let _ixRange = '30d';                       // 7d | 30d | 90d | 1y
const _INSX_RANGES = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
const _INSX_DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const _INSX_GREEN = 'rgb(53,249,47)';
const _INSX_WARN = '#c45c2a';

/* ── date / data helpers ───────────────────────────────────────────────── */
function _insxDays() { return _INSX_RANGES[_ixRange] || 30; }
function _insxDateList(n) { const a = []; for (let i = n - 1; i >= 0; i--) a.push(localDateStr(new Date(Date.now() - i * 86400000))); return a; }
function _insxDoneOn(ds) { return TASKS.filter(t => t.done && t.doneDate === ds); }
function _insxFocusSecsOn(ds) { return _insxDoneOn(ds).reduce((s, t) => s + taskEffortSecs(t), 0); }
function _insxHabitPctOn(ds) { const h = (_habits || []); if (!h.length) return 0; const log = _habitLogs[ds]; const done = log ? Object.values(log.completions || {}).filter(Boolean).length : 0; return Math.round(done / h.length * 100); }
function _insxFmtHrs(secs) { const h = secs / 3600; return h >= 10 ? Math.round(h) + 'h' : h >= 1 ? h.toFixed(1).replace(/\.0$/, '') + 'h' : Math.round(secs / 60) + 'm'; }
function _insxDelta(now, prev) { if (!prev) return null; const d = Math.round((now - prev) / prev * 100); return { pct: Math.abs(d) + '%', pos: now >= prev }; }

/* ── shared chrome ─────────────────────────────────────────────────────── */
function _ixTabsHtml() {
  const tabs = [['overview', 'Overview'], ['time', 'Time'], ['focus', 'Focus'], ['energy', 'Energy'], ['patterns', 'Patterns']];
  return `<div class="insx2-tabs">${tabs.map(([id, l]) =>
    `<button class="insx2-tab${_ixTab === id ? ' active' : ''}" data-insx-tab="${id}">${l}</button>`).join('')}</div>`;
}
function _ixRangeHtml() {
  return `<div class="insx2-range">${Object.keys(_INSX_RANGES).map(r =>
    `<button class="insx2-rbtn${_ixRange === r ? ' active' : ''}" data-insx-range="${r}">${r}</button>`).join('')}</div>`;
}
function _insxStatRail(stats) {
  return `<div class="insx2-rail" style="grid-template-columns:repeat(${stats.length},1fr)">${stats.map(s => `
    <div class="insx2-stat">
      <div class="insx2-stat-lbl">${escHtml(s.label)}</div>
      <div class="insx2-stat-row">
        <span class="insx2-stat-val">${escHtml(s.value)}</span>
        ${s.delta ? `<span class="insx2-stat-delta ${s.delta.pos ? 'up' : 'down'}">${s.delta.pos ? '▲' : '▼'} ${escHtml(s.delta.pct)}</span>` : ''}
      </div>
    </div>`).join('')}</div>`;
}
function _insxSection(eyebrow, title, italic, right) {
  return `<div class="insx2-sec-head">
    <div><div class="insx2-eyebrow">${escHtml(eyebrow)}</div>
    <div class="insx2-sec-title">${escHtml(title)}</div>
    ${italic ? `<div class="insx2-sec-italic">${escHtml(italic)}</div>` : ''}</div>
    ${right || ''}</div>`;
}

/* ── reusable SVG viz (ported) ─────────────────────────────────────────── */
function _insxLineChart(series, height, labels) {
  const w = 800, pad = 30;
  const all = series.flatMap(s => s.points);
  const maxV = Math.max(1, ...all), minV = Math.min(0, ...all);
  const n = series[0].points.length;
  const xFor = i => pad + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad * 2));
  const yFor = v => pad + (1 - (v - minV) / (maxV - minV || 1)) * (height - pad * 2);
  let defs = '', paths = '';
  series.forEach((s, i) => {
    const id = `insxln${i}`;
    defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity="0.32"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
    const d = s.points.map((v, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
    const da = `${d} L ${xFor(n - 1).toFixed(1)} ${height - pad} L ${pad} ${height - pad} Z`;
    paths += `<path d="${da}" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${s.color}" stroke-width="1.5" style="filter:drop-shadow(0 0 5px ${s.color}88)"/>`;
    if (n <= 40) s.points.forEach((v, idx) => { paths += `<circle cx="${xFor(idx).toFixed(1)}" cy="${yFor(v).toFixed(1)}" r="2.2" fill="${s.color}"/>`; });
  });
  const grid = [0, .25, .5, .75, 1].map(p => `<line x1="${pad}" x2="${w - pad}" y1="${(pad + p * (height - pad * 2)).toFixed(1)}" y2="${(pad + p * (height - pad * 2)).toFixed(1)}" stroke="rgba(255,255,255,0.05)"/>`).join('');
  const xl = (labels || []).map((l, i) => l ? `<text x="${xFor(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="rgba(255,255,255,.35)" font-family="DM Mono,monospace" font-size="9">${escHtml(l)}</text>` : '').join('');
  return `<svg viewBox="0 0 ${w} ${height}" style="width:100%;display:block"><defs>${defs}</defs>${grid}${paths}${xl}</svg>`;
}
function _insxRadar(axes, values, color) {
  const size = 240, c = size / 2, r = size / 2 - 34, levels = 4;
  const ang = i => (i / axes.length) * Math.PI * 2 - Math.PI / 2;
  const pt = (v, i) => [c + Math.cos(ang(i)) * (v / 100) * r, c + Math.sin(ang(i)) * (v / 100) * r];
  const rings = Array.from({ length: levels }, (_, k) => `<circle cx="${c}" cy="${c}" r="${((k + 1) / levels * r).toFixed(1)}" fill="none" stroke="rgba(255,255,255,.05)"/>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(100, i); return `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.06)"/>`; }).join('');
  const poly = values.map((v, i) => pt(v, i).map(n => n.toFixed(1)).join(',')).join(' ');
  const dots = values.map((v, i) => { const [x, y] = pt(v, i); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"/>`; }).join('');
  const labs = axes.map((a, i) => { const [x, y] = pt(118, i); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,.55)" font-family="DM Mono,monospace" font-size="9">${escHtml(a)}</text>`; }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" style="width:100%;max-width:${size}px;display:block;margin:0 auto">${rings}${spokes}<polygon points="${poly}" fill="${color}33" stroke="${color}" stroke-width="1.5" style="filter:drop-shadow(0 0 8px ${color}99)"/>${dots}${labs}</svg>`;
}
function _insxSpark(series, color) {
  const min = Math.min(...series), max = Math.max(...series);
  const path = series.map((v, i) => { const x = (i / (series.length - 1)) * 200; const y = 32 - ((v - min) / (max - min || 1)) * 28; return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ');
  return `<svg viewBox="0 0 200 40" style="width:100%;display:block"><path d="${path} L 200 40 L 0 40 Z" fill="${color}22"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" style="filter:drop-shadow(0 0 3px ${color}99)"/></svg>`;
}

/* ── TAB: OVERVIEW ─────────────────────────────────────────────────────── */
function _insxOverview() {
  const n = _insxDays(), dates = _insxDateList(n), prevDates = _insxDateList(n * 2).slice(0, n);
  const focusSecs = dates.reduce((s, ds) => s + _insxFocusSecsOn(ds), 0);
  const prevFocus = prevDates.reduce((s, ds) => s + _insxFocusSecsOn(ds), 0);
  const shipped = dates.reduce((s, ds) => s + _insxDoneOn(ds).length, 0);
  const prevShipped = prevDates.reduce((s, ds) => s + _insxDoneOn(ds).length, 0);
  const habitPcts = dates.map(_insxHabitPctOn);
  const habitAvg = habitPcts.length ? Math.round(habitPcts.reduce((a, b) => a + b, 0) / habitPcts.length) : 0;
  const prevHabitAvg = prevDates.length ? Math.round(prevDates.map(_insxHabitPctOn).reduce((a, b) => a + b, 0) / prevDates.length) : 0;
  const doneAll = dates.flatMap(_insxDoneOn);
  const deepSecs = doneAll.filter(t => t.energyType === 'deep').reduce((s, t) => s + taskEffortSecs(t), 0);
  const deepRatio = focusSecs ? (deepSecs / focusSecs) : 0;
  const today = localDateStr(new Date());
  const overdue = TASKS.filter(t => !t.done && !t.someday && t.dueDate && t.dueDate < today).length;

  const rail = _insxStatRail([
    { label: 'FOCUS HOURS', value: _insxFmtHrs(focusSecs), delta: _insxDelta(focusSecs, prevFocus) },
    { label: 'HABITS KEPT', value: habitAvg + '%', delta: _insxDelta(habitAvg, prevHabitAvg) },
    { label: 'DEEP WORK', value: Math.round(deepRatio * 100) + '%' },
    { label: 'TASKS SHIPPED', value: String(shipped), delta: _insxDelta(shipped, prevShipped) },
    { label: 'OVERDUE', value: String(overdue) },
  ]);

  // focus hours (per day) vs habit % (scaled) line chart
  const focusPts = dates.map(ds => +(_insxFocusSecsOn(ds) / 3600).toFixed(2));
  const labels = dates.map((ds, i) => (i === 0 || i === dates.length - 1 || i % Math.ceil(n / 5) === 0)
    ? new Date(ds + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase() : '');
  const chart = _insxLineChart([
    { points: focusPts, color: _INSX_GREEN },
    { points: habitPcts.map(v => v / 10), color: 'rgba(255,255,255,.7)' },
  ], 220, labels);

  // time by category (real)
  const byCat = {};
  doneAll.forEach(t => { const c = t.category || 'uncategorised'; byCat[c] = (byCat[c] || 0) + taskEffortSecs(t); });
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const catTotal = catRows.reduce((s, [, v]) => s + v, 0) || 1;
  const catBar = catRows.map(([id, v]) => `<div style="width:${(v / catTotal * 100).toFixed(1)}%;height:100%;background:${getCatColor(id === 'uncategorised' ? '' : id)}"></div>`).join('');
  const catLegend = catRows.map(([id, v]) => `<div class="insx2-catrow">
    <span class="insx2-dot" style="background:${getCatColor(id === 'uncategorised' ? '' : id)}"></span>
    <div style="flex:1"><div class="insx2-catname">${escHtml(id === 'uncategorised' ? 'Uncategorised' : (CATEGORIES[id]?.label || id))}</div>
    <div class="insx2-catpct">${Math.round(v / catTotal * 100)}%</div></div>
    <span class="insx2-cathrs">${_insxFmtHrs(v)}</span></div>`).join('') || '<div class="insx2-empty">Log time on tasks to see where hours go.</div>';

  // keystone habits (real: by 30-day rate)
  const kh = (_habits || []).map(h => {
    const done = dates.filter(ds => !!_habitLogs[ds]?.completions?.[h.id]).length;
    return { name: h.name, rate: dates.length ? done / dates.length : 0, days: done };
  }).sort((a, b) => b.rate - a.rate).slice(0, 4);
  const khHtml = kh.length ? kh.map(h => `<div>
      <div class="insx2-kh-top"><span class="insx2-kh-name">${escHtml(h.name)}</span><span class="insx2-tel">${h.days}D · ${Math.round(h.rate * 100)}%</span></div>
      <div class="insx2-bar"><div class="insx2-bar-fill" style="width:${Math.round(h.rate * 100)}%"></div></div></div>`).join('')
    : '<div class="insx2-empty">No habits tracked yet.</div>';

  // observation (real)
  const bestCat = catRows[0] ? (catRows[0][0] === 'uncategorised' ? 'uncategorised work' : (CATEGORIES[catRows[0][0]]?.label || catRows[0][0])) : null;
  const obs = bestCat
    ? `Most of your logged focus went to <b>${escHtml(bestCat)}</b> — ${_insxFmtHrs(catRows[0][1])} across ${n} days. Habits held at ${habitAvg}%.`
    : 'Start logging time when you close a task and this becomes the receipt of where your attention actually went.';

  return `
    ${_insxSection('LAST ' + n + ' DAYS · OVERVIEW', 'The arc of your period.', 'Focus and habits, traced against what shipped.')}
    ${rail}
    <div class="insx2-card">
      <div class="insx2-card-head">
        <div><div class="insx2-eyebrow">FOCUS × HABIT · ${n}D</div><div class="insx2-card-title">The compound, over time.</div></div>
        <div class="insx2-legend"><span><span class="insx2-dot" style="background:${_INSX_GREEN}"></span>FOCUS HRS</span><span><span class="insx2-dot" style="background:rgba(255,255,255,.7)"></span>HABITS %</span></div>
      </div>${chart}
    </div>
    <div class="insx2-two12">
      <div class="insx2-card">
        <div class="insx2-eyebrow">TIME BY CATEGORY · ${n}D</div><div class="insx2-card-title">Where your hours actually went</div>
        <div class="insx2-catbar">${catBar || ''}</div>
        <div class="insx2-catgrid">${catLegend}</div>
      </div>
      <div class="insx2-card">
        <div class="insx2-eyebrow">KEYSTONE HABITS</div><div class="insx2-card-title">The ones that carry the rest</div>
        <div class="insx2-kh">${khHtml}</div>
      </div>
    </div>
    <div class="insx2-card insx2-quote"><div class="insx2-eyebrow">OBSERVED THIS PERIOD</div><div class="insx2-quote-txt">${obs}</div></div>`;
}

/* ── TAB: TIME ─────────────────────────────────────────────────────────── */
function _insxTime() {
  const n = _insxDays(), dates = _insxDateList(n), set = new Set(dates);
  const evs = (CAL_EVENTS || []).filter(e => set.has(e.date) && !e.allDay && e.startTime);
  const bookedMin = evs.reduce((s, e) => s + (e.duration || 60), 0);
  const avgBooked = (bookedMin / 60 / n);
  const catOf = e => { const t = e.taskId ? TASKS.find(x => x.id === e.taskId) : null; return t?.category || null; };
  const meetMin = evs.filter(e => (catOf(e) || '').toLowerCase().includes('meet') || (catOf(e) || '').toLowerCase().includes('team')).reduce((s, e) => s + (e.duration || 60), 0);
  const meetLoad = bookedMin ? Math.round(meetMin / bookedMin * 100) : 0;
  const deepest = evs.reduce((m, e) => Math.max(m, e.duration || 0), 0);

  const rail = _insxStatRail([
    { label: 'AVG BOOKED/DAY', value: avgBooked.toFixed(1) + 'h' },
    { label: 'EVENTS', value: String(evs.length) },
    { label: 'MEETING LOAD', value: meetLoad + '%' },
    { label: 'LONGEST BLOCK', value: deepest ? (deepest >= 60 ? (deepest / 60).toFixed(1).replace(/\.0$/, '') + 'h' : deepest + 'm') : '—' },
  ]);

  // hour × day heatmap from scheduled events (over range)
  const grid = {}; // [dow][hour] = minutes
  evs.forEach(e => { const d = new Date(e.date + 'T00:00'); const dow = (d.getDay() + 6) % 7; const h = parseInt(e.startTime.split(':')[0], 10); grid[dow] = grid[dow] || {}; grid[dow][h] = (grid[dow][h] || 0) + (e.duration || 60); });
  let maxCell = 1; Object.values(grid).forEach(row => Object.values(row).forEach(v => { if (v > maxCell) maxCell = v; }));
  const hourHdr = Array.from({ length: 24 }, (_, h) => `<div class="insx2-hm-hh">${h % 3 === 0 ? String(h).padStart(2, '0') : ''}</div>`).join('');
  const heat = _INSX_DOW.map((d, di) => `<div class="insx2-hm-dl">${d}</div>` + Array.from({ length: 24 }, (_, h) => {
    const v = (grid[di] && grid[di][h]) || 0; const int = v / maxCell;
    return `<div class="insx2-hm-cell" style="background:${int > 0.04 ? `rgba(53,249,47,${(0.15 + int * 0.75).toFixed(2)})` : 'rgba(255,255,255,.03)'}"></div>`;
  }).join('')).join('');

  // per-weekday total hours (stacked-ish, real)
  const dowTot = [0, 0, 0, 0, 0, 0, 0];
  evs.forEach(e => { const d = new Date(e.date + 'T00:00'); dowTot[(d.getDay() + 6) % 7] += (e.duration || 60) / 60; });
  const maxDow = Math.max(1, ...dowTot);
  const rhythm = _INSX_DOW.map((d, i) => `<div class="insx2-rhythm-col">
    <span class="insx2-tel">${dowTot[i].toFixed(1)}h</span>
    <div class="insx2-rhythm-bar"><div class="insx2-rhythm-fill" style="height:${(dowTot[i] / maxDow * 100).toFixed(0)}%"></div></div>
    <span class="insx2-tel">${d}</span></div>`).join('');

  return `
    ${_insxSection('TIME · WHERE IT ACTUALLY GOES', 'Hours, not intentions.', 'A calendar is a hypothesis. Insights is the receipt.')}
    ${rail}
    <div class="insx2-card">
      <div class="insx2-card-head"><div><div class="insx2-eyebrow">HOUR × DAY · ${n}D SCHEDULED</div><div class="insx2-card-title">When you actually book time</div></div>
        <div class="insx2-legend"><span class="insx2-tel">LESS</span><div class="insx2-hm-scale">${[0.15, 0.35, 0.55, 0.75, 0.95].map(v => `<div style="background:rgba(53,249,47,${v})"></div>`).join('')}</div><span class="insx2-tel">MORE</span></div>
      </div>
      <div class="insx2-hm"><div class="insx2-hm-hrow"><div class="insx2-hm-corner"></div>${hourHdr}</div>${evs.length ? `<div class="insx2-hm-body">${heat}</div>` : '<div class="insx2-empty">No scheduled events in this range — timebox some tasks on the calendar.</div>'}</div>
    </div>
    <div class="insx2-card">
      <div class="insx2-eyebrow">WEEKDAY RHYTHM · ${n}D</div><div class="insx2-card-title">Each day, shaped</div>
      <div class="insx2-rhythm">${rhythm}</div>
    </div>`;
}

/* ── TAB: FOCUS ────────────────────────────────────────────────────────── */
function _insxFocus() {
  const n = _insxDays(), dates = _insxDateList(n);
  const logged = dates.flatMap(_insxDoneOn).filter(t => (t.timeSpentMinutes || 0) > 0);
  const totalSecs = dates.reduce((s, ds) => s + _insxFocusSecsOn(ds), 0);
  const sessions = logged.length;
  const avgMin = sessions ? Math.round(logged.reduce((s, t) => s + (t.timeSpentMinutes || 0), 0) / sessions) : 0;
  const longest = logged.reduce((m, t) => Math.max(m, t.timeSpentMinutes || 0), 0);

  const rail = _insxStatRail([
    { label: 'SESSIONS · ' + n + 'D', value: String(sessions) },
    { label: 'TOTAL', value: _insxFmtHrs(totalSecs) },
    { label: 'AVG SESSION', value: avgMin ? avgMin + 'm' : '—' },
    { label: 'LONGEST', value: longest ? (longest >= 60 ? (longest / 60).toFixed(1).replace(/\.0$/, '') + 'h' : longest + 'm') : '—' },
  ]);

  // session stream — last min(n,14) days, segmented by hours
  const streamDays = dates.slice(-Math.min(n, 14));
  const maxH = Math.max(1, ...streamDays.map(ds => _insxFocusSecsOn(ds) / 3600));
  const bestDs = streamDays.reduce((b, ds) => _insxFocusSecsOn(ds) > _insxFocusSecsOn(b) ? ds : b, streamDays[0] || '');
  const stream = streamDays.map(ds => {
    const hrs = _insxFocusSecsOn(ds) / 3600; const segs = hrs > 0 ? Math.max(1, Math.ceil(hrs)) : 0; const best = ds === bestDs && hrs > 0;
    return `<div class="insx2-stream-col">
      <span class="insx2-tel${best ? ' green' : ''}">${hrs > 0 ? hrs.toFixed(1).replace(/\.0$/, '') + 'h' : '—'}</span>
      <div class="insx2-stream-bar${best ? ' best' : ''}">${Array.from({ length: segs }, () => `<div class="insx2-stream-seg" style="height:${(1 / Math.max(segs, 1) * 100).toFixed(0)}%"></div>`).join('')}</div>
      <span class="insx2-tel">${new Date(ds + 'T00:00').getDate()}</span></div>`;
  }).join('');

  // radar — % of each weekday with 2h+ focus
  const dowHit = [0, 0, 0, 0, 0, 0, 0], dowCnt = [0, 0, 0, 0, 0, 0, 0];
  dates.forEach(ds => { const dow = (new Date(ds + 'T00:00').getDay() + 6) % 7; dowCnt[dow]++; if (_insxFocusSecsOn(ds) >= 7200) dowHit[dow]++; });
  const radarVals = dowHit.map((h, i) => dowCnt[i] ? Math.round(h / dowCnt[i] * 100) : 0);

  // categories focused (real)
  const byCat = {}; dates.flatMap(_insxDoneOn).forEach(t => { const c = t.category || 'uncategorised'; byCat[c] = (byCat[c] || 0) + taskEffortSecs(t); });
  const catCards = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, v]) => `
    <div class="insx2-fcat" style="border-left-color:${getCatColor(id === 'uncategorised' ? '' : id)}">
      <div class="insx2-eyebrow">${escHtml((id === 'uncategorised' ? 'Uncategorised' : (CATEGORIES[id]?.label || id)).toUpperCase())}</div>
      <div class="insx2-fcat-v">${_insxFmtHrs(v)}</div>
      <div class="insx2-tel">${Math.round(v / (totalSecs || 1) * 100)}% OF FOCUS</div></div>`).join('') || '<div class="insx2-empty">No logged focus time in this range.</div>';

  return `
    ${_insxSection('FOCUS · DEEP WORK TELEMETRY', 'Where the work actually shipped.', 'Every close-logged session. The one focus that could not slip.')}
    ${rail}
    <div class="insx2-card">
      <div class="insx2-card-head"><div><div class="insx2-eyebrow">SESSION STREAM · LAST ${streamDays.length} DAYS</div><div class="insx2-card-title">Each bar is a day of logged focus.</div></div></div>
      <div class="insx2-stream">${sessions ? stream : '<div class="insx2-empty">Log time when you close tasks to build the stream.</div>'}</div>
    </div>
    <div class="insx2-two11">
      <div class="insx2-card"><div class="insx2-eyebrow">FOCUS PROFILE</div><div class="insx2-card-title">Your week, at a glance</div>
        ${_insxRadar(_INSX_DOW, radarVals, _INSX_GREEN)}
        <div class="insx2-eyebrow" style="text-align:center;margin-top:6px">% OF DAYS WITH 2H+ FOCUS</div></div>
      <div class="insx2-card"><div class="insx2-eyebrow">WHAT YOU FOCUSED ON</div><div class="insx2-card-title">Intentions, compounded</div>
        <div class="insx2-fcats">${catCards}</div></div>
    </div>`;
}

/* ── TAB: ENERGY ───────────────────────────────────────────────────────── */
function _insxEnergy() {
  const n = _insxDays(), dates = _insxDateList(n);
  const moodDays = dates.map(ds => ({ ds, mood: _habitLogs[ds]?.mood || 0, energy: _habitLogs[ds]?.energy || 0 })).filter(d => d.mood || d.energy);
  const avgMood = moodDays.length ? (moodDays.reduce((s, d) => s + d.mood, 0) / moodDays.filter(d => d.mood).length) : 0;
  const avgEnergy = moodDays.length ? (moodDays.reduce((s, d) => s + d.energy, 0) / moodDays.filter(d => d.energy).length) : 0;

  const rail = _insxStatRail([
    { label: 'AVG MOOD', value: avgMood ? avgMood.toFixed(1) + '/5' : '—' },
    { label: 'AVG ENERGY', value: avgEnergy ? avgEnergy.toFixed(1) + '/5' : '—' },
    { label: 'CHECK-INS', value: `${moodDays.length}/${n}d` },
    { label: 'FOCUS HRS', value: _insxFmtHrs(dates.reduce((s, ds) => s + _insxFocusSecsOn(ds), 0)) },
  ]);

  if (!moodDays.length) {
    return `${_insxSection('ENERGY · THE HUMAN LAYER', 'You are a circadian animal.', 'Log mood & energy on the Habits “Today” tab to light this up.')}${rail}
      <div class="insx2-card insx2-quote"><div class="insx2-eyebrow">NO CHECK-INS YET</div><div class="insx2-quote-txt">Add a daily mood/energy check-in on the Habits page and this tab traces it against what you shipped.</div></div>`;
  }

  // mood × focus line (real, scaled)
  const labels = dates.map((ds, i) => (i === 0 || i === dates.length - 1 || i % Math.ceil(n / 5) === 0) ? new Date(ds + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase() : '');
  const chart = _insxLineChart([
    { points: dates.map(ds => _habitLogs[ds]?.mood || 0), color: 'rgba(255,255,255,.7)' },
    { points: dates.map(ds => +(_insxFocusSecsOn(ds) / 3600).toFixed(2)), color: _INSX_GREEN },
  ], 220, labels);

  // mood distribution
  const buckets = {}; moodDays.forEach(d => { if (d.mood) buckets[d.mood] = (buckets[d.mood] || 0) + 1; });
  const moodLabels = { 1: 'Low', 2: 'Flat', 3: 'Steady', 4: 'Good', 5: 'Great' };
  const totMood = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  const dist = [5, 4, 3, 2, 1].filter(k => buckets[k]).map(k => {
    const pct = Math.round(buckets[k] / totMood * 100);
    return `<div><div class="insx2-kh-top"><span>${moodLabels[k]}</span><span class="insx2-tel">${pct}%</span></div><div class="insx2-bar"><div class="insx2-bar-fill" style="width:${pct}%"></div></div></div>`;
  }).join('');

  return `
    ${_insxSection('ENERGY · THE HUMAN LAYER', 'You are a circadian animal.', 'Mood & energy check-ins, traced against what you shipped.')}
    ${rail}
    <div class="insx2-card">
      <div class="insx2-card-head"><div><div class="insx2-eyebrow">MOOD × FOCUS · ${n}D</div><div class="insx2-card-title">Energy and output, side by side</div></div>
        <div class="insx2-legend"><span><span class="insx2-dot" style="background:rgba(255,255,255,.7)"></span>MOOD</span><span><span class="insx2-dot" style="background:${_INSX_GREEN}"></span>FOCUS HRS</span></div></div>
      ${chart}
    </div>
    <div class="insx2-card"><div class="insx2-eyebrow">MOOD DISTRIBUTION</div><div class="insx2-card-title">How you felt, shaped</div><div class="insx2-kh">${dist}</div></div>`;
}

/* ── TAB: PATTERNS ─────────────────────────────────────────────────────── */
function _insxPatterns() {
  const n = Math.max(_insxDays(), 30), dates = _insxDateList(n);
  const patterns = [];
  // best weekday
  const dowSec = [0, 0, 0, 0, 0, 0, 0], dowCnt = [0, 0, 0, 0, 0, 0, 0];
  dates.forEach(ds => { const dow = (new Date(ds + 'T00:00').getDay() + 6) % 7; dowSec[dow] += _insxFocusSecsOn(ds); dowCnt[dow]++; });
  const dowAvg = dowSec.map((s, i) => dowCnt[i] ? s / dowCnt[i] : 0);
  const bestDow = dowAvg.indexOf(Math.max(...dowAvg)), worstDow = dowAvg.indexOf(Math.min(...dowAvg.filter(v => v >= 0)));
  if (Math.max(...dowAvg) > 0) patterns.push({ icon: '◉', color: _INSX_GREEN, title: `${_INSX_DOW[bestDow]} is your deepest day`, body: `You log the most focus on ${_INSX_DOW[bestDow]} (${_insxFmtHrs(dowAvg[bestDow])}/day avg). Protect it — schedule the hard thing here.` });
  // keystone habit
  const kh = (_habits || []).map(h => ({ name: h.name, rate: dates.filter(ds => !!_habitLogs[ds]?.completions?.[h.id]).length / dates.length })).sort((a, b) => b.rate - a.rate)[0];
  if (kh && kh.rate > 0) patterns.push({ icon: '◐', color: 'rgba(255,255,255,.65)', title: `${kh.name} is your keystone`, body: `Kept ${Math.round(kh.rate * 100)}% of the last ${n} days — your most consistent habit. The rest tends to follow it.` });
  // overdue
  const today = localDateStr(new Date());
  const overdue = TASKS.filter(t => !t.done && !t.someday && t.dueDate && t.dueDate < today);
  if (overdue.length) patterns.push({ icon: '▲', color: _INSX_WARN, title: `${overdue.length} task${overdue.length === 1 ? '' : 's'} slipping`, body: `Overdue and unscheduled. Re-entry is one decision — pull the oldest two forward and the pile stops feeling heavy.` });
  // shipped trend
  const half = Math.floor(n / 2);
  const recent = dates.slice(half).reduce((s, ds) => s + _insxDoneOn(ds).length, 0);
  const older = dates.slice(0, half).reduce((s, ds) => s + _insxDoneOn(ds).length, 0);
  if (recent || older) patterns.push({ icon: recent >= older ? '✶' : '◈', color: 'rgba(255,255,255,.55)', title: recent >= older ? 'Output is rising' : 'Output has cooled', body: `${recent} tasks shipped in the recent half vs ${older} before. ${recent >= older ? 'The compound is working.' : 'A gentle nudge back to one-focus days would help.'}` });

  const cards = patterns.length ? patterns.map((p, i) => `
    <div class="insx2-pattern">
      <div class="insx2-pat-glow" style="background:radial-gradient(circle, ${p.color}26, transparent 70%)"></div>
      <div class="insx2-pat-head"><div class="insx2-pat-icon" style="background:${p.color}1f;border-color:${p.color}55;color:${p.color}">${p.icon}</div>
        <div><div class="insx2-eyebrow">PATTERN 0${i + 1}</div><div class="insx2-pat-title">${escHtml(p.title)}</div></div></div>
      <div class="insx2-pat-body">${p.body}</div></div>`).join('')
    : '<div class="insx2-empty">Not enough history yet — keep logging and Cosmodex will surface patterns.</div>';

  // 90-day-ish trends (weekly sparklines, real)
  const weeks = Math.min(Math.ceil(n / 7), 14);
  const focusWk = [], taskWk = [], habitWk = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const wd = _insxDateList(n).slice(Math.max(0, n - (w + 1) * 7), n - w * 7);
    focusWk.push(+(wd.reduce((s, ds) => s + _insxFocusSecsOn(ds), 0) / 3600).toFixed(1));
    taskWk.push(wd.reduce((s, ds) => s + _insxDoneOn(ds).length, 0));
    habitWk.push(wd.length ? Math.round(wd.map(_insxHabitPctOn).reduce((a, b) => a + b, 0) / wd.length) : 0);
  }
  const trend = (label, series, unit, color) => {
    const now = series[series.length - 1], then = series[0];
    const d = _insxDelta(now, then);
    return `<div class="insx2-trend">
      <span class="insx2-trend-lbl">${label}</span>
      <span class="insx2-tel">${then}${unit}</span>
      <div class="insx2-trend-spark">${_insxSpark(series.length > 1 ? series : [0, ...series], color)}</div>
      <span class="insx2-trend-now">${now}${unit}</span>
      ${d ? `<span class="insx2-stat-delta ${d.pos ? 'up' : 'down'}">${d.pos ? '▲' : '▼'} ${d.pct}</span>` : '<span></span>'}</div>`;
  };

  return `
    ${_insxSection('PATTERNS · COSMODEX SIGNALS', 'What your period is telling you.', 'Surfaced from your real data. Act on the first one.')}
    <div class="insx2-patgrid">${cards}</div>
    <div class="insx2-card"><div class="insx2-eyebrow">TREND · LAST ${weeks} WEEKS</div><div class="insx2-card-title">The direction of things</div>
      <div class="insx2-trends">
        ${trend('Focus hours / week', focusWk, 'h', _INSX_GREEN)}
        ${trend('Tasks shipped / week', taskWk, '', 'rgba(255,255,255,.6)')}
        ${trend('Habits kept / week', habitWk, '%', 'rgba(255,255,255,.7)')}
      </div></div>`;
}

/* ── main render + wiring ──────────────────────────────────────────────── */
function renderInsightsX() {
  const panel = document.getElementById('panel-insights');
  if (!panel) return;
  let body = '';
  try {
    body = _ixTab === 'overview' ? _insxOverview()
      : _ixTab === 'time' ? _insxTime()
      : _ixTab === 'focus' ? _insxFocus()
      : _ixTab === 'energy' ? _insxEnergy()
      : _insxPatterns();
  } catch (e) { console.error('insights render', e); body = '<div class="insx2-empty">Could not render this view.</div>'; }
  panel.innerHTML = `<div class="insx2-page">
    <div class="insx2-chrome">
      <div><div class="insx2-eyebrow">INSIGHTS</div><div class="insx2-headline">The receipt of your attention</div></div>
      <div style="flex:1"></div>
      ${_ixRangeHtml()}
      ${_ixTabsHtml()}
    </div>
    <div class="insx2-body">${body}</div>
  </div>`;
  panel.querySelectorAll('[data-insx-tab]').forEach(b => b.onclick = () => { _ixTab = b.dataset.insxTab; renderInsightsX(); });
  panel.querySelectorAll('[data-insx-range]').forEach(b => b.onclick = () => { _ixRange = b.dataset.insxRange; renderInsightsX(); });
}
window.renderInsightsX = renderInsightsX;
