/* ══ HABITS — HELPERS ══ */
// → future file: cosmodex-habits.js
function getHabitsUid() { return window.CDX_USER?.uid || null; }

function last7Days() {
  const days = []; const now = new Date();
  for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate()-i); days.push(d); }
  return days;
}

/* ══ HABITS — SUBSCRIBE ══ */
function habitsSubscribe() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB) return;
  // Subscribe once. Switching Habits tabs used to tear down and re-establish these
  // listeners on every click, re-downloading the full habits list + 91 days of logs
  // each time. The snapshots stay live and update the in-memory arrays; callers just
  // re-render from cache. cleanupAllListeners() nulls these on sign-out.
  if (_habitsUnsub && _habitLogsUnsub) return;
  if (_habitsUnsub) { _habitsUnsub(); _habitsUnsub = null; }
  if (_habitLogsUnsub) { _habitLogsUnsub(); _habitLogsUnsub = null; }
  const { collection, query, where, onSnapshot } = window.CDX_FB;
  const db = window.CDX_DB;

  _habitsUnsub = onSnapshot(collection(db, 'users', uid, 'habits'), snap => {
    // Keep graduated habits in memory (Reflect + Habits tab need them)
    _habits = snap.docs.map(d => _habitWithDefaults({ id: d.id, ...d.data() }))
      .filter(h => !h.archivedAt && h.status !== 'archived')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (_habitsTab === 'today') renderToday();
    if (_habitsTab === 'habits') renderHabitsTab();
    if (_habitsTab === 'hinsights') renderHabitsInsights();
    if (_habitsTab === 'reflect') renderReflect();
    window.renderDashboardBoard?.(); // dashboard rituals card (guards on _mainPanel)
  }, err => console.warn('habits onSnapshot:', err.message));

  // For 13-week heatmap we need 91 days of logs
  const d91 = new Date(); d91.setDate(d91.getDate() - 91);
  _habitLogsUnsub = onSnapshot(
    query(collection(db, 'users', uid, 'habitLogs'), where('date', '>=', localDateStr(d91))),
    snap => {
      snap.docs.forEach(d => { _habitLogs[d.id] = d.data(); });
      if (_habitsTab === 'today') renderToday();
      if (_habitsTab === 'habits') renderHabitsTab();
      if (_habitsTab === 'hinsights') renderHabitsInsights();
      if (_habitsTab === 'reflect') renderReflect();
      window.renderDashboardBoard?.();
    }, err => console.warn('habitLogs onSnapshot:', err.message));
}

function routinesSubscribe() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB || _routinesUnsub) return;
  const { doc, onSnapshot } = window.CDX_FB;
  _routinesUnsub = onSnapshot(doc(window.CDX_DB, 'users', uid, 'routines', 'config'), snap => {
    if (snap.exists()) { const d = snap.data(); _routines = { morning: d.morning||[], evening: d.evening||[] }; }
    if (_habitsTab === 'today') _todayRenderMorningMode();
    window.renderDashboardBoard?.();
  }, err => console.warn('routines onSnapshot:', err.message));
}

function behavSubscribe() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB || _behavUnsub) return;
  const { doc, onSnapshot } = window.CDX_FB;
  _behavUnsub = onSnapshot(doc(window.CDX_DB, 'users', uid, 'behaviours', 'current'), snap => {
    if (snap.exists()) { const d = snap.data(); _behav = { identity: d.identity||'', keystone: d.keystone||[], notes: d.notes||'' }; }
    if (_habitsTab === 'reflect') renderReflect();
  }, err => console.warn('behaviours onSnapshot:', err.message));
}

function hbSettingsSubscribe() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB || _hbSettingsUnsub) return;
  const { doc, onSnapshot } = window.CDX_FB;
  _hbSettingsUnsub = onSnapshot(doc(window.CDX_DB, 'users', uid, 'hbSettings', 'config'), snap => {
    if (snap.exists()) {
      const d = snap.data();
      _hbSettings = {
        season:          d.season          || '',
        seasonStartDate: d.seasonStartDate || '',
        quote:           d.quote           || '',
        quoteAuthor:     d.quoteAuthor     || '',
        customHabits:    d.customHabits    || '',
        nonNegotiable:   d.nonNegotiable   || '',
        onboarded:       d.onboarded       === true,
        activeSlotLimit: typeof d.activeSlotLimit === 'number' ? d.activeSlotLimit : 3,
      };
    } else {
      // One-time migration from localStorage
      const saved = localStorage.getItem('hb-settings');
      if (saved) {
        try {
          const cfg = JSON.parse(saved);
          _hbSettings = { season: cfg.season||'', seasonStartDate:'', quote: cfg.quote||'', quoteAuthor:'', customHabits: cfg.customHabits||'', nonNegotiable:'' };
          const { doc: docFn, setDoc, serverTimestamp } = window.CDX_FB;
          setDoc(docFn(window.CDX_DB, 'users', uid, 'hbSettings', 'config'), { ..._hbSettings, updatedAt: serverTimestamp() }, { merge: true });
          localStorage.removeItem('hb-settings');
        } catch(e) {}
      }
    }
    if (_habitsTab === 'today') renderToday();
    if (_habitsTab === 'reflect') renderReflect();
  }, err => console.warn('hbSettings onSnapshot:', err.message));
}

/* ── Values inventory (Phase 1) ──────────────────── */
function valuesSubscribe() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB || _valuesUnsub) return;
  const { collection, onSnapshot } = window.CDX_FB;
  _valuesUnsub = onSnapshot(collection(window.CDX_DB, 'users', uid, 'values'), snap => {
    _values = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Seed defaults on first open if user has no values and hasn't onboarded
    if (_values.length === 0 && !_hbSettings.onboarded) {
      _seedDefaultValues(uid).catch(err => console.warn('seed values:', err.message));
    }
    if (_habitsTab === 'habits') renderHabitsTab();
  }, err => console.warn('values onSnapshot:', err.message));
}

async function _seedDefaultValues(uid) {
  const { doc, setDoc, serverTimestamp } = window.CDX_FB;
  await Promise.all(DEFAULT_VALUES.map(v =>
    setDoc(doc(window.CDX_DB, 'users', uid, 'values', v.id), { ...v, createdAt: serverTimestamp() })
  ));
  // Mark onboarded so we don't re-seed if user deletes them
  await setDoc(doc(window.CDX_DB, 'users', uid, 'hbSettings', 'config'), { onboarded: true, updatedAt: serverTimestamp() }, { merge: true });
}

async function addValue(name, emoji) {
  const uid = getHabitsUid();
  if (!uid || !name?.trim()) return;
  const { doc, setDoc, serverTimestamp } = window.CDX_FB;
  const id = 'v_' + Date.now();
  await setDoc(doc(window.CDX_DB, 'users', uid, 'values', id), { id, name: name.trim(), emoji: emoji || '', createdAt: serverTimestamp() });
}

async function deleteValue(id) {
  const uid = getHabitsUid();
  if (!uid || !id) return;
  const { doc, deleteDoc } = window.CDX_FB;
  await deleteDoc(doc(window.CDX_DB, 'users', uid, 'values', id));
  // Clear dangling valueId on any habits that referenced this value
  await Promise.all(_habits.filter(h => h.valueId === id).map(h => habitUpdate(h.id, { valueId: null })));
}

/* ── Stacks (Phase 1) ──────────────────── */
function stacksSubscribe() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB || _stacksUnsub) return;
  const { collection, onSnapshot } = window.CDX_FB;
  _stacksUnsub = onSnapshot(collection(window.CDX_DB, 'users', uid, 'stacks'), snap => {
    _stacks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (_habitsTab === 'habits') renderHabitsTab();
  }, err => console.warn('stacks onSnapshot:', err.message));
}

async function addStack(name, track) {
  const uid = getHabitsUid();
  if (!uid || !name?.trim()) return null;
  const { doc, setDoc, serverTimestamp } = window.CDX_FB;
  const id = 's_' + Date.now();
  await setDoc(doc(window.CDX_DB, 'users', uid, 'stacks', id), {
    id, name: name.trim(), track: track || 'morning', habitIds: [], createdAt: serverTimestamp()
  });
  return id;
}

async function updateStack(id, data) {
  const uid = getHabitsUid();
  if (!uid || !id) return;
  const { doc, updateDoc, serverTimestamp } = window.CDX_FB;
  await updateDoc(doc(window.CDX_DB, 'users', uid, 'stacks', id), { ...data, updatedAt: serverTimestamp() });
}

async function deleteStack(id) {
  const uid = getHabitsUid();
  if (!uid || !id) return;
  const { doc, deleteDoc } = window.CDX_FB;
  await deleteDoc(doc(window.CDX_DB, 'users', uid, 'stacks', id));
}

