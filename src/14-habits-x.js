/* ═══════════════════════════════════════════════════════════════════════════
   HABITS · design-system rebuild (Today / Builder / Progress / Reflect /
   Behaviours). Renders into #panel-habits, wired to the REAL data model
   (_habits, _habitLogs, habitToggle, habitUpdate, _todayStreakDays). Replaces
   the legacy habits UI at runtime; the Firestore subscriptions in 03-habits.js
   still feed the data. Exposed: window.initHabitsX / window.renderHabitsX.
   ═══════════════════════════════════════════════════════════════════════════ */
let _hxTab = 'today';
let _hxBuilderStep = 1;
let _hxBuilder = { identity: '', name: '', anchor: '', cue: '', reward: '', minimum: '', cat: 'Craft' };
let _hxReflectDraft = { open: false, habit: '', body: '' };

const HX_CATS = [
  { name: 'Mind',   color: 'rgba(255,255,255,.6)' },
  { name: 'Body',   color: '#4a7c5e' },
  { name: 'Craft',  color: 'rgba(255,255,255,.45)' },
  { name: 'Ritual', color: 'rgba(255,255,255,.7)' },
  { name: 'People', color: 'rgba(255,255,255,.5)' },
];
function _hxColor(h) {
  const c = HX_CATS.find(x => x.name === (h && h.category));
  return c ? c.color : (typeof getCatColor === 'function' ? getCatColor(h && h.category) : 'rgba(255,255,255,.6)');
}
function _hxActive() {
  return (typeof _habits !== 'undefined' ? _habits : [])
    .filter(h => h && h.status !== 'archived' && h.status !== 'graduated')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
function _hxName(h) { return h.tinyBehavior || h.name || 'Habit'; }
function _hxAnchor(h) { return (h.anchor && h.anchor.value) ? h.anchor.value : 'anytime'; }
function _hxDone(h, ds) { return !!(_habitLogs[ds] && _habitLogs[ds].completions && _habitLogs[ds].completions[h.id]); }
function _hxStreak(id) { return typeof _todayStreakDays === 'function' ? _todayStreakDays(id) : 0; }
function _hxIdentity() {
  return (typeof _behav !== 'undefined' && _behav.identity) ||
         (typeof _hbSettings !== 'undefined' && _hbSettings.identity) || '';
}
function _hxDateStr(offset) {
  const d = new Date(); d.setDate(d.getDate() - offset);
  return localDateStr(d);
}
// Fraction of active habits kept on a given date (0..1)
function _hxDayRate(ds, active) {
  if (!active.length) return 0;
  const log = _habitLogs[ds]; if (!log || !log.completions) return 0;
  return active.filter(h => log.completions[h.id]).length / active.length;
}

/* ── shared bits ─────────────────────────────────────────────────────── */
function _hxSecHead(eyebrow, title, italic, right) {
  return `<div class="hx-sechead">
    <div>
      <div class="hx-eyebrow">${escHtml(eyebrow)}</div>
      <span class="hx-sechead-title">${escHtml(title)}</span>
      ${italic ? `<span class="hx-sechead-italic">${escHtml(italic)}</span>` : ''}
    </div>
    ${right || ''}
  </div>`;
}
function _hxDot(color, size) { const s = size || 8; return `<span class="hx-dot" style="width:${s}px;height:${s}px;background:${color};box-shadow:0 0 6px ${color}"></span>`; }

/* ═══ TODAY ═══════════════════════════════════════════════════════════ */
function _hxToday() {
  const ds = localDateStr(new Date());
  const active = _hxActive();
  const kept = active.filter(h => _hxDone(h, ds)).length;
  const dateLbl = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  const identity = _hxIdentity();

  const rows = active.length ? active.map(h => {
    const done = _hxDone(h, ds), color = _hxColor(h);
    return `<div class="hx-hrow${done ? ' done' : ''}">
      <div class="hx-check${done ? ' on' : ''}" data-hx-toggle="${escAttr(h.id)}"></div>
      <div>
        <div class="hx-hname">${escHtml(_hxName(h))}</div>
        <div class="hx-hanchor">↳ ${escHtml(_hxAnchor(h))}</div>
      </div>
      ${_hxDot(color)}
      <span class="hx-tel" style="font-size:11px;color:rgba(255,255,255,.65)">${_hxStreak(h.id)}d</span>
    </div>`;
  }).join('') : `<div class="hx-empty">No habits yet — design one in the Builder tab.</div>`;

  // 35-day (5 week) completion heatmap
  const cells = [];
  for (let i = 34; i >= 0; i--) {
    const r = _hxDayRate(_hxDateStr(i), active);
    cells.push(`<div class="hx-heat-cell" style="background:rgba(255,255,255,${(0.06 + r * 0.4).toFixed(3)})${r > 0.85 ? ';box-shadow:0 0 8px rgba(255,255,255,.14)' : ''}"></div>`);
  }
  let keptTotal = 0; for (let i = 0; i < 35; i++) if (_hxDayRate(_hxDateStr(i), active) > 0) keptTotal++;

  return `${_hxSecHead('TODAY · ' + dateLbl,
      identity ? 'I am ' + identity + '.' : 'I am someone who shows up consistently.',
      'Chain today to the anchor. Tomorrow, do it again.',
      `<button class="hx-liquid" data-hx-gotab="builder">＋ Design a habit</button>`)}
    <div class="hx-grid-15">
      <div class="hx-card" style="padding:22px">
        <div class="hx-ritual-head"><span class="hx-ritual-title">Daily ritual</span>
          <span class="hx-eyebrow">${kept} / ${active.length} KEPT</span></div>
        ${rows}
      </div>
      <div class="hx-col">
        <div class="hx-card deep" style="padding:22px">
          <div class="hx-eyebrow">THE 30-SECOND VERSION</div>
          <span class="hx-quote">"The habit must be doable in 30 seconds on your worst day."</span>
          <div class="hx-tel" style="font-size:10px;color:rgba(255,255,255,.45);margin-top:10px">— BJ FOGG</div>
        </div>
        <div class="hx-card" style="padding:22px">
          <div class="hx-eyebrow">35-DAY HEATMAP</div>
          <div class="hx-heat">${cells.join('')}</div>
          <div class="hx-eyebrow" style="margin-top:14px">5 WEEKS · ${keptTotal} / 35 ACTIVE DAYS</div>
        </div>
        <div class="hx-card" style="padding:22px">
          <div class="hx-eyebrow">IDENTITY ANCHOR</div>
          <span class="hx-identity">${identity ? escHtml('I am ' + identity + '.') : 'Set an identity in the Builder — every rep is a vote for it.'}</span>
        </div>
      </div>
    </div>`;
}

/* ═══ BUILDER ═════════════════════════════════════════════════════════ */
function _hxBuilderPane() {
  const f = _hxBuilder, step = _hxBuilderStep;
  const steps = [
    { n: 1, label: 'Identity',  help: 'Who are you becoming?' },
    { n: 2, label: 'Action',    help: 'The tiny thing (30s version)' },
    { n: 3, label: 'Anchor',    help: 'What happens just before?' },
    { n: 4, label: 'Celebrate', help: 'Wire in the reward' },
  ];
  const rail = steps.map(s => {
    const active = step === s.n, past = step > s.n;
    return `<div class="hx-rail-step${active ? ' active' : ''}${past ? ' past' : ''}" data-hx-step="${s.n}">
      <div class="hx-rail-tel">${past ? '✓' : '0' + s.n} · ${s.label.toUpperCase()}</div>
      <div class="hx-rail-help">${s.help}</div>
    </div>`;
  }).join('');

  let body = '';
  if (step === 1) body = `
    <div class="hx-eyebrow">STEP 01 · IDENTITY</div>
    <span class="hx-sechead-title" style="font-size:24px">I am…</span>
    <span class="hx-sechead-italic">Start with who. The action is downstream of the self-image.</span>
    <input class="hx-input italic" id="hx-f-identity" value="${escAttr(f.identity)}" placeholder="someone who writes daily" style="margin-top:16px">
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
      ${['someone who writes daily','a parent who shows up present','a curious learner','someone who moves'].map(s =>
        `<button class="hx-chip" data-hx-seed-identity="${escAttr(s)}">${escHtml(s)}</button>`).join('')}
    </div>`;
  else if (step === 2) body = `
    <div class="hx-eyebrow">STEP 02 · ACTION</div>
    <span class="hx-sechead-title" style="font-size:24px">The 30-second version.</span>
    <span class="hx-sechead-italic">If you can't do it on your worst day, it's not tiny enough.</span>
    <input class="hx-input" id="hx-f-name" value="${escAttr(f.name)}" placeholder="Write one sentence" style="margin-top:16px">
    <div style="margin-top:14px"><div class="hx-eyebrow" style="margin-bottom:8px">MINIMUM VIABLE VERSION</div>
      <input class="hx-input mono" id="hx-f-minimum" value="${escAttr(f.minimum)}" placeholder="e.g. open the notebook"></div>
    <div style="margin-top:14px"><div class="hx-eyebrow" style="margin-bottom:8px">CATEGORY</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${HX_CATS.map(c => `<button class="hx-chip${f.cat === c.name ? ' active' : ''}" data-hx-cat="${escAttr(c.name)}">${_hxDot(c.color, 7)} ${c.name}</button>`).join('')}
      </div></div>`;
  else if (step === 3) body = `
    <div class="hx-eyebrow">STEP 03 · ANCHOR</div>
    <span class="hx-sechead-title" style="font-size:24px">After I … I will …</span>
    <span class="hx-sechead-italic">Chain to an existing routine. The anchor is the cue.</span>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
      <div><div class="hx-eyebrow" style="margin-bottom:6px">AFTER (ANCHOR)</div>
        <input class="hx-input body" id="hx-f-anchor" value="${escAttr(f.anchor)}" placeholder="I pour coffee"></div>
      <div><div class="hx-eyebrow" style="margin-bottom:6px">SENSORY CUE</div>
        <input class="hx-input body" id="hx-f-cue" value="${escAttr(f.cue)}" placeholder="Coffee maker beep"></div>
    </div>
    <div class="hx-recipe"><div class="hx-eyebrow" style="color:rgba(255,255,255,.6)">RECIPE</div>
      <div class="hx-recipe-body">After I <u>${escHtml(f.anchor || '___')}</u>, I will <u>${escHtml(f.name || '___')}</u>.</div></div>`;
  else body = `
    <div class="hx-eyebrow">STEP 04 · CELEBRATE</div>
    <span class="hx-sechead-title" style="font-size:24px">The reward wires the loop.</span>
    <span class="hx-sechead-italic">A small, immediate feeling of pride beats any external prize.</span>
    <div style="margin-top:16px"><div class="hx-eyebrow" style="margin-bottom:6px">CELEBRATION</div>
      <input class="hx-input body" id="hx-f-reward" value="${escAttr(f.reward)}" placeholder='Say "good" out loud. Fist pump. Smile.'></div>
    <div class="hx-loop"><div class="hx-eyebrow" style="color:#4a7c5e">COMPLETE LOOP</div>
      <div class="hx-recipe-body" style="font-size:17px">I am <u>${escHtml(f.identity || '___')}</u>. After I <u>${escHtml(f.anchor || '___')}</u>, I will <u>${escHtml(f.name || '___')}</u>. Then I <u>${escHtml(f.reward || '___')}</u>.</div></div>`;

  const nav = `<div class="hx-nav">
    <button class="hx-back" data-hx-back ${step === 1 ? 'disabled' : ''}>‹ Back</button>
    ${step < 4 ? `<button class="hx-liquid" data-hx-next>Next ›</button>`
               : `<button class="hx-liquid" data-hx-create>◈ Add to daily ritual</button>`}</div>`;

  const checklist = [
    ['Doable in 30 seconds?', !!f.name],
    ['Has a specific anchor?', !!f.anchor],
    ['Sensory cue identified?', !!f.cue],
    ['Celebration defined?', !!f.reward],
  ].map(([l, ok]) => `<div class="hx-ck"><span class="hx-ck-box${ok ? ' ok' : ''}"></span><span class="hx-tel" style="font-size:11px;color:${ok ? '#fff' : 'rgba(255,255,255,.55)'}">${escHtml(l)}</span></div>`).join('');

  return `${_hxSecHead('BUILDER · TINY HABITS METHOD', "Design a habit that can't fail.",
      'Identity → tiny action → anchor → celebration. Four moves, one ritual.')}
    <div class="hx-rail">${rail}</div>
    <div class="hx-grid-14">
      <div class="hx-card" style="padding:26px">${body}${nav}</div>
      <div class="hx-col">
        <div class="hx-card deep" style="padding:20px"><div class="hx-eyebrow">WHY IT WORKS</div>
          <div style="font-family:var(--font-body);font-size:13px;color:rgba(255,255,255,.75);margin-top:10px;line-height:1.6">Identity-based habits stick because they change the story you tell yourself. Every rep becomes a vote for the person you want to be.</div></div>
        <div class="hx-card deep" style="padding:20px"><div class="hx-eyebrow">CHECKLIST</div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">${checklist}</div></div>
        <div class="hx-card deep" style="padding:20px"><div class="hx-eyebrow">TEMPLATE LIBRARY</div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
            ${[['Read 2 pages','After I sit on the couch'],['5 pushups','After I brush my teeth'],['Journal 1 line','After I close my laptop']].map(([n, a]) =>
              `<div class="hx-tmpl" data-hx-tmpl="${escAttr(n)}|${escAttr(a)}"><div class="hx-tmpl-n">${escHtml(n)}</div><div class="hx-rail-tel" style="margin-top:2px">↳ ${escHtml(a.toUpperCase())}</div></div>`).join('')}
          </div></div>
      </div>
    </div>`;
}

/* ═══ PROGRESS ════════════════════════════════════════════════════════ */
function _hxProgress() {
  const active = _hxActive();
  // per-habit 28-day history from logs (oldest→newest)
  const hist = h => { const a = []; for (let i = 27; i >= 0; i--) a.push(_hxDone(h, _hxDateStr(i)) ? 1 : 0); return a; };
  const perHabit = active.map(h => ({ h, hist: hist(h), color: _hxColor(h) }));
  const totalKept = perHabit.reduce((a, p) => a + p.hist.filter(Boolean).length, 0);
  const cells = perHabit.length * 28;
  const rate = cells ? Math.round(totalKept / cells * 100) : 0;
  // longest run across all-habits-kept days
  let longest = 0, run = 0;
  for (let i = 55; i >= 0; i--) { if (_hxDayRate(_hxDateStr(i), active) >= 0.999 && active.length) { run++; longest = Math.max(longest, run); } else run = 0; }

  const stats = [['CONSISTENCY', rate + '%'], ['TOTAL KEPT', totalKept], ['LONGEST RUN', longest + 'd'], ['ACTIVE HABITS', active.length]]
    .map(([l, v]) => `<div class="hx-stat"><div class="hx-eyebrow">${l}</div><div class="hx-stat-v">${v}</div></div>`).join('');

  const prows = perHabit.length ? perHabit.map(({ h, hist, color }) => {
    const kept = hist.filter(Boolean).length;
    return `<div class="hx-prow">
      <div><div style="display:flex;align-items:center;gap:8px">${_hxDot(color, 7)}<div class="hx-hname" style="font-size:14px">${escHtml(_hxName(h))}</div></div>
        <div class="hx-rail-tel" style="margin-top:3px">${escHtml((h.category || 'HABIT').toUpperCase())} · ${_hxStreak(h.id)}D STREAK</div></div>
      <div class="hx-p28">${hist.map(v => `<span style="background:${v ? color + 'cc' : 'rgba(255,255,255,.04)'};border:1px solid ${v ? color : 'rgba(255,255,255,.06)'}${v ? ';box-shadow:0 0 6px ' + color + '66' : ''}"></span>`).join('')}</div>
      <span class="hx-tel" style="font-size:11px;color:rgba(255,255,255,.75)">${kept}/28</span>
      <span class="hx-tel" style="font-size:11px;color:#fff;text-shadow:0 0 8px rgba(255,255,255,.3)">${Math.round(kept / 28 * 100)}%</span>
    </div>`;
  }).join('') : `<div class="hx-empty">No habits to chart yet.</div>`;

  // category mix over 28d
  const catTotals = {}; let catSum = 0;
  perHabit.forEach(({ h, hist }) => { const k = h.category || 'Other'; const n = hist.filter(Boolean).length; catTotals[k] = (catTotals[k] || 0) + n; catSum += n; });
  const mix = Object.keys(catTotals).length ? Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([name, n]) => {
    const pct = catSum ? Math.round(n / catSum * 100) : 0; const c = (HX_CATS.find(x => x.name === name) || {}).color || 'rgba(255,255,255,.5)';
    return `<div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="hx-tel" style="font-size:10px;color:rgba(255,255,255,.6)">${escHtml(name.toUpperCase())}</span><span class="hx-tel" style="font-size:10px;color:rgba(255,255,255,.5)">${pct}%</span></div>
      <div class="hx-bar"><i style="width:${pct}%;background:linear-gradient(90deg,${c}aa,${c});box-shadow:0 0 8px ${c}88"></i></div></div>`;
  }).join('') : `<div class="hx-empty">No reps logged yet.</div>`;

  // consistency curve: weekly rate over last 5 weeks
  const wk = [];
  for (let w = 4; w >= 0; w--) { let s = 0, n = 0; for (let d = 0; d < 7; d++) { const off = w * 7 + d; s += _hxDayRate(_hxDateStr(off), active); n++; } wk.push(n ? s / n : 0); }
  const pts = wk.map((v, i) => [i / 4 * 400, 150 - v * 130]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(0) + ' ' + p[1].toFixed(0)).join(' ');

  return `${_hxSecHead('PROGRESS · LAST 4 WEEKS', 'The compound, visible.',
      'Every row is 28 days. Every lit cell is a vote for who you are becoming.')}
    <div class="hx-stats">${stats}</div>
    <div class="hx-card" style="padding:22px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:18px"><span class="hx-ritual-title">By habit</span>
        <span class="hx-tel" style="font-size:10px;color:rgba(255,255,255,.4)">28 DAYS</span></div>${prows}</div>
    <div class="hx-grid-2" style="margin-top:22px">
      <div class="hx-card" style="padding:22px"><div class="hx-eyebrow">CATEGORY MIX · 28D</div>
        <span class="hx-sechead-title" style="font-size:18px">Where your reps went</span>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">${mix}</div></div>
      <div class="hx-card" style="padding:22px"><div class="hx-eyebrow">CONSISTENCY CURVE</div>
        <span class="hx-sechead-title" style="font-size:18px">Weekly kept-rate</span>
        <svg viewBox="0 0 400 160" style="width:100%;margin-top:16px;display:block">
          <defs><linearGradient id="hx-curve" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.3"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
          ${[0, 40, 80, 120, 160].map(y => `<line x1="0" x2="400" y1="${y}" y2="${y}" stroke="rgba(255,255,255,0.04)"/>`).join('')}
          <path d="${path}" fill="none" stroke="#fff" stroke-width="1.5" style="filter:drop-shadow(0 0 6px rgba(255,255,255,.35))"/>
          <path d="${path} L 400 160 L 0 160 Z" fill="url(#hx-curve)"/>
          ${pts.map(p => `<circle cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="3" fill="#fff" style="filter:drop-shadow(0 0 4px rgba(255,255,255,.6))"/>`).join('')}
        </svg>
        <div style="display:flex;justify-content:space-between;margin-top:6px">${['W1', 'W2', 'W3', 'W4', 'NOW'].map(w => `<span class="hx-tel" style="font-size:9px;color:rgba(255,255,255,.4)">${w}</span>`).join('')}</div></div>
    </div>`;
}

