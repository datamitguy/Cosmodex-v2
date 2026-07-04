/* ══ HABIT BUILDER — LIBRARY & CLOCK ══ */
const HB_HABITS = [
  {icon:'📖',name:'Read 15 pages',cat:'mind',dur:'20 min',tag:'Compound Knowledge',identity:'"I am a curious, continuous learner who compounds knowledge daily."',sbNew:'I will read for 15 min'},
  {icon:'📓',name:'10-min journaling',cat:'mind',dur:'10 min',tag:'Mental Clarity',identity:'"I am a reflective, intentional person who thinks before I act."',sbNew:'I will write in my journal for 10 min'},
  {icon:'🧘',name:'Meditation',cat:'mind',dur:'10 min',tag:'Focus',identity:'"I am someone who chooses calm over chaos."',sbNew:'I will meditate for 10 min'},
  {icon:'📝',name:'Gratitude (3 things)',cat:'soul',dur:'5 min',tag:'Positive Affect',identity:'"I am someone who finds light, even on hard days."',sbNew:'I will write 3 things I\'m grateful for'},
  {icon:'🥛',name:'Drink 500ml water',cat:'body',dur:'2 min',tag:'Hydration',identity:'"I am someone who respects and nourishes my body."',sbNew:'I will drink 500ml water'},
  {icon:'🚶',name:'Morning walk',cat:'body',dur:'10 min',tag:'Alertness',identity:'"I am an active, present person who moves with purpose."',sbNew:'I will go for a 10-min walk'},
  {icon:'🧊',name:'Cold shower',cat:'body',dur:'3 min',tag:'Resilience',identity:'"I am someone who does hard things on purpose."',sbNew:'I will finish my shower with 2 min cold'},
  {icon:'💪',name:'7-min workout',cat:'body',dur:'7 min',tag:'Energy',identity:'"I am someone who moves their body every day."',sbNew:'I will do a 7-min workout'},
  {icon:'📵',name:'No phone first 20 min',cat:'mind',dur:'20 min',tag:'Focus',identity:'"I am someone who guards my attention fiercely."',sbNew:'I will keep my phone face-down for 20 min'},
  {icon:'🌅',name:'Watch the sunrise',cat:'soul',dur:'5 min',tag:'Groundedness',identity:'"I am someone who starts the day with intention."',sbNew:'I will step outside and watch the sunrise'},
  {icon:'🎯',name:'Set daily intention',cat:'work',dur:'3 min',tag:'Clarity',identity:'"I am an intentional person who decides before the day decides for me."',sbNew:'I will write my single focus for the day'},
  {icon:'📬',name:'Zero inbox review',cat:'work',dur:'15 min',tag:'Control',identity:'"I am someone who stays on top of what matters."',sbNew:'I will process my inbox to zero'},
  {icon:'🔬',name:'Learn one new thing',cat:'mind',dur:'10 min',tag:'Growth',identity:'"I am a lifelong learner who compounds curiosity."',sbNew:'I will spend 10 min learning something new'},
  {icon:'🤝',name:'Connect with someone',cat:'soul',dur:'5 min',tag:'Belonging',identity:'"I am someone who invests in real relationships."',sbNew:'I will reach out to one person today'},
  {icon:'🌙',name:'Evening wind-down',cat:'soul',dur:'20 min',tag:'Sleep',identity:'"I am someone who protects their recovery."',sbNew:'I will do my evening wind-down routine'},
];

let _hbCurrentCat = 'all';
let _hbCurrentSearch = '';
let _hbSelectedHabit = HB_HABITS[0];
let _hbDoneCount = 0;
let _hbTotalSteps = 0;