/* ══ HABITS — TAB SWITCH ══ */
function switchHabitsTab(tab) {
  // Backward-compat: any legacy launcher references resolve to today
  if (tab === 'launcher' || tab === 'tracker' || tab === 'progress' || tab === 'builder') tab = 'today';
  _habitsTab = tab;
  ['today','reflect','habits','hinsights'].forEach(t => {
    const btn  = document.querySelector(`.habits-v2-tab[data-htab="${t}"]`);
    const pane = document.getElementById('hpane-'+t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (pane) pane.style.display = t === tab ? 'flex' : 'none';
  });
  if (tab === 'today')     { habitsSubscribe(); routinesSubscribe(); behavSubscribe(); hbSettingsSubscribe(); renderToday(); }
  if (tab === 'reflect')   { habitsSubscribe(); hbSettingsSubscribe(); behavSubscribe(); valuesSubscribe(); renderReflect(); }
  if (tab === 'habits')    { habitsSubscribe(); hbSettingsSubscribe(); valuesSubscribe(); stacksSubscribe(); _habitsTabInit(); renderHabitsTab(); }
  if (tab === 'hinsights') { habitsSubscribe(); requestAnimationFrame(() => renderHabitsInsights()); }
}

/* ══ TODAY TAB — Daily Ritual ══ */
let _todayClockInterval = null;

function _todayAnchorGroup(habit) {
  const a = habit.anchor || { type: 'anytime', value: '' };
  if (a.type === 'anytime' || !a.value) return 'anytime';
  const v = (a.value || '').toLowerCase();
  // Infer time-of-day from keywords or explicit time
  if (a.type === 'time') {
    const h = parseInt((a.value || '').split(':')[0] || '0', 10);
    if (h < 12) return 'morning';
    if (h < 17) return 'midday';
    return 'evening';
  }
  if (v.includes('wake') || v.includes('coffee') || v.includes('breakfast') || v.includes('morning')) return 'morning';
  if (v.includes('lunch') || v.includes('midday') || v.includes('afternoon')) return 'midday';
  if (v.includes('dinner') || v.includes('wind-down') || v.includes('bed') || v.includes('evening') || v.includes('night')) return 'evening';
  return 'anytime';
}

function _todayStreakDays(habitId) {
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const ds = localDateStr(new Date(Date.now() - i * 86400000));
    if (_habitLogs[ds]?.completions?.[habitId]) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function renderToday() {
  // Live clock + date
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const timeEl = document.getElementById('today-hero-time');
  const dateEl = document.getElementById('today-hero-date');
  if (timeEl) timeEl.textContent = `${hh}:${mm}`;
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  // Season
  const seasonEl = document.getElementById('today-hero-season');
  if (seasonEl) {
    if (_hbSettings.season) {
      let dayN = '';
      if (_hbSettings.seasonStartDate) {
        const s = new Date(_hbSettings.seasonStartDate + 'T00:00');
        const diff = Math.max(1, Math.floor((Date.now() - s.getTime()) / 86400000) + 1);
        dayN = ' · Day ' + diff;
      }
      seasonEl.textContent = _hbSettings.season + dayN;
    } else {
      seasonEl.textContent = 'Set your season in habits settings';
    }
  }

  // Quote
  const quoteEl = document.getElementById('today-hero-quote');
  if (quoteEl) {
    if (_hbSettings.quote) {
      quoteEl.textContent = '"' + _hbSettings.quote + '"' + (_hbSettings.quoteAuthor ? ' — ' + _hbSettings.quoteAuthor : '');
    } else {
      quoteEl.textContent = '';
    }
  }

  // Non-negotiable (load today's, fall back to default in settings)
  const nonnegEl = document.getElementById('today-nonneg-input');
  const today = localDateStr(now);
  const todayLog = _habitLogs[today] || {};
  if (nonnegEl && document.activeElement !== nonnegEl) {
    nonnegEl.textContent = todayLog.nonNegotiable || _hbSettings.nonNegotiable || '';
  }

  // Mood/energy chips — reflect current values
  const moodChips = document.querySelectorAll('.today-checkin-chips[data-check="mood"] .today-chip');
  moodChips.forEach(c => c.classList.toggle('active', parseInt(c.dataset.v, 10) === (todayLog.mood || 0)));
  const energyChips = document.querySelectorAll('.today-checkin-chips[data-check="energy"] .today-chip');
  energyChips.forEach(c => c.classList.toggle('active', parseInt(c.dataset.v, 10) === (todayLog.energy || 0)));

  // Rest day button state
  const restBtn = document.getElementById('today-rest-btn');
  if (restBtn) restBtn.classList.toggle('active', !!todayLog.restDay);

  // Morning Mode — routine timeline
  _todayRenderMorningMode();

  // Anchor-grouped habits
  _todayRenderHabits(today, !!todayLog.restDay);
}

function _todayRenderMorningMode() {
  const stepsEl = document.getElementById('today-morning-steps');
  const progEl = document.getElementById('today-morning-progress');
  if (!stepsEl) return;
  const steps = _routines.morning || [];
  if (!steps.length) {
    stepsEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);padding:8px 2px">No morning routine yet — set one in the Launcher tab or the legacy section below.</div>';
    if (progEl) progEl.textContent = '0/0';
    return;
  }
  const todayDs = localDateStr(new Date());
  const doneKey = 'hb-launcher-done-' + todayDs;
  let done;
  try { done = JSON.parse(localStorage.getItem(doneKey) || '{}'); } catch { done = {}; }
  let doneCount = 0;
  stepsEl.innerHTML = steps.map((s, i) => {
    const isDone = !!done[i];
    if (isDone) doneCount++;
    return `<div class="today-morning-step ${isDone ? 'done' : ''}" data-morning-idx="${i}">
      <div class="today-morning-check ${isDone ? 'done' : ''}">${isDone ? '✓' : ''}</div>
      <span class="today-morning-step-time">${escHtml(s.time || '')}</span>
      <span class="today-morning-step-text">${escHtml(s.text || '')}</span>
    </div>`;
  }).join('');
  if (progEl) progEl.textContent = doneCount + '/' + steps.length;
}

function _todayRenderHabits(todayDs, isRestDay) {
  const listEl = document.getElementById('today-habits');
  if (!listEl) return;
  const habits = (_habits || []).filter(h => h.status !== 'archived' && h.status !== 'graduated');
  if (isRestDay) {
    listEl.innerHTML = `<div class="today-rest-banner">🌙 Today is a rest day. Completions are paused, streaks are preserved.<br><span style="opacity:0.7">Self-compassion is not the same as giving up.</span></div>`;
    return;
  }
  if (!habits.length) {
    listEl.innerHTML = '<div class="today-empty">no rituals yet. even stars have routines — add one below, or design one in the Builder tab.</div>';
    return;
  }
  // Group by anchor
  const groups = { morning: [], midday: [], evening: [], anytime: [] };
  habits.forEach(h => { groups[_todayAnchorGroup(h)].push(h); });
  const groupMeta = [
    { id: 'morning', icon: '🌅', label: 'Morning' },
    { id: 'midday',  icon: '☀️', label: 'Midday' },
    { id: 'evening', icon: '🌙', label: 'Evening' },
    { id: 'anytime', icon: '🎯', label: 'Anytime' },
  ];
  listEl.innerHTML = groupMeta.filter(g => groups[g.id].length).map(g => {
    const rows = groups[g.id].map(h => {
      const done = !!_habitLogs[todayDs]?.completions?.[h.id];
      const streak = _todayStreakDays(h.id);
      const streakClass = streak >= 7 ? 'hot' : '';
      const name = h.tinyBehavior || h.name;
      const identity = h.identityTag ? `<span class="today-habit-identity">${escHtml(h.identityTag)}</span>` : '';
      const anchor = h.anchor?.value ? `<span class="today-habit-anchor">after ${escHtml(h.anchor.value)}</span>` : '';
      const meta = identity || anchor ? `<div class="today-habit-meta">${identity}${identity && anchor ? '<span>·</span>' : ''}${anchor}</div>` : '';
      return `<div class="today-habit ${done ? 'done' : ''}" data-habit-id="${escAttr(h.id)}">
        <div class="today-habit-check ${done ? 'done' : ''}" data-today-toggle="${escAttr(h.id)}">${done ? '✓' : ''}</div>
        <div class="today-habit-body">
          <div class="today-habit-name">${escHtml(name)}</div>
          ${meta}
        </div>
        ${streak > 0 ? `<span class="today-habit-streak ${streakClass}">${streak}d</span>` : ''}
        <div class="today-habit-burst"></div>
        <div class="today-habit-vote"></div>
      </div>`;
    }).join('');
    return `<div class="today-anchor-group">
      <div class="today-anchor-header">
        <span class="today-anchor-icon">${g.icon}</span>
        <span class="today-anchor-title">${g.label}</span>
        <span class="today-anchor-count">${groups[g.id].filter(h => _habitLogs[todayDs]?.completions?.[h.id]).length}/${groups[g.id].length}</span>
      </div>
      <div class="today-anchor-body">${rows}</div>
    </div>`;
  }).join('');
}

async function _todaySaveCheckin(field, value) {
  const uid = getHabitsUid();
  if (!uid) return;
  const ds = localDateStr(new Date());
  if (!_habitLogs[ds]) _habitLogs[ds] = { date: ds, completions: {} };
  _habitLogs[ds][field] = value;
  // Add context snapshot if not present
  if (!_habitLogs[ds].contextSnapshot) {
    const d = new Date();
    _habitLogs[ds].contextSnapshot = { dayOfWeek: d.getDay(), weekend: d.getDay() === 0 || d.getDay() === 6, month: d.getMonth() };
  }
  try {
    const { doc, setDoc } = window.CDX_FB;
    const payload = { date: ds, [field]: value, contextSnapshot: _habitLogs[ds].contextSnapshot };
    await setDoc(doc(window.CDX_DB, 'users', uid, 'habitLogs', ds), payload, { merge: true });
  } catch (e) { console.warn('today save checkin:', e); }
}

async function _todayToggleRestDay() {
  const uid = getHabitsUid();
  if (!uid) return;
  const ds = localDateStr(new Date());
  if (!_habitLogs[ds]) _habitLogs[ds] = { date: ds, completions: {} };
  const wasRest = !!_habitLogs[ds].restDay;
  _habitLogs[ds].restDay = !wasRest;
  renderToday();
  try {
    const { doc, setDoc } = window.CDX_FB;
    await setDoc(doc(window.CDX_DB, 'users', uid, 'habitLogs', ds), { date: ds, restDay: !wasRest }, { merge: true });
  } catch (e) { console.warn('today rest toggle:', e); _habitLogs[ds].restDay = wasRest; renderToday(); }
}

function _todayFireCelebration(habitRow, habit) {
  const burst = habitRow.querySelector('.today-habit-burst');
  const vote  = habitRow.querySelector('.today-habit-vote');
  if (burst) {
    burst.classList.remove('fire');
    void burst.offsetWidth;
    burst.classList.add('fire');
  }
  if (vote) {
    const identity = habit.identityTag || 'the builder';
    vote.textContent = '+1 for ' + identity;
    vote.classList.remove('show');
    void vote.offsetWidth;
    vote.classList.add('show');
  }
  // Haptic if available
  if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
}

async function _todayNonNegSave() {
  const el = document.getElementById('today-nonneg-input');
  if (!el) return;
  const uid = getHabitsUid();
  if (!uid) return;
  const ds = localDateStr(new Date());
  const text = el.textContent.trim();
  if (!_habitLogs[ds]) _habitLogs[ds] = { date: ds, completions: {} };
  _habitLogs[ds].nonNegotiable = text;
  try {
    const { doc, setDoc } = window.CDX_FB;
    await setDoc(doc(window.CDX_DB, 'users', uid, 'habitLogs', ds), { date: ds, nonNegotiable: text }, { merge: true });
  } catch (e) { console.warn('today nonneg save:', e); }
}

function _todayInit() {
  const pane = document.getElementById('hpane-today');
  if (!pane || pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  // Live clock
  if (_todayClockInterval) clearInterval(_todayClockInterval);
  _todayClockInterval = setInterval(() => {
    if (_habitsTab === 'today') {
      const now = new Date();
      const timeEl = document.getElementById('today-hero-time');
      if (timeEl) timeEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    }
  }, 30000);

  // Mood/energy chip clicks
  pane.querySelectorAll('.today-checkin-chips').forEach(row => {
    row.addEventListener('click', e => {
      const chip = e.target.closest('.today-chip');
      if (!chip) return;
      const field = row.dataset.check; // 'mood' or 'energy'
      const value = parseInt(chip.dataset.v, 10);
      row.querySelectorAll('.today-chip').forEach(c => c.classList.toggle('active', c === chip));
      _todaySaveCheckin(field, value);
    });
  });

  // Rest day toggle
  document.getElementById('today-rest-btn')?.addEventListener('click', _todayToggleRestDay);

  // Non-negotiable save on blur
  document.getElementById('today-nonneg-input')?.addEventListener('blur', _todayNonNegSave);

  // Morning Mode collapsible toggle
  document.getElementById('today-morning-header')?.addEventListener('click', () => {
    const wrap = document.getElementById('today-morning-mode');
    const body = document.getElementById('today-morning-body');
    if (!wrap || !body) return;
    const isOpen = wrap.classList.toggle('open');
    body.style.display = isOpen ? '' : 'none';
  });

  // Morning step check clicks (delegated)
  document.getElementById('today-morning-steps')?.addEventListener('click', e => {
    const step = e.target.closest('.today-morning-step');
    if (!step) return;
    const idx = parseInt(step.dataset.morningIdx, 10);
    const ds = localDateStr(new Date());
    const key = 'hb-launcher-done-' + ds;
    let done;
    try { done = JSON.parse(localStorage.getItem(key) || '{}'); } catch { done = {}; }
    done[idx] = !done[idx];
    localStorage.setItem(key, JSON.stringify(done));
    _todayRenderMorningMode();
  });

  // Habit checks — hold-to-complete (the commitment gesture).
  // Completing takes a 550ms press while a gold ring fills; a quick tap hints.
  // Un-completing stays a plain click. Keyboard activation (detail 0) completes directly.
  const todayHabitsEl = document.getElementById('today-habits');
  let _holdTimer = null, _holdCheck = null;

  const _completeHabit = async (check) => {
    const habitId = check.dataset.todayToggle;
    const ds = localDateStr(new Date());
    const habit = _habits.find(h => h.id === habitId);
    const habitRow = check.closest('.today-habit');
    if (habit && habitRow) _todayFireCelebration(habitRow, habit);
    await habitToggle(habitId, ds);
    setTimeout(() => renderToday(), 400);
  };
  const _cancelHold = (hint) => {
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
    if (_holdCheck) {
      _holdCheck.classList.remove('holding');
      if (hint) {
        const c = _holdCheck;
        c.classList.remove('hold-hint'); void c.offsetWidth; c.classList.add('hold-hint');
        setTimeout(() => c.classList.remove('hold-hint'), 900);
      }
      _holdCheck = null;
    }
  };

  todayHabitsEl?.addEventListener('pointerdown', e => {
    const check = e.target.closest('[data-today-toggle]');
    if (!check) return;
    const ds = localDateStr(new Date());
    if (_habitLogs[ds]?.completions?.[check.dataset.todayToggle]) return; // uncomplete = click
    _holdCheck = check;
    check.classList.add('holding');
    _holdTimer = setTimeout(() => {
      const c = _holdCheck;
      _holdTimer = null; _holdCheck = null;
      if (c) { c.classList.remove('holding'); c.dataset.heldDone = '1'; _completeHabit(c); }
    }, 550);
  });
  todayHabitsEl?.addEventListener('pointerup', () => _cancelHold(true));
  todayHabitsEl?.addEventListener('pointerleave', () => _cancelHold(false));
  todayHabitsEl?.addEventListener('pointercancel', () => _cancelHold(false));

  todayHabitsEl?.addEventListener('click', async e => {
    const check = e.target.closest('[data-today-toggle]');
    if (!check) return;
    if (check.dataset.heldDone === '1') { delete check.dataset.heldDone; return; }
    const habitId = check.dataset.todayToggle;
    const ds = localDateStr(new Date());
    const wasDone = !!_habitLogs[ds]?.completions?.[habitId];
    if (wasDone) {
      await habitToggle(habitId, ds);
      setTimeout(() => renderToday(), 400);
    } else if (e.detail === 0) {
      await _completeHabit(check); // keyboard Enter/Space — no hold required
    }
    // mouse tap on an undone habit: hold-hint already shown by pointerup
  });
}

/* ══ HABITS — RENDER ══ */
function renderHabits() {
  const days     = last7Days();
  const todayStr = localDateStr(new Date());
  const DN       = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  // Day strip header
  const strip = document.getElementById('habits-day-strip');
  if (strip) {
    strip.innerHTML =
      '<div></div>' +
      days.map(d => {
        const ds = localDateStr(d);
        const isT = ds === todayStr;
        return `<div class="habit-day-header-cell ${isT?'today-col':''}">${DN[d.getDay()]}<br>${d.getDate()}</div>`;
      }).join('') +
      '<div class="habit-day-header-cell" style="font-size:10px">STREAK</div>';
  }

  const list = document.getElementById('habits-list');
  if (!list) return;

  if (!_habits.length) {
    list.innerHTML = '<div style="padding:20px 0;font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em">no rituals yet. even stars have routines — add one below</div>';
    return;
  }

  list.innerHTML = _habits.map((h, idx) => {
    const checks = days.map(d => {
      const ds = localDateStr(d);
      const done = !!_habitLogs[ds]?.completions?.[h.id];
      const isToday = ds === todayStr;
      return `<div class="habit-check-v2 ${done?'done':''} ${isToday?'today-col':''}"
               data-habit-id="${escAttr(h.id)}" data-date="${escAttr(ds)}"
               title="${ds}">${done?'✓':''}</div>`;
    }).join('');
    const streak = habitsStreak(h);
    return `<div class="habit-row-v2" style="animation-delay:${idx*30}ms">
      <span class="habit-name-v2">${escHtml(h.name)}</span>
      ${checks}
      <div class="habit-streak-v2">${streak > 0 ? streak+'d' : '—'}</div>
      <button class="habit-del-v2" data-del-habit="${escAttr(h.id)}" title="Remove">✕</button>
    </div>`;
  }).join('');

  // Bind check clicks
  list.querySelectorAll('.habit-check-v2').forEach(el => {
    el.addEventListener('click', () => habitToggle(el.dataset.habitId, el.dataset.date));
  });
  list.querySelectorAll('[data-del-habit]').forEach(el => {
    el.addEventListener('click', () => habitDelete(el.dataset.delHabit));
  });
}

function habitsStreak(h) {
  let s = 0; const now = new Date();
  for (let i = 0; ; i++) {
    const d = new Date(now); d.setDate(now.getDate()-i);
    if (_habitLogs[localDateStr(d)]?.completions?.[h.id]) s++;
    else break;
    if (s > 365) break;
  }
  return s;
}

/* ══ HABITS — CRUD ══ */
async function habitsAddNew() {
  const inp  = document.getElementById('habit-new-inp');
  const name = inp.value.trim();
  if (!name) return;
  inp.value = '';
  const uid = getHabitsUid();
  if (!uid) return;
  const id = 'h_' + Date.now();
  const newHabit = _habitWithDefaults({ id, name, order: _habits.length });
  _habits.push(newHabit);
  renderHabits();
  const { doc, setDoc, serverTimestamp } = window.CDX_FB;
  try {
    await setDoc(doc(window.CDX_DB, 'users', uid, 'habits', id), {
      id, name, order: _habits.length - 1,
      identityTag: '', valueTags: [], tinyBehavior: '', fullBehavior: '',
      anchor: { type: 'anytime', value: '', linkedHabitId: null },
      schedule: { days: 'daily', frequency: 1 },
      stackId: null,
      frictionTags: [], frictionFallbacks: {},
      restDaysPlanned: [],
      status: 'active', graduatedAt: null,
      createdAt: serverTimestamp(), archivedAt: null
    });
  } catch(e) {
    console.warn('habitsAddNew error:', e);
    _habits = _habits.filter(h => h.id !== id);
    inp.value = name;
    renderHabits();
  }
}

async function habitToggle(habitId, dateStr) {
  const uid = getHabitsUid();
  if (!uid) return;
  const { doc, setDoc, updateDoc, deleteField } = window.CDX_FB;
  if (!_habitLogs[dateStr]) _habitLogs[dateStr] = { date: dateStr, completions: {} };
  const wasDone = !!_habitLogs[dateStr].completions[habitId];
  if (wasDone) delete _habitLogs[dateStr].completions[habitId];
  else         _habitLogs[dateStr].completions[habitId] = true;
  renderHabits();
  try {
    const logRef = doc(window.CDX_DB, 'users', uid, 'habitLogs', dateStr);
    if (!wasDone) {
      await setDoc(logRef, { date: dateStr, completions: { [habitId]: true } }, { merge: true });
    } else {
      await updateDoc(logRef, { [`completions.${habitId}`]: deleteField() });
    }
  } catch(e) {
    console.warn('habitToggle error:', e);
    if (!wasDone) delete _habitLogs[dateStr].completions[habitId];
    else          _habitLogs[dateStr].completions[habitId] = true;
    renderHabits();
  }
}

async function habitDelete(habitId) {
  const uid = getHabitsUid();
  if (!uid) return;
  const removed = _habits.find(h => h.id === habitId);
  _habits = _habits.filter(h => h.id !== habitId);
  renderHabits();
  if (_habitsTab === 'habits') renderHabitsTab();
  if (_habitsTab === 'today') renderToday();
  const { doc, deleteDoc, writeBatch, deleteField } = window.CDX_FB;
  try {
    await deleteDoc(doc(window.CDX_DB, 'users', uid, 'habits', habitId));
  } catch(e) {
    console.warn('habitDelete error:', e);
    if (removed) { _habits.push(removed); _habits.sort((a,b)=>(a.order??0)-(b.order??0)); }
    renderHabits();
    return;
  }
  // Purge this habit's completions from the *cached* logs only (≤91 days already in
  // memory), in a single bounded WriteBatch. The old path did getDocs() over the whole
  // habitLogs collection and fired one updateDoc per matching day — potentially hundreds
  // of parallel writes that throttled Firestore. Older logs keep a harmless ghost key;
  // stats iterate live _habits so a deleted habit never counts.
  try {
    const dates = Object.keys(_habitLogs).filter(ds => _habitLogs[ds]?.completions
      && Object.prototype.hasOwnProperty.call(_habitLogs[ds].completions, habitId));
    dates.forEach(ds => { delete _habitLogs[ds].completions[habitId]; });
    for (let i = 0; i < dates.length; i += 400) {
      const batch = writeBatch(window.CDX_DB);
      dates.slice(i, i + 400).forEach(ds =>
        batch.update(doc(window.CDX_DB, 'users', uid, 'habitLogs', ds), { ['completions.' + habitId]: deleteField() }));
      await batch.commit();
    }
  } catch(e) { console.warn('habitLogs purge after habitDelete failed:', e.message); }
}

async function habitUpdate(habitId, data) {
  const uid = getHabitsUid();
  if (!uid) return;
  const { doc, updateDoc, serverTimestamp } = window.CDX_FB;
  try {
    await updateDoc(doc(window.CDX_DB, 'users', uid, 'habits', habitId), { ...data, updatedAt: serverTimestamp() });
  } catch (e) { console.warn('habitUpdate error:', e); }
}

async function habitGraduate(habitId) {
  const uid = getHabitsUid();
  if (!uid) return;
  const { doc, updateDoc, serverTimestamp } = window.CDX_FB;
  try {
    await updateDoc(doc(window.CDX_DB, 'users', uid, 'habits', habitId), {
      status: 'graduated',
      graduatedAt: serverTimestamp()
    });
    showToast('Habit graduated — slot freed', 'success');
  } catch (e) { console.warn('habitGraduate error:', e); showToast('Failed to graduate habit', 'error'); }
}

async function habitReactivate(habitId) {
  const uid = getHabitsUid();
  if (!uid) return;
  const { doc, updateDoc } = window.CDX_FB;
  try {
    await updateDoc(doc(window.CDX_DB, 'users', uid, 'habits', habitId), {
      status: 'active',
      graduatedAt: null
    });
    showToast('Habit reactivated', 'info');
  } catch (e) { console.warn('habitReactivate error:', e); }
}

/* ══ HABITS TAB — Design surface (Phase 3) ══ */
let _hbWizard = { open: false, step: 1, editId: null, data: null };
const HABITS_WIZARD_TOTAL_STEPS = 6;

function _habitsSubscribeWithTabRender(origSub) {
  // Helper no-op — we trigger render via _habitsUnsub already
}

function _habitsCompletionRate30d(habitId) {
  let done = 0, total = 0;
  for (let i = 0; i < 30; i++) {
    const ds = localDateStr(new Date(Date.now() - i * 86400000));
    total++;
    if (_habitLogs[ds]?.completions?.[habitId]) done++;
  }
  return total > 0 ? Math.round(done / total * 100) : 0;
}

function _habitsCompletion60d(habitId) {
  let done = 0, total = 0;
  for (let i = 0; i < 60; i++) {
    const ds = localDateStr(new Date(Date.now() - i * 86400000));
    total++;
    if (_habitLogs[ds]?.completions?.[habitId]) done++;
  }
  return total > 0 ? done / total : 0;
}

function renderHabitsTab() {
  const active = _habits.filter(h => h.status !== 'graduated' && h.status !== 'archived');
  const graduated = _habits.filter(h => h.status === 'graduated');

  // Slot limit banner
  const slotLimit = _hbSettings.activeSlotLimit || 3;
  const slotsEl = document.getElementById('habits-tab-slots');
  if (slotsEl) {
    slotsEl.textContent = `Slots: ${active.length} of ${slotLimit}`;
    slotsEl.classList.toggle('full', active.length >= slotLimit);
  }

  // Create button state
  const createBtn = document.getElementById('habits-create-btn');
  if (createBtn) {
    const atLimit = active.length >= slotLimit;
    createBtn.classList.toggle('disabled', atLimit);
    createBtn.textContent = atLimit ? `✕ Slot limit reached · graduate a habit to open one` : '+ Create habit';
  }

  // Active list
  const activeList = document.getElementById('habits-active-list');
  if (activeList) {
    if (!active.length) {
      activeList.innerHTML = '<div class="habits-empty-state">no rituals yet. even stars have routines — create your first tiny habit below.</div>';
    } else {
      activeList.innerHTML = active.map(h => _habitsCardHtml(h, false)).join('');
    }
  }

  // Graduated list
  const gradList = document.getElementById('habits-graduated-list');
  const gradCount = document.getElementById('habits-graduated-count');
  if (gradCount) gradCount.textContent = String(graduated.length);
  if (gradList) {
    if (!graduated.length) {
      gradList.innerHTML = '<div class="habits-empty-state">No graduated habits yet. A habit graduates when it reaches 90% over 60 days — research suggests it is then automatic.</div>';
    } else {
      gradList.innerHTML = graduated.map(h => _habitsCardHtml(h, true)).join('');
    }
  }

  // Stacks list
  const stacksList = document.getElementById('habits-stacks-list');
  const stacksCount = document.getElementById('habits-stacks-count');
  if (stacksCount) stacksCount.textContent = String(_stacks.length);
  if (stacksList) {
    if (!_stacks.length) {
      stacksList.innerHTML = '<div class="habits-empty-state">Stacks let you chain habits together (e.g., After coffee → Meditate → Journal). Create habits first, then group them here.</div>';
    } else {
      stacksList.innerHTML = _stacks.map(s => `
        <div class="habits-card">
          <div class="habits-card-body">
            <div class="habits-card-title">${escHtml(s.name)}</div>
            <div class="habits-card-meta">
              <span class="habits-card-chip">${escHtml(s.track || 'morning')}</span>
              <span class="habits-card-chip">${(s.habitIds || []).length} habits</span>
            </div>
          </div>
          <div class="habits-card-actions">
            <button class="habits-card-btn danger" data-stack-del="${escAttr(s.id)}" title="Delete stack">✕</button>
          </div>
        </div>
      `).join('');
    }
  }
}

function _habitsCardHtml(h, isGraduated) {
  const rate = _habitsCompletionRate30d(h.id);
  const rateGreen = rate >= 80;
  const identity = h.identityTag ? `<span class="habits-card-chip value">${escHtml(h.identityTag)}</span>` : '';
  const values = (h.valueTags || []).slice(0, 2).map(v => {
    const val = _values.find(x => x.id === v);
    return val ? `<span class="habits-card-chip value">${val.emoji || ''} ${escHtml(val.name)}</span>` : '';
  }).join('');
  const anchor = h.anchor?.value
    ? `<span class="habits-card-chip anchor">${h.anchor.type === 'event' ? 'after' : h.anchor.type === 'time' ? 'at' : 'at'} ${escHtml(h.anchor.value)}</span>`
    : `<span class="habits-card-chip anchor">anytime</span>`;
  const rest = (h.restDaysPlanned || []).length
    ? `<span class="habits-card-chip">rest: ${h.restDaysPlanned.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(' ')}</span>`
    : '';
  const rateDisplay = isGraduated
    ? `<div class="habits-card-rate green">✓</div><div class="habits-card-rate-label">graduated</div>`
    : `<div class="habits-card-rate ${rateGreen ? 'green' : ''}">${rate}%</div><div class="habits-card-rate-label">30-day</div>`;
  const actions = isGraduated
    ? `<button class="habits-card-btn" data-habit-reactivate="${escAttr(h.id)}" title="Reactivate">↻</button>
       <button class="habits-card-btn danger" data-habit-delete="${escAttr(h.id)}" title="Delete">✕</button>`
    : `<button class="habits-card-btn" data-habit-edit="${escAttr(h.id)}" title="Edit">✎</button>
       <button class="habits-card-btn" data-habit-graduate="${escAttr(h.id)}" title="Graduate (mark automatic)">◎</button>
       <button class="habits-card-btn danger" data-habit-delete="${escAttr(h.id)}" title="Delete">✕</button>`;
  return `
    <div class="habits-card">
      <div class="habits-card-body">
        <div class="habits-card-title">${escHtml(h.tinyBehavior || h.name)}</div>
        ${h.identityTag ? `<div class="habits-card-identity">${escHtml(h.identityTag)}</div>` : ''}
        <div class="habits-card-meta">${values}${anchor}${rest}</div>
      </div>
      <div class="habits-card-stats">${rateDisplay}</div>
      <div class="habits-card-actions">${actions}</div>
    </div>`;
}

function _habitsWizardOpen(editHabit) {
  if (!editHabit) {
    // Enforce slot limit on create
    const active = _habits.filter(h => h.status !== 'graduated' && h.status !== 'archived');
    const slotLimit = _hbSettings.activeSlotLimit || 3;
    if (active.length >= slotLimit) {
      showToast('Focus builds habits. Graduate one first or archive it.', 'error');
      return;
    }
  }
  _hbWizard.open = true;
  _hbWizard.step = 1;
  _hbWizard.editId = editHabit?.id || null;
  _hbWizard.data = editHabit ? {
    name: editHabit.name || '',
    identityTag: editHabit.identityTag || '',
    valueTags: [...(editHabit.valueTags || [])],
    tinyBehavior: editHabit.tinyBehavior || '',
    fullBehavior: editHabit.fullBehavior || '',
    anchor: { ...(editHabit.anchor || { type: 'anytime', value: '', linkedHabitId: null }) },
    frictionTags: [...(editHabit.frictionTags || [])],
    restDaysPlanned: [...(editHabit.restDaysPlanned || [])],
  } : {
    name: '', identityTag: '', valueTags: [], tinyBehavior: '', fullBehavior: '',
    anchor: { type: 'event', value: '', linkedHabitId: null },
    frictionTags: [], restDaysPlanned: [],
  };
  document.getElementById('habits-wizard-backdrop').style.display = '';
  document.getElementById('habits-wizard').style.display = 'flex';
  _habitsWizardRender();
}

function _habitsWizardClose() {
  _hbWizard.open = false;
  document.getElementById('habits-wizard-backdrop').style.display = 'none';
  document.getElementById('habits-wizard').style.display = 'none';
}

function _habitsWizardRender() {
  const step = _hbWizard.step;
  document.getElementById('habits-wizard-step-label').textContent = `Step ${step} of ${HABITS_WIZARD_TOTAL_STEPS}`;
  document.getElementById('habits-wizard-progress-fill').style.width = `${(step / HABITS_WIZARD_TOTAL_STEPS) * 100}%`;
  const titles = ['', 'Why this habit?', 'Who are you becoming?', 'The tiny version', 'When will you do it?', 'What could break it?', 'Plan your rest days'];
  document.getElementById('habits-wizard-title').textContent = titles[step];

  // Show/hide steps
  document.querySelectorAll('.habits-wstep').forEach(el => {
    el.style.display = parseInt(el.dataset.wstep, 10) === step ? '' : 'none';
  });
  // Library only on step 1 or 3
  const wlib = document.getElementById('habits-wlib');
  if (wlib) wlib.style.display = (step === 1 || step === 3) ? '' : 'none';

  // Render values grid
  if (step === 1) {
    const grid = document.getElementById('habits-wizard-values');
    if (grid) {
      grid.innerHTML = _values.map(v => {
        const active = _hbWizard.data.valueTags.includes(v.id);
        return `<button class="habits-value-chip ${active ? 'active' : ''}" data-val-id="${escAttr(v.id)}">${v.emoji || ''} ${escHtml(v.name)}</button>`;
      }).join('') || '<div class="habits-empty-state" style="padding:12px">No values yet. Default values are being seeded…</div>';
    }
    // Render library templates
    const libItems = document.getElementById('habits-wlib-items');
    if (libItems) {
      libItems.innerHTML = (HB_HABITS || []).slice(0, 12).map(h =>
        `<button class="habits-wlib-chip" data-template-name="${escAttr(h.name)}" data-template-identity="${escAttr(h.identity || '')}" data-template-tiny="${escAttr(h.sbNew || h.name)}">${h.icon || ''} ${escHtml(h.name)}</button>`
      ).join('');
    }
  }

  // Identity input
  if (step === 2) {
    const inp = document.getElementById('habits-wizard-identity');
    if (inp) inp.value = _hbWizard.data.identityTag || '';
  }

  // Tiny behavior inputs
  if (step === 3) {
    const tinyInp = document.getElementById('habits-wizard-tiny');
    const fullInp = document.getElementById('habits-wizard-full');
    if (tinyInp) tinyInp.value = _hbWizard.data.tinyBehavior || '';
    if (fullInp) fullInp.value = _hbWizard.data.fullBehavior || '';
  }

  // Anchor
  if (step === 4) {
    const inp = document.getElementById('habits-wizard-anchor');
    if (inp) inp.value = _hbWizard.data.anchor.value || '';
    document.querySelectorAll('.habits-anchor-type').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.atype === _hbWizard.data.anchor.type);
    });
    const hint = document.getElementById('habits-wizard-anchor-hint');
    if (hint) {
      const type = _hbWizard.data.anchor.type;
      hint.textContent = type === 'event' ? 'Event-based anchors build automaticity faster than clocks. Tip: name an existing habit (e.g., "morning coffee").'
        : type === 'time' ? 'Time-based cues work, but events work better. Try anchoring to an existing habit if possible.'
        : type === 'location' ? 'Location anchors use environmental triggers (e.g., "at the kitchen table").'
        : 'Anytime habits are flexible but harder to automate. Consider adding an anchor later.';
    }
  }

  // Friction
  if (step === 5) {
    document.querySelectorAll('#habits-wizard-friction .habits-friction-chip').forEach(btn => {
      btn.classList.toggle('active', _hbWizard.data.frictionTags.includes(btn.dataset.friction));
    });
  }

  // Rest days
  if (step === 6) {
    document.querySelectorAll('#habits-wizard-restdays .habits-restday-chip').forEach(btn => {
      btn.classList.toggle('active', _hbWizard.data.restDaysPlanned.includes(parseInt(btn.dataset.dow, 10)));
    });
  }

  // Next button label
  const nextBtn = document.getElementById('habits-wizard-next');
  if (nextBtn) {
    nextBtn.textContent = step === HABITS_WIZARD_TOTAL_STEPS ? (_hbWizard.editId ? 'Save changes' : 'Create habit') : 'Next →';
    nextBtn.classList.toggle('save', step === HABITS_WIZARD_TOTAL_STEPS);
  }
  const backBtn = document.getElementById('habits-wizard-back');
  if (backBtn) backBtn.disabled = step === 1;
}