/* ═══ REFLECT ═════════════════════════════════════════════════════════ */
function _hxReflectStore() { try { return JSON.parse(localStorage.getItem('cdx_hx_reflect') || '[]'); } catch { return []; } }
function _hxReflectSave(arr) { localStorage.setItem('cdx_hx_reflect', JSON.stringify(arr)); }
function _hxReflect() {
  const prompts = [
    'Which rep today took the least willpower?',
    'Which habit, if you kept it for a year, would change the most?',
    'Where did you fall off — and what anchor was missing?',
    'What identity did you vote for today?',
  ];
  const entries = _hxReflectStore();
  const active = _hxActive();
  const words = entries.reduce((a, e) => a + (e.body || '').trim().split(/\s+/).filter(Boolean).length, 0);
  const ds = localDateStr(new Date());
  const keptToday = active.filter(h => _hxDone(h, ds)).length;

  const draft = _hxReflectDraft.open ? `
    <div class="hx-card" style="padding:18px">
      <div class="hx-eyebrow" style="margin-bottom:8px">NEW ENTRY</div>
      <select class="hx-input mono" id="hx-r-habit" style="margin-bottom:10px">
        <option value="">General reflection</option>
        ${active.map(h => `<option value="${escAttr(_hxName(h))}"${_hxReflectDraft.habit === _hxName(h) ? ' selected' : ''}>${escHtml(_hxName(h))}</option>`).join('')}
      </select>
      <textarea class="hx-input body" id="hx-r-body" rows="4" placeholder="What did you notice?" style="resize:vertical">${escHtml(_hxReflectDraft.body)}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="hx-liquid" data-hx-r-save>Save entry</button><button class="hx-back" data-hx-r-cancel>Cancel</button></div>
    </div>` : '';

  const list = entries.length ? entries.map((e, i) => `
    <div class="hx-card" style="padding:22px">
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:10px">
        <span class="hx-tel" style="font-size:10px;color:rgba(255,255,255,.5)">${escHtml(e.date || '')}</span>
        ${e.habit ? `<span class="hx-pill">${escHtml(e.habit.toUpperCase())}</span>` : ''}
        <div style="flex:1"></div>
        <button class="hx-back" style="padding:4px 10px" data-hx-r-del="${i}">✕</button>
      </div>
      <div class="hx-entry-body">${escHtml(e.body || '')}</div>
    </div>`).join('') : `<div class="hx-card" style="padding:22px"><div class="hx-empty">No reflections yet. Write your first weekly look-back →</div></div>`;

  return `${_hxSecHead('REFLECT · WEEKLY REVIEW', 'The week, in your own handwriting.',
      'A short weekly look-back is worth more than 30 minutes of new goals.',
      `<button class="hx-liquid" data-hx-r-new>＋ New entry</button>`)}
    <div class="hx-grid-14">
      <div class="hx-col">${draft}${list}</div>
      <div class="hx-col">
        <div class="hx-card" style="padding:22px"><div class="hx-eyebrow">THIS WEEK'S PROMPTS</div>
          <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
            ${prompts.map((p, i) => `<div class="hx-prompt" data-hx-prompt="${escAttr(p)}"><div style="display:flex;gap:10px;align-items:flex-start"><span class="hx-tel" style="font-size:10px;color:rgba(255,255,255,.4)">0${i + 1}</span><span class="hx-prompt-txt">${escHtml(p)}</span></div></div>`).join('')}
          </div></div>
        <div class="hx-card deep" style="padding:22px"><div class="hx-eyebrow">WEEKLY TELEMETRY</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px">
            <div><div class="hx-eyebrow">ENTRIES</div><div class="hx-stat-v" style="font-size:26px">${String(entries.length).padStart(2, '0')}</div></div>
            <div><div class="hx-eyebrow">WORDS</div><div class="hx-stat-v" style="font-size:26px">${words}</div></div>
            <div><div class="hx-eyebrow">KEPT TODAY</div><div class="hx-stat-v" style="font-size:26px">${keptToday}/${active.length}</div></div>
            <div><div class="hx-eyebrow">IDENTITY</div><span class="hx-identity" style="font-size:13px">${_hxIdentity() ? escHtml(_hxIdentity()) : 'showing up.'}</span></div>
          </div></div>
      </div>
    </div>`;
}