function hbRenderLibrary() {
  const list = document.getElementById('hb-habit-list');
  if (!list) return;

  // Load any custom habits from settings
  const customRaw = document.getElementById('hb-cfg-custom-habits')?.value || '';
  const customHabits = customRaw.split('\n').filter(l => l.trim()).map(l => {
    const parts = l.split('·').map(p => p.trim());
    const namePart = parts[0] || '';
    const icon = namePart.match(/^\p{Emoji}/u)?.[0] || '⭐';
    const name = namePart.replace(/^\p{Emoji}\s*/u, '').trim();
    return { icon, name, cat: (parts[2]||'mind').toLowerCase(), dur: parts[1]||'5 min', tag: 'Custom', identity: `"I am someone who practices ${name.toLowerCase()}."`, sbNew: `I will ${name.toLowerCase()}` };
  }).filter(h => h.name);

  const allHabits = [...HB_HABITS, ...customHabits];
  list.innerHTML = '';
  allHabits.filter(h =>
    (_hbCurrentCat === 'all' || h.cat === _hbCurrentCat) &&
    (h.name.toLowerCase().includes(_hbCurrentSearch) || (h.tag||'').toLowerCase().includes(_hbCurrentSearch))
  ).forEach(h => {
    const el = document.createElement('div');
    el.className = 'hb-lib-template';
    if (_hbSelectedHabit && _hbSelectedHabit.name === h.name) el.classList.add('adding');
    el.innerHTML = `<div class="hb-lt-icon">${h.icon}</div><div class="hb-lt-info"><div class="hb-lt-name">${escHtml(h.name)}</div><div class="hb-lt-meta">${escHtml(h.dur)} · ${escHtml(h.tag)}</div></div><div class="hb-lt-add">+</div>`;
    el.addEventListener('click', () => hbSelectHabit(h, el));
    list.appendChild(el);
  });
}

function hbSelectHabit(h, el) {
  document.querySelectorAll('.hb-lib-template').forEach(t => t.classList.remove('adding'));
  if (el) el.classList.add('adding');
  _hbSelectedHabit = h;
  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setEl('hb-sel-icon', h.icon);
  setEl('hb-sel-name', h.name);
  const badge = document.getElementById('hb-sel-cat');
  if (badge) { badge.textContent = h.cat.charAt(0).toUpperCase() + h.cat.slice(1); badge.className = `hb-habit-badge hb-tag hb-tag-${h.cat === 'mind' ? 'lav' : h.cat === 'body' ? 'sage' : h.cat === 'work' ? 'sky' : 'gold'}`; }
  const identity = document.getElementById('hb-sel-identity');
  if (identity) identity.textContent = h.identity || `"I am a person who practices ${h.name.toLowerCase()} — because it reflects who I'm becoming."`;
  const sbNew = document.getElementById('hb-sb-new');
  if (sbNew) sbNew.textContent = h.sbNew || `I will ${h.name.toLowerCase()}`;
  // Reset cue fields
  const setVal = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
  setVal('hb-cue-loc', '');
  setVal('hb-cue-time', '');
  setVal('hb-cue-slot', '📅 Morning Routine');
  setVal('hb-cue-freq', '📆 Daily (Mon–Sun)');
  const why = document.getElementById('hb-why');
  if (why) why.value = '';
  const reward = document.getElementById('hb-reward');
  if (reward) reward.value = '';
}

function hbFilterHabits(v) { _hbCurrentSearch = v.toLowerCase(); hbRenderLibrary(); }