function _habitsWizardCollectCurrentStep() {
  const step = _hbWizard.step;
  if (step === 2) {
    _hbWizard.data.identityTag = document.getElementById('habits-wizard-identity')?.value.trim() || '';
  }
  if (step === 3) {
    _hbWizard.data.tinyBehavior = document.getElementById('habits-wizard-tiny')?.value.trim() || '';
    _hbWizard.data.fullBehavior = document.getElementById('habits-wizard-full')?.value.trim() || '';
    // Use tiny as the default name if empty
    if (!_hbWizard.data.name) _hbWizard.data.name = _hbWizard.data.tinyBehavior;
  }
  if (step === 4) {
    _hbWizard.data.anchor.value = document.getElementById('habits-wizard-anchor')?.value.trim() || '';
  }
}

async function _habitsWizardSave() {
  _habitsWizardCollectCurrentStep();
  const d = _hbWizard.data;
  if (!d.tinyBehavior && !d.name) {
    showToast('Please enter a tiny behavior', 'error');
    return;
  }
  if (!d.name) d.name = d.tinyBehavior;

  const uid = getHabitsUid();
  if (!uid) return;
  const { doc, setDoc, updateDoc, serverTimestamp } = window.CDX_FB;

  try {
    if (_hbWizard.editId) {
      await updateDoc(doc(window.CDX_DB, 'users', uid, 'habits', _hbWizard.editId), {
        name: d.name,
        identityTag: d.identityTag,
        valueTags: d.valueTags,
        tinyBehavior: d.tinyBehavior,
        fullBehavior: d.fullBehavior,
        anchor: d.anchor,
        frictionTags: d.frictionTags,
        restDaysPlanned: d.restDaysPlanned,
        updatedAt: serverTimestamp()
      });
      showToast('Habit updated', 'success');
    } else {
      const id = 'h_' + Date.now();
      await setDoc(doc(window.CDX_DB, 'users', uid, 'habits', id), {
        id,
        name: d.name,
        order: _habits.length,
        identityTag: d.identityTag,
        valueTags: d.valueTags,
        tinyBehavior: d.tinyBehavior,
        fullBehavior: d.fullBehavior,
        anchor: d.anchor,
        schedule: { days: 'daily', frequency: 1 },
        stackId: null,
        frictionTags: d.frictionTags,
        frictionFallbacks: {},
        restDaysPlanned: d.restDaysPlanned,
        status: 'active',
        graduatedAt: null,
        createdAt: serverTimestamp(),
        archivedAt: null
      });
      showToast('Habit created', 'success');
    }
    _habitsWizardClose();
  } catch (e) {
    console.warn('habits wizard save error:', e);
    showToast('Failed to save habit', 'error');
  }
}