/* ═══ BEHAVIOURS ══════════════════════════════════════════════════════ */
function _hxBehaviours() {
  const active = _hxActive();
  const ds = i => _hxDateStr(i);
  // kept rate by anchor group (morning/evening) over 60 days
  const groupRate = grp => {
    const hs = active.filter(h => (typeof _todayAnchorGroup === 'function' ? _todayAnchorGroup(h) : 'anytime') === grp);
    if (!hs.length) return null;
    let done = 0, tot = 0;
    for (let i = 0; i < 60; i++) hs.forEach(h => { tot++; if (_hxDone(h, ds(i))) done++; });
    return tot ? Math.round(done / tot * 100) : 0;
  };
  const morn = groupRate('morning'), eve = groupRate('evening');
  // compound gain: a "read"-ish habit count
  const read = active.find(h => /read|page|book/i.test(_hxName(h)));
  let readDays = 0; if (read) for (let i = 0; i < 30; i++) if (_hxDone(read, ds(i))) readDays++;

  const insights = [
    { icon: '◉', color: '#4a7c5e', title: 'Anchor strength',
      body: active.filter(h => h.anchor && h.anchor.value).length
        ? `${active.filter(h => h.anchor && h.anchor.value).length} of ${active.length} habits are chained to a specific anchor. Anchored habits keep far better than free-floating ones — give every habit an "after I…" cue.`
        : 'None of your habits have a specific anchor yet. Add an "after I…" cue in the Builder — sensory anchors beat willpower.' },
    { icon: '◐', color: 'rgba(255,255,255,.6)', title: 'Timing window',
      body: (morn != null || eve != null)
        ? `You keep ${morn != null ? morn + '% of morning' : 'no tracked morning'} habits${eve != null ? ' and ' + eve + '% of evening ones' : ''}. ${morn != null && eve != null && morn > eve ? 'Evenings are your weak point — move faltering habits earlier.' : 'Protect the window that works.'}`
        : 'Add anchors so Cosmodex can compare your morning vs. evening kept-rates.' },
    { icon: '▲', color: '#c45c2a', title: 'Consistency',
      body: `Over the last 28 days you kept ${active.length ? Math.round(active.reduce((a, h) => { let k = 0; for (let i = 0; i < 28; i++) if (_hxDone(h, ds(i))) k++; return a + k; }, 0) / (active.length * 28) * 100) : 0}% of your reps. Small and steady compounds faster than big and sporadic.` },
    { icon: '✶', color: 'rgba(255,255,255,.45)', title: 'Compound gain',
      body: read ? `"${escHtml(_hxName(read))}" ${readDays}× in 30 days. Keep that cadence and it becomes ~${readDays * 12} reps a year — the compound is in the streak, not the session.`
        : 'Every kept rep is a vote for your identity. Stack 30 days and the identity starts to feel true.' },
  ];
  const insightHtml = insights.map((ins, i) => `
    <div class="hx-card hx-insight" style="padding:22px">
      <div class="hx-insight-glow" style="background:radial-gradient(circle,${ins.color}30,transparent 70%)"></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div class="hx-insight-icon" style="background:${ins.color}20;border:1px solid ${ins.color}50;color:${ins.color};text-shadow:0 0 10px ${ins.color}">${ins.icon}</div>
        <div class="hx-eyebrow" style="color:rgba(255,255,255,.6)">INSIGHT 0${i + 1}</div></div>
      <span class="hx-sechead-title" style="font-size:20px;margin:0 0 8px">${escHtml(ins.title)}</span>
      <div style="font-family:var(--font-body);font-size:14px;color:rgba(255,255,255,.78);line-height:1.6">${ins.body}</div>
    </div>`).join('');

  // completions by weekday (real; we have dates, not clock times)
  const dow = [0, 0, 0, 0, 0, 0, 0], dowMax = { v: 1 };
  for (let i = 0; i < 90; i++) { const d = new Date(); d.setDate(d.getDate() - i); const log = _habitLogs[localDateStr(d)];
    if (log && log.completions) { const n = Object.keys(log.completions).length; dow[d.getDay()] += n; dowMax.v = Math.max(dowMax.v, dow[d.getDay()]); } }
  const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const todHtml = DOW.map((lbl, i) => { const inten = dow[i] / dowMax.v;
    return `<div class="hx-tod-col"><div class="hx-tod-bar" style="background:rgba(255,255,255,${(0.05 + inten * 0.4).toFixed(3)})${inten > 0.75 ? ';box-shadow:0 0 10px rgba(255,255,255,.2)' : ''}"></div><span class="hx-tel" style="font-size:8px;color:rgba(255,255,255,.35)">${lbl}</span></div>`; }).join('');

  // strongest pairs — Jaccard co-occurrence over 60 days
  const pairs = [];
  for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) {
    let both = 0, either = 0;
    for (let i = 0; i < 60; i++) { const da = _hxDone(active[a], ds(i)), db = _hxDone(active[b], ds(i)); if (da || db) either++; if (da && db) both++; }
    if (either >= 5) pairs.push({ a: active[a], b: active[b], n: both / either });
  }
  pairs.sort((x, y) => y.n - x.n);
  const pairHtml = pairs.length ? pairs.slice(0, 3).map(p => {
    const c = _hxColor(p.a);
    return `<div class="hx-tmpl" style="cursor:default"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span class="hx-hname" style="font-size:14px">${escHtml(_hxName(p.a))}</span><span class="hx-tel" style="font-size:10px;color:rgba(255,255,255,.4)">↔</span>
      <span class="hx-hname" style="font-size:14px">${escHtml(_hxName(p.b))}</span><div style="flex:1"></div>
      <span class="hx-tel" style="font-size:11px;color:${c};text-shadow:0 0 8px ${c}">r=${p.n.toFixed(2)}</span></div>
      <div class="hx-bar" style="height:4px"><i style="width:${Math.round(p.n * 100)}%;background:${c};box-shadow:0 0 6px ${c}88"></i></div></div>`;
  }).join('') : `<div class="hx-empty">Log a few weeks to surface habit pairs.</div>`;

  // morning chain from morning-anchored habits
  const chain = active.filter(h => (typeof _todayAnchorGroup === 'function' ? _todayAnchorGroup(h) : '') === 'morning').slice(0, 5);
  const chainHtml = chain.length ? chain.map((h, i, a) => { const c = _hxColor(h);
    return `<div style="display:flex;gap:14px;align-items:flex-start">
      <div style="width:46px"><span class="hx-tel" style="font-size:10px;color:rgba(255,255,255,.5)">${escHtml(h.anchor && h.anchor.value ? '' : '')}${String(6 + i).padStart(2, '0')}:00</span></div>
      <div style="display:flex;flex-direction:column;align-items:center"><div style="width:12px;height:12px;border-radius:50%;background:${c};box-shadow:0 0 10px ${c};margin-top:4px"></div>${i < a.length - 1 ? `<div style="width:1px;flex:1;min-height:28px;background:linear-gradient(180deg,${c},${_hxColor(a[i + 1])})"></div>` : ''}</div>
      <div style="flex:1;padding-bottom:18px"><span class="hx-hname" style="font-size:15px">${escHtml(_hxName(h))}</span></div></div>`; }).join('')
    : `<div class="hx-empty">No morning-anchored habits yet.</div>`;

  return `${_hxSecHead('BEHAVIOURS · PATTERNS NOTICED', 'Your data, talking back.',
      'Signals Cosmodex noticed across your recent history.')}
    <div class="hx-grid-2" style="margin-bottom:22px">${insightHtml}</div>
    <div class="hx-card" style="padding:22px;margin-bottom:22px">
      <span class="hx-ritual-title">When your habits actually land</span>
      <span class="hx-sechead-italic">Completions · last 90 days · by weekday</span>
      <div class="hx-tod">${todHtml}</div></div>
    <div class="hx-grid-2">
      <div class="hx-card" style="padding:22px"><div class="hx-eyebrow">STRONGEST PAIRS</div>
        <span class="hx-sechead-title" style="font-size:18px">These reinforce each other</span>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">${pairHtml}</div></div>
      <div class="hx-card" style="padding:22px"><div class="hx-eyebrow">HABIT CHAIN · MORNING</div>
        <span class="hx-sechead-title" style="font-size:18px">Your keystone sequence</span>
        <div style="margin-top:18px;display:flex;flex-direction:column">${chainHtml}</div></div>
    </div>`;
}