function hbPickCat(el, cat) {
  document.querySelectorAll('.hb-cat-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  _hbCurrentCat = cat;
  hbRenderLibrary();
}

function hbPickRamp(el) {
  document.querySelectorAll('.hb-ramp-step').forEach(r => {
    r.classList.remove('active');
    r.querySelector('.hb-rs-dose')?.classList.remove('active');
  });
  el.classList.add('active');
  el.querySelector('.hb-rs-dose')?.classList.add('active');
}

function hbAddToTracker() {
  if (!_hbSelectedHabit) return;
  const inp = document.getElementById('habit-new-inp');
  if (inp) { inp.value = _hbSelectedHabit.icon + ' ' + _hbSelectedHabit.name; habitsAddNew(); }
  // Switch to today tab
  switchHabitsTab('today');
  document.querySelector('.habits-v2-tab[data-htab="today"]')?.click();
  showToast('Habit added to Today →');
}

function hbSaveDraft() { showToast('Draft saved'); }

/* ── LAUNCHER ────────────────────────────────────────── */
let _hbClockInterval = null;

function hbInitLauncher() {
  // Start live clock
  if (_hbClockInterval) clearInterval(_hbClockInterval);
  hbTickClock();
  _hbClockInterval = setInterval(hbTickClock, 1000);
  hbLoadLauncherFromRoutines();
  hbUpdateLauncherDynamic();
  // Non-negotiable save on blur
  const nonnegEl = document.getElementById('hb-nonneg-text');
  if (nonnegEl && !nonnegEl._cdxBound) {
    nonnegEl._cdxBound = true;
    nonnegEl.addEventListener('blur', () => {
      const val = nonnegEl.textContent.trim();
      _hbSettings.nonNegotiable = val;
      const uid = window.CDX_USER?.uid;
      if (uid) {
        const { doc, setDoc, serverTimestamp } = window.CDX_FB;
        setDoc(doc(window.CDX_DB, 'users', uid, 'hbSettings', 'config'),
          { nonNegotiable: val, updatedAt: serverTimestamp() }, { merge: true });
      }
    });
  }
}

function hbTickClock() {
  const n = new Date();
  const h = String(n.getHours()).padStart(2,'0');
  const m = String(n.getMinutes()).padStart(2,'0');
  const el = document.getElementById('hb-clock');
  if (el) el.textContent = h + ':' + m;
  const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const mos  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const d = document.getElementById('hb-clockdate');
  if (d) d.textContent = days[n.getDay()] + ' · ' + mos[n.getMonth()] + ' ' + n.getDate();
}

function hbUpdateLauncherDynamic() {
  const today = localDateStr(new Date());

  // Season label + day count
  const seasonEl = document.getElementById('hb-season-label');
  if (seasonEl) {
    let label = _hbSettings.season || '';
    if (label && _hbSettings.seasonStartDate) {
      const start = new Date(_hbSettings.seasonStartDate);
      const dayCount = Math.max(1, Math.floor((new Date() - start) / 86400000) + 1);
      label += ' · Day ' + dayCount;
    }
    seasonEl.textContent = label;
  }

  // Quote
  const quoteEl = document.getElementById('hb-quote-text');
  if (quoteEl) quoteEl.textContent = _hbSettings.quote || '';

  // Quote attribution + identity
  const attrEl = document.getElementById('hb-quote-attr');
  if (attrEl) {
    const author = _hbSettings.quoteAuthor ? '— ' + _hbSettings.quoteAuthor + ' · ' : '';
    const identity = _behav.identity || _hbSettings.identity || '';
    if (author || identity) {
      attrEl.innerHTML = author + 'Your identity today: <em style="color:var(--gold);">' + escHtml(identity) + '</em>';
    } else {
      attrEl.textContent = '';
    }
  }

  // Identity card
  const idEl = document.getElementById('hb-id-display');
  const identity = _behav.identity || _hbSettings.identity || '';
  if (idEl) idEl.textContent = identity ? '"' + identity + '"' : '';

  // Non-negotiable (only update if not currently focused)
  const nonnegEl = document.getElementById('hb-nonneg-text');
  if (nonnegEl && document.activeElement !== nonnegEl) {
    nonnegEl.textContent = _hbSettings.nonNegotiable || '';
  }

  // Stats from habit logs
  const yesterday = localDateStr(new Date(Date.now() - 86400000));

  // Day streak: consecutive days ending today where ≥1 habit was completed
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const ds = localDateStr(new Date(d - i * 86400000));
    const log = _habitLogs[ds];
    const count = log ? Object.values(log.completions || {}).filter(Boolean).length : 0;
    if (count > 0) streak++;
    else if (i > 0) break; // allow today to be 0 and still count yesterday
  }
  const streakEl = document.getElementById('hb-streak-n');
  if (streakEl) streakEl.textContent = streak > 0 ? streak + 'd' : '—';

  // Momentum: % completion last 7 days
  let totalPossible = 0, totalDone = 0;
  for (let i = 0; i < 7; i++) {
    const ds = localDateStr(new Date(Date.now() - i * 86400000));
    const log = _habitLogs[ds];
    totalPossible += _habits.length;
    totalDone += log ? Object.values(log.completions || {}).filter(Boolean).length : 0;
  }
  const momEl = document.getElementById('hb-momentum-n');
  if (momEl) momEl.textContent = totalPossible > 0 ? Math.round(totalDone / totalPossible * 100) + '%' : '—';

  // Done yesterday
  const ytdLog = _habitLogs[yesterday];
  const ytdCount = ytdLog ? Object.values(ytdLog.completions || {}).filter(Boolean).length : 0;
  const doneEl = document.getElementById('hb-done-n');
  if (doneEl) doneEl.textContent = _habits.length > 0 ? ytdCount + '/' + _habits.length : '—';
}