function _habitsWizardNext() {
  _habitsWizardCollectCurrentStep();
  if (_hbWizard.step === HABITS_WIZARD_TOTAL_STEPS) {
    _habitsWizardSave();
    return;
  }
  _hbWizard.step++;
  _habitsWizardRender();
}

function _habitsWizardBack() {
  _habitsWizardCollectCurrentStep();
  if (_hbWizard.step > 1) { _hbWizard.step--; _habitsWizardRender(); }
}

function _habitsTabInit() {
  const pane = document.getElementById('hpane-habits');
  if (!pane || pane.dataset.inited === '1') return;
  pane.dataset.inited = '1';

  // Create button
  document.getElementById('habits-create-btn')?.addEventListener('click', () => {
    const createBtn = document.getElementById('habits-create-btn');
    if (createBtn?.classList.contains('disabled')) {
      showToast('Graduate a habit to free a slot', 'error');
      return;
    }
    _habitsWizardOpen(null);
  });

  // Delegated card actions (edit, delete, graduate, reactivate)
  pane.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-habit-edit]');
    if (editBtn) {
      const h = _habits.find(x => x.id === editBtn.dataset.habitEdit);
      if (h) _habitsWizardOpen(h);
      return;
    }
    const delBtn = e.target.closest('[data-habit-delete]');
    if (delBtn) {
      const h = _habits.find(x => x.id === delBtn.dataset.habitDelete);
      if (h && await cdxConfirm(`Delete "${h.name}"?`)) await habitDelete(h.id);
      return;
    }
    const gradBtn = e.target.closest('[data-habit-graduate]');
    if (gradBtn) {
      const h = _habits.find(x => x.id === gradBtn.dataset.habitGraduate);
      if (h && await cdxConfirm(`Mark "${h.name}" as graduated?\nIt will move to the graduated list and free a slot.`, { okLabel: 'Graduate', okColor: 'rgb(57,255,20)', okBg: 'rgba(57,255,20,0.1)', okBorder: 'rgba(57,255,20,0.4)' })) {
        await habitGraduate(h.id);
      }
      return;
    }
    const reactBtn = e.target.closest('[data-habit-reactivate]');
    if (reactBtn) {
      const h = _habits.find(x => x.id === reactBtn.dataset.habitReactivate);
      if (!h) return;
      const active = _habits.filter(x => x.status !== 'graduated' && x.status !== 'archived');
      const slotLimit = _hbSettings.activeSlotLimit || 3;
      if (active.length >= slotLimit) {
        showToast('Slot limit full — graduate another habit first', 'error');
        return;
      }
      await habitReactivate(h.id);
      return;
    }
    const stackDelBtn = e.target.closest('[data-stack-del]');
    if (stackDelBtn) {
      if (await cdxConfirm('Delete this stack?')) await deleteStack(stackDelBtn.dataset.stackDel);
      return;
    }
  });

  // Wizard: close + backdrop
  document.getElementById('habits-wizard-close')?.addEventListener('click', _habitsWizardClose);
  document.getElementById('habits-wizard-backdrop')?.addEventListener('click', _habitsWizardClose);

  // Wizard: back/next
  document.getElementById('habits-wizard-back')?.addEventListener('click', _habitsWizardBack);
  document.getElementById('habits-wizard-next')?.addEventListener('click', _habitsWizardNext);

  // Wizard: value chip clicks (delegation on body)
  document.querySelector('.habits-wizard-body')?.addEventListener('click', e => {
    // Values
    const val = e.target.closest('[data-val-id]');
    if (val) {
      const id = val.dataset.valId;
      const idx = _hbWizard.data.valueTags.indexOf(id);
      if (idx >= 0) _hbWizard.data.valueTags.splice(idx, 1);
      else if (_hbWizard.data.valueTags.length < 2) _hbWizard.data.valueTags.push(id);
      else { showToast('Pick at most 2 values', 'info'); return; }
      val.classList.toggle('active');
      return;
    }
    // Anchor type
    const atype = e.target.closest('[data-atype]');
    if (atype) {
      _hbWizard.data.anchor.type = atype.dataset.atype;
      _habitsWizardRender();
      return;
    }
    // Friction chip
    const fric = e.target.closest('[data-friction]');
    if (fric) {
      const f = fric.dataset.friction;
      const idx = _hbWizard.data.frictionTags.indexOf(f);
      if (idx >= 0) _hbWizard.data.frictionTags.splice(idx, 1);
      else _hbWizard.data.frictionTags.push(f);
      fric.classList.toggle('active');
      return;
    }
    // Rest day chip
    const rd = e.target.closest('[data-dow]');
    if (rd) {
      const dow = parseInt(rd.dataset.dow, 10);
      const idx = _hbWizard.data.restDaysPlanned.indexOf(dow);
      if (idx >= 0) _hbWizard.data.restDaysPlanned.splice(idx, 1);
      else _hbWizard.data.restDaysPlanned.push(dow);
      rd.classList.toggle('active');
      return;
    }
    // Library template
    const tpl = e.target.closest('[data-template-name]');
    if (tpl) {
      _hbWizard.data.name = tpl.dataset.templateName;
      _hbWizard.data.tinyBehavior = tpl.dataset.templateTiny;
      // Strip quotes from identity string
      const ident = (tpl.dataset.templateIdentity || '').replace(/^"|"$/g, '').replace(/^I am (a |someone who |the )?/i, '').split(/[.—-]/)[0].trim().slice(0, 60);
      _hbWizard.data.identityTag = ident;
      showToast('Template applied — adjust and continue', 'success');
      return;
    }
  });
}