/* ── shell + render ──────────────────────────────────────────────────── */
const _HX_TABS = ['today', 'builder', 'progress', 'reflect', 'behaviours'];
function renderHabitsX() {
  const panel = document.getElementById('panel-habits');
  if (!panel) return;
  let body = '';
  if (_hxTab === 'today') body = _hxToday();
  else if (_hxTab === 'builder') body = _hxBuilderPane();
  else if (_hxTab === 'progress') body = _hxProgress();
  else if (_hxTab === 'reflect') body = _hxReflect();
  else body = _hxBehaviours();

  panel.innerHTML = `<div class="hx-root">
    <div class="hx-topbar">
      <div><div class="hx-eyebrow">HABITS</div><div class="hx-h1">Ritual engine</div></div>
      <div class="hx-spacer"></div>
      <div class="hx-tabs">${_HX_TABS.map(t => `<button class="hx-tab${_hxTab === t ? ' active' : ''}" data-hx-tab="${t}">${t}</button>`).join('')}</div>
    </div>
    <div class="hx-pane" id="hx-pane">${body}</div>`;
  _hxWire(panel);
}
window.renderHabitsX = renderHabitsX;
window.initHabitsX = function (tab) { if (tab && _HX_TABS.includes(tab)) _hxTab = tab; renderHabitsX(); };
// Live data updates: only auto-refresh the read-only tabs so we never wipe
// half-typed Builder / Reflect input from under the user.
window._hxAutoRefresh = function () {
  if (typeof _mainPanel === 'undefined' || _mainPanel !== 'habits') return;
  if (_hxTab === 'builder' || _hxTab === 'reflect') return;
  renderHabitsX();
};