function hbLoadLauncherFromRoutines() {
  const steps = document.getElementById('hb-timeline-steps');
  if (!steps) return;
  const morning = _routines?.morning || [];
  if (!morning.length) {
    steps.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em;padding:20px 0;text-align:center;">Add steps in the Tracker tab → Morning Routine</div>';
    _hbDoneCount = 0; _hbTotalSteps = 0;
    hbUpdateLauncherProgress();
    return;
  }
  _hbTotalSteps = morning.length;
  const completed = JSON.parse(localStorage.getItem('hb-launcher-done-' + localDateStr(new Date())) || '{}');
  _hbDoneCount = Object.values(completed).filter(Boolean).length;

  steps.innerHTML = morning.map((step, i) => {
    const isDone = !!completed[i];
    const isActive = !isDone && morning.slice(0, i).every((_, j) => !!completed[j]);
    return `<div class="hb-step ${isActive ? 'hb-step-active' : ''}" onclick="hbExpandStep(this)">
      <div class="hb-step-left">
        <div class="hb-step-time">${step.time || ''}</div>
        <div class="hb-step-check ${isDone ? 'done' : isActive ? 'active' : ''}" data-idx="${i}" onclick="hbToggleStep(event,this)">${isDone ? '✓' : ''}</div>
        ${i < morning.length - 1 ? `<div class="hb-step-line ${isDone ? 'done' : ''}"></div>` : ''}
      </div>
      <div class="hb-step-body">
        <div class="hb-step-name ${isDone ? 'done' : ''}">${escHtml(step.text || '')}</div>
        <div class="hb-step-meta">
          <span class="hb-step-dur">${step.time ? step.time : ''}</span>
          ${isActive ? '<span class="hb-tag hb-tag-gold">Active Now</span>' : isDone ? '<span class="hb-tag hb-tag-sage">Done</span>' : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  steps.querySelectorAll('.hb-step-check').forEach(el => {
    el.addEventListener('click', e => hbToggleStep(e, el));
  });

  hbUpdateLauncherProgress();
}

function hbToggleStep(e, el) {
  e.stopPropagation();
  const idx = el.dataset.idx;
  const dateKey = 'hb-launcher-done-' + localDateStr(new Date());
  const completed = JSON.parse(localStorage.getItem(dateKey) || '{}');
  completed[idx] = !completed[idx];
  localStorage.setItem(dateKey, JSON.stringify(completed));
  hbLoadLauncherFromRoutines();
}

function hbExpandStep(el) {
  const exp = el.querySelector('.hb-step-expand');
  if (exp) exp.classList.toggle('open');
}

function hbUpdateLauncherProgress() {
  const bar  = document.getElementById('hb-rt-bar');
  const prog = document.getElementById('hb-rt-progress');
  const pct  = _hbTotalSteps > 0 ? Math.round(_hbDoneCount / _hbTotalSteps * 100) : 0;
  if (bar)  bar.style.width = pct + '%';
  if (prog) prog.textContent = _hbDoneCount + ' of ' + _hbTotalSteps + ' done';

  // Update launch button sub-label
  const sub = document.getElementById('hb-lb-sub');
  if (sub) sub.textContent = _hbTotalSteps + ' steps · ' + (pct < 100 ? (100 - pct) + '% remaining' : 'Routine complete ✓');
}

function hbPickEnergy(el) {
  document.querySelectorAll('.hb-energy-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  const mode = el.querySelector('.hb-ec-name')?.textContent || '';
  const sub = document.getElementById('hb-lb-sub');
  if (sub) sub.textContent = _hbTotalSteps + ' steps · ' + mode + ' mode';
}

function hbLaunchDay() {
  const btn = document.getElementById('hb-launch-btn');
  if (!btn) return;
  btn.style.background = 'linear-gradient(135deg,var(--neon) 0%,#2d5a3d 100%)';
  btn.innerHTML = 'Day started ✓<span class="hb-lb-sub">Routine launched — good luck today</span>';
  setTimeout(() => {
    btn.style.background = 'linear-gradient(135deg,var(--gold) 0%,#ffffff 100%)';
    btn.innerHTML = 'Begin the day<span class="hb-lb-sub">' + _hbTotalSteps + ' steps ready</span>';
    // re-fetch the ID'd element that got overwritten
    const restoredSub = btn.querySelector('.hb-lb-sub');
    if (restoredSub) restoredSub.id = 'hb-lb-sub';
  }, 2500);
}

function hbLoadIdentityFromSettings() {
  hbUpdateLauncherDynamic();
}

async function hbSaveSettings() {
  const identity       = document.getElementById('hb-cfg-identity')?.value || '';
  const season         = document.getElementById('hb-cfg-season')?.value || '';
  const seasonStartDate= document.getElementById('hb-cfg-season-start')?.value || '';
  const quote          = document.getElementById('hb-cfg-quote')?.value || '';
  const quoteAuthor    = document.getElementById('hb-cfg-quote-author')?.value || '';
  const customHabits   = document.getElementById('hb-cfg-custom-habits')?.value || '';
  const nonNegotiable  = document.getElementById('hb-cfg-nonneg')?.value || '';

  const cfg = { identity, season, seasonStartDate, quote, quoteAuthor, customHabits, nonNegotiable };
  Object.assign(_hbSettings, cfg);

  const uid = window.CDX_USER?.uid;
  if (uid) {
    const { doc, setDoc, serverTimestamp } = window.CDX_FB;
    await setDoc(doc(window.CDX_DB, 'users', uid, 'hbSettings', 'config'),
      { ...cfg, updatedAt: serverTimestamp() }, { merge: true });
    // Keep behaviours identity in sync
    if (identity) {
      _behav.identity = identity;
      await setDoc(doc(window.CDX_DB, 'users', uid, 'behaviours', 'current'),
        { identity, updatedAt: serverTimestamp() }, { merge: true });
    }
  }
  localStorage.removeItem('hb-settings');
  hbUpdateLauncherDynamic();
  showToast('Habit settings saved');
}

function hbLoadSettingsPanel() {
  const setVal = (id, val) => { const e = document.getElementById(id); if (e && val != null) e.value = val; };
  setVal('hb-cfg-identity',      _hbSettings.identity || _behav.identity || '');
  setVal('hb-cfg-season',        _hbSettings.season);
  setVal('hb-cfg-season-start',  _hbSettings.seasonStartDate);
  setVal('hb-cfg-quote',         _hbSettings.quote);
  setVal('hb-cfg-quote-author',  _hbSettings.quoteAuthor);
  setVal('hb-cfg-custom-habits', _hbSettings.customHabits);
  setVal('hb-cfg-nonneg',        _hbSettings.nonNegotiable);
}

function hbLoadSavedSettings() {
  // Legacy: now handled by hbSettingsSubscribe(). No-op kept for safety.
}

/* ── PROGRESS HEATMAP ───────────────────────────────── */
function hbBuildHeatmap() {
  const hm = document.getElementById('hb-heatmap');
  if (!hm || hm.children.length > 0) return; // already built
  for (let i = 0; i < 91; i++) {
    const cell = document.createElement('div');
    const r = Math.random();
    const l = r > .75 ? 'l4' : r > .5 ? 'l3' : r > .3 ? 'l2' : r > .15 ? 'l1' : '';
    cell.className = 'hb-hm-cell' + (l ? ' ' + l : '');
    cell.title = 'Day ' + (i + 1);
    hm.appendChild(cell);
  }
}