/* ══ REFLECT TAB — Phase 5 ══ */
let _reflectReviewTimer = null;
let _reflectInited = false;
let _reflectCurrentReview = null;

function _reflectWeekKey() {
  // ISO week key: YYYY-Www based on Monday of current week
  const now = new Date();
  const dow = now.getDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - daysBack);
  mon.setHours(0,0,0,0);
  // Approximate ISO week number
  const firstJan = new Date(mon.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((mon - firstJan) / 86400000 + firstJan.getDay() + 1) / 7);
  return `${mon.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function _reflectWeekDates() {
  const now = new Date();
  const dow = now.getDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - daysBack + i);
    d.setHours(0,0,0,0);
    dates.push(d);
  }
  return dates;
}

async function _reflectLoadReview() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB) return null;
  const weekKey = _reflectWeekKey();
  try {
    const { doc, getDoc } = window.CDX_FB;
    const snap = await getDoc(doc(window.CDX_DB, 'users', uid, 'weeklyReviews', weekKey));
    return snap.exists() ? snap.data() : null;
  } catch (e) { console.warn('reflect load:', e); return null; }
}

async function _reflectSaveReview() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB) return;
  const weekKey = _reflectWeekKey();
  const data = {
    weekKey,
    worked:   document.getElementById('reflect-review-worked')?.value.trim() || '',
    didnt:    document.getElementById('reflect-review-didnt')?.value.trim() || '',
    next:     document.getElementById('reflect-review-next')?.value.trim() || '',
    reanchor: document.getElementById('reflect-review-reanchor')?.value.trim() || '',
  };
  try {
    const { doc, setDoc, serverTimestamp } = window.CDX_FB;
    await setDoc(doc(window.CDX_DB, 'users', uid, 'weeklyReviews', weekKey), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    const saveEl = document.getElementById('reflect-review-save');
    if (saveEl) {
      saveEl.textContent = 'Saved ✓'; saveEl.classList.add('saving');
      setTimeout(() => { saveEl.textContent = 'Saved automatically'; saveEl.classList.remove('saving'); }, 1500);
    }
  } catch (e) { console.warn('reflect save:', e); }
}

function _reflectScheduleReviewSave() {
  clearTimeout(_reflectReviewTimer);
  _reflectReviewTimer = setTimeout(() => _reflectSaveReview(), 900);
}

function _reflectInit() {
  if (_reflectInited) return;
  _reflectInited = true;
  // Wire textareas to debounced save
  ['reflect-review-worked','reflect-review-didnt','reflect-review-next','reflect-review-reanchor'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _reflectScheduleReviewSave);
  });
}

async function renderReflect() {
  _reflectInit();

  const weekDates = _reflectWeekDates();
  const weekDs = weekDates.map(d => localDateStr(d));
  const now = new Date();
  const todayDs = localDateStr(now);

  // Week label
  const labelEl = document.getElementById('reflect-week-label');
  if (labelEl) {
    const start = weekDates[0], end = weekDates[6];
    const fmt = d => d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    labelEl.textContent = `${fmt(start)} – ${fmt(end)}`;
  }

  // Fresh-start card (Mondays, month-start, or new season)
  const freshEl = document.getElementById('reflect-fresh-start');
  if (freshEl) {
    const dow = now.getDay();
    const dom = now.getDate();
    let msg = '';
    if (dow === 1) msg = '<strong>It\'s Monday.</strong> Fresh start effect is real — use the motivation boost to re-anchor a wobbly habit or start a tiny new one.';
    else if (dom === 1) msg = '<strong>New month.</strong> Research (Milkman): fresh-start landmarks boost behavior change by up to 30%. Name one thing you want to carry forward.';
    if (msg) {
      freshEl.innerHTML = `<span class="reflect-fresh-icon">☀</span><div class="reflect-fresh-text">${msg}</div>`;
      freshEl.style.display = 'flex';
    } else {
      freshEl.style.display = 'none';
    }
  }

  // Season
  const seasonNameEl = document.getElementById('reflect-season-name');
  const seasonSubEl = document.getElementById('reflect-season-sub');
  const seasonIdEl = document.getElementById('reflect-season-identity');
  if (seasonNameEl) {
    seasonNameEl.textContent = _hbSettings.season || 'No season set';
  }
  if (seasonSubEl) {
    if (_hbSettings.seasonStartDate) {
      const s = new Date(_hbSettings.seasonStartDate + 'T00:00');
      const diff = Math.max(1, Math.floor((Date.now() - s.getTime()) / 86400000) + 1);
      seasonSubEl.textContent = `Day ${diff} of the chapter`;
    } else {
      seasonSubEl.textContent = 'Set a start date in habits settings';
    }
  }
  if (seasonIdEl) {
    seasonIdEl.textContent = _behav.identity ? `"${_behav.identity}"` : '';
  }

  // Active habits list (used across sections)
  const habits = _habits.filter(h => h.status !== 'graduated' && h.status !== 'archived');

  // Week stats
  const weekStatsEl = document.getElementById('reflect-week-stats');
  if (weekStatsEl) {
    let totalDone = 0, totalPossible = 0, bestDayIdx = 0, bestDayCnt = 0, restDayCount = 0;
    weekDs.forEach((ds, i) => {
      const log = _habitLogs[ds] || {};
      if (log.restDay) { restDayCount++; return; }
      const comps = log.completions || {};
      const doneCnt = habits.reduce((s, h) => s + (comps[h.id] ? 1 : 0), 0);
      totalDone += doneCnt;
      totalPossible += habits.length;
      if (doneCnt > bestDayCnt) { bestDayCnt = doneCnt; bestDayIdx = i; }
    });
    const pct = totalPossible > 0 ? Math.round(totalDone / totalPossible * 100) : 0;
    const dowNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const greenPct = pct >= 70;
    weekStatsEl.innerHTML = `
      <div class="reflect-stat">
        <div class="reflect-stat-num ${greenPct ? 'green' : ''}">${pct}%</div>
        <div class="reflect-stat-label">Completion rate</div>
      </div>
      <div class="reflect-stat">
        <div class="reflect-stat-num">${totalDone}</div>
        <div class="reflect-stat-label">Habit completions</div>
      </div>
      <div class="reflect-stat">
        <div class="reflect-stat-num">${bestDayCnt > 0 ? dowNames[bestDayIdx] : '—'}</div>
        <div class="reflect-stat-label">Best day · ${bestDayCnt} done</div>
      </div>
      <div class="reflect-stat">
        <div class="reflect-stat-num">${restDayCount}</div>
        <div class="reflect-stat-label">Rest days</div>
      </div>`;
  }

  // 7-day grid
  const gridEl = document.getElementById('reflect-week-grid');
  if (gridEl) {
    const dowNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    gridEl.innerHTML = weekDates.map((d, i) => {
      const ds = weekDs[i];
      const log = _habitLogs[ds] || {};
      const isRest = !!log.restDay;
      const comps = log.completions || {};
      const doneCnt = habits.reduce((s, h) => s + (comps[h.id] ? 1 : 0), 0);
      const pct = habits.length > 0 ? doneCnt / habits.length : 0;
      const isToday = ds === todayDs;
      const classes = ['reflect-week-cell'];
      if (isToday) classes.push('today');
      if (isRest) classes.push('rest');
      if (isRest) {
        return `<div class="${classes.join(' ')}">
          <span class="reflect-week-dow">${dowNames[i]}</span>
          <span class="reflect-week-ratio rest-label">rest</span>
        </div>`;
      }
      const greenBar = pct >= 0.8;
      return `<div class="${classes.join(' ')}">
        <span class="reflect-week-dow">${dowNames[i]}</span>
        <span class="reflect-week-ratio ${greenBar ? 'green' : ''}">${habits.length > 0 ? `${doneCnt}/${habits.length}` : '—'}</span>
        <div class="reflect-week-bar"><div class="reflect-week-bar-fill ${greenBar ? 'green' : ''}" style="width:${Math.round(pct * 100)}%"></div></div>
      </div>`;
    }).join('');
  }

  // Wins + Needs love
  const winsEl = document.getElementById('reflect-wins');
  const needsEl = document.getElementById('reflect-needs');
  if (winsEl && needsEl) {
    const nonRestDates = weekDs.filter(ds => !_habitLogs[ds]?.restDay);
    if (!habits.length || !nonRestDates.length) {
      winsEl.innerHTML = '<div class="hins-empty-state">No data yet this week.</div>';
      needsEl.innerHTML = '<div class="hins-empty-state">No data yet this week.</div>';
    } else {
      const rows = habits.map(h => {
        const done = nonRestDates.filter(ds => _habitLogs[ds]?.completions?.[h.id]).length;
        const pct = Math.round(done / nonRestDates.length * 100);
        return { h, done, total: nonRestDates.length, pct };
      });
      const wins = rows.filter(r => r.pct >= 100);
      const needs = rows.filter(r => r.pct < 50);
      winsEl.innerHTML = wins.length
        ? wins.map(r => `<div class="reflect-list-row win"><span class="reflect-list-icon">◎</span><span class="reflect-list-name">${escHtml(r.h.tinyBehavior || r.h.name)}</span><span class="reflect-list-pct green">${r.done}/${r.total}</span></div>`).join('')
        : '<div class="hins-empty-state">No 100% habits yet this week. One tiny win today changes that.</div>';
      needsEl.innerHTML = needs.length
        ? needs.map(r => `<div class="reflect-list-row"><span class="reflect-list-icon">◐</span><span class="reflect-list-name">${escHtml(r.h.tinyBehavior || r.h.name)}</span><span class="reflect-list-pct">${r.pct}%</span></div>`).join('')
        : '<div class="hins-empty-state">Nothing under 50% — great discipline this week.</div>';
    }
  }

  // Values Action Balance — count completions per value this week
  const valuesEl = document.getElementById('reflect-values');
  if (valuesEl) {
    if (!_values.length) {
      valuesEl.innerHTML = '<div class="hins-empty-state">No values defined yet. They\'re seeded automatically on first open.</div>';
    } else {
      const valCounts = {}; _values.forEach(v => valCounts[v.id] = 0);
      weekDs.forEach(ds => {
        const comps = _habitLogs[ds]?.completions || {};
        habits.forEach(h => {
          if (comps[h.id]) {
            (h.valueTags || []).forEach(vid => {
              if (valCounts[vid] != null) valCounts[vid]++;
            });
          }
        });
      });
      const maxCount = Math.max(...Object.values(valCounts), 1);
      const sorted = _values.map(v => ({ v, count: valCounts[v.id] })).sort((a, b) => b.count - a.count);
      valuesEl.innerHTML = sorted.map(({ v, count }) => {
        const pct = Math.round(count / maxCount * 100);
        const greenBar = pct >= 70;
        return `<div class="reflect-value-row">
          <span class="reflect-value-emoji">${v.emoji || ''}</span>
          <span class="reflect-value-name">${escHtml(v.name)}</span>
          <div class="reflect-value-bar"><div class="reflect-value-bar-fill ${greenBar ? 'green' : ''}" style="width:${pct}%"></div></div>
          <span class="reflect-value-count">${count} completions</span>
        </div>`;
      }).join('');
    }
  }

  // Rest days taken
  const restEl = document.getElementById('reflect-rest');
  if (restEl) {
    const dowNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const rests = weekDs.map((ds, i) => _habitLogs[ds]?.restDay ? dowNames[i] : null).filter(Boolean);
    restEl.innerHTML = rests.length
      ? rests.map(d => `<span class="reflect-rest-chip">🌙 ${d}</span>`).join('')
      : '<div class="reflect-rest-empty">No rest days taken this week.</div>';
  }

  // Load weekly review content
  _reflectCurrentReview = await _reflectLoadReview();
  if (_reflectCurrentReview) {
    const r = _reflectCurrentReview;
    const workedEl = document.getElementById('reflect-review-worked');
    const didntEl = document.getElementById('reflect-review-didnt');
    const nextEl = document.getElementById('reflect-review-next');
    const reanchorEl = document.getElementById('reflect-review-reanchor');
    if (workedEl && document.activeElement !== workedEl) workedEl.value = r.worked || '';
    if (didntEl && document.activeElement !== didntEl) didntEl.value = r.didnt || '';
    if (nextEl && document.activeElement !== nextEl) nextEl.value = r.next || '';
    if (reanchorEl && document.activeElement !== reanchorEl) reanchorEl.value = r.reanchor || '';
  } else {
    // Clear textareas for a new week
    ['reflect-review-worked','reflect-review-didnt','reflect-review-next','reflect-review-reanchor'].forEach(id => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = '';
    });
  }

  // Graduation ledger — habits with status=graduated, sorted by graduatedAt desc
  const ledgerEl = document.getElementById('reflect-ledger');
  if (ledgerEl) {
    const graduated = _habits.filter(h => h.status === 'graduated').sort((a, b) => {
      const aT = a.graduatedAt?.seconds || 0;
      const bT = b.graduatedAt?.seconds || 0;
      return bT - aT;
    });
    if (!graduated.length) {
      ledgerEl.innerHTML = '<div class="hins-empty-state">No graduated habits yet. Reach 90% over 60 days on a habit to graduate it — research suggests it\'s then automatic.</div>';
    } else {
      ledgerEl.innerHTML = graduated.map(h => {
        let dateStr = '';
        if (h.graduatedAt?.seconds) {
          dateStr = new Date(h.graduatedAt.seconds * 1000).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return `<div class="reflect-ledger-row">
          <span class="reflect-ledger-icon">◎</span>
          <div class="reflect-ledger-body">
            <div class="reflect-ledger-name">${escHtml(h.tinyBehavior || h.name)}</div>
            ${h.identityTag ? `<div class="reflect-ledger-identity">${escHtml(h.identityTag)}</div>` : ''}
          </div>
          <span class="reflect-ledger-date">${dateStr}</span>
        </div>`;
      }).join('');
    }
  }
}

/* ══ HABITS INSIGHTS — Phase 4 ══ */
function _hinsDrawHeatmap() {
  const cvs = document.getElementById('hins-heatmap-canvas');
  if (!cvs) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || 800, H = cvs.clientHeight || 180;
  cvs.width = W * dpr; cvs.height = H * dpr;
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  const ctx = cvs.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const cols = 13, rows = 7;
  const leftPad = 36, topPad = 18, rightPad = 12, botPad = 12;
  const plotW = W - leftPad - rightPad;
  const plotH = H - topPad - botPad;
  const gap = 3;
  const cellW = (plotW - gap * (cols - 1)) / cols;
  const cellH = (plotH - gap * (rows - 1)) / rows;
  const size = Math.min(cellW, cellH);

  // Row labels (Mon/Wed/Fri)
  const dayLabels = ['Mon','','Wed','','Fri','','Sun'];
  ctx.font = "300 8px 'DM Mono',monospace";
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let r = 0; r < rows; r++) {
    if (!dayLabels[r]) continue;
    ctx.fillText(dayLabels[r], leftPad - 6, topPad + r * (size + gap) + size / 2);
  }

  // Today's dow (0=Mon…6=Sun)
  const todayDow = (new Date().getDay() + 6) % 7;
  const habits = _habits.filter(h => h.status !== 'graduated' && h.status !== 'archived');

  let totalDone = 0, totalDays = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // compute daysBack from today: col 12 is current week, col 0 is 12 weeks ago
      const daysBack = (cols - 1 - c) * 7 + (todayDow - r);
      const x = leftPad + c * (size + gap);
      const y = topPad + r * (size + gap);
      if (daysBack < 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        _hinsRoundRect(ctx, x, y, size, size, 2);
        ctx.fill();
        continue;
      }
      const ds = localDateStr(new Date(Date.now() - daysBack * 86400000));
      const comps = _habitLogs[ds]?.completions || {};
      const doneCnt = habits.reduce((s, h) => s + (comps[h.id] ? 1 : 0), 0);
      const max = habits.length || 1;
      const ratio = doneCnt / max;
      totalDone += doneCnt;
      totalDays += max;

      let bg;
      if (doneCnt === 0) bg = 'rgba(255,255,255,0.04)';
      else if (ratio < 0.25) bg = 'rgba(255,255,255,0.14)';
      else if (ratio < 0.5)  bg = 'rgba(255,255,255,0.26)';
      else if (ratio < 0.85) bg = 'rgba(255,255,255,0.42)';
      else                   bg = 'rgb(57,255,20)';

      ctx.fillStyle = bg;
      _hinsRoundRect(ctx, x, y, size, size, 2);
      ctx.fill();
      if (ratio >= 0.85) {
        ctx.shadowColor = 'rgba(57,255,20,0.5)';
        ctx.shadowBlur = 5;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // Stat text
  const statEl = document.getElementById('hins-heatmap-stat');
  if (statEl) {
    const pct = totalDays > 0 ? Math.round(totalDone / totalDays * 100) : 0;
    statEl.textContent = `${totalDone} completions · ${pct}% 91-day rate`;
  }
}

function _hinsRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function _hinsAutomaticityEstimate(habit) {
  // Days tracked since createdAt (or since first log)
  let daysTracked = 0;
  if (habit.createdAt) {
    const created = habit.createdAt?.toDate ? habit.createdAt.toDate() : (habit.createdAt?.seconds ? new Date(habit.createdAt.seconds * 1000) : new Date(habit.createdAt));
    daysTracked = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
  }
  // 30-day completion rate
  const rate = _habitsCompletionRate30d(habit.id);
  // Simple estimate: if rate >= 90%, remaining = max(0, 66 - daysTracked); if rate >= 70%, 90 - daysTracked; else 120 - daysTracked
  const target = rate >= 90 ? 66 : rate >= 70 ? 90 : 120;
  const remaining = Math.max(0, target - daysTracked);
  return { daysTracked, rate, remaining, rangeMin: 18, rangeMax: 254 };
}

function _hinsDrawMiniRing(containerEl, pct) {
  if (!containerEl) return;
  const size = 52, stroke = 5, r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const green = pct >= 80;
  const color = green ? 'rgb(57,255,20)' : 'rgba(255,255,255,0.5)';
  const glow = green ? 'drop-shadow(0 0 4px rgba(57,255,20,0.4))' : 'none';
  containerEl.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="filter:${glow}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
    </svg>`;
}