/* Persist the current builder inputs into _hxBuilder before a re-render */
function _hxSyncBuilder() {
  const g = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  const map = { 'hx-f-identity': 'identity', 'hx-f-name': 'name', 'hx-f-minimum': 'minimum', 'hx-f-anchor': 'anchor', 'hx-f-cue': 'cue', 'hx-f-reward': 'reward' };
  Object.entries(map).forEach(([id, key]) => { const v = g(id); if (v !== undefined) _hxBuilder[key] = v; });
}

async function _hxCreateHabit() {
  _hxSyncBuilder();
  const f = _hxBuilder;
  if (!f.name.trim()) { showToast('Name the tiny action first', 'error'); return; }
  const uid = typeof getHabitsUid === 'function' ? getHabitsUid() : null;
  const id = 'h_' + Date.now();
  const doc0 = typeof _habitWithDefaults === 'function' ? _habitWithDefaults({ id, name: f.name.trim(), order: _habits.length }) : { id, name: f.name.trim() };
  doc0.tinyBehavior = f.name.trim();
  doc0.identityTag = f.identity.trim();
  doc0.category = f.cat;
  doc0.anchor = { type: f.anchor.trim() ? 'after' : 'anytime', value: f.anchor.trim(), linkedHabitId: null };
  doc0.cue = f.cue.trim();
  doc0.reward = f.reward.trim();
  doc0.fullBehavior = f.minimum.trim();
  doc0.status = 'active';
  _habits.push(doc0);
  if (uid && window.CDX_FB && window.CDX_DB) {
    const { doc, setDoc, serverTimestamp } = window.CDX_FB;
    try {
      await setDoc(doc(window.CDX_DB, 'users', uid, 'habits', id), {
        id, name: f.name.trim(), order: _habits.length - 1,
        identityTag: f.identity.trim(), valueTags: [], tinyBehavior: f.name.trim(), fullBehavior: f.minimum.trim(),
        anchor: doc0.anchor, cue: f.cue.trim(), reward: f.reward.trim(), category: f.cat,
        schedule: { days: 'daily', frequency: 1 }, stackId: null,
        frictionTags: [], frictionFallbacks: {}, restDaysPlanned: [],
        status: 'active', graduatedAt: null, createdAt: serverTimestamp(), archivedAt: null,
      });
      showToast('Habit added to your daily ritual', 'success');
    } catch (e) { console.warn('hx create habit error:', e); _habits = _habits.filter(h => h.id !== id); showToast('Could not save habit', 'error'); }
  }
  _hxBuilder = { identity: '', name: '', anchor: '', cue: '', reward: '', minimum: '', cat: 'Craft' };
  _hxBuilderStep = 1; _hxTab = 'today';
  renderHabitsX();
  window.renderDashboardBoard && window.renderDashboardBoard();
}