function renderHabitsInsights() {
  const habits = _habits.filter(h => h.status !== 'graduated' && h.status !== 'archived');

  // ── Graduation Signal ──
  const banner = document.getElementById('hins-graduation-banner');
  if (banner) {
    // A habit is eligible if 60-day rate >= 90%
    const eligible = habits.filter(h => _habitsCompletion60d(h.id) >= 0.9);
    if (eligible.length) {
      const names = eligible.slice(0, 2).map(h => `<strong>${escHtml(h.tinyBehavior || h.name)}</strong>`).join(' and ');
      banner.innerHTML = `
        <span class="hins-graduation-icon">◎</span>
        <div class="hins-graduation-text">${names} ${eligible.length > 1 ? 'have' : 'has'} hit 90%+ over 60 days — likely automatic. Graduate to free a slot.</div>`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  // ── 13-week heatmap ──
  // Draw after next frame so layout sizes are correct
  requestAnimationFrame(() => _hinsDrawHeatmap());

  // ── Automaticity Estimate per habit ──
  const autoList = document.getElementById('hins-auto-list');
  if (autoList) {
    if (!habits.length) {
      autoList.innerHTML = '<div class="hins-empty-state">No active habits yet. Create one in the Habits tab to start tracking automaticity.</div>';
    } else {
      autoList.innerHTML = '';
      habits.forEach(h => {
        const est = _hinsAutomaticityEstimate(h);
        const row = document.createElement('div');
        row.className = 'hins-auto-row';
        row.innerHTML = `
          <div class="hins-auto-ring" data-pct="${est.rate}"></div>
          <div class="hins-auto-name">
            <div class="hins-auto-name-text">${escHtml(h.tinyBehavior || h.name)}</div>
            <div class="hins-auto-name-sub">${est.daysTracked}d tracked · ${h.identityTag ? escHtml(h.identityTag) : 'no identity set'}</div>
          </div>
          <div class="hins-auto-stats">
            <div class="hins-auto-pct ${est.rate >= 80 ? 'green' : ''}">${est.rate}%</div>
            <div class="hins-auto-remaining">${est.remaining > 0 ? '~' + est.remaining + 'd to target' : 'likely automatic'}</div>
          </div>`;
        autoList.appendChild(row);
        _hinsDrawMiniRing(row.querySelector('.hins-auto-ring'), est.rate);
      });
    }
  }

  // ── Context Reliability Matrix ──
  const ctxWrap = document.getElementById('hins-context-wrap');
  if (ctxWrap) {
    if (!habits.length) {
      ctxWrap.innerHTML = '<div class="hins-empty-state">Add habits to see context patterns.</div>';
    } else {
      const dowNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      // Compute per-habit dow completion rate over last 30 days
      const dowStats = {}; // habitId -> [possible, done] per dow
      habits.forEach(h => {
        dowStats[h.id] = Array.from({length:7}, () => ({ possible: 0, done: 0 }));
      });
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 86400000);
        const ds = localDateStr(d);
        const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
        const comps = _habitLogs[ds]?.completions || {};
        habits.forEach(h => {
          dowStats[h.id][dow].possible++;
          if (comps[h.id]) dowStats[h.id][dow].done++;
        });
      }

      const rows = habits.length;
      const cols = 8; // 1 label + 7 days
      const grid = document.createElement('div');
      grid.className = 'hins-context-grid';
      grid.style.gridTemplateColumns = '180px repeat(7, minmax(28px, 1fr))';
      // Header row: corner + day abbreviations
      const corner = document.createElement('div'); corner.className = 'hins-ctx-corner'; grid.appendChild(corner);
      dowNames.forEach(n => {
        const h = document.createElement('div'); h.className = 'hins-ctx-dowhead'; h.textContent = n; grid.appendChild(h);
      });
      // Habit rows
      habits.forEach(h => {
        const nameEl = document.createElement('div');
        nameEl.className = 'hins-ctx-habit';
        nameEl.textContent = h.tinyBehavior || h.name;
        grid.appendChild(nameEl);
        for (let dow = 0; dow < 7; dow++) {
          const cell = document.createElement('div');
          cell.className = 'hins-ctx-cell';
          const stat = dowStats[h.id][dow];
          if (stat.possible === 0) {
            cell.classList.add('empty');
            cell.textContent = '';
          } else {
            const pct = Math.round(stat.done / stat.possible * 100);
            const green = pct >= 80;
            const dim = pct < 30;
            const alpha = Math.max(0.08, Math.min(0.85, pct / 100));
            cell.style.background = green ? 'rgb(57,255,20)' : `rgba(255,255,255,${alpha.toFixed(2)})`;
            if (green) cell.style.boxShadow = '0 0 4px rgba(57,255,20,0.4)';
            cell.textContent = pct + '%';
            cell.style.color = green ? '#0d0c0a' : (alpha > 0.4 ? '#0d0c0a' : 'rgba(255,255,255,0.5)');
            cell.title = `${h.tinyBehavior || h.name} · ${dowNames[dow]} · ${stat.done}/${stat.possible} (${pct}%)`;
          }
          grid.appendChild(cell);
        }
      });
      ctxWrap.innerHTML = '';
      ctxWrap.appendChild(grid);
    }
  }

  // ── Friction Patterns ──
  const fricList = document.getElementById('hins-friction-list');
  if (fricList) {
    // Count friction skips from habitLogs skipReasons across last 91 days
    const counts = {};
    Object.values(_habitLogs).forEach(log => {
      const reasons = log?.skipReasons || {};
      Object.values(reasons).forEach(r => {
        if (!r) return;
        counts[r] = (counts[r] || 0) + 1;
      });
    });
    // Also include friction tags from habits (as "declared risks")
    const declared = {};
    habits.forEach(h => (h.frictionTags || []).forEach(t => { declared[t] = (declared[t] || 0) + 1; }));
    const all = Object.keys({...counts, ...declared});
    if (!all.length) {
      fricList.innerHTML = '<div class="hins-empty-state">No friction data yet. Friction tags declared in the Habits tab will surface here once skip reasons are logged.</div>';
    } else {
      const fricIcons = { travel: '✈', 'low-energy': '🔋', meetings: '📞', weekend: '🌙', 'late-night': '🌃', illness: '🤒' };
      const rows = all.map(tag => ({
        tag,
        skipped: counts[tag] || 0,
        declared: declared[tag] || 0,
      })).sort((a, b) => (b.skipped + b.declared) - (a.skipped + a.declared)).slice(0, 6);
      fricList.innerHTML = rows.map(r => `
        <div class="hins-friction-row">
          <span class="hins-friction-icon">${fricIcons[r.tag] || '⚠'}</span>
          <span class="hins-friction-name">${r.tag.replace(/-/g, ' ')}</span>
          <span class="hins-friction-count">${r.skipped > 0 ? r.skipped + ' skip' + (r.skipped === 1 ? '' : 's') : 'declared in ' + r.declared}</span>
        </div>`).join('');
    }
  }

  // ── Mood × Habit Correlation ──
  const moodList = document.getElementById('hins-mood-list');
  if (moodList) {
    // For each habit, compute completion rate on low-mood days (mood <= 2) vs high-mood (mood >= 4)
    if (!habits.length) {
      moodList.innerHTML = '<div class="hins-empty-state">Add habits to see mood correlations.</div>';
    } else {
      const lowMoodDays = [], highMoodDays = [];
      Object.entries(_habitLogs).forEach(([ds, log]) => {
        if (!log) return;
        if (log.mood && log.mood <= 2) lowMoodDays.push(ds);
        if (log.mood && log.mood >= 4) highMoodDays.push(ds);
      });
      if (lowMoodDays.length === 0 && highMoodDays.length === 0) {
        moodList.innerHTML = '<div class="hins-empty-state">Log your mood on the Today tab to see which habits survive low-energy days.</div>';
      } else {
        const rows = habits.map(h => {
          const lowDone = lowMoodDays.filter(ds => _habitLogs[ds]?.completions?.[h.id]).length;
          const highDone = highMoodDays.filter(ds => _habitLogs[ds]?.completions?.[h.id]).length;
          const lowPct = lowMoodDays.length ? Math.round(lowDone / lowMoodDays.length * 100) : null;
          const highPct = highMoodDays.length ? Math.round(highDone / highMoodDays.length * 100) : null;
          return { h, lowPct, highPct };
        });
        moodList.innerHTML = rows.map(r => {
          const low = r.lowPct != null ? r.lowPct : 0;
          const displayPct = r.lowPct != null ? r.lowPct : (r.highPct || 0);
          const green = low >= 70;
          return `
            <div class="hins-mood-row">
              <span class="hins-mood-name">${escHtml(r.h.tinyBehavior || r.h.name)}</span>
              <div class="hins-mood-bar-wrap">
                <div class="hins-mood-bar"><div class="hins-mood-bar-fill ${green ? 'green' : ''}" style="width:${displayPct}%"></div></div>
                <span class="hins-mood-bar-val">${r.lowPct != null ? r.lowPct + '%' : '—'}</span>
              </div>
            </div>`;
        }).join('');
      }
    }
  }
}
function renderRoutines() {
  ['morning','evening'].forEach(slot => {
    const list  = document.getElementById('routines-'+slot+'-list');
    const items = _routines[slot] || [];
    if (!list) return;
    if (!items.length) {
      list.innerHTML = `<div style="padding:12px 0;font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em">No steps yet</div>`;
      return;
    }
    list.innerHTML = items.map((item, i) => `
      <div class="routine-item-v2">
        <div class="routine-time-badge">${escHtml(item.time || '--:--')}</div>
        <input class="routine-text-v2" value="${escAttr(item.text||'')}" placeholder="Step…"
               onchange="routineUpdate('${slot}',${i},'text',this.value)">
        <button class="routine-del-v2" onclick="routineDelete('${slot}',${i})">✕</button>
      </div>`).join('');
  });
}

function routineAdd(slot) {
  const timeEl = document.getElementById('routine-'+slot+'-time');
  const textEl = document.getElementById('routine-'+slot+'-inp');
  const text   = textEl.value.trim();
  if (!text) return;
  (_routines[slot] = _routines[slot] || []).push({ time: timeEl.value.trim(), text });
  routinesSave(_routines);
  textEl.value = ''; timeEl.value = '';
  renderRoutines();
}

function routineUpdate(slot, i, field, val) {
  if (_routines[slot]?.[i]) _routines[slot][i][field] = val;
  routinesSave(_routines);
}

function routineDelete(slot, i) {
  (_routines[slot] || []).splice(i, 1);
  routinesSave(_routines);
  renderRoutines();
}

function routinesSave(data) {
  _routines = data;
  clearTimeout(_routinesSaveTimer);
  _routinesSaveTimer = setTimeout(async () => {
    const uid = getHabitsUid();
    if (!uid || !window.CDX_DB) return;
    const { doc, setDoc, serverTimestamp } = window.CDX_FB;
    try { await setDoc(doc(window.CDX_DB, 'users', uid, 'routines', 'config'), { ...data, updatedAt: serverTimestamp() }); }
    catch(e) { console.warn('routinesSave error:', e); }
  }, 800);
}