function _hxWire(panel) {
  // Tabs
  panel.querySelectorAll('[data-hx-tab]').forEach(b => b.onclick = () => { if (_hxTab === 'builder') _hxSyncBuilder(); _hxTab = b.dataset.hxTab; renderHabitsX(); });
  panel.querySelectorAll('[data-hx-gotab]').forEach(b => b.onclick = () => { _hxTab = b.dataset.hxGotab; renderHabitsX(); });

  // Today: toggle
  panel.querySelectorAll('[data-hx-toggle]').forEach(el => el.onclick = () => {
    habitToggle(el.dataset.hxToggle, localDateStr(new Date())).then(() => { renderHabitsX(); window.renderDashboardBoard && window.renderDashboardBoard(); });
  });

  // Builder navigation + fields
  panel.querySelector('[data-hx-next]') && (panel.querySelector('[data-hx-next]').onclick = () => { _hxSyncBuilder(); _hxBuilderStep = Math.min(4, _hxBuilderStep + 1); renderHabitsX(); });
  panel.querySelector('[data-hx-back]') && (panel.querySelector('[data-hx-back]').onclick = () => { _hxSyncBuilder(); _hxBuilderStep = Math.max(1, _hxBuilderStep - 1); renderHabitsX(); });
  panel.querySelector('[data-hx-create]') && (panel.querySelector('[data-hx-create]').onclick = _hxCreateHabit);
  panel.querySelectorAll('[data-hx-step]').forEach(el => el.onclick = () => { _hxSyncBuilder(); _hxBuilderStep = +el.dataset.hxStep; renderHabitsX(); });
  panel.querySelectorAll('[data-hx-cat]').forEach(el => el.onclick = () => { _hxSyncBuilder(); _hxBuilder.cat = el.dataset.hxCat; renderHabitsX(); });
  panel.querySelectorAll('[data-hx-seed-identity]').forEach(el => el.onclick = () => { _hxSyncBuilder(); _hxBuilder.identity = el.dataset.hxSeedIdentity; renderHabitsX(); });
  panel.querySelectorAll('[data-hx-tmpl]').forEach(el => el.onclick = () => { const [n, a] = el.dataset.hxTmpl.split('|'); _hxSyncBuilder(); _hxBuilder.name = n; _hxBuilder.anchor = (a || '').replace(/^After I\s*/i, ''); _hxTab = 'builder'; _hxBuilderStep = 2; renderHabitsX(); });
  // keep recipe/loop preview live as the user types
  ['hx-f-anchor', 'hx-f-name', 'hx-f-reward', 'hx-f-identity'].forEach(id => { const el = document.getElementById(id); if (el) el.oninput = () => { _hxSyncBuilder(); const prev = panel.querySelectorAll('.hx-recipe-body'); prev.forEach(() => {}); }; });

  // Reflect
  panel.querySelector('[data-hx-r-new]') && (panel.querySelector('[data-hx-r-new]').onclick = () => { _hxReflectDraft = { open: true, habit: '', body: '' }; renderHabitsX(); });
  panel.querySelector('[data-hx-r-cancel]') && (panel.querySelector('[data-hx-r-cancel]').onclick = () => { _hxReflectDraft.open = false; renderHabitsX(); });
  panel.querySelector('[data-hx-r-save]') && (panel.querySelector('[data-hx-r-save]').onclick = () => {
    const habit = document.getElementById('hx-r-habit')?.value || '';
    const bodyv = (document.getElementById('hx-r-body')?.value || '').trim();
    if (!bodyv) { showToast('Write something first', 'error'); return; }
    const arr = _hxReflectStore();
    arr.unshift({ date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase(), habit, body: bodyv });
    _hxReflectSave(arr); _hxReflectDraft = { open: false, habit: '', body: '' }; renderHabitsX();
  });
  panel.querySelectorAll('[data-hx-r-del]').forEach(el => el.onclick = () => { const arr = _hxReflectStore(); arr.splice(+el.dataset.hxRDel, 1); _hxReflectSave(arr); renderHabitsX(); });
  panel.querySelectorAll('[data-hx-prompt]').forEach(el => el.onclick = () => { _hxReflectDraft = { open: true, habit: '', body: el.dataset.hxPrompt + '\n\n' }; renderHabitsX(); const t = document.getElementById('hx-r-body'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } });
}