/* ══ BEHAVIOURS ══ */
function renderBehaviours() {
  const idEl = document.getElementById('behav-identity');
  const notesEl = document.getElementById('behav-notes');
  if (idEl && idEl !== document.activeElement) idEl.value = _behav.identity || '';
  if (notesEl && notesEl !== document.activeElement) notesEl.value = _behav.notes || '';

  const list = document.getElementById('behav-keystone-list');
  const ks   = _behav.keystone || [];
  if (!list) return;
  if (!ks.length) {
    list.innerHTML = '<div style="padding:8px 0;font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em">No keystone behaviours yet</div>';
    return;
  }
  list.innerHTML = ks.map((k, i) => `
    <div class="keystone-row-v2">
      <div class="keystone-dot"></div>
      <span class="keystone-text">${escHtml(k)}</span>
      <button class="keystone-del" onclick="behavKeystoneDelete(${i})">✕</button>
    </div>`).join('');
}

function behavAutoSave() {
  _behav.identity = document.getElementById('behav-identity')?.value || '';
  _behav.notes    = document.getElementById('behav-notes')?.value || '';
  // Show saving indicator
  const ind = document.getElementById('behav-save-indicator');
  if (ind) { ind.textContent = 'Saving…'; ind.style.opacity = '1'; }
  clearTimeout(_behavSaveTimer);
  _behavSaveTimer = setTimeout(async () => {
    const uid = getHabitsUid();
    if (!uid || !window.CDX_DB) return;
    const { doc, setDoc, serverTimestamp } = window.CDX_FB;
    try {
      await setDoc(doc(window.CDX_DB, 'users', uid, 'behaviours', 'current'), {
        ..._behav, updatedAt: serverTimestamp()
      });
      if (ind) { ind.textContent = 'Saved ✓'; setTimeout(() => { ind.style.opacity = '0'; }, 1500); }
    } catch(e) {
      console.warn('behavSave error:', e);
      if (ind) { ind.textContent = 'Save failed'; }
    }
  }, 1000);
}

function behavKeystoneAdd() {
  const inp = document.getElementById('behav-keystone-inp');
  const val = inp.value.trim();
  if (!val) return;
  (_behav.keystone = _behav.keystone || []).push(val);
  behavAutoSave(); inp.value = '';
  renderBehaviours();
}

function behavKeystoneDelete(i) {
  (_behav.keystone || []).splice(i, 1);
  behavAutoSave();
  renderBehaviours();
}

/* ══ HABITS — INIT ══ */
function initHabitsPage() {
  // Tab buttons
  document.querySelectorAll('.habits-v2-tab[data-htab]').forEach(btn => {
    btn.addEventListener('click', () => switchHabitsTab(btn.dataset.htab));
  });

  // Add habit
  const habitsAddBtn = document.getElementById('habits-add-btn');
  const habitInp     = document.getElementById('habit-new-inp');
  habitsAddBtn?.addEventListener('click', habitsAddNew);
  habitInp?.addEventListener('keydown', e => { if (e.key === 'Enter') habitsAddNew(); });

  // Keystone add
  document.getElementById('behav-keystone-add-btn')?.addEventListener('click', behavKeystoneAdd);
  document.getElementById('behav-keystone-inp')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') behavKeystoneAdd();
  });

  // Init habit data
  habitsSubscribe();
  routinesSubscribe();
  behavSubscribe();
  // Phase 1: also subscribe to values and stacks (needed once hbSettings loads)
  hbSettingsSubscribe();
  valuesSubscribe();
  stacksSubscribe();
  // Phase 2: Today tab init (wires mood/energy chips, rest day, habit taps, etc.)
  _todayInit();
  renderToday();
  renderHabits();
}

