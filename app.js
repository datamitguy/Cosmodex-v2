'use strict';

/* ══ CONSTANTS ══ */
// → future file: cosmodex-state.js  (shared global state + constants)
let CATEGORIES = {};

// Load saved categories from localStorage
(function loadSavedCategories() {
  const saved = localStorage.getItem('cdx_categories');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Replace entirely so deletions persist across sessions
      CATEGORIES = parsed;
    } catch(e) {}
  }
})();

// People (collaborators / contacts for @mention)
let PEOPLE = [];
(function loadSavedPeople() {
  try { PEOPLE = JSON.parse(localStorage.getItem('cdx_people') || '[]'); } catch(e) {}
})();
function savePeople() {
  localStorage.setItem('cdx_people', JSON.stringify(PEOPLE));
  const user = window.CDX_USER;
  if (!user || !window.CDX_FB || !window.CDX_DB) return;
  const { doc, setDoc } = window.CDX_FB;
  setDoc(doc(window.CDX_DB, 'users', user.uid, 'config', 'people'),
    { people: PEOPLE }, { merge: false }
  ).catch(e => console.warn('People Firestore save failed:', e));
}

const PEOPLE_COLORS = ['#c9a227','#4a7c5e','#6b9fd4','#c45c2a','#9b7fd4','#e8a020','#4a9b7f','#d46b9f'];

const ENERGY_TYPES = {
  quick:   { label: 'Quick',   icon: '⚡', cssClass: 'energy-quick' },
  deep:    { label: 'Deep',    icon: '🧠', cssClass: 'energy-deep' },
  shallow: { label: 'Shallow', icon: '💬', cssClass: 'energy-shallow' },
  admin:   { label: 'Meeting', icon: '📅', cssClass: 'energy-admin' },
};

const CAT_COLOR_PALETTE = ['#00cfff','#ff6fff','#00ff9f','#bf80ff','#ff9f00','#ff4f7b','#ffff00','#00ffcc','#ff3f3f','#80ff00'];
let _newCatColor = CAT_COLOR_PALETTE[0];

const LIST_COLORS = [
  '#5c4433', '#3d5c4a', '#4a3d5c', '#5c3d42', '#3d4e5c',
  '#5c5233', '#3d5c55', '#5c4a3d', '#3d485c', '#52435c'
];

const PROJECT_COLORS = [
  '#c9a227', '#4a7c5e', '#6b9fd4', '#c45c2a', '#9b7fd4',
  '#c49a6c', '#5c8a6b', '#a05c8a', '#6b8ac4', '#c4a05c'
];

const HK_HOLIDAYS = [
  { date:'2025-01-01', name:"New Year's Day",          type:'public' },
  { date:'2025-01-29', name:'Lunar New Year',           type:'public' },
  { date:'2025-01-30', name:'Lunar New Year',           type:'public' },
  { date:'2025-01-31', name:'Lunar New Year',           type:'public' },
  { date:'2025-04-04', name:'Ching Ming Festival',      type:'public' },
  { date:'2025-04-18', name:'Good Friday',              type:'public' },
  { date:'2025-04-19', name:'Day after Good Friday',    type:'public' },
  { date:'2025-04-21', name:'Easter Monday',            type:'public' },
  { date:'2025-05-01', name:'Labour Day',               type:'public' },
  { date:'2025-05-05', name:"Buddha's Birthday",        type:'public' },
  { date:'2025-06-02', name:'Tuen Ng Festival',         type:'public' },
  { date:'2025-07-01', name:'HKSAR Establishment Day',  type:'public' },
  { date:'2025-09-07', name:'Day after Mid-Autumn',     type:'public' },
  { date:'2025-10-01', name:'National Day',             type:'public' },
  { date:'2025-10-07', name:'Chung Yeung Festival',     type:'public' },
  { date:'2025-12-25', name:'Christmas Day',            type:'public' },
  { date:'2025-12-26', name:'Boxing Day',               type:'public' },
  { date:'2026-01-01', name:"New Year's Day",           type:'public' },
  { date:'2026-02-17', name:'Lunar New Year',           type:'public' },
  { date:'2026-02-18', name:'Lunar New Year',           type:'public' },
  { date:'2026-02-19', name:'Lunar New Year',           type:'public' },
  { date:'2026-04-03', name:'Good Friday',              type:'public' },
  { date:'2026-04-04', name:'Day after Good Friday',    type:'public' },
  { date:'2026-04-05', name:'Ching Ming Festival',      type:'public' },
  { date:'2026-04-06', name:'Easter Monday',            type:'public' },
  { date:'2026-05-01', name:'Labour Day',               type:'public' },
  { date:'2026-05-25', name:"Buddha's Birthday",        type:'public' },
  { date:'2026-06-19', name:'Tuen Ng Festival',         type:'public' },
  { date:'2026-07-01', name:'HKSAR Establishment Day',  type:'public' },
  { date:'2026-09-26', name:'Day after Mid-Autumn',     type:'public' },
  { date:'2026-10-01', name:'National Day',             type:'public' },
  { date:'2026-10-25', name:'Chung Yeung Festival',     type:'public' },
  { date:'2026-12-25', name:'Christmas Day',            type:'public' },
  { date:'2026-12-26', name:'Boxing Day',               type:'public' },
];

/* ══ STATE ══ */
let TASKS      = [];
let CAL_EVENTS = [];
let HOLIDAYS   = {};

let _calView      = 'day';
let _calDate      = new Date();
let _dragTaskId   = null;
let _dragSubId    = null;
let _schedCtx     = null;

// Lists state
let LISTS     = [];
let _listView = null;  // currently open list ID

// Habits state
let _habits        = [];
let _habitLogs     = {};
let _routines      = { morning: [], evening: [] };
let _behav         = { identity: '', keystone: [], notes: '' };
let _hbSettings    = { season:'', seasonStartDate:'', quote:'', quoteAuthor:'', customHabits:'', nonNegotiable:'', onboarded:false, activeSlotLimit:3 };
let _values        = []; // values inventory — [{ id, name, emoji }]
let _stacks        = []; // habit stacks — [{ id, name, track, habitIds[] }]
let _habitsTab     = 'today';
let _habitsUnsub   = null;
let _habitLogsUnsub = null;
let _routinesUnsub = null;
let _behavUnsub    = null;
let _hbSettingsUnsub = null;
let _valuesUnsub    = null;
let _stacksUnsub    = null;
let _routinesSaveTimer = null;
let _behavSaveTimer    = null;

// Phase 1: applies research-backed defaults to a habit (in-memory; non-destructive)
function _habitWithDefaults(h) {
  return {
    identityTag:      '',
    valueTags:        [],
    tinyBehavior:     '',
    fullBehavior:     '',
    anchor:           { type: 'anytime', value: '', linkedHabitId: null },
    schedule:         { days: 'daily', frequency: 1 },
    stackId:          null,
    frictionTags:     [],
    frictionFallbacks:{},
    restDaysPlanned:  [],
    status:           'active',
    graduatedAt:      null,
    ...h,
  };
}

// Default values inventory seeded on first open (only if user has never onboarded)
const DEFAULT_VALUES = [
  { id: 'v_health',       name: 'Health',       emoji: '💪' },
  { id: 'v_craft',        name: 'Craft',        emoji: '🛠️' },
  { id: 'v_relationships',name: 'Relationships',emoji: '🤝' },
  { id: 'v_growth',       name: 'Growth',       emoji: '🌱' },
  { id: 'v_contribution', name: 'Contribution', emoji: '🎁' },
  { id: 'v_play',         name: 'Play',         emoji: '🎨' },
  { id: 'v_rest',         name: 'Rest',         emoji: '🌙' },
  { id: 'v_meaning',      name: 'Meaning',      emoji: '✨' },
];

// Orb petal state
let _orbGeometry  = null; // set by drawCosmodex when expanded
let _orbClickHour = 9;    // hour of last petal click

// Data listeners — stored so they can be cleaned up on signout
let _tasksUnsub       = null;
let _calEventsUnsub   = null;
let _holidaysUnsub    = null;
let _listsUnsub       = null;
let _msProjUnsub      = null;
let _msEventsUnsub    = null;
let _msListsUnsub     = null;
let _catUnsub         = null;
let _peopleUnsub      = null;

// Comm Drill state
let DRILL_RESPONSES   = []; // graded + ungraded responses, synced from Firestore
let _drillUnsub       = null;

// Interval IDs — stored so they can be cleared on signout
let _calNowLineInterval = null;
let _cosmodexInterval   = null;

// Milestones state
let MILESTONE_PROJECTS = [];
let MILESTONE_EVENTS   = [];
let MILESTONE_LISTS    = [];
let _msProjEdit        = null;
let _msEventEdit       = null;
let _msNewActivities   = [];
let _mainPanel         = 'default';  // 'default' | 'milestones'
let _msView            = 'dashboard'; // 'dashboard' | 'timeline'
let _msFocusProj       = null;        // project id when in timeline view
let _planLeftCollapsed  = localStorage.getItem('cosmodex_plan_left_collapsed')  === '1';
let _planRightCollapsed = localStorage.getItem('cosmodex_plan_right_collapsed') === '1';

let _settings = JSON.parse(localStorage.getItem('cdx_v2_settings') || 'null') || {
  visibleCategories: Object.keys(CATEGORIES),
  defaultCategory: Object.keys(CATEGORIES)[0] || '',
};
// Ensure defaultCategory exists (for older stored settings without it)
if (!_settings.defaultCategory) _settings.defaultCategory = Object.keys(CATEGORIES)[0] || '';
function saveSettings() { localStorage.setItem('cdx_v2_settings', JSON.stringify(_settings)); }

// Focus/effort time attributed to a task. Counts ONLY the minutes the user
// logs in the mandatory close prompt (timeSpentMinutes). The pomodoro/commit
// timers no longer inflate focus stats — only deliberate task time adds up.
function taskEffortSecs(t) { return (t && t.timeSpentMinutes ? t.timeSpentMinutes * 60 : 0); }

/* ── Theme ─────────────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('cdx_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cdx_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const el = document.getElementById('theme-icon');
  if (el) el.textContent = theme === 'dark' ? '◑' : '◐';
}

document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);
document.getElementById('mob-theme-btn')?.addEventListener('click', toggleTheme);

/* ── Nav collapse ──────────────────────────────────────── */
document.getElementById('nav-expand-btn')?.addEventListener('click', () => {
  document.getElementById('left-nav').classList.toggle('collapsed');
});
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('left-nav').classList.toggle('collapsed');
});

/* ── Tools section toggle ──────────────────────────────── */
document.getElementById('tools-toggle')?.addEventListener('click', () => {
  document.querySelector('.nav-tools-section')?.classList.toggle('collapsed');
});

/* ── Nav items ─────────────────────────────────────────── */
const NAV_OVERLAY_MAP = {};

/* A11y bootstrap: div-based nav items become keyboard-operable buttons,
   icon-only buttons get accessible names from their titles. */
document.querySelectorAll('.nav-item').forEach(item => {
  item.setAttribute('role', 'button');
  item.setAttribute('tabindex', '0');
  item.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
  });
});
document.querySelectorAll('button[title]:not([aria-label])').forEach(el => {
  el.setAttribute('aria-label', el.title);
});

document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
  item.addEventListener('click', () => {
    const panel = item.dataset.panel;
    // Overlays (lifeos)
    if (NAV_OVERLAY_MAP[panel]) {
      openOverlay(NAV_OVERLAY_MAP[panel]);
      return;
    }
    // Lists → full page
    if (panel === 'lists') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('lists');
      return;
    }
    // Tasks → full page (every captured task)
    if (panel === 'alltasks') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('alltasks');
      return;
    }
    // Habits → full page
    if (panel === 'habits') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('habits');
      return;
    }
    // Insights → full page
    if (panel === 'insights') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('insights');
      return;
    }
    // Drill → full page
    if (panel === 'drill') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('drill');
      return;
    }
    // Calendar → full design-system calendar page
    if (panel === 'calendarx') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('calendarx');
      return;
    }
    // Planning → full milestones panel
    if (panel === 'planning') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('milestones');
      return;
    }
    // Timedrift → full screen panel
    if (panel === 'timedrift') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('timedrift');
      return;
    }
    // Mind Map → full page
    if (panel === 'mindmap') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('mindmap');
      return;
    }
    // Archived → full page
    if (panel === 'archived') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('archived');
      return;
    }
    // Cosmodex Bubble → open orb modal
    if (panel === 'cosmodex-bubble') {
      openOrb();
      return;
    }
    // Workspace panels (today, calendar, tasks) → restore default layout
    showMainPanel('default');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const title = item.textContent.trim().replace(/[0-9—\s]+$/, '').trim();
    const ptEl = document.getElementById('page-title');
    if (ptEl) ptEl.textContent = title;
  });
});

/* ══ PANEL SWITCHING (Calendar/Tasks ↔ Milestones) ══ */
// → future file: cosmodex-shell.js  (nav, routing, overlay open/close)
function showMainPanel(name) {
  _mainPanel = name;
  document.getElementById('dashboard-hero').style.display     = name === 'default' ? '' : 'none';
  // The old calendar+tasks panes are retired from the dashboard; they stay in the
  // DOM (hidden) so the calendar engine still renders harmlessly for other code.
  document.getElementById('main-content-panels').style.display = 'none';
  document.getElementById('panel-calendar').style.display    = 'none';
  document.getElementById('panel-tasks').style.display       = 'none';
  const dashBoard = document.getElementById('dash-board');
  if (dashBoard) dashBoard.style.display = name === 'default' ? '' : 'none';
  document.getElementById('panel-alltasks').style.display    = name === 'alltasks' ? 'flex' : 'none';
  const calxPanel = document.getElementById('panel-calendarx');
  if (calxPanel) calxPanel.style.display = name === 'calendarx' ? 'flex' : 'none';
  const focusPanel = document.getElementById('panel-focus');
  if (focusPanel) focusPanel.style.display = name === 'focus' ? 'flex' : 'none';
  document.getElementById('panel-milestones').style.display  = name === 'milestones' ? 'flex' : 'none';
  document.getElementById('panel-archived').style.display    = name === 'archived' ? 'flex' : 'none';
  document.getElementById('panel-lists').style.display       = name === 'lists' ? 'flex' : 'none';
  document.getElementById('panel-habits').style.display      = name === 'habits' ? 'flex' : 'none';
  document.getElementById('panel-insights').style.display    = name === 'insights' ? 'flex' : 'none';
  document.getElementById('panel-drill').style.display       = name === 'drill' ? 'flex' : 'none';
  document.getElementById('panel-timedrift').style.display   = name === 'timedrift' ? 'flex' : 'none';
  document.getElementById('panel-mindmap').style.display     = name === 'mindmap' ? 'flex' : 'none';
  const titles = { default:'Today', milestones:'Planning', archived:'Archived', lists:'Lists', alltasks:'Tasks', calendarx:'Calendar', focus:'Focus', habits:'Habits & Routines', insights:'Insights', drill:'Drill', timedrift:'Timedrift', mindmap:'Mind Map' };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || 'Today';
  if (name === 'default') { window.renderDashboardBoard?.(); }
  if (name === 'milestones') { renderMilestones(); window.initPlanningWidgets?.(); }
  if (name === 'archived') { renderArchivedPage(); }
  if (name === 'lists') { renderLists(); if (!_listView && LISTS.length) openListDetail(LISTS[0].id); }
  if (name === 'alltasks') { renderTasksPage(); }
  if (name === 'calendarx') { window.renderCalendarX?.(); }
  if (name === 'focus') { window.initPomoOverlay?.(); }
  if (name === 'habits') {
    // New design-system habits UI (14-habits-x.js). Ensure data subscriptions are
    // live (subscribe-once guards make these cheap), then render.
    habitsSubscribe?.(); routinesSubscribe?.(); behavSubscribe?.(); hbSettingsSubscribe?.();
    window.initHabitsX ? window.initHabitsX('today') : switchHabitsTab('today');
  }
  if (name === 'insights') { habitsSubscribe(); requestAnimationFrame(() => { window.renderInsightsX ? renderInsightsX() : renderInsights(); }); }
  if (name === 'drill') { renderDrill(); }
  const orbEl = document.getElementById('cosmodex-orb');
  if (orbEl) orbEl.style.display = name === 'timedrift' ? 'none' : '';
  if (name === 'timedrift') { startTimedrift(); }
  else { stopTimedrift(); }
  if (name === 'mindmap') { window.initMindMap?.(); }
}

/* ══ LISTS — FIRESTORE CRUD ══ */
// → future file: cosmodex-lists.js

// List types: 'simple' (bullets), 'task' (checkable — shows completion ribbon),
// 'rated' (5-star rating per item). Legacy lists with no type read as 'simple'.
const LIST_TYPE_META = {
  simple: { icon: '✦', label: 'Simple' },
  task:   { icon: '✓', label: 'Task' },
  rated:  { icon: '★', label: 'Rated' },
};
const listTypeOf = l => (l && LIST_TYPE_META[l.type]) ? l.type : 'simple';

async function addList(title, type = 'simple') {
  if (!title?.trim()) { showToast('List name cannot be empty', 'error'); return; }
  if (!LIST_TYPE_META[type]) type = 'simple';
  const { addDoc, serverTimestamp } = window.CDX_FB;
  const color = LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)];
  try {
    await addDoc(_uc('lists'), {
      title: title.trim(), type, color, items: [], why: '', notes: '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.error('addList error:', err);
    showToast('Failed to create list', 'error');
  }
}

async function setListType(listId, type) {
  if (!LIST_TYPE_META[type]) return;
  await updateList(listId, { type });
}

// Rating for 'rated' lists — clicking the current value clears it back to 0
async function setListItemRating(listId, itemId, rating) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('lists', listId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;
      const items = (snap.data().items || []).map(i =>
        i.id === itemId ? { ...i, rating: (i.rating === rating ? 0 : rating) } : i);
      transaction.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('setListItemRating error:', err);
    showToast('Failed to update rating', 'error');
  }
}

async function updateList(id, data) {
  const { updateDoc, serverTimestamp } = window.CDX_FB;
  try {
    await updateDoc(_ud('lists', id), { ...data, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('updateList error:', err);
    showToast('Failed to save list changes', 'error');
    throw err; // re-throw so callers can handle if needed
  }
}

async function deleteList(id) {
  const { deleteDoc } = window.CDX_FB;
  await deleteDoc(_ud('lists', id));
}

async function addListItem(listId, text) {
  if (!text?.trim()) return;
  const { updateDoc, serverTimestamp, arrayUnion } = window.CDX_FB;
  const newItem = { id: crypto.randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
  try {
    await updateDoc(_ud('lists', listId), { items: arrayUnion(newItem), updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('addListItem error:', err);
    showToast('Failed to add item', 'error');
  }
}

async function toggleListItem(listId, itemId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('lists', listId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('List not found');
      const items = (snap.data().items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i);
      transaction.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('toggleListItem error:', err);
    showToast('Failed to update item', 'error');
  }
}

async function deleteListItem(listId, itemId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('lists', listId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('List not found');
      const items = (snap.data().items || []).filter(i => i.id !== itemId);
      transaction.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('deleteListItem error:', err);
    showToast('Failed to delete item', 'error');
  }
}

async function addListSubItem(listId, itemId, text) {
  if (!text?.trim()) return;
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  const newSub = { id: crypto.randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('lists', listId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('List not found');
      const items = (snap.data().items || []).map(i => {
        if (i.id === itemId) return { ...i, subitems: [...(i.subitems || []), newSub] };
        return i;
      });
      transaction.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('addListSubItem error:', err);
    showToast('Failed to add sub-item', 'error');
  }
}

async function deleteListSubItem(listId, itemId, subId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('lists', listId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('List not found');
      const items = (snap.data().items || []).map(i => {
        if (i.id === itemId) return { ...i, subitems: (i.subitems || []).filter(s => s.id !== subId) };
        return i;
      });
      transaction.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('deleteListSubItem error:', err);
    showToast('Failed to delete sub-item', 'error');
  }
}

async function toggleListSubItem(listId, itemId, subId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('lists', listId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('List not found');
      const items = (snap.data().items || []).map(i => {
        if (i.id === itemId) return { ...i, subitems: (i.subitems || []).map(s => s.id === subId ? { ...s, done: !s.done } : s) };
        return i;
      });
      transaction.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('toggleListSubItem error:', err);
    showToast('Failed to update sub-item', 'error');
  }
}

/* ══ LISTS PAGE — RENDER ══ */
function renderLists() {
  const sidebar = document.getElementById('lists-sidebar-items');
  if (!sidebar) return;
  const q = (document.getElementById('lists-search')?.value || '').toLowerCase().trim();
  const visible = q ? LISTS.filter(l => (l.title || '').toLowerCase().includes(q)) : LISTS;
  if (!LISTS.length) {
    sidebar.innerHTML = '<div style="padding:16px;font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em;text-align:center">No lists yet</div>';
    return;
  }
  if (!visible.length) {
    sidebar.innerHTML = '<div style="padding:16px;font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em;text-align:center">No match</div>';
    return;
  }
  sidebar.innerHTML = visible.map(l => {
    const items = l.items || [];
    const total = items.length;
    const type = listTypeOf(l);
    const isActive = _listView === l.id;
    const countLabel = type === 'task'
      ? `${items.filter(i => i.done).length}/${total}`
      : (total > 0 ? `${total} item${total !== 1 ? 's' : ''}` : '—');
    return `
      <div class="list-sidebar-card ${isActive?'active':''}" data-list-id="${escAttr(l.id)}">
        <div class="list-sidebar-card-icon" style="color:${escAttr(l.color)};border-color:${escAttr(l.color)}44">${LIST_TYPE_META[type].icon}</div>
        <span class="list-sidebar-card-name">${escHtml(l.title || 'Untitled')}</span>
        <span class="list-sidebar-card-count">${countLabel}</span>
      </div>`;
  }).join('');
  // Re-bind if current list is open
  if (_listView) renderListDetail(_listView);
}

function renderListDetail(listId) {
  const list = LISTS.find(l => l.id === listId);
  const emptyState    = document.getElementById('lists-empty-state');
  const detailContent = document.getElementById('lists-detail-content');
  if (!list) {
    if (emptyState) emptyState.style.display = 'flex';
    if (detailContent) detailContent.style.display = 'none';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  if (detailContent) detailContent.style.display = 'flex';

  const type = listTypeOf(list);
  const nameEl = document.getElementById('lists-detail-name');
  const countEl = document.getElementById('lists-detail-count');
  const colorEl = document.getElementById('lists-detail-color-strip');
  const typeSel = document.getElementById('lists-detail-type-select');
  const whyEl = document.getElementById('lists-detail-why');
  const notesEl = document.getElementById('lists-detail-notes');
  if (nameEl) nameEl.textContent = list.title;
  if (colorEl) {
    // Repurposed as the header icon chip: type glyph tinted by the list colour
    colorEl.textContent = LIST_TYPE_META[type].icon;
    colorEl.style.color = list.color || 'var(--gold)';
    colorEl.style.borderColor = (list.color || 'rgba(255,255,255,0.2)') + '55';
    colorEl.style.background = (list.color || 'rgba(255,255,255,0.06)') + '18';
  }
  if (typeSel) typeSel.value = type;
  if (whyEl && document.activeElement !== whyEl) whyEl.value = list.why || '';
  if (notesEl && document.activeElement !== notesEl) notesEl.value = list.notes || '';
  const items = list.items || [];
  if (countEl) countEl.textContent = `${LIST_TYPE_META[type].label.toUpperCase()} · ${items.length} ITEM${items.length !== 1 ? 'S' : ''}`;

  // Completion ribbon — task lists only ("bottom ribbon for completed")
  const ribbon = document.getElementById('lists-completion-ribbon');
  if (ribbon) {
    if (type === 'task' && items.length) {
      const done = items.filter(i => i.done).length;
      const total = items.length, remaining = total - done;
      const pct = Math.round(done / total * 100);
      ribbon.style.display = '';
      ribbon.innerHTML = `
        <div class="list-ribbon">
          <div class="list-ribbon-stats">
            <div class="list-ribbon-cell"><span class="list-ribbon-k">Total</span><span class="list-ribbon-v">${total}</span></div>
            <div class="list-ribbon-cell"><span class="list-ribbon-k">Done</span><span class="list-ribbon-v done">${done}</span></div>
            <div class="list-ribbon-cell"><span class="list-ribbon-k">Remaining</span><span class="list-ribbon-v">${remaining}</span></div>
            <div class="list-ribbon-cell"><span class="list-ribbon-k">Complete</span><span class="list-ribbon-v">${pct}%</span></div>
          </div>
          <div class="list-ribbon-bar"><div class="list-ribbon-fill" style="width:${pct}%"></div></div>
        </div>`;
    } else {
      ribbon.style.display = 'none';
      ribbon.innerHTML = '';
    }
  }

  const body = document.getElementById('lists-detail-items');
  if (!body) return;
  if (!items.length) {
    body.innerHTML = '<div style="padding:24px 0;font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em;text-align:center">an empty list. even the void keeps notes — add one below</div>';
    return;
  }
  const accentColor = list.color || 'var(--gold)';
  const allowSub = type !== 'rated';
  body.innerHTML = items.map((item, idx) => {
    const subs = item.subitems || [];
    // Leading control depends on list type
    let lead;
    if (type === 'task') {
      lead = `<div class="list-item-check ${item.done ? 'done' : ''}" data-toggle-item="${escAttr(item.id)}">${item.done ? '✓' : ''}</div>`;
    } else if (type === 'rated') {
      const rating = item.rating || 0;
      lead = `<div class="list-item-rating" data-rate-item="${escAttr(item.id)}">${[1,2,3,4,5].map(n =>
        `<span class="list-star ${n <= rating ? 'on' : ''}" data-rate-val="${n}">★</span>`).join('')}</div>`;
    } else {
      lead = `<div class="list-item-marker" style="background:${accentColor}18;color:${accentColor};border:1px solid ${accentColor}33">◆</div>`;
    }
    const textCls = `list-detail-item-text${type === 'task' && item.done ? ' done' : ''}`;
    return `
    <div class="list-detail-item-wrap type-${type}" draggable="true" data-idx="${idx}" style="animation-delay:${idx*20}ms">
      <div class="list-detail-item" data-item-id="${escAttr(item.id)}">
        ${type === 'rated' ? '' : lead}
        <span class="${textCls}" data-item-id="${escAttr(item.id)}">${linkifyText(item.text)}</span>
        ${type === 'rated' ? lead : ''}
        ${allowSub ? `<span class="list-detail-item-addsub" data-addsub-item="${escAttr(item.id)}" title="Add sub-item">⊕</span>` : ''}
        <span class="list-detail-item-del" data-del-item="${escAttr(item.id)}">✕</span>
      </div>
      ${subs.length ? `<div class="list-subitems">${subs.map(s => `
        <div class="list-subitem ${s.done ? 'done' : ''}" data-parent-id="${escAttr(item.id)}" data-sub-id="${escAttr(s.id)}">
          <span class="list-subitem-check" data-toggle-sub="${escAttr(s.id)}" data-toggle-parent="${escAttr(item.id)}">${s.done ? '✓' : '○'}</span>
          <span class="list-subitem-text">${linkifyText(s.text)}</span>
          <span class="list-subitem-del" data-del-sub="${escAttr(s.id)}" data-del-sub-parent="${escAttr(item.id)}">✕</span>
        </div>`).join('')}</div>` : ''}
      ${allowSub ? `<div class="list-subitem-input-row" data-subinput-parent="${escAttr(item.id)}" style="display:none">
        <input class="list-subitem-input" type="text" placeholder="Add sub-item..." maxlength="200" />
        <button class="list-subitem-input-btn" data-confirm-sub="${escAttr(item.id)}">Add</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function openListDetail(listId) {
  _listView = listId;
  // Reset delete confirm state
  const delConfirm = document.getElementById('lists-delete-confirm');
  const delBtn = document.getElementById('lists-delete-btn');
  if (delConfirm) delConfirm.style.display = 'none';
  if (delBtn) delBtn.style.display = '';
  renderLists();
  renderListDetail(listId);
  // Focus add input
  setTimeout(() => document.getElementById('lists-item-input')?.focus(), 100);
}

function closeListDetail() {
  _listView = null;
  const emptyState = document.getElementById('lists-empty-state');
  const detailContent = document.getElementById('lists-detail-content');
  if (emptyState) emptyState.style.display = 'flex';
  if (detailContent) detailContent.style.display = 'none';
  renderLists();
}

/* ══ KINETIC: drag list items to reorder — gold drop line, persisted order ══ */
async function reorderListItems(listId, fromIdx, toIdx) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async tx => {
      const ref = _ud('lists', listId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const items = [...(snap.data().items || [])];
      if (fromIdx < 0 || fromIdx >= items.length) return;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(Math.min(toIdx, items.length), 0, moved);
      tx.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('reorderListItems error:', err);
    showToast('couldn\'t reorder — the cosmos resisted. try again.', 'error');
  }
}

function _initListReorder() {
  const body = document.getElementById('lists-detail-items');
  if (!body || body.dataset.dnd === '1') return;
  body.dataset.dnd = '1';
  let fromIdx = null;
  const clearMarks = () => body.querySelectorAll('.drop-before,.drop-after')
    .forEach(el => el.classList.remove('drop-before', 'drop-after'));

  body.addEventListener('dragstart', e => {
    const wrap = e.target.closest('.list-detail-item-wrap');
    if (!wrap) return;
    fromIdx = +wrap.dataset.idx;
    wrap.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  body.addEventListener('dragover', e => {
    if (fromIdx === null) return;
    const wrap = e.target.closest('.list-detail-item-wrap');
    if (!wrap) return;
    e.preventDefault();
    clearMarks();
    const r = wrap.getBoundingClientRect();
    wrap.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  body.addEventListener('drop', e => {
    if (fromIdx === null) return;
    const wrap = e.target.closest('.list-detail-item-wrap');
    if (!wrap || !_listView) return;
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    let toIdx = +wrap.dataset.idx + (e.clientY < r.top + r.height / 2 ? 0 : 1);
    if (toIdx > fromIdx) toIdx--;
    if (toIdx !== fromIdx) reorderListItems(_listView, fromIdx, toIdx);
    clearMarks();
    fromIdx = null;
  });
  body.addEventListener('dragend', () => {
    body.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    clearMarks();
    fromIdx = null;
  });
}

function initListsPage() {
  _initListReorder();
  // Sidebar card clicks
  const sidebarItems = document.getElementById('lists-sidebar-items');
  if (sidebarItems) {
    sidebarItems.addEventListener('click', e => {
      const card = e.target.closest('[data-list-id]');
      if (card) openListDetail(card.dataset.listId);
    });
  }

  // Search lists
  document.getElementById('lists-search')?.addEventListener('input', () => renderLists());

  // Create new list — NO prompt(), inline input
  const createBtn = document.getElementById('lists-create-btn');
  const newTitleInp = document.getElementById('lists-new-title');
  async function doCreateList() {
    const title = newTitleInp.value.trim();
    if (!title) { newTitleInp.focus(); return; }
    const type = document.getElementById('lists-new-type')?.value || 'simple';
    newTitleInp.value = '';
    await addList(title, type);
  }
  createBtn?.addEventListener('click', doCreateList);
  newTitleInp?.addEventListener('keydown', e => { if (e.key === 'Enter') doCreateList(); });

  // Delete list — inline confirmation, NO confirm()
  document.getElementById('lists-delete-btn')?.addEventListener('click', () => {
    document.getElementById('lists-delete-confirm').style.display = 'flex';
    document.getElementById('lists-delete-btn').style.display = 'none';
  });
  document.getElementById('lists-delete-no')?.addEventListener('click', () => {
    document.getElementById('lists-delete-confirm').style.display = 'none';
    document.getElementById('lists-delete-btn').style.display = '';
  });
  document.getElementById('lists-delete-yes')?.addEventListener('click', async () => {
    if (!_listView) return;
    await deleteList(_listView);
    closeListDetail();
  });

  // Add item
  const addBtn = document.getElementById('lists-item-add-btn');
  const inp = document.getElementById('lists-item-input');
  async function doAddItem() {
    const text = inp.value.trim();
    if (text && _listView) { await addListItem(_listView, text); inp.value = ''; }
  }
  addBtn?.addEventListener('click', doAddItem);
  inp?.addEventListener('keydown', e => { if (e.key === 'Enter') doAddItem(); });

  // Change the selected list's type
  document.getElementById('lists-detail-type-select')?.addEventListener('change', async e => {
    if (_listView) await setListType(_listView, e.target.value);
  });

  // Item deletes + subitem actions (delegated)
  document.getElementById('lists-detail-items')?.addEventListener('click', async e => {
    // Toggle a task-list item done
    const toggleItem = e.target.closest('[data-toggle-item]');
    if (toggleItem && _listView) { await toggleListItem(_listView, toggleItem.dataset.toggleItem); return; }

    // Set a rated-list item's star rating
    const star = e.target.closest('[data-rate-val]');
    if (star && _listView) {
      const rateWrap = star.closest('[data-rate-item]');
      if (rateWrap) await setListItemRating(_listView, rateWrap.dataset.rateItem, +star.dataset.rateVal);
      return;
    }

    // Delete top-level item
    const del = e.target.closest('[data-del-item]');
    if (del && _listView) { await deleteListItem(_listView, del.dataset.delItem); return; }

    // Show sub-item input row
    const addSub = e.target.closest('[data-addsub-item]');
    if (addSub) {
      const parentId = addSub.dataset.addsubItem;
      const row = document.querySelector(`[data-subinput-parent="${parentId}"]`);
      if (row) { row.style.display = row.style.display === 'none' ? 'flex' : 'none'; row.querySelector('input')?.focus(); }
      return;
    }

    // Confirm add sub-item
    const confirmSub = e.target.closest('[data-confirm-sub]');
    if (confirmSub && _listView) {
      const parentId = confirmSub.dataset.confirmSub;
      const inp = document.querySelector(`[data-subinput-parent="${parentId}"] input`);
      if (inp && inp.value.trim()) { await addListSubItem(_listView, parentId, inp.value); inp.value = ''; }
      return;
    }

    // Toggle sub-item done
    const toggleSub = e.target.closest('[data-toggle-sub]');
    if (toggleSub && _listView) {
      await toggleListSubItem(_listView, toggleSub.dataset.toggleParent, toggleSub.dataset.toggleSub);
      return;
    }

    // Delete sub-item
    const delSub = e.target.closest('[data-del-sub]');
    if (delSub && _listView) {
      await deleteListSubItem(_listView, delSub.dataset.delSubParent, delSub.dataset.delSub);
      return;
    }
  });

  // Enter key to add sub-item
  document.getElementById('lists-detail-items')?.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest('.list-subitem-input');
    if (inp && _listView) {
      const parentId = inp.closest('[data-subinput-parent]')?.dataset.subinputParent;
      if (parentId && inp.value.trim()) { await addListSubItem(_listView, parentId, inp.value); inp.value = ''; }
    }
  });

  // Inline title rename (blur = save)
  document.getElementById('lists-detail-name')?.addEventListener('blur', async e => {
    const t = e.target.textContent.trim();
    if (_listView && t) await updateList(_listView, { title: t });
  });
  document.getElementById('lists-detail-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.key === 'Escape') { e.target.blur(); }
  });

  // Why / Notes save on blur
  document.getElementById('lists-detail-why')?.addEventListener('blur', async e => {
    if (_listView) await updateList(_listView, { why: e.target.value.trim() });
  });
  document.getElementById('lists-detail-notes')?.addEventListener('blur', async e => {
    if (_listView) await updateList(_listView, { notes: e.target.value.trim() });
  });
}

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
    window.renderDashboardBoard?.(); window._hxAutoRefresh?.(); // dashboard rituals card (guards on _mainPanel)
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
      window.renderDashboardBoard?.(); window._hxAutoRefresh?.();
    }, err => console.warn('habitLogs onSnapshot:', err.message));
}

function routinesSubscribe() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB || _routinesUnsub) return;
  const { doc, onSnapshot } = window.CDX_FB;
  _routinesUnsub = onSnapshot(doc(window.CDX_DB, 'users', uid, 'routines', 'config'), snap => {
    if (snap.exists()) { const d = snap.data(); _routines = { morning: d.morning||[], evening: d.evening||[] }; }
    if (_habitsTab === 'today') _todayRenderMorningMode();
    window.renderDashboardBoard?.(); window._hxAutoRefresh?.();
  }, err => console.warn('routines onSnapshot:', err.message));
}

function behavSubscribe() {
  const uid = getHabitsUid();
  if (!uid || !window.CDX_DB || _behavUnsub) return;
  const { doc, onSnapshot } = window.CDX_FB;
  _behavUnsub = onSnapshot(doc(window.CDX_DB, 'users', uid, 'behaviours', 'current'), snap => {
    if (snap.exists()) { const d = snap.data(); _behav = { identity: d.identity||'', keystone: d.keystone||[], notes: d.notes||'' }; }
    if (_habitsTab === 'reflect') renderReflect();
    window._hxAutoRefresh?.();
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
    window._hxAutoRefresh?.();
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

/* ── Routine-step completion — Firestore-backed (was localStorage-only, per-device).
   Stored on the synced habitLogs/{date} doc as routineDone:{ m0:true, e1:true }. ── */
function _routineDoneMap(ds) { return (_habitLogs[ds] && _habitLogs[ds].routineDone) || {}; }
async function toggleRoutineStep(ds, key) {
  const uid = getHabitsUid(); if (!uid || !window.CDX_DB) return;
  if (!_habitLogs[ds]) _habitLogs[ds] = { date: ds, completions: {} };
  if (!_habitLogs[ds].routineDone) _habitLogs[ds].routineDone = {};
  const was = !!_habitLogs[ds].routineDone[key];
  if (was) delete _habitLogs[ds].routineDone[key]; else _habitLogs[ds].routineDone[key] = true;
  // optimistic UI
  window.renderDashboardBoard?.();
  if (_habitsTab === 'today') _todayRenderMorningMode?.();
  const { doc, setDoc, updateDoc, deleteField } = window.CDX_FB;
  try {
    const ref = doc(window.CDX_DB, 'users', uid, 'habitLogs', ds);
    if (was) await updateDoc(ref, { ['routineDone.' + key]: deleteField() });
    else     await setDoc(ref, { date: ds, routineDone: { [key]: true } }, { merge: true });
  } catch (e) {
    console.warn('toggleRoutineStep error:', e);
    // revert on failure
    if (was) _habitLogs[ds].routineDone[key] = true; else delete _habitLogs[ds].routineDone[key];
    window.renderDashboardBoard?.();
  }
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
      `<div style="display:flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.04em">` +
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
    const col = isHot ? `rgba(57,255,20,${brightness.toFixed(2)})` : `rgba(255,255,255,${brightness.toFixed(2)})`;
    const glow = isHot ? 'rgba(57,255,20,0.5)' : 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(p.x, p.y, isToday ? size + 1.5 : size, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.shadowColor = glow; ctx.shadowBlur = isToday ? 14 : 8;
    ctx.fill(); ctx.shadowBlur = 0;
    if (isToday) {
      // Outer pulse ring on today
      ctx.beginPath(); ctx.arc(p.x, p.y, size + 5, 0, Math.PI * 2);
      ctx.strokeStyle = isHot ? 'rgba(57,255,20,0.35)' : 'rgba(255,255,255,0.2)';
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
      else bg = 'rgb(57,255,20)';
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
        ctx.shadowColor = 'rgba(57,255,20,0.5)'; ctx.shadowBlur = 6;
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
  const legCells = ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.26)', 'rgba(255,255,255,0.42)', 'rgb(57,255,20)'];
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
  drawBars(hoursThis, useGreen ? 'rgb(57,255,20)' : 'rgba(255,255,255,0.75)', 1);
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
  ctx.fillStyle = useGreen && peakV > 0 ? 'rgb(57,255,20)' : 'rgba(255,255,255,0.85)';
  ctx.fillText(peakV > 0 ? String(peakH).padStart(2, '0') + ':00' : '—', cx, cy + 6);
  ctx.font = "300 9px 'DM Mono',monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(peakV > 0 ? `${peakV} tasks` : '', cx, cy + 22);
}

/* Trend scrub — glide across the chart to read any day (kinetic Insights) */
let _insTrendCache = null;

function _insInitTrendScrub(cvs) {
  if (cvs.dataset.scrub === '1') return;
  cvs.dataset.scrub = '1';
  let tip = null;
  const getTip = () => {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'ins-trend-tip';
      document.body.appendChild(tip);
    }
    return tip;
  };
  cvs.addEventListener('pointermove', e => {
    if (!_insTrendCache) return;
    const { data, dates, padL, stepX } = _insTrendCache;
    const rect = cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.max(0, Math.min(data.length - 1, Math.round((x - padL) / stepX)));
    const t = getTip();
    t.textContent = `${fmtDate(dates[i])} — ${data[i]} task${data[i] === 1 ? '' : 's'}`;
    t.style.left = (rect.left + padL + i * stepX) + 'px';
    t.style.top = (rect.top - 6) + 'px';
    t.classList.add('show');
    _insTrendCache.hoverIdx = i;
    _insRedrawTrend();
  });
  cvs.addEventListener('pointerleave', () => {
    tip?.classList.remove('show');
    if (_insTrendCache) { _insTrendCache.hoverIdx = -1; _insRedrawTrend(); }
  });
}

function _insRedrawTrend() {
  const c = _insTrendCache;
  if (c) _insDrawTrend(c.canvasId, c.data, c.labels, c.color, c.dates, true);
}

function _insDrawTrend(canvasId, data, labels, color, dates, isRedraw) {
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
  const fillColor = color.includes('57,255,20') ? 'rgba(57,255,20,' : 'rgba(255,255,255,';
  grad.addColorStop(0, fillColor + '0.10)'); grad.addColorStop(1, fillColor + '0.01)');
  ctx.fillStyle = grad; ctx.fill();
  // Stroke
  ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  const glowColor = color.includes('57,255,20') ? 'rgba(57,255,20,0.4)' : 'rgba(255,255,255,0.15)';
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

  // Scrub state: cache geometry + data, draw the hover marker, arm the listener
  if (dates) {
    const hoverIdx = (isRedraw && _insTrendCache) ? _insTrendCache.hoverIdx : -1;
    _insTrendCache = { canvasId, data, labels, color, dates, padL, stepX, hoverIdx };
    if (hoverIdx >= 0 && pts[hoverIdx]) {
      const [hx, hy] = pts[hoverIdx];
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, padT + plotH); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.shadowColor = 'rgba(255,255,255,0.7)'; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    }
    _insInitTrendScrub(cvs);
  }
}

/* Momentum is framed by what builds it, never by penalties (loss aversion).
   Goal-gradient nudge: name the nearest almost-reached milestone. */
function _insMomentumNudge(momentum, tasksDoneToday) {
  const today = localDateStr(new Date());
  const overdueCount = TASKS.filter(t => !t.done && t.dueDate && t.dueDate < today).length;

  // Nearest streak-proximity nudge across habits
  let nudge = '';
  let best = null; // { name, daysLeft }
  (_habits || []).forEach(h => {
    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (_habitLogs[localDateStr(d)]?.completions?.[h.id]) streak++;
      else break;
    }
    const left = 7 - streak;
    if (streak >= 4 && left > 0 && (!best || left < best.daysLeft)) best = { name: h.name, daysLeft: left };
  });
  if (best) {
    nudge = `${best.daysLeft} day${best.daysLeft > 1 ? 's' : ''} from a 7-day streak — ${escHtml(best.name)}`;
  } else if (tasksDoneToday >= 3 && tasksDoneToday < 6) {
    nudge = `${6 - tasksDoneToday} more task${6 - tasksDoneToday > 1 ? 's' : ''} to a full-velocity day`;
  } else {
    nudge = 'every completion adds velocity.';
  }

  const reentry = overdueCount > 0
    ? `<div class="ins-reentry">
         <span class="ins-reentry-msg">${overdueCount} task${overdueCount > 1 ? 's' : ''} slipped orbit · re-entry is one click</span>
         <button class="ins-reentry-btn" id="ins-reentry-btn">reschedule all → tomorrow</button>
       </div>`
    : '';

  return `<div class="ins-nudge">✦ ${nudge}</div>${reentry}`;
}

/* ── Design-system tab chrome (Overview · Time · Focus · Patterns) ──────
   Groups the existing real-data sections under DS-styled tabs. Switching a tab
   toggles [data-ins-tab] section visibility and re-renders so canvases in the
   now-visible tab size correctly. */
let _insxTab = 'overview';
function _insxApplyTab() {
  document.querySelectorAll('#insx-tabs .insx-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.insTabBtn === _insxTab));
  document.querySelectorAll('#panel-insights [data-ins-tab]').forEach(sec => {
    sec.style.display = (sec.dataset.insTab === _insxTab) ? '' : 'none';
  });
}
function _insxSetTab(tab) { _insxTab = tab; _insxApplyTab(); renderInsights(); }

function renderInsights() {
  const logs = _habitLogs, habits = _habits;
  const today = localDateStr(new Date());
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  // Wire the DS tab bar once, then apply the active tab so the visible sections
  // are laid out (non-zero canvas width) before we draw into them.
  const tabsEl = document.getElementById('insx-tabs');
  if (tabsEl && !tabsEl.dataset.wired) {
    tabsEl.dataset.wired = '1';
    tabsEl.querySelectorAll('[data-ins-tab-btn]').forEach(b =>
      b.addEventListener('click', () => _insxSetTab(b.dataset.insTabBtn)));
  }
  _insxApplyTab();
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
    const secs = dayTasks.reduce((s, t) => s + taskEffortSecs(t), 0);
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
        <div class="ins-hero-gauge-bar"><div class="ins-hero-gauge-fill" style="width:${Math.round(habitPct * 2)}%;background:${habitGreen ? 'rgb(57,255,20)' : 'rgba(255,255,255,0.5)'};box-shadow:${habitGreen ? '0 0 6px rgba(57,255,20,0.4)' : 'none'}"></div></div>
        <span class="ins-hero-gauge-val">${momentum.habitPts}</span>
      </div>
      <div class="ins-hero-gauge">
        <span class="ins-hero-gauge-label">Tasks</span>
        <div class="ins-hero-gauge-bar"><div class="ins-hero-gauge-fill" style="width:${taskTodayPct}%;background:${taskGreen ? 'rgb(57,255,20)' : 'rgba(255,255,255,0.5)'};box-shadow:${taskGreen ? '0 0 6px rgba(57,255,20,0.4)' : 'none'}"></div></div>
        <span class="ins-hero-gauge-val">${tasksDoneToday}</span>
      </div>
      ${_insMomentumNudge(momentum, tasksDoneToday)}`;
    document.getElementById('ins-reentry-btn')?.addEventListener('click', () => rescheduleAllOverdue());
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
  let weekSecs = 0;
  const byCat = {};
  TASKS.forEach(task => {
    // Focus time = logged time on COMPLETED tasks only (matches Insights-X).
    // Previously this fell back to dueDate, so undone tasks with a due date and
    // logged minutes inflated focus hours — the "4h while tasks undone" bug.
    if (!task.done) return;
    const taskSecs = taskEffortSecs(task);
    if (taskSecs <= 0) return;
    const dd = task.doneDate || '';
    if (dd >= weekAgo) weekSecs += taskSecs;
    const cat = task.category || 'uncategorised';
    byCat[cat] = (byCat[cat] || 0) + taskSecs;
  });
  setEl('ins-focus-time', weekSecs > 0 ? _insFmtHrs(weekSecs) : '—');
  const focusBar = document.getElementById('ins-focus-bar');
  if (focusBar) {
    focusBar.style.width = Math.min(100, Math.round(weekSecs / (8 * 3600) * 100)) + '%';
    focusBar.style.background = weekSecs >= focusThreshold ? 'rgb(57,255,20)' : 'rgba(255,255,255,0.5)';
    focusBar.style.boxShadow = weekSecs >= focusThreshold ? '0 0 8px rgba(57,255,20,0.3)' : 'none';
  }
  const focusSub = document.getElementById('ins-focus-sub');
  if (focusSub) focusSub.textContent = weekSecs > 0 ? 'Logged task time this week' : 'Log time when you close a task';

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
    } else { overdueSub.textContent = 'All clear'; overdueSub.style.color = 'rgba(57,255,20,0.6)'; }
  }

  // ── Tabbed Visualization: compute all 3 datasets ───────
  // 1. Pulse Heatmap data — last 84 days
  const pulseData = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = localDateStr(d);
    const dayTasks = TASKS.filter(t => t.done && t.doneDate === ds);
    const secs = dayTasks.reduce((s, t) => s + taskEffortSecs(t), 0);
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
    const secs = taskEffortSecs(t);
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
        <div class="ins-viz-stat"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:rgb(57,255,20);margin-right:6px;box-shadow:0 0 6px rgba(57,255,20,0.4)"></span>This week <span class="val">${thisTotal} tasks</span></div>
        <div class="ins-viz-stat"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.4);margin-right:6px"></span>Last week <span class="val">${prevTotal} tasks</span></div>
        <div class="ins-viz-stat">Peak hour <span class="val">${peakV > 0 ? String(peakH).padStart(2,'0') + ':00' : '—'}</span></div>
        <div class="ins-viz-stat">Peak count <span class="val ${peakV >= 5 ? 'green' : ''}">${peakV}</span></div>`;
    }
  }

  // ── Completion Trend (28-day) ─────────────────────────
  const trendData = [], trendLabels = [], trendDates = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = localDateStr(d);
    trendData.push(TASKS.filter(t => t.done && t.doneDate === ds).length);
    trendDates.push(ds);
    trendLabels.push(i % 7 === 0 ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
  }
  // Use green if weekly average >= 5 tasks/day, else white
  const weekAvg = trendData.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const trendColor = weekAvg >= 5 ? 'rgb(57,255,20)' : 'rgba(255,255,255,0.5)';
  if (panelVisible) _insDrawTrend('ins-trend-canvas', trendData, trendLabels, trendColor, trendDates);

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
        return `<div class="hb-fi-habit" style="border-left-color:var(--gold)">
          <div class="hb-fi-info">
            <div class="hb-fi-name">${escHtml(h.name)} — ${h.pct}% this month</div>
            <div class="hb-fi-reason">Inconsistent — ${skipped} skips in ${h.possible} days</div>
          </div>
          <div class="hb-fi-action" style="color:var(--gold)">~ Watch</div>
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
    const col = pct >= 70 ? 'var(--neon)' : pct >= 40 ? 'var(--gold)' : 'var(--gold)';
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
  const focusThis = thisWeekTasks.reduce((s, t) => s + taskEffortSecs(t), 0);
  const focusPrev = prevWeekTasks.reduce((s, t) => s + taskEffortSecs(t), 0);

  // Top categories this week
  const catSecs = {};
  thisWeekTasks.forEach(t => {
    const cat = t.category || 'uncategorised';
    catSecs[cat] = (catSecs[cat] || 0) + taskEffortSecs(t);
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
      <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin:16px 0 10px;">Habit Performance · ${weekPct}% ${prevPct > 0 ? '(' + deltaStr + ')' : ''}</div>
      <div class="hb-wc-habits">${habitTags}</div>`;
  }

  debriefEl.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:300;color:var(--cream);margin-bottom:2px">${startLabel} – ${endLabel}</div>
    <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);margin-bottom:14px">Current Week</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-family:var(--font-display);font-size:28px;font-weight:300;color:${thisWeekTasks.length >= 25 ? 'rgb(57,255,20)' : 'var(--cream)'}">${thisWeekTasks.length}</span>
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;color:var(--muted)">tasks done · ${taskDeltaStr} last week</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-family:var(--font-display);font-size:20px;font-weight:300;color:var(--cream)">${_insFmtHrs(focusThis)}</span>
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;color:var(--muted)">focus time${focusPrev > 0 ? ` · was ${_insFmtHrs(focusPrev)}` : ''}</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-family:var(--font-display);font-size:16px;font-weight:300;color:var(--cream)">${bestDayName}</span>
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;color:var(--muted)">best day · ${bestDay.count} tasks</span>
      </div>
    </div>
    ${topCats.length ? `<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px">Top Categories</div>
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

/* ══ MILESTONES — FIRESTORE CRUD ══ */
// → future file: cosmodex-planning.js
async function addMilestoneProject(title, startDate, endDate, color, category='', notes='', missionBrief='', antiGoals='', cadence='quarterly', bigRock=false) {
  const { addDoc, serverTimestamp } = window.CDX_FB;
  const ref = await addDoc(_uc('milestoneProjects'),
    { title, startDate, endDate, color, category: category||null, notes: notes||'',
      missionBrief: missionBrief||null, antiGoals: antiGoals||null,
      cadence: cadence || 'quarterly', bigRock: !!bigRock,
      isArchived: false,
      createdAt: serverTimestamp() });
  return ref;
}

// A commitment's cadence, defaulting older records (no field) to quarterly.
function commitmentCadence(p) {
  const c = p && p.cadence;
  return (c === 'weekly' || c === 'monthly' || c === 'quarterly') ? c : 'quarterly';
}

async function updateMilestoneProject(id, data) {
  const { updateDoc } = window.CDX_FB;
  await updateDoc(_ud('milestoneProjects', id), data);
}

async function deleteMilestoneProject(id) {
  const { getDocs, query, where, writeBatch } = window.CDX_FB;
  const [evSnap, listSnap] = await Promise.all([
    getDocs(query(_uc('milestoneEvents'), where('projectId', '==', id))),
    getDocs(query(_uc('milestone_lists'), where('projectId', '==', id))),
  ]);
  // Gather every task linked to this commitment — via event activities OR a direct projectId.
  const taskIds = [];
  evSnap.docs.forEach(d => {
    (d.data().activities || []).forEach(a => { if (a.taskId && !taskIds.includes(a.taskId)) taskIds.push(a.taskId); });
  });
  TASKS.forEach(t => { if (t.projectId === id && !taskIds.includes(t.id)) taskIds.push(t.id); });
  // Completed tasks are preserved (unlinked); incomplete ones are deleted with the commitment.
  const { del, keep } = _partitionLinkedTasks(taskIds);
  const calEventIds = _collectTaskCalEvents(del);
  // Atomic cascade: one WriteBatch so a mid-flight failure can't leave orphaned
  // events/lists/tasks/calEvents pointing at a deleted commitment.
  const batch = writeBatch(window.CDX_DB);
  evSnap.docs.forEach(d => batch.delete(d.ref));
  listSnap.docs.forEach(d => batch.delete(d.ref));
  del.forEach(tid => batch.delete(_ud('tasks', tid)));
  keep.forEach(tid => batch.update(_ud('tasks', tid), { projectId: null }));
  calEventIds.forEach(cid => batch.delete(_ud('calEvents', cid)));
  batch.delete(_ud('milestoneProjects', id));
  await batch.commit();
}

// Split linked task ids into those to delete (incomplete) vs keep (completed).
function _partitionLinkedTasks(taskIds) {
  const del = [], keep = [];
  taskIds.forEach(tid => {
    const t = TASKS.find(t => t.id === tid);
    if (t && t.done) keep.push(tid); else if (t) del.push(tid);
  });
  return { del, keep };
}

// Calendar events belonging to the given tasks (and their subtasks), de-duped.
function _collectTaskCalEvents(taskIds) {
  const ids = [];
  taskIds.forEach(tid => {
    const t = TASKS.find(t => t.id === tid);
    if (t?.calEventId) ids.push(t.calEventId);
    (t?.subtasks || []).forEach(s => { if (s.calEventId) ids.push(s.calEventId); });
  });
  CAL_EVENTS.filter(e => taskIds.includes(e.taskId)).forEach(e => { if (!ids.includes(e.id)) ids.push(e.id); });
  return ids;
}

async function addMilestoneEvent(projectId, title, date, description, activities) {
  const { addDoc, serverTimestamp } = window.CDX_FB;
  await addDoc(_uc('milestoneEvents'),
    { projectId, title, date, description, activities, createdAt: serverTimestamp() });
}

async function updateMilestoneEvent(id, data) {
  const { updateDoc } = window.CDX_FB;
  await updateDoc(_ud('milestoneEvents', id), data);
}

async function deleteMilestoneEvent(id) {
  const { deleteDoc, updateDoc } = window.CDX_FB;
  const ev = MILESTONE_EVENTS.find(e => e.id === id);
  const taskIds = (ev?.activities || []).filter(a => a.taskId).map(a => a.taskId);
  // Completed tasks are preserved (unlinked); incomplete ones are deleted with the milestone.
  const { del, keep } = _partitionLinkedTasks(taskIds);
  const calEventIds = _collectTaskCalEvents(del);
  await Promise.all([
    deleteDoc(_ud('milestoneEvents', id)),
    ...del.map(tid => deleteDoc(_ud('tasks', tid))),
    ...keep.map(tid => updateDoc(_ud('tasks', tid), { projectId: null })),
    ...calEventIds.map(cid => deleteDoc(_ud('calEvents', cid))),
  ]);
}

/* ── Milestone Lists ────────────────────────────────────── */
async function ensureMilestoneList(projectId, title) {
  if (MILESTONE_LISTS.some(ml => ml.projectId === projectId)) return;
  const { addDoc, serverTimestamp } = window.CDX_FB;
  await addDoc(_uc('milestone_lists'), { projectId, title, items: [], createdAt: serverTimestamp() });
}

async function updateMilestoneListItems(id, items) {
  const { updateDoc } = window.CDX_FB;
  await updateDoc(_ud('milestone_lists', id), { items });
}

async function addMilestoneItem(projId, text) {
  const ml = MILESTONE_LISTS.find(m => m.projectId === projId);
  if (!ml) return;
  const newItem = { id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() };
  await updateMilestoneListItems(ml.id, [...(ml.items || []), newItem]);
}

async function toggleMilestoneItem(projId, itemId) {
  const ml = MILESTONE_LISTS.find(m => m.projectId === projId);
  if (!ml) return;
  const items = (ml.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i);
  await updateMilestoneListItems(ml.id, items);
}

async function deleteMilestoneItem(projId, itemId) {
  const ml = MILESTONE_LISTS.find(m => m.projectId === projId);
  if (!ml) return;
  await updateMilestoneListItems(ml.id, (ml.items || []).filter(i => i.id !== itemId));
}

async function toggleMilestoneActivity(eventId, actId) {
  const ev = MILESTONE_EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  const act = ev.activities.find(a => a.id === actId);
  const activities = ev.activities.map(a =>
    a.id === actId ? { ...a, done: !a.done } : a
  );
  await updateMilestoneEvent(eventId, { activities });
  // Sync linked task
  if (act?.taskId) {
    const task = TASKS.find(t => t.id === act.taskId);
    if (task) await updateTask(act.taskId, { done: !act.done });
  }
}

async function addMilestoneActivity(eventId, text, taskId=null) {
  const ev = MILESTONE_EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  // If no taskId provided, create a real task
  let realTaskId = taskId;
  if (!taskId && text) {
    const { addDoc, serverTimestamp } = window.CDX_FB;
    const ref = await addDoc(_uc('tasks'), {
      title: text, done: false, priority: 'med',
      dueDate: ev.date || null, category: _settings.defaultCategory || null,
      calEventId: null, subtasks: [],
      projectId: ev.projectId || null,
      createdAt: serverTimestamp()
    });
    realTaskId = ref.id;
  } else if (taskId && ev.projectId) {
    // Stamp projectId on existing task if not already set
    const task = TASKS.find(t => t.id === taskId);
    if (task && !task.projectId) {
      updateTask(taskId, { projectId: ev.projectId });
    }
  }
  const newAct = { id: crypto.randomUUID(), text: text||'', taskId: realTaskId||null, done: false };
  await updateMilestoneEvent(eventId, { activities: [...(ev.activities||[]), newAct] });
}

/* ══ MILESTONES — RENDER ══ */
function msDateToPercent(dateStr, startDate, endDate) {
  const d = new Date(dateStr).getTime();
  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime();
  if (e === s) return 0;
  return Math.min(100, Math.max(0, ((d - s) / (e - s)) * 100));
}

function renderMilestones() {
  // Keep the design-kit tabs live when commitments/milestones change.
  window._refreshPlanDesign && window._refreshPlanDesign();
  // Always show dashboard in left panel; timeline (if active) in right panel
  renderMilestoneDashboard();
  // Only manage timeline/center-panel state when actually on the Planning panel
  if (_mainPanel !== 'milestones') return;
  if (_msView === 'timeline' && _msFocusProj && MILESTONE_PROJECTS.find(p => p.id === _msFocusProj)) {
    // An initiative is selected — filter the calendar (and lists) to it
    showPlanningTimeline(_msFocusProj);
  } else {
    // Nothing selected (or the focused project was deleted) — show every
    // initiative's milestones + events on the calendar.
    _msView = 'dashboard';
    _msFocusProj = null;
    showPlanningCalendarAll();
  }
}

/* ── Dashboard: card grid ────────────────────────────── */
function renderMilestoneDashboard() {
  const body = document.getElementById('milestones-body');
  if (!body) return;

  const activeProjs   = MILESTONE_PROJECTS.filter(p => !p.isArchived);
  const archivedProjs = MILESTONE_PROJECTS.filter(p => p.isArchived);


  if (!MILESTONE_PROJECTS.length) {
    body.innerHTML = `<div style="color:var(--muted);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-align:center;margin-top:60px">No commitments yet.<br><br>Click "+ New" to start.</div>`;
    return;
  }

  body.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'ms-dash-grid';

  // Big rocks (BAU) pinned to the top of the commitments list (item 6)
  const sortedProjs = [...activeProjs].sort((a, b) => (b.bigRock ? 1 : 0) - (a.bigRock ? 1 : 0));
  sortedProjs.forEach(proj => {
    const pr  = _commitmentProgress(proj.id);
    const pct = Math.round(pr * 100);
    const cTasks = _commitmentTasks(proj.id);
    const doneN  = cTasks.filter(t => t.done).length;
    const cat = proj.category ? CATEGORIES[proj.category] : null;
    const clr = proj.color || 'rgba(255,255,255,.5)';
    const dates = (proj.startDate && proj.endDate)
      ? `${fmtDate(proj.startDate)} – ${fmtDate(proj.endDate)}`
      : (proj.bigRock ? 'Ongoing · BAU' : '');

    const outer = document.createElement('div');
    outer.className = 'ms-dash-card-outer ms-oneliner';
    outer.dataset.msDashCard = proj.id;
    outer.style.setProperty('--commit-clr', clr);
    outer.innerHTML = `
      <div class="ms-ol-inner">
        <div class="ms-ol-row">
          <span class="ms-ol-dot" style="background:${clr}"></span>
          <span class="ms-ol-title">${escHtml(proj.title)}</span>
          ${proj.bigRock ? `<span class="ms-ol-bau">⛰ BAU</span>` : ''}
          ${cat ? `<span class="plan-pill">${escHtml(cat.label.toUpperCase())}</span>` : ''}
          <span style="flex:1"></span>
          <span class="ms-ol-pct">${cTasks.length ? `${doneN}/${cTasks.length} · ` : ''}${pct}%</span>
          <button class="ms-ol-archive" data-ms-archive="${proj.id}" title="Mark done & archive">✓</button>
        </div>
        ${dates ? `<div class="ms-ol-meta">${escHtml(dates)}</div>` : ''}
        <div class="ms-ol-track"><div class="ms-ol-fill" style="width:${pct}%;background:${clr}"></div></div>
      </div>`;
    grid.appendChild(outer);
  });

  if (activeProjs.length) body.appendChild(grid);
  else body.innerHTML = `<div style="color:var(--muted);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-align:center;margin-top:40px">All commitments archived.</div>`;

  grid.querySelectorAll('[data-ms-dash-card]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      _msView = 'timeline';
      _msFocusProj = card.dataset.msDashCard;
      showPlanningTimeline(_msFocusProj);
    });
  });
}

/* ── Archived projects overlay ────────────────────────── */
function showArchivedProjectsOverlay() {
  const existing = document.getElementById('ms-archived-overlay');
  if (existing) { existing.remove(); return; }

  const archivedProjs = MILESTONE_PROJECTS.filter(p => p.isArchived);
  const overlay = document.createElement('div');
  overlay.id = 'ms-archived-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:900;display:flex;align-items:flex-start;justify-content:flex-end;padding:56px 16px 0';
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;width:420px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6)">
      <div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);gap:8px">
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);flex:1">Archived Commitments</span>
        <button id="ms-arch-overlay-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;line-height:1;padding:2px 6px">×</button>
      </div>
      <div style="overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px">
        ${archivedProjs.length === 0
          ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--muted);text-align:center;padding:24px">No archived commitments</div>`
          : archivedProjs.map(proj => {
              const events = MILESTONE_EVENTS.filter(e => e.projectId === proj.id);
              const allActs = events.flatMap(e => e.activities || []);
              const doneActs = allActs.filter(a => a.done).length;
              return `<div class="ms-arch-item" data-arch-proj="${proj.id}" style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;transition:background 150ms">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="flex:1;font-family:var(--font-mono);font-size:11px;color:rgba(255,255,255,0.7)">${escHtml(proj.title)}</div>
                  <span style="font-family:var(--font-mono);font-size:10px;color:var(--neon)">✓ done</span>
                  <button class="btn-ghost ms-unarchive-btn" data-ms-unarchive="${proj.id}" style="font-size:10px;padding:3px 8px;color:var(--muted);border-color:var(--border)">Restore</button>
                </div>
                <div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:4px">${doneActs}/${allActs.length} tasks · ${events.length} milestone${events.length !== 1 ? 's' : ''}</div>
              </div>`;
            }).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#ms-arch-overlay-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll('.ms-arch-item').forEach(item => {
    item.addEventListener('click', async e => {
      const restoreBtn = e.target.closest('[data-ms-unarchive]');
      if (restoreBtn) {
        const projId = restoreBtn.dataset.msUnarchive;
        await window.CDX_FB.updateDoc(_ud('milestoneProjects', projId), { isArchived: false });
        overlay.remove();
        return;
      }
      overlay.remove();
      _msView = 'timeline';
      _msFocusProj = item.dataset.archProj;
      showPlanningTimeline(_msFocusProj);
    });
    item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.08)'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'rgba(255,255,255,0.04)'; });
  });
}

/* ── Archived page (full panel) ────────────────────────── */
function renderArchivedPage() {
  const body  = document.getElementById('archived-page-body');
  const badge = document.getElementById('archived-count-badge');
  if (!body) return;
  const archivedProjs = MILESTONE_PROJECTS.filter(p => p.isArchived);
  if (badge) badge.textContent = `${archivedProjs.length} archived`;
  if (archivedProjs.length === 0) {
    body.innerHTML = `<div style="font-family:var(--font-mono);font-size:11px;color:var(--muted);text-align:center;padding:64px">No archived commitments</div>`;
    return;
  }
  body.innerHTML = archivedProjs.map(proj => {
    const events  = MILESTONE_EVENTS.filter(e => e.projectId === proj.id);
    const allActs = events.flatMap(e => e.activities || []);
    const doneActs = allActs.filter(a => a.done).length;
    const pct   = allActs.length ? Math.round(doneActs / allActs.length * 100) : 0;
    const start = proj.startDate ? proj.startDate.slice(0, 10) : '—';
    const end   = proj.endDate   ? proj.endDate.slice(0, 10)   : '—';
    const cat   = proj.category  || '—';
    return `<div class="archived-row" data-arch-proj="${proj.id}" style="display:grid;grid-template-columns:1fr 120px 160px 140px 120px;gap:0;padding:13px 28px;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;transition:background 120ms;cursor:default">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:7px;height:7px;border-radius:50%;background:${proj.color || '#888'};flex-shrink:0"></div>
        <span style="font-size:13px;color:rgba(255,255,255,0.85)">${escHtml(proj.title)}</span>
      </div>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${escHtml(cat)}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${start} → ${end}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:2px;background:rgba(255,255,255,0.08);border-radius:2px;max-width:80px">
          <div style="height:2px;background:var(--neon);border-radius:2px;width:${pct}%"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${doneActs}/${allActs.length}</span>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn-ghost arch-page-unarchive-btn" data-arch-unarchive="${proj.id}" style="font-size:10px;padding:4px 10px;color:var(--muted)">Unarchive</button>
      </div>
    </div>`;
  }).join('');
  body.querySelectorAll('.archived-row').forEach(row => {
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.03)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
  });
  body.querySelectorAll('.arch-page-unarchive-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const projId = btn.dataset.archUnarchive;
      await window.CDX_FB.updateDoc(_ud('milestoneProjects', projId), { isArchived: false });
    });
  });
}

function showPlanningTimeline(projId) {
  const proj = MILESTONE_PROJECTS.find(p => p.id === projId);
  if (!proj) return;

  // Update right panel header title
  const titleEl = document.getElementById('plan-ctx-title');
  if (titleEl) titleEl.textContent = proj.title;

  // Show "+ Milestone" and close buttons in header
  const addBtn = document.getElementById('plan-tl-add-ms');
  if (addBtn) {
    addBtn.style.display = '';
    addBtn.dataset.msAddEvent = projId;
    addBtn.onclick = () => openMsEventModal(projId);
  }
  const closeBtn = document.getElementById('plan-ms-close');
  if (closeBtn) closeBtn.style.display = '';
  const editProjBtn = document.getElementById('plan-edit-proj');
  if (editProjBtn) {
    editProjBtn.style.display = '';
    editProjBtn.onclick = () => openMsProjectModal(projId);
  }

  // Switch from empty state to content
  const empty   = document.getElementById('plan-ctx-empty');
  const content = document.getElementById('plan-ctx-content');
  if (empty)   empty.style.display   = 'none';
  if (content) content.style.display = 'flex';

  // Show lists panel content, hide its empty state
  const listsEmpty = document.getElementById('plan-lists-empty');
  const listsBody  = document.getElementById('plan-tl-lists-body');
  if (listsEmpty) listsEmpty.style.display = 'none';
  if (listsBody)  listsBody.style.display  = '';

  // Highlight active card in left panel
  document.querySelectorAll('.plan-left .ms-dash-card-outer').forEach(c => {
    c.classList.toggle('ctx-active', c.dataset.msDashCard === projId);
  });

  // Auto-expand right panel if collapsed
  if (_planRightCollapsed) togglePlanPanel('right');

  // Render content — calendar filtered to this initiative
  renderPlanningCalendar(projId);
  ensureMilestoneList(projId, proj.title).then(() => renderMilestoneListsPanel(projId));
}

/* ── Milestone Lists Panel ──────────────────────────────── */
function renderMilestoneListsPanel(projId) {
  const body = document.getElementById('plan-tl-lists-body');
  if (!body) return;

  const ml = MILESTONE_LISTS.find(m => m.projectId === projId);
  if (!ml) {
    body.innerHTML = `<div style="font-size:11px;color:var(--muted);text-align:center;padding:20px 0">Loading…</div>`;
    return;
  }

  const items = ml.items || [];
  const doneCount = items.filter(i => i.done).length;

  // Tasks linked to this commitment (projectId) — the real work with due dates,
  // shown here so a task added to the commitment is visible in its detail view,
  // not just in the edit modal.
  const linkedTasks = (typeof TASKS !== 'undefined' ? TASKS : [])
    .filter(t => t.projectId === projId)
    .sort((a, b) => (a.done - b.done) || String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  const tasksHtml = linkedTasks.length ? `
    <div style="padding:6px 0 8px">
      <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;color:var(--muted);margin-bottom:6px">LINKED TASKS · ${linkedTasks.filter(t => t.done).length}/${linkedTasks.length}</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${linkedTasks.map(t => `
          <div style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" data-plink-toggle="${escAttr(t.id)}" ${t.done ? 'checked' : ''} style="cursor:pointer;accent-color:var(--gold);flex-shrink:0">
            <span data-plink-open="${escAttr(t.id)}" title="Open task" style="font-size:11px;color:${t.done ? 'var(--muted)' : 'var(--cream)'};flex:1;${t.done ? 'text-decoration:line-through' : ''};line-height:1.4;word-break:break-word;cursor:pointer">${escHtml(t.title)}</span>
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--muted);flex-shrink:0">${t.dueDate ? escHtml(fmtDate(t.dueDate)) : (t.someday ? 'Someday' : '—')}</span>
            <button data-plink-unlink="${escAttr(t.id)}" title="Remove from this commitment (keeps the task)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:0 2px;line-height:1;flex-shrink:0">×</button>
          </div>`).join('')}
      </div>
      <div style="height:1px;background:var(--border);margin:10px 0 2px"></div>
    </div>` : '';

  body.innerHTML = `
    ${tasksHtml}
    <div style="padding:6px 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${doneCount}/${items.length} done</span>
      </div>
      <div id="ms-items-list" style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">
        ${items.map(item => `
          <div style="display:flex;align-items:flex-start;gap:5px">
            <input type="checkbox" data-ms-toggle="${item.id}" ${item.done ? 'checked' : ''} style="cursor:pointer;accent-color:var(--gold);flex-shrink:0;margin-top:3px">
            <span style="font-size:11px;color:${item.done ? 'var(--muted)' : 'var(--cream)'};flex:1;${item.done ? 'text-decoration:line-through' : ''};line-height:1.4;word-break:break-word">${escHtml(item.text)}</span>
            <button data-ms-del="${item.id}" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:0 2px;line-height:1;flex-shrink:0">×</button>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:4px">
        <input id="ms-new-item-inp" class="form-input" placeholder="Add item…" style="flex:1;font-size:11px;padding:4px 7px;height:26px">
        <button id="ms-new-item-btn" class="btn-primary" style="font-size:10px;padding:4px 8px;height:26px;flex-shrink:0">+</button>
      </div>
    </div>`;

  const inp = body.querySelector('#ms-new-item-inp');
  body.querySelector('#ms-new-item-btn').addEventListener('click', async () => {
    if (inp.value.trim()) { await addMilestoneItem(projId, inp.value.trim()); inp.value = ''; }
  });
  inp.addEventListener('keydown', async e => {
    if (e.key === 'Enter' && inp.value.trim()) { await addMilestoneItem(projId, inp.value.trim()); inp.value = ''; }
  });

  body.querySelectorAll('[data-ms-toggle]').forEach(cb => {
    cb.addEventListener('change', () => toggleMilestoneItem(projId, cb.dataset.msToggle));
  });

  // Linked-task completion — toggle the real task, then refresh this panel.
  body.querySelectorAll('[data-plink-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      const p = toggleTask(cb.dataset.plinkToggle);
      (p && p.then ? p : Promise.resolve()).then(() => renderMilestoneListsPanel(projId));
    });
  });

  // Open a linked task in the Tasks page.
  body.querySelectorAll('[data-plink-open]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.plinkOpen;
      showMainPanel('alltasks');
      setTimeout(() => window.openAtkDetail?.(id), 40);
    });
  });

  // Unlink a task from this commitment (clears projectId; the task itself stays).
  body.querySelectorAll('[data-plink-unlink]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.plinkUnlink;
      const p = updateTask(id, { projectId: null });
      (p && p.then ? p : Promise.resolve()).then(() => {
        if (typeof showToast === 'function') showToast('Unlinked from commitment', 'success');
        renderMilestoneListsPanel(projId);
      });
    });
  });

  body.querySelectorAll('[data-ms-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteMilestoneItem(projId, btn.dataset.msDel));
  });
}


function renderMsColorPicker(containerId, selectedColor) {
  const picker = document.getElementById(containerId);
  if (!picker) return;
  picker.innerHTML = PROJECT_COLORS.map(c => `
    <div class="ms-color-swatch ${selectedColor === c ? 'selected' : ''}"
         style="background:${c}" data-color="${c}"></div>
  `).join('');
}

function renderMsActivityList() {
  const el = document.getElementById('ms-event-activities-list');
  if (!el) return;
  if (!_msNewActivities.length) {
    el.innerHTML = '<p style="font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.06em">No tasks yet.</p>';
    return;
  }
  el.innerHTML = _msNewActivities.map((a, i) => {
    const task = a.taskId ? TASKS.find(t => t.id === a.taskId) : null;
    const cat  = task?.category ? CATEGORIES[task.category] : null;
    const modCatClr = getCatColor(task?.category);
    const catBadge = cat ? `<span style="font-size:10px;padding:1px 5px;border-radius:100px;background:${modCatClr}22;color:${modCatClr};border:1px solid ${modCatClr}44;font-family:var(--font-mono)">${cat.label}</span>` : '';
    const linkedBadge = a.taskId ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--neon);padding:1px 5px;border-radius:4px;background:rgba(74,124,94,0.1)">linked</span>` : '';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-family:var(--font-body);font-size:13px;color:var(--cream)">${escHtml(a.text||a.title||'')}</span>
        ${catBadge}${linkedBadge}
        <span style="font-size:11px;color:var(--muted);cursor:pointer;padding:2px 6px" data-rm-activity="${i}">✕</span>
      </div>`;
  }).join('');
}

function openMsProjectModal(projId = null) {
  _msProjEdit = projId;
  const proj = projId ? MILESTONE_PROJECTS.find(p => p.id === projId) : null;
  document.getElementById('ms-proj-modal-title').textContent = proj ? 'Edit Commitment' : 'New Commitment';
  document.getElementById('ms-proj-title').value = proj ? proj.title : '';
  document.getElementById('ms-proj-start').value = proj ? proj.startDate : '';
  document.getElementById('ms-proj-end').value   = proj ? proj.endDate : '';
  const selColor = proj ? proj.color : PROJECT_COLORS[0];
  document.getElementById('ms-proj-color-val').value = selColor;
  renderMsColorPicker('ms-proj-color-picker', selColor);
  // Populate category select
  const catSel = document.getElementById('ms-proj-category');
  if (catSel) {
    catSel.innerHTML = '<option value="">— None —</option>' +
      Object.entries(CATEGORIES).map(([k,v]) =>
        `<option value="${k}"${proj?.category===k?' selected':''}>${v.label}</option>`
      ).join('');
  }
  // Populate notes
  const notesEl = document.getElementById('ms-proj-notes');
  if (notesEl) notesEl.value = proj ? (proj.notes || '') : '';
  // Populate mission brief and anti-goals
  const missionEl = document.getElementById('ms-proj-mission');
  if (missionEl) missionEl.value = proj ? (proj.missionBrief || '') : '';
  const antiEl = document.getElementById('ms-proj-antigoals');
  if (antiEl) antiEl.value = proj ? (proj.antiGoals || '') : '';
  const cadenceEl = document.getElementById('ms-proj-cadence');
  if (cadenceEl) cadenceEl.value = proj ? commitmentCadence(proj) : 'quarterly';
  const bigRockEl = document.getElementById('ms-proj-bigrock');
  if (bigRockEl) bigRockEl.checked = proj ? !!proj.bigRock : false;
  const delBtn = document.getElementById('ms-proj-delete-btn');
  if (delBtn) delBtn.style.display = proj ? '' : 'none';
  // Tasks section — link the work that delivers this commitment (item 4)
  const tasksGroup = document.getElementById('ms-proj-tasks-group');
  if (tasksGroup) {
    tasksGroup.style.display = proj ? '' : 'none';
    if (proj) { _renderMsProjTasks(projId); _wireMsProjTasks(projId); }
  }
  openOverlay('ms-project-modal');
}

function _renderMsProjTasks(projId) {
  const listEl = document.getElementById('ms-proj-tasks-list');
  if (!listEl) return;
  const tasks = TASKS.filter(t => t.projectId === projId)
    .sort((a, b) => (a.done - b.done) || String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  if (!tasks.length) {
    listEl.innerHTML = `<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:.06em;padding:3px 0">No tasks yet — add the work that delivers this.</div>`;
    return;
  }
  listEl.innerHTML = tasks.map(t => {
    const due = t.dueDate ? fmtDate(t.dueDate) : (t.someday ? 'Someday' : 'No date');
    return `<div class="ms-proj-task-row${t.done ? ' done' : ''}">
      <span class="ms-proj-task-dot" style="background:${getCatColor(t.category)}"></span>
      <span class="ms-proj-task-name">${escHtml(t.title)}</span>
      <span class="ms-proj-task-due">${escHtml(due)}</span>
      <button class="ms-proj-task-unlink" data-unlink="${escAttr(t.id)}" title="Unlink from commitment">✕</button>
    </div>`;
  }).join('');
  listEl.querySelectorAll('[data-unlink]').forEach(b => b.onclick = async () => {
    await updateTask(b.dataset.unlink, { projectId: null });
    _renderMsProjTasks(projId);
  });
}

// Shared: create a new task (or link an existing one) to a commitment.
// Due date is mandatory on first input (item 12) unless linking a task that already has one.
async function _commitmentAddTask(projId, title, due) {
  title = (title || '').trim();
  if (!title) return false;
  const existing = TASKS.find(t => t.title.toLowerCase() === title.toLowerCase() && t.projectId !== projId);
  if (!due && !(existing && existing.dueDate)) { showToast('Due date is required', 'error'); return false; }
  try {
    if (existing) {
      await updateTask(existing.id, { projectId: projId, dueDate: existing.dueDate || due });
    } else {
      const { addDoc, serverTimestamp } = window.CDX_FB;
      await addDoc(_uc('tasks'), { title, done: false, dueDate: due, projectId: projId, priority: 'med', createdAt: serverTimestamp() });
    }
    showToast('Task added to commitment', 'success');
    return true;
  } catch (e) { console.error('commitmentAddTask', e); showToast('Could not add task', 'error'); return false; }
}

async function _addMsProjTask(projId) {
  const titleEl = document.getElementById('ms-proj-task-title');
  const dueEl   = document.getElementById('ms-proj-task-due');
  const ok = await _commitmentAddTask(projId, titleEl?.value, dueEl?.value || '');
  if (!ok) { dueEl?.focus(); return; }
  if (titleEl) titleEl.value = '';
  if (dueEl) dueEl.value = '';
  const sr = document.getElementById('ms-proj-task-search'); if (sr) { sr.style.display = 'none'; sr.innerHTML = ''; }
  setTimeout(() => _renderMsProjTasks(projId), 150);
}

function _wireMsProjTasks(projId) {
  const addBtn = document.getElementById('ms-proj-task-add');
  const titleEl = document.getElementById('ms-proj-task-title');
  const searchEl = document.getElementById('ms-proj-task-search');
  if (addBtn) addBtn.onclick = () => _addMsProjTask(projId);
  if (titleEl) {
    titleEl.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); _addMsProjTask(projId); } };
    titleEl.oninput = () => {
      const q = titleEl.value.trim().toLowerCase();
      if (!searchEl) return;
      if (!q) { searchEl.style.display = 'none'; searchEl.innerHTML = ''; return; }
      const res = TASKS.filter(t => !t.done && t.projectId !== projId && t.title.toLowerCase().includes(q)).slice(0, 6);
      if (!res.length) { searchEl.style.display = 'none'; searchEl.innerHTML = ''; return; }
      searchEl.style.display = '';
      searchEl.innerHTML = res.map(t =>
        `<div class="ms-proj-search-item" data-link="${escAttr(t.id)}"><span class="ms-proj-task-dot" style="background:${getCatColor(t.category)}"></span>${escHtml(t.title)}<span class="ms-proj-task-due">${t.dueDate ? escHtml(fmtDate(t.dueDate)) : 'no date'}</span></div>`).join('');
      searchEl.querySelectorAll('[data-link]').forEach(el => el.onclick = async () => {
        const t = TASKS.find(x => x.id === el.dataset.link);
        const due = document.getElementById('ms-proj-task-due')?.value || '';
        if (!t.dueDate && !due) { showToast('Set a due date first', 'error'); return; }
        await updateTask(t.id, { projectId: projId, dueDate: t.dueDate || due });
        titleEl.value = ''; searchEl.style.display = 'none'; searchEl.innerHTML = '';
        setTimeout(() => _renderMsProjTasks(projId), 150);
      });
    };
  }
}

function openMsEventModal(projectId, eventId = null, prefilledDate = '') {
  const ev = eventId ? MILESTONE_EVENTS.find(e => e.id === eventId) : null;
  _msEventEdit = eventId || null;
  _msNewActivities = ev ? JSON.parse(JSON.stringify(ev.activities)) : [];
  document.getElementById('ms-event-modal-title').textContent = ev ? 'Edit Milestone' : 'New Milestone';
  const _delBtn = document.getElementById('ms-event-delete');
  if (_delBtn) {
    _delBtn.style.display = ev ? '' : 'none';
    _delBtn.onclick = async () => {
      if (!await cdxConfirm(`Delete milestone "${ev.title}"?`)) return;
      await deleteMilestoneEvent(ev.id);
      closeOverlay('ms-event-modal');
      showToast('Milestone deleted', 'success');
    };
  }
  document.getElementById('ms-event-project-id').value = projectId;
  document.getElementById('ms-event-id').value = eventId || '';
  document.getElementById('ms-event-title').value = ev ? ev.title : '';
  const _evProj = MILESTONE_PROJECTS.find(p => p.id === projectId);
  const _dateInput = document.getElementById('ms-event-date');
  _dateInput.value  = ev ? ev.date : (prefilledDate || '');
  _dateInput.min = _evProj?.startDate || '';
  _dateInput.max = _evProj?.endDate   || '';
  document.getElementById('ms-event-desc').value  = ev ? (ev.description || '') : '';
  // Clear task search
  const searchInp = document.getElementById('ms-activity-input');
  if (searchInp) searchInp.value = '';
  const searchRes = document.getElementById('ms-activity-search-results');
  if (searchRes) { searchRes.style.display = 'none'; searchRes.innerHTML = ''; }
  renderMsActivityList();
  openOverlay('ms-event-modal');
}

function openMsEventDetail(eventId) {
  const ev = MILESTONE_EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  const proj = MILESTONE_PROJECTS.find(p => p.id === ev.projectId);
  document.getElementById('ms-detail-title').textContent = ev.title;
  document.getElementById('ms-detail-meta').textContent =
    fmtDate(ev.date) + (proj ? ' · ' + proj.title : '');
  document.getElementById('ms-detail-desc').textContent = ev.description || '';
  const acts = document.getElementById('ms-detail-activities');
  if (!ev.activities.length) {
    acts.innerHTML = '<p style="font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.06em">No activities.</p>';
  } else {
    acts.innerHTML = ev.activities.map(a => `
      <div class="ms-activity-row">
        <div class="ms-activity-check ${a.done ? 'done' : ''}"
             data-toggle-act="${escAttr(a.id)}" data-ev-id="${escAttr(eventId)}"></div>
        <span class="ms-activity-text ${a.done ? 'done' : ''}">${escHtml(a.text)}</span>
      </div>`).join('');
  }
  document.getElementById('ms-detail-edit-btn').dataset.editEvId   = eventId;
  document.getElementById('ms-detail-delete-btn').dataset.delEvId  = eventId;
  openOverlay('ms-event-detail');
}

/* ── Helper: calculate date from progress bar click ───── */
function dateFromBarClick(projId, bar, clickX) {
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clickX - rect.left) / rect.width));
  const proj = MILESTONE_PROJECTS.find(p => p.id === projId);
  if (!proj) return null;
  const start = new Date(proj.startDate);
  const end   = new Date(proj.endDate);
  const ms = start.getTime() + pct * (end.getTime() - start.getTime());
  return localDateStr(new Date(ms));
}

/* ── Helper: task search results for milestone panels ─── */
function showMsTaskSearchResults(query, evId, containerEl) {
  if (!containerEl) return;
  const q = (query || '').toLowerCase().trim();
  if (!q) { containerEl.style.display = 'none'; containerEl.innerHTML = ''; return; }
  const ev = MILESTONE_EVENTS.find(e => e.id === evId);
  const existingTaskIds = new Set((ev?.activities || []).map(a => a.taskId).filter(Boolean));
  const results = TASKS
    .filter(t => !t.done && t.title.toLowerCase().includes(q) && !existingTaskIds.has(t.id))
    .slice(0, 5);
  if (!results.length) { containerEl.style.display = 'none'; containerEl.innerHTML = ''; return; }
  containerEl.style.display = 'block';
  containerEl.innerHTML = results.map(t => {
    const cat = t.category ? CATEGORIES[t.category] : null;
    const catBadge = cat ? `<span style="font-size:10px;padding:1px 5px;border-radius:100px;background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44;font-family:var(--font-mono)">${cat.label}</span>` : '';
    const dot = `<div style="width:6px;height:6px;border-radius:50%;background:${t.priority==='high'?'var(--gold)':t.priority==='med'?'rgba(255,255,255,0.55)':'var(--muted)'};flex-shrink:0"></div>`;
    return `<div class="ms-task-search-result" data-task-id="${escAttr(t.id)}" data-ev-id="${escAttr(evId)}">${dot}<span style="flex:1">${escHtml(t.title)}</span>${catBadge}</div>`;
  }).join('');
}

function initMilestonesPanel() {
  // Toolbar delegation — catches dynamically-added toolbar buttons
  document.getElementById('panel-milestones').addEventListener('click', e => {
    const editProjBtn = e.target.closest('[data-ms-edit-proj]');
    if (editProjBtn && editProjBtn.dataset.msEditProj) {
      openMsProjectModal(editProjBtn.dataset.msEditProj);
      return;
    }
    const addEvBtn = e.target.closest('[data-ms-add-event]');
    if (addEvBtn) {
      openMsEventModal(addEvBtn.dataset.msAddEvent);
      return;
    }
  });

  // Add initiative button
  document.getElementById('ms-add-project-btn')?.addEventListener('click', () => openMsProjectModal());

  // Color swatch selection in project modal
  document.getElementById('ms-proj-color-picker').addEventListener('click', e => {
    const sw = e.target.closest('[data-color]');
    if (!sw) return;
    document.querySelectorAll('#ms-proj-color-picker .ms-color-swatch')
      .forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
    document.getElementById('ms-proj-color-val').value = sw.dataset.color;
  });

  // Initiative modal confirm — includes category + notes + mission + anti-goals
  document.getElementById('ms-proj-confirm').addEventListener('click', async () => {
    const title       = document.getElementById('ms-proj-title').value.trim();
    const start       = document.getElementById('ms-proj-start').value;
    const end         = document.getElementById('ms-proj-end').value;
    const color       = document.getElementById('ms-proj-color-val').value || PROJECT_COLORS[0];
    const category    = document.getElementById('ms-proj-category')?.value || '';
    const notes       = document.getElementById('ms-proj-notes')?.value.trim() || '';
    const missionBrief = document.getElementById('ms-proj-mission')?.value.trim() || '';
    const antiGoals   = document.getElementById('ms-proj-antigoals')?.value.trim() || '';
    const cadence     = document.getElementById('ms-proj-cadence')?.value || 'quarterly';
    const bigRock     = !!document.getElementById('ms-proj-bigrock')?.checked;
    if (!title) { showToast('Title is required.', 'error'); return; }
    // BAU big rocks are ongoing — no mandatory start/end (item 6).
    if (!bigRock && (!start || !end)) { showToast('Start and End dates are required.', 'error'); return; }
    if (start && end && end < start) { showToast('End date must be on or after start date.', 'error'); return; }
    try {
      if (_msProjEdit) {
        await updateMilestoneProject(_msProjEdit, { title, startDate: start, endDate: end, color, category: category||null, notes, missionBrief: missionBrief||null, antiGoals: antiGoals||null, cadence, bigRock });
        closeOverlay('ms-project-modal');
      } else {
        const newRef = await addMilestoneProject(title, start, end, color, category, notes, missionBrief, antiGoals, cadence, bigRock);
        closeOverlay('ms-project-modal');
        if (newRef?.id) { _msView = 'timeline'; _msFocusProj = newRef.id; showPlanningTimeline(newRef.id); }
      }
    } catch (err) {
      console.error('Failed to save commitment:', err);
      showToast('Failed to save commitment', 'error');
    }
  });

  // Initiative delete button
  document.getElementById('ms-proj-delete-btn').addEventListener('click', async () => {
    if (!_msProjEdit) return;
    const proj = MILESTONE_PROJECTS.find(p => p.id === _msProjEdit);
    if (await cdxConfirm(`Delete commitment "${proj ? proj.title : ''}" and all its milestones?`)) {
      await deleteMilestoneProject(_msProjEdit);
      closeOverlay('ms-project-modal');
    }
  });

  // ── milestones-body: unified click delegation ───────────
  const msBody = document.getElementById('milestones-body');

  msBody.addEventListener('click', async e => {
    // Archive (mark done) button
    const archBtn = e.target.closest('[data-ms-archive]');
    if (archBtn) {
      const projId = archBtn.dataset.msArchive;
      const proj = MILESTONE_PROJECTS.find(p => p.id === projId);
      if (proj && await cdxConfirm(`Mark "${proj.title}" as done and archive it?`, { okLabel: 'Archive', okColor: 'var(--cream)', okBg: 'rgba(255,255,255,0.1)', okBorder: 'rgba(255,255,255,0.2)' })) {
        await window.CDX_FB.updateDoc(_ud('milestoneProjects', projId), { isArchived: true });
      }
      return;
    }

    // Unarchive (restore) button
    const unarchBtn = e.target.closest('[data-ms-unarchive]');
    if (unarchBtn) {
      const projId = unarchBtn.dataset.msUnarchive;
      await window.CDX_FB.updateDoc(_ud('milestoneProjects', projId), { isArchived: false });
      return;
    }

    // Pip click — open event modal (do NOT bubble to bar click)
    const pip = e.target.closest('[data-ms-pip]');
    if (pip) { e.stopPropagation(); return; }

    // + Milestone button
    const addEvBtn = e.target.closest('[data-ms-add-event]');
    if (addEvBtn) { openMsEventModal(addEvBtn.dataset.msAddEvent); return; }

    // ⋯ Edit initiative button
    const editProjBtn = e.target.closest('[data-ms-edit-proj]');
    if (editProjBtn && editProjBtn.dataset.msEditProj) {
      openMsProjectModal(editProjBtn.dataset.msEditProj); return;
    }

    // ✎ Edit event/milestone button
    const editEvBtn = e.target.closest('[data-ms-edit-ev]');
    if (editEvBtn) {
      const evId = editEvBtn.dataset.msEditEv;
      const ev = MILESTONE_EVENTS.find(ev => ev.id === evId);
      if (ev) openMsEventModal(ev.projectId, evId);
      return;
    }

    // ✕ Delete milestone event from timeline card
    const delEvBtn = e.target.closest('[data-ms-del-ev]');
    if (delEvBtn) {
      const evId = delEvBtn.dataset.msDelEv;
      if (await cdxConfirm('Delete this milestone?')) {
        await deleteMilestoneEvent(evId);
      }
      return;
    }

    // Toggle activity checkbox
    const actCheck = e.target.closest('[data-toggle-act]');
    if (actCheck) {
      await toggleMilestoneActivity(actCheck.dataset.evId, actCheck.dataset.toggleAct);
      return;
    }

    // Remove activity
    const rmAct = e.target.closest('[data-rm-act]');
    if (rmAct) {
      const ev = MILESTONE_EVENTS.find(ev => ev.id === rmAct.dataset.evId);
      if (ev) {
        const removedAct = ev.activities.find(a => a.id === rmAct.dataset.rmAct);
        if (removedAct?.taskId) await updateTask(removedAct.taskId, { projectId: null });
        const activities = ev.activities.filter(a => a.id !== rmAct.dataset.rmAct);
        await updateMilestoneEvent(rmAct.dataset.evId, { activities });
      }
      return;
    }

    // Add task button (from inline search row)
    const addTaskEvBtn = e.target.closest('[data-add-task-ev]');
    if (addTaskEvBtn) {
      const evId = addTaskEvBtn.dataset.addTaskEv;
      const inputEl = msBody.querySelector(`.ms-task-search-input[data-ev-id="${evId}"]`);
      const text = inputEl?.value.trim();
      if (!text) return;
      // Check if it matches an existing task
      const match = TASKS.find(t => t.title.toLowerCase() === text.toLowerCase() && !t.done);
      if (match) {
        await addMilestoneActivity(evId, match.title, match.id);
      } else {
        await addMilestoneActivity(evId, text, null);
      }
      if (inputEl) inputEl.value = '';
      const resultsEl = msBody.querySelector(`.ms-task-search-results[data-ev-id="${evId}"]`);
      if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
      return;
    }

    // Task search result click (inline card)
    const searchResult = e.target.closest('.ms-task-search-result[data-task-id]');
    if (searchResult) {
      const taskId = searchResult.dataset.taskId;
      const evId   = searchResult.dataset.evId;
      const task   = TASKS.find(t => t.id === taskId);
      if (task) await addMilestoneActivity(evId, task.title, task.id);
      const inputEl   = msBody.querySelector(`.ms-task-search-input[data-ev-id="${evId}"]`);
      if (inputEl) inputEl.value = '';
      const resultsEl = msBody.querySelector(`.ms-task-search-results[data-ev-id="${evId}"]`);
      if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
      return;
    }

    // Progress bar click → open milestone modal at that date
    // (must be last: only fires if no other target matched)
    const bar = e.target.closest('[data-proj-bar]');
    if (bar && !e.target.closest('[data-ms-pip]') && !e.target.closest('button')) {
      const projId  = bar.dataset.projBar;
      const dateStr = dateFromBarClick(projId, bar, e.clientX);
      if (projId && dateStr) openMsEventModal(projId, null, dateStr);
      return;
    }
  });

  // ── Task search input (live search) ────────────────────
  msBody.addEventListener('input', e => {
    const inp = e.target.closest('.ms-task-search-input');
    if (!inp) return;
    const evId = inp.dataset.evId;
    const resultsEl = msBody.querySelector(`.ms-task-search-results[data-ev-id="${evId}"]`);
    showMsTaskSearchResults(inp.value, evId, resultsEl);
  });

  // ── Progress bar: hover tooltip + click to add milestone ─
  const tooltip = document.getElementById('ms-date-tooltip');

  msBody.addEventListener('mousemove', e => {
    const bar = e.target.closest('[data-proj-bar]');
    if (!bar || e.target.closest('[data-ms-pip]')) {
      if (tooltip) tooltip.style.display = 'none';
      return;
    }
    const projId = bar.dataset.projBar;
    const dateStr = dateFromBarClick(projId, bar, e.clientX);
    if (tooltip && dateStr) {
      tooltip.textContent = fmtDate(dateStr);
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top  = (e.clientY - 28) + 'px';
    }
  });

  msBody.addEventListener('mouseleave', () => {
    if (tooltip) tooltip.style.display = 'none';
  });

  // ── Event modal: activity add with task search ──────────
  const modalActivityAdd = document.getElementById('ms-activity-add');
  const modalActivityInp = document.getElementById('ms-activity-input');
  const modalSearchRes   = document.getElementById('ms-activity-search-results');

  if (modalActivityInp) {
    modalActivityInp.addEventListener('input', () => {
      const q = modalActivityInp.value.trim().toLowerCase();
      if (!q) { if (modalSearchRes) { modalSearchRes.style.display='none'; modalSearchRes.innerHTML=''; } return; }
      const results = TASKS.filter(t => !t.done && t.title.toLowerCase().includes(q)).slice(0,5);
      if (!results.length) { if (modalSearchRes) { modalSearchRes.style.display='none'; modalSearchRes.innerHTML=''; } return; }
      if (modalSearchRes) {
        modalSearchRes.style.display = 'block';
        modalSearchRes.innerHTML = results.map(t => {
          const cat = t.category ? CATEGORIES[t.category] : null;
          const catBadge = cat ? `<span style="font-size:10px;padding:1px 5px;border-radius:100px;background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44;font-family:var(--font-mono)">${cat.label}</span>` : '';
          return `<div class="ms-task-search-result" data-modal-task-id="${escAttr(t.id)}" style="cursor:pointer"><div style="width:6px;height:6px;border-radius:50%;background:${t.priority==='high'?'var(--gold)':t.priority==='med'?'rgba(255,255,255,0.55)':'var(--muted)'};flex-shrink:0"></div><span style="flex:1">${escHtml(t.title)}</span>${catBadge}</div>`;
        }).join('');
      }
    });
    modalActivityInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); modalActivityAdd?.click(); }
    });
  }

  if (modalSearchRes) {
    modalSearchRes.addEventListener('click', e => {
      const item = e.target.closest('[data-modal-task-id]');
      if (!item) return;
      const task = TASKS.find(t => t.id === item.dataset.modalTaskId);
      if (task) {
        _msNewActivities.push({ id: crypto.randomUUID(), text: task.title, taskId: task.id, done: false });
        renderMsActivityList();
      }
      modalActivityInp.value = '';
      modalSearchRes.style.display = 'none';
      modalSearchRes.innerHTML = '';
    });
  }

  if (modalActivityAdd) {
    modalActivityAdd.addEventListener('click', () => {
      const text = modalActivityInp?.value.trim();
      if (!text) return;
      // Check if typed text exactly matches an existing task
      const match = TASKS.find(t => t.title.toLowerCase() === text.toLowerCase() && !t.done);
      if (match) {
        _msNewActivities.push({ id: crypto.randomUUID(), text: match.title, taskId: match.id, done: false });
      } else {
        _msNewActivities.push({ id: crypto.randomUUID(), text, taskId: null, done: false });
      }
      if (modalActivityInp) modalActivityInp.value = '';
      if (modalSearchRes) { modalSearchRes.style.display = 'none'; modalSearchRes.innerHTML = ''; }
      renderMsActivityList();
    });
  }

  document.getElementById('ms-event-activities-list').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm-activity]');
    if (rm) { _msNewActivities.splice(+rm.dataset.rmActivity, 1); renderMsActivityList(); }
  });

  // Event modal confirm
  let _msEventSaving = false;
  document.getElementById('ms-event-confirm').addEventListener('click', async () => {
    if (_msEventSaving) return;
    _msEventSaving = true;
    const title  = document.getElementById('ms-event-title').value.trim();
    const date   = document.getElementById('ms-event-date').value;
    const desc   = document.getElementById('ms-event-desc').value.trim();
    const projId = document.getElementById('ms-event-project-id').value;
    const evId   = document.getElementById('ms-event-id').value;
    if (!title || !date) { _msEventSaving = false; return; }
    const _evProj = MILESTONE_PROJECTS.find(p => p.id === projId);
    if (_evProj) {
      if (_evProj.startDate && date < _evProj.startDate) {
        showToast(`Milestone date cannot be before the initiative start date (${_evProj.startDate}).`, 'error');
        _msEventSaving = false; return;
      }
      if (_evProj.endDate && date > _evProj.endDate) {
        showToast(`Milestone date cannot be after the initiative end date (${_evProj.endDate}).`, 'error');
        _msEventSaving = false; return;
      }
    }

    try {
      // For new tasks (taskId=null), create real tasks in Firestore before saving
      const activitiesToSave = await Promise.all(_msNewActivities.map(async a => {
        if (!a.taskId && a.text) {
          const { addDoc, serverTimestamp } = window.CDX_FB;
          const ref = await addDoc(_uc('tasks'), {
            title: a.text, done: false, priority: 'med',
            dueDate: date || null, category: null,
            calEventId: null, subtasks: [],
            createdAt: serverTimestamp()
          });
          return { ...a, taskId: ref.id };
        }
        return a;
      }));

      if (evId) {
        await updateMilestoneEvent(evId, { title, date, description: desc, activities: activitiesToSave });
      } else {
        await addMilestoneEvent(projId, title, date, desc, activitiesToSave);
      }
      closeOverlay('ms-event-modal');
    } finally {
      _msEventSaving = false;
    }
  });

  // Event detail — activity toggles
  document.getElementById('ms-detail-activities').addEventListener('click', async e => {
    const toggle = e.target.closest('[data-toggle-act]');
    if (toggle) await toggleMilestoneActivity(toggle.dataset.evId, toggle.dataset.toggleAct);
  });

  // Event detail — edit button
  document.getElementById('ms-detail-edit-btn').addEventListener('click', () => {
    const evId = document.getElementById('ms-detail-edit-btn').dataset.editEvId;
    const ev = MILESTONE_EVENTS.find(e => e.id === evId);
    if (ev) { closeOverlay('ms-event-detail'); openMsEventModal(ev.projectId, evId); }
  });

  // Event detail — delete button
  document.getElementById('ms-detail-delete-btn').addEventListener('click', async () => {
    const evId = document.getElementById('ms-detail-delete-btn').dataset.delEvId;
    if (await cdxConfirm('Delete this milestone?')) {
      await deleteMilestoneEvent(evId);
      closeOverlay('ms-event-detail');
    }
  });

  // Also attach click + input delegation to right-panel timeline body
  const tlBody = document.getElementById('plan-tl-body');
  if (tlBody) {
    tlBody.addEventListener('click', async e => {
      const editEvBtn = e.target.closest('[data-ms-edit-ev]');
      if (editEvBtn) { const ev = MILESTONE_EVENTS.find(ev => ev.id === editEvBtn.dataset.msEditEv); if (ev) openMsEventModal(ev.projectId, editEvBtn.dataset.msEditEv); return; }
      const delEvBtn = e.target.closest('[data-ms-del-ev]');
      if (delEvBtn) { if (await cdxConfirm('Delete this milestone?')) await deleteMilestoneEvent(delEvBtn.dataset.msDelEv); return; }
      const actCheck = e.target.closest('[data-toggle-act]');
      if (actCheck) { await toggleMilestoneActivity(actCheck.dataset.evId, actCheck.dataset.toggleAct); return; }
      const rmAct = e.target.closest('[data-rm-act]');
      if (rmAct) { const ev = MILESTONE_EVENTS.find(ev => ev.id === rmAct.dataset.evId); if (ev) { const removedAct = ev.activities.find(a => a.id === rmAct.dataset.rmAct); if (removedAct?.taskId) await updateTask(removedAct.taskId, { projectId: null }); const activities = ev.activities.filter(a => a.id !== rmAct.dataset.rmAct); await updateMilestoneEvent(rmAct.dataset.evId, { activities }); } return; }
      const addTaskEvBtn = e.target.closest('[data-add-task-ev]');
      if (addTaskEvBtn) {
        const evId = addTaskEvBtn.dataset.addTaskEv;
        const inputEl = tlBody.querySelector(`.ms-task-search-input[data-ev-id="${evId}"]`);
        const text = inputEl?.value.trim();
        if (!text) return;
        const match = TASKS.find(t => t.title.toLowerCase() === text.toLowerCase() && !t.done);
        if (match) await addMilestoneActivity(evId, match.title, match.id);
        else await addMilestoneActivity(evId, text, null);
        if (inputEl) inputEl.value = '';
        const resultsEl = tlBody.querySelector(`.ms-task-search-results[data-ev-id="${evId}"]`);
        if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
        return;
      }
      const searchResult = e.target.closest('.ms-task-search-result[data-task-id]');
      if (searchResult) {
        const task = TASKS.find(t => t.id === searchResult.dataset.taskId);
        if (task) await addMilestoneActivity(searchResult.dataset.evId, task.title, task.id);
        const inputEl = tlBody.querySelector(`.ms-task-search-input[data-ev-id="${searchResult.dataset.evId}"]`);
        if (inputEl) inputEl.value = '';
        const resultsEl = tlBody.querySelector(`.ms-task-search-results[data-ev-id="${searchResult.dataset.evId}"]`);
        if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
        return;
      }
    });
    tlBody.addEventListener('input', e => {
      const inp = e.target.closest('.ms-task-search-input');
      if (!inp) return;
      const evId = inp.dataset.evId;
      const resultsEl = tlBody.querySelector(`.ms-task-search-results[data-ev-id="${evId}"]`);
      showMsTaskSearchResults(inp.value, evId, resultsEl);
    });
  }

  // Hide tooltip when mouse leaves the milestones body
  if (tooltip) {
    document.addEventListener('mousemove', e => {
      if (!e.target.closest('[data-proj-bar]')) tooltip.style.display = 'none';
    });
  }
}

/* ══ PLANNING WIDGETS (Week / Month panels in Planning page) ══ */
(function(){
  let _planWeekOffset = 0;
  let _planMonthOffset = 0;
  let _planSaveTimer = null;

  function isoWeekKey(date) {
    const d = new Date(date || new Date());
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const w1 = new Date(d.getFullYear(), 0, 4);
    const wn = 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${String(wn).padStart(2,'0')}`;
  }
  function monthKey(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function getWeekStart(offset) {
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + (offset || 0) * 7);
    mon.setHours(0,0,0,0);
    return mon;
  }


  function switchPlanRightTab(tab) {
    document.querySelectorAll('.plan-center-tab').forEach(b => b.classList.toggle('active', b.dataset.ptab === tab));
    document.getElementById('plan-right-week').style.display  = tab === 'week'  ? '' : 'none';
    document.getElementById('plan-right-month').style.display = tab === 'month' ? '' : 'none';
    document.getElementById('plan-right-focus').style.display = tab === 'focus' ? '' : 'none';
    if (tab === 'week')  buildWeekPlan();
    if (tab === 'month') buildMonthPlan();
    if (tab === 'focus') buildFocusBuckets();
  }

  async function buildWeekPlan() {
    const ws = getWeekStart(_planWeekOffset);
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    const fmt = d => d.toLocaleDateString('en-GB', { month:'short', day:'numeric' });
    const labelEl = document.getElementById('plan-week-label');
    if (labelEl) labelEl.textContent = `Week of ${fmt(ws)} – ${fmt(we)}`;
    const key = isoWeekKey(ws);

    let data = {};
    const uid = window.CDX_USER?.uid;
    if (uid && window.CDX_FB && window.CDX_DB) {
      try {
        const { doc, getDoc, collection } = window.CDX_FB;
        const snap = await getDoc(doc(collection(window.CDX_DB, 'users', uid, 'weeklyPlans'), key));
        if (snap.exists()) data = snap.data();
      } catch(e) {}
    }

    const ids = ['pw-intention','pw-p1','pw-p2','pw-p3','pw-went-well','pw-carry-fwd'];
    const vals = [data.intention||'', ...(data.priorities||[]).slice(0,3), data.reviewWentWell||'', data.reviewCarryForward||''];
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) { el.value = vals[i] || ''; el.oninput = () => scheduleSave('week', key); }
    });

    // 7-column task grid
    const days = Array.from({length:7}, (_,i) => { const d = new Date(ws); d.setDate(ws.getDate()+i); return localDateStr(d); });
    renderWeekTaskData(days);
  }

  async function buildMonthPlan() {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + _planMonthOffset, 1);
    const key = monthKey(target);
    const labelEl = document.getElementById('plan-month-label');
    if (labelEl) labelEl.textContent = target.toLocaleDateString('en-GB', {month:'long', year:'numeric'});

    let data = {};
    const uid = window.CDX_USER?.uid;
    if (uid && window.CDX_FB && window.CDX_DB) {
      try {
        const { doc, getDoc, collection } = window.CDX_FB;
        const snap = await getDoc(doc(collection(window.CDX_DB, 'users', uid, 'monthlyPlans'), key));
        if (snap.exists()) data = snap.data();
      } catch(e) {}
    }

    const intentEl = document.getElementById('pm-intention');
    if (intentEl) { intentEl.value = data.intention||''; intentEl.oninput = () => scheduleSave('month', key); }

    // Calendar grid
    const daysInMonth = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
    const firstDow = (new Date(target.getFullYear(), target.getMonth(), 1).getDay() + 6) % 7;
    const todayStr = localDateStr(new Date());
    const calEl = document.getElementById('pm-cal-grid');
    if (calEl) {
      let html = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d =>
        `<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);text-align:center;padding:2px">${d}</div>`).join('');
      for (let i = 0; i < firstDow; i++) html += `<div></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${key}-${String(d).padStart(2,'0')}`;
        const hasEv = CAL_EVENTS.some(e => e.date === ds);
        const isToday = ds === todayStr;
        html += `<div class="plan-month-day-cell${isToday?' today':''}">
          <span>${d}</span>${hasEv?`<div class="plan-event-dot"></div>`:''}
        </div>`;
      }
      calEl.innerHTML = html;
    }

    renderPlanMilestones(data.milestones || [], key);

    renderMonthTaskData(key);
  }

  function renderWeekTaskData(days) {
    const grid = document.getElementById('pw-task-grid');
    if (grid) grid.innerHTML = `<div class="plan-week-grid">
      ${days.map(d => `<div class="plan-week-grid-day">${new Date(d+'T00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}</div>`).join('')}
      ${days.map(d => {
        const dt = TASKS.filter(t => (t.dueDate||t.due) === d && !t._parent);
        return `<div class="plan-week-grid-cell">
          ${dt.map(t => `<div style="padding:1px 0;color:${t.done?'var(--muted)':'var(--cream)'};text-decoration:${t.done?'line-through':'none'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px" title="${escAttr(t.title||'')}">${escHtml(t.title||'')}</div>`).join('')}
        </div>`;
      }).join('')}
    </div>`;
    const done = TASKS.filter(t => t.done && days.includes(t.dueDate||t.due)).length;
    const total = TASKS.filter(t => days.includes(t.dueDate||t.due)).length;
    const stats = document.getElementById('pw-stats');
    if (stats) stats.innerHTML = `<div class="plan-stat-bar" style="margin-top:8px">
      <div class="plan-stat-bar-label"><span>Tasks Done</span><span>${done}/${total}</span></div>
      <div class="plan-stat-bar-track"><div class="plan-stat-bar-fill" style="width:${total?Math.round(done/total*100):0}%"></div></div>
    </div>`;
    renderWeekDueSection(days);
  }

  function renderMonthTaskData(key) {
    const done = TASKS.filter(t => t.done && (t.dueDate||t.due)?.startsWith(key)).length;
    const total = TASKS.filter(t => (t.dueDate||t.due)?.startsWith(key)).length;
    const stats = document.getElementById('pm-stats');
    if (stats) stats.innerHTML = `<div class="plan-stat-bar" style="margin-top:12px">
      <div class="plan-stat-bar-label"><span>Tasks Done</span><span>${done}/${total}</span></div>
      <div class="plan-stat-bar-track"><div class="plan-stat-bar-fill" style="width:${total?Math.round(done/total*100):0}%"></div></div>
    </div>`;
    renderMonthDueSection(key);
  }

  function refreshPlanTaskViews() {
    // Keep the focused commitment's calendar + linked-task list live as tasks
    // change (e.g. a task just added to it), so it shows without re-opening.
    if (_msView === 'timeline' && _msFocusProj &&
        document.getElementById('plan-ctx-content')?.style.display !== 'none') {
      if (typeof renderPlanningCalendar === 'function') renderPlanningCalendar(_msFocusProj);
      const ae = document.activeElement;
      const typingInPanel = ae && ae.closest && ae.closest('#plan-tl-lists-body');
      if (!typingInPanel && typeof renderMilestoneListsPanel === 'function') renderMilestoneListsPanel(_msFocusProj);
    }
    const calView = document.getElementById('plan-view-calendar');
    if (!calView || calView.style.display === 'none') return;
    const weekEl = document.getElementById('plan-right-week');
    if (weekEl && weekEl.style.display !== 'none') {
      const days = Array.from({length:7}, (_,i) => { const d = new Date(getWeekStart(_planWeekOffset)); d.setDate(d.getDate()+i); return localDateStr(d); });
      renderWeekTaskData(days);
    } else {
      const target = new Date(new Date().getFullYear(), new Date().getMonth() + _planMonthOffset, 1);
      renderMonthTaskData(monthKey(target));
    }
  }

  function renderWeekDueSection(days) {
    const el = document.getElementById('pw-due-section');
    if (!el) return;
    // Tasks due this week (not sub-tasks)
    const tasks = TASKS.filter(t => !t._parent && days.includes(t.dueDate||t.due))
      .sort((a,b) => (a.dueDate||a.due||'').localeCompare(b.dueDate||b.due||''));
    // Milestone events due this week
    const msEvents = (typeof MILESTONE_EVENTS !== 'undefined' ? MILESTONE_EVENTS : [])
      .filter(e => days.includes(e.date));

    if (!tasks.length && !msEvents.length) {
      el.innerHTML = '';
      return;
    }
    const fmtDate = ds => new Date(ds+'T00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'});
    let rows = '';
    msEvents.forEach(e => {
      rows += `<div class="plan-due-row">
        <span class="plan-due-badge milestone">Milestone</span>
        <span class="plan-due-title" title="${escAttr(e.title||'')}">${escHtml(e.title||'Untitled')}</span>
        <span class="plan-due-date">${e.date ? fmtDate(e.date) : ''}</span>
      </div>`;
    });
    tasks.forEach(t => {
      const d = t.dueDate||t.due||'';
      rows += `<div class="plan-due-row">
        <span class="plan-due-badge task${t.done?' done':''}">Task</span>
        <span class="plan-due-title${t.done?' done':''}" title="${escAttr(t.title||'')}">${escHtml(t.title||'Untitled')}</span>
        <span class="plan-due-date">${d ? fmtDate(d) : ''}</span>
      </div>`;
    });
    el.innerHTML = `<div class="plan-due-section">
      <div class="plan-due-section-title">Due this week</div>
      ${rows}
    </div>`;
  }

  function renderMonthDueSection(key) {
    const el = document.getElementById('pm-due-section');
    if (!el) return;
    // Tasks due this month (not sub-tasks)
    const tasks = TASKS.filter(t => !t._parent && (t.dueDate||t.due||'').startsWith(key))
      .sort((a,b) => (a.dueDate||a.due||'').localeCompare(b.dueDate||b.due||''));
    // Milestone events due this month
    const msEvents = (typeof MILESTONE_EVENTS !== 'undefined' ? MILESTONE_EVENTS : [])
      .filter(e => e.date && e.date.startsWith(key))
      .sort((a,b) => (a.date||'').localeCompare(b.date||''));

    if (!tasks.length && !msEvents.length) {
      el.innerHTML = '';
      return;
    }
    const fmtDate = ds => new Date(ds+'T00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    let rows = '';
    msEvents.forEach(e => {
      rows += `<div class="plan-due-row">
        <span class="plan-due-badge milestone">Milestone</span>
        <span class="plan-due-title" title="${escAttr(e.title||'')}">${escHtml(e.title||'Untitled')}</span>
        <span class="plan-due-date">${e.date ? fmtDate(e.date) : ''}</span>
      </div>`;
    });
    tasks.forEach(t => {
      const d = t.dueDate||t.due||'';
      rows += `<div class="plan-due-row">
        <span class="plan-due-badge task${t.done?' done':''}">Task</span>
        <span class="plan-due-title${t.done?' done':''}" title="${escAttr(t.title||'')}">${escHtml(t.title||'Untitled')}</span>
        <span class="plan-due-date">${d ? fmtDate(d) : ''}</span>
      </div>`;
    });
    el.innerHTML = `<div class="plan-due-section">
      <div class="plan-due-section-title">Due this month</div>
      ${rows}
    </div>`;
  }

  function renderPlanMilestones(milestones, key) {
    const container = document.getElementById('pm-milestones');
    if (!container) return;
    container.innerHTML = milestones.map((m, i) => `
      <div class="plan-milestone-row" data-id="${escAttr(m.id||String(i))}">
        <input type="checkbox"${m.done?' checked':''} onchange="window._schedulePlanSave('month','${escAttr(key)}')">
        <input type="date" value="${escAttr(m.date||'')}" onchange="window._schedulePlanSave('month','${escAttr(key)}')">
        <input type="text" value="${escAttr(m.title||'')}" placeholder="Milestone…" oninput="window._schedulePlanSave('month','${escAttr(key)}')">
        <button onclick="this.closest('.plan-milestone-row').remove();window._schedulePlanSave('month','${escAttr(key)}')" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:0 4px;font-size:14px;line-height:1">✕</button>
      </div>`).join('');
  }

  function addPlanMonthMilestone() {
    const target = new Date();
    target.setMonth(target.getMonth() + _planMonthOffset);
    const key = monthKey(target);
    const container = document.getElementById('pm-milestones');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'plan-milestone-row';
    row.dataset.id = Date.now();
    row.innerHTML = `
      <input type="checkbox">
      <input type="date" value="${localDateStr(new Date())}" onchange="window._schedulePlanSave('month','${key}')">
      <input type="text" placeholder="Milestone…" oninput="window._schedulePlanSave('month','${key}')">
      <button onclick="this.closest('.plan-milestone-row').remove();window._schedulePlanSave('month','${key}')" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:0 4px;font-size:14px;line-height:1">✕</button>`;
    container.appendChild(row);
    row.querySelector('input[type="text"]').focus();
  }

  function scheduleSave(tab, key) {
    clearTimeout(_planSaveTimer);
    _planSaveTimer = setTimeout(() => savePlanData(tab, key), 800);
  }
  window._schedulePlanSave = scheduleSave;
  window.togglePlanPanel = togglePlanPanel;
  window._refreshPlanTaskViews = refreshPlanTaskViews;

  async function savePlanData(tab, key) {
    const uid = window.CDX_USER?.uid;
    if (!uid || !window.CDX_FB || !window.CDX_DB) return;
    const { doc, setDoc, collection, serverTimestamp } = window.CDX_FB;
    let payload;
    if (tab === 'week') {
      payload = {
        intention: document.getElementById('pw-intention')?.value || '',
        priorities: ['pw-p1','pw-p2','pw-p3'].map(id => document.getElementById(id)?.value || ''),
        reviewWentWell: document.getElementById('pw-went-well')?.value || '',
        reviewCarryForward: document.getElementById('pw-carry-fwd')?.value || '',
        updatedAt: serverTimestamp(),
      };
    } else {
      const milestones = [];
      document.querySelectorAll('#pm-milestones .plan-milestone-row').forEach(row => {
        milestones.push({
          id: row.dataset.id,
          date: row.querySelector('input[type="date"]')?.value || '',
          title: row.querySelector('input[type="text"]')?.value || '',
          done: row.querySelector('input[type="checkbox"]')?.checked || false,
        });
      });
      payload = {
        intention: document.getElementById('pm-intention')?.value || '',
        milestones,
        updatedAt: serverTimestamp(),
      };
    }
    try {
      await setDoc(doc(collection(window.CDX_DB, 'users', uid, tab === 'week' ? 'weeklyPlans' : 'monthlyPlans'), key), payload, { merge: true });
    } catch(e) { console.warn('Plan save error:', e); }
  }

  function closeMilestoneDetail() {
    // Deselect the initiative and fall back to the all-initiatives calendar
    _msView = 'dashboard';
    _msFocusProj = null;
    showPlanningCalendarAll();
  }

  function togglePlanPanel(side) {
    const isLeft = side === 'left';
    const panel  = document.getElementById(isLeft ? 'plan-left-panel'  : 'plan-right-panel');
    const rail   = document.getElementById(isLeft ? 'plan-left-rail'   : 'plan-right-rail');
    const toggle = document.getElementById(isLeft ? 'plan-left-toggle' : 'plan-right-toggle');
    const nowCollapsed = panel.classList.toggle('collapsed');
    rail.classList.toggle('visible', nowCollapsed);
    if (toggle) toggle.textContent = isLeft ? (nowCollapsed ? '›' : '‹') : (nowCollapsed ? '‹' : '›');
    const key = isLeft ? 'cosmodex_plan_left_collapsed' : 'cosmodex_plan_right_collapsed';
    localStorage.setItem(key, nowCollapsed ? '1' : '0');
    if (isLeft) _planLeftCollapsed = nowCollapsed; else _planRightCollapsed = nowCollapsed;
  }

  function restorePlanPanelStates() {
    if (_planLeftCollapsed) {
      document.getElementById('plan-left-panel')?.classList.add('collapsed');
      document.getElementById('plan-left-rail')?.classList.add('visible');
      const t = document.getElementById('plan-left-toggle'); if (t) t.textContent = '›';
    }
    if (_planRightCollapsed) {
      document.getElementById('plan-right-panel')?.classList.add('collapsed');
      document.getElementById('plan-right-rail')?.classList.add('visible');
      const t = document.getElementById('plan-right-toggle'); if (t) t.textContent = '‹';
    }
  }

  // Wire up tabs + nav buttons once, auto-build on first open
  let _planWidgetsInited = false;
  window.initPlanningWidgets = function() {
    if (!_planWidgetsInited) {
      _planWidgetsInited = true;
      document.querySelectorAll('.plan-center-tab').forEach(btn => {
        btn.addEventListener('click', () => switchPlanRightTab(btn.dataset.ptab));
      });
      document.getElementById('plan-week-prev')?.addEventListener('click', () => { _planWeekOffset--; buildWeekPlan(); });
      document.getElementById('plan-week-next')?.addEventListener('click', () => { _planWeekOffset++; buildWeekPlan(); });
      document.getElementById('plan-week-today')?.addEventListener('click', () => { _planWeekOffset = 0; buildWeekPlan(); });
      document.getElementById('plan-month-prev')?.addEventListener('click', () => { _planMonthOffset--; buildMonthPlan(); });
      document.getElementById('plan-month-next')?.addEventListener('click', () => { _planMonthOffset++; buildMonthPlan(); });
      document.getElementById('plan-month-today')?.addEventListener('click', () => { _planMonthOffset = 0; buildMonthPlan(); });
      document.getElementById('plan-add-month-ms')?.addEventListener('click', addPlanMonthMilestone);
      document.getElementById('plan-left-toggle')?.addEventListener('click',  () => togglePlanPanel('left'));
      document.getElementById('plan-right-toggle')?.addEventListener('click', () => togglePlanPanel('right'));
      document.getElementById('plan-left-expand')?.addEventListener('click',  e => { e.stopPropagation(); togglePlanPanel('left'); });
      document.getElementById('plan-right-expand')?.addEventListener('click', e => { e.stopPropagation(); togglePlanPanel('right'); });
      document.getElementById('plan-ms-close')?.addEventListener('click', () => {
        closeMilestoneDetail();
        window.showPlanTab2 && window.showPlanTab2(window._planTab2 || 'quarter');
      });
      // Expose the calendar sub-tab switcher so the global 7-tab controller can drive it.
      window._switchPlanCalTab = switchPlanRightTab;
      // 7-tab bar: This Week / Weekly Review / Quarter / North Star / Week / Month / Buckets
      document.querySelectorAll('#plan-tabs2 .plan-tab2').forEach(btn => {
        btn.addEventListener('click', () => window.showPlanTab2(btn.dataset.ptab2));
      });
      restorePlanPanelStates();
    }
    window.showPlanTab2(window._planTab2 || 'thisweek'); // default tab each time the panel opens
  };
})();


/* ══ KINETIC: project cards tilt toward the cursor ══ */
let _msTiltCard = null;
document.addEventListener('pointermove', e => {
  const card = e.target.closest?.('.ms-dash-card-outer');
  if (card !== _msTiltCard) {
    if (_msTiltCard) { _msTiltCard.style.transform = ''; _msTiltCard.classList.remove('tilting'); }
    _msTiltCard = card || null;
    if (card) card.classList.add('tilting');
  }
  if (!card) return;
  const r = card.getBoundingClientRect();
  const dx = (e.clientX - r.left) / r.width - 0.5;
  const dy = (e.clientY - r.top) / r.height - 0.5;
  card.style.transform = `perspective(700px) rotateX(${(-dy * 5).toFixed(2)}deg) rotateY(${(dx * 6).toFixed(2)}deg) translateZ(4px)`;
});

/* ══════════════════════════════════════════════════════════════════════
   PLANNING CALENDAR — Month / Week view of initiative milestones + events.
   Replaces the old vertical milestone timeline in the planning centre panel.
   _pcalProj null → every initiative's items, colour-coded by initiative;
   a project id → filtered to that one. Aesthetic from the design kit.
   ══════════════════════════════════════════════════════════════════════ */
let _pcalView   = 'month';       // 'month' | 'week'
let _pcalAnchor = new Date();    // any date inside the visible month / week
let _pcalProj   = null;          // filter project id (null = all initiatives)
let _pcalShowAll = false;        // Week/Month tabs: also show tasks + holidays + all events

const _PCAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _PCAL_MON3   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const _PCAL_DOW    = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

function _pcalProjColor(projId) {
  const p = MILESTONE_PROJECTS.find(pr => pr.id === projId);
  return (p && p.color) || 'rgba(255,255,255,0.55)';
}

// Which initiative a calendar event belongs to (direct field or via its task)
function _pcalEventProj(ev) {
  if (ev.projectId) return ev.projectId;
  const t = TASKS.find(t => t.calEventId === ev.id) || (ev.taskId ? TASKS.find(t => t.id === ev.taskId) : null);
  return t ? (t.projectId || null) : null;
}

// Items (milestones + initiative-linked events) grouped by 'YYYY-MM-DD'
function _pcalItems(projId) {
  const byDate = {};
  const push = (ds, item) => { (byDate[ds] = byDate[ds] || []).push(item); };

  // Milestones are a global layer — they show on every calendar regardless of
  // which commitment is in focus.
  MILESTONE_EVENTS.forEach(ev => {
    const ds = String(ev.date || '').slice(0, 10);
    if (!ds) return;
    push(ds, { kind:'milestone', id: ev.id, projectId: ev.projectId,
      title: ev.title || 'Milestone', color: _pcalProjColor(ev.projectId), startTime: null,
      foreign: !!(projId && ev.projectId !== projId) });
  });

  (CAL_EVENTS || []).forEach(ev => {
    const pid = _pcalEventProj(ev);
    // In show-all mode we surface every event; otherwise only initiative-linked ones.
    if (!pid && !_pcalShowAll) return;
    if (projId && pid !== projId) return;
    const ds = String(ev.date || '').slice(0, 10);
    if (!ds) return;
    push(ds, { kind:'event', id: ev.id, projectId: pid,
      title: ev.title || 'Event', color: pid ? _pcalProjColor(pid) : 'rgba(255,255,255,0.5)',
      startTime: ev.allDay ? null : (ev.startTime || null), duration: ev.duration || 60 });
  });

  // Commitment-focused view: surface this commitment's linked tasks by their due
  // date, even when they have no calendar event yet. Without this, a task added
  // to a commitment (projectId set) with only a due date never appeared on the
  // commitment's own calendar.
  if (projId) {
    (TASKS || []).forEach(t => {
      if (t.projectId !== projId) return;
      const ds = String(t.dueDate || '').slice(0, 10);
      if (!ds) return;
      // Skip if the task is already shown as its scheduled calendar event above.
      if (t.calEventId && (CAL_EVENTS || []).some(e => e.id === t.calEventId && String(e.date || '').slice(0, 10) === ds)) return;
      push(ds, { kind: 'task', id: t.id, projectId: projId,
        title: t.title || 'Task', color: getCatColor(t.category), done: !!t.done, startTime: null });
    });
  }

  // Show-all mode (Week/Month tabs): also surface tasks by due date + holidays.
  if (_pcalShowAll && !projId) {
    (TASKS || []).forEach(t => {
      const ds = String(t.dueDate || '').slice(0, 10);
      if (!ds) return;
      push(ds, { kind:'task', id: t.id, projectId: t.projectId || null,
        title: t.title || 'Task', color: getCatColor(t.category), done: !!t.done, startTime: null });
    });
    Object.values(HOLIDAYS || {}).forEach(h => {
      const ds = String(h.date || '').slice(0, 10);
      if (!ds) return;
      push(ds, { kind:'holiday', id: h.docId || ds, title: h.name || 'Holiday', color: 'var(--gold)', startTime: null });
    });
  }

  // Order within a day: milestone → holiday → timed event → task, then by time.
  const rank = { milestone: 0, holiday: 1, event: 2, task: 3 };
  Object.values(byDate).forEach(arr => arr.sort((a, b) =>
    (rank[a.kind] - rank[b.kind]) || String(a.startTime||'').localeCompare(String(b.startTime||''))));
  return byDate;
}

function _pcalChip(it) {
  if (it.kind === 'task') {
    return `<div class="pcal-chip task${it.done ? ' done' : ''}" data-pcal-open="task" data-id="${escAttr(it.id)}" style="--c:${it.color}" title="${escAttr(it.title)}">
      <span class="pcal-taskdot">${it.done ? '✓' : '○'}</span><span class="pcal-chip-t">${escHtml(it.title)}</span>
    </div>`;
  }
  if (it.kind === 'holiday') {
    return `<div class="pcal-chip holiday" data-pcal-open="holiday" data-id="${escAttr(it.id)}" style="--c:var(--gold)" title="${escAttr(it.title)}">
      <span class="pcal-diamond">✦</span><span class="pcal-chip-t">${escHtml(it.title)}</span>
    </div>`;
  }
  if (it.kind === 'milestone') {
    return `<div class="pcal-chip milestone${it.foreign ? ' foreign' : ''}" data-pcal-open="milestone" data-id="${escAttr(it.id)}" data-proj="${escAttr(it.projectId)}" style="--c:${it.color}" title="⚑ ${escAttr(it.title)}">
      <span class="cal-ms-ico">⚑</span><span class="pcal-chip-t">${escHtml(it.title)}</span>
    </div>`;
  }
  return `<div class="pcal-chip" data-pcal-open="${it.kind}" data-id="${escAttr(it.id)}" data-proj="${escAttr(it.projectId)}" style="--c:${it.color}" title="${escAttr(it.title)}">
      <span class="pcal-evdot"></span>
      <span class="pcal-chip-t">${escHtml(it.title)}</span>
    </div>`;
}

function _pcalMonthCells(anchor) {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;   // Mon = 0
  const todayStr = localDateStr(new Date());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m, 1 - offset + i);
    const ds = localDateStr(d);
    cells.push({ date: d.getDate(), ds, inMonth: d.getMonth() === m, isToday: ds === todayStr, weekend: (d.getDay() + 6) % 7 >= 5 });
  }
  return cells;
}

function _pcalWeekDays(anchor) {
  const off = (anchor.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) =>
    new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - off + i));
}

function _pcalRenderMonth(byDate) {
  const cells = _pcalMonthCells(_pcalAnchor);
  const dow = _PCAL_DOW.map(d => `<div class="pcal-dow">${d}</div>`).join('');
  // Dim dates outside the focused commitment's window (item 9)
  const _fproj = _pcalProj ? MILESTONE_PROJECTS.find(p => p.id === _pcalProj) : null;
  const _rs = _fproj?.startDate, _re = _fproj?.endDate;
  const _outRange = ds => _rs && _re && (ds < _rs || ds > _re);
  // Mark days that fall within the focused commitment's window (month view only) —
  // rendered as a green neon dot on the cell (item 10).
  const _inRange = ds => _rs && _re && ds >= _rs && ds <= _re;
  const grid = cells.map(c => {
    const items = byDate[c.ds] || [];
    const chips = items.slice(0, 3).map(_pcalChip).join('');
    const more = items.length > 3 ? `<div class="pcal-more">+${items.length - 3} more</div>` : '';
    return `<div class="pcal-cell${c.inMonth ? '' : ' out'}${c.isToday ? ' today' : ''}${c.weekend ? ' wknd' : ''}${_outRange(c.ds) ? ' pcal-outrange' : ''}${(c.inMonth && _inRange(c.ds)) ? ' pcal-inrange' : ''}" data-pcal-day="${c.ds}">
        <div class="pcal-cell-h">
          <span class="pcal-date">${c.date}</span>
          ${c.isToday ? '<span class="pcal-today-tag">TODAY</span>' : ''}
          ${items.length ? `<span class="pcal-count">·${items.length}</span>` : ''}
        </div>
        <div class="pcal-cell-body">${chips}${more}</div>
      </div>`;
  }).join('');
  return `<div class="pcal-month"><div class="pcal-dow-row">${dow}</div><div class="pcal-grid">${grid}</div></div>`;
}

function _pcalRenderWeek(byDate) {
  const days = _pcalWeekDays(_pcalAnchor);
  const todayStr = localDateStr(new Date());
  const H0 = 7, H1 = 21, HH = 44;
  const hours = []; for (let h = H0; h <= H1; h++) hours.push(h);

  const header = `<div class="pcal-wk-hrow"><div class="pcal-wk-corner"></div>` +
    days.map((d, i) => `<div class="pcal-wk-dh${localDateStr(d) === todayStr ? ' today' : ''}">
        <span class="pcal-wk-dn">${_PCAL_DOW[i]}</span><span class="pcal-wk-dd">${d.getDate()}</span></div>`).join('') + `</div>`;

  const allday = `<div class="pcal-wk-allrow"><div class="pcal-wk-alllbl">ALL-DAY</div>` +
    days.map(d => {
      const items = (byDate[localDateStr(d)] || []).filter(it => it.kind === 'milestone' || !it.startTime);
      return `<div class="pcal-wk-allcell">${items.map(_pcalChip).join('')}</div>`;
    }).join('') + `</div>`;

  const rail = `<div class="pcal-wk-rail">` +
    hours.map(h => `<div class="pcal-wk-hr" style="height:${HH}px"><span>${String(h).padStart(2,'0')}</span></div>`).join('') + `</div>`;

  const cols = days.map(d => {
    const ds = localDateStr(d);
    const timed = (byDate[ds] || []).filter(it => it.kind === 'event' && it.startTime);
    const slots = hours.map(() => `<div class="pcal-wk-slot" style="height:${HH}px"></div>`).join('');
    const evs = timed.map(it => {
      const [hh, mm] = it.startTime.split(':').map(Number);
      const top = Math.max(0, (hh + (mm || 0) / 60 - H0) * HH);
      const height = Math.max(20, ((it.duration || 60) / 60) * HH - 3);
      return `<div class="pcal-wk-ev" data-pcal-open="event" data-id="${escAttr(it.id)}" data-proj="${escAttr(it.projectId)}"
          style="--c:${it.color};top:${top}px;height:${height}px" title="${escAttr(it.title)}">
          <span class="pcal-wk-ev-t">${escHtml(it.title)}</span><span class="pcal-wk-ev-time">${it.startTime}</span></div>`;
    }).join('');
    return `<div class="pcal-wk-col${ds === todayStr ? ' today' : ''}">${slots}<div class="pcal-wk-events">${evs}</div></div>`;
  }).join('');

  return `${header}${allday}<div class="pcal-wk-body">${rail}<div class="pcal-wk-cols">${cols}</div></div>`;
}

function _pcalToolbar(hideToggle) {
  let label;
  if (_pcalView === 'week') {
    const ds = _pcalWeekDays(_pcalAnchor), a = ds[0], b = ds[6];
    label = `${_PCAL_MON3[a.getMonth()]} ${a.getDate()} – ${_PCAL_MON3[b.getMonth()]} ${b.getDate()}`;
  } else {
    label = `${_PCAL_MONTHS[_pcalAnchor.getMonth()]} ${_pcalAnchor.getFullYear()}`;
  }
  return `<div class="pcal-toolbar">
      <span class="pcal-title">${label}</span>
      <div class="pcal-tb-right">
        <div class="pcal-nav">
          <button class="pcal-nav-btn" data-pcal-nav="prev">‹</button>
          <button class="pcal-nav-btn" data-pcal-nav="today">Today</button>
          <button class="pcal-nav-btn" data-pcal-nav="next">›</button>
        </div>
        ${hideToggle ? '' : `<div class="pcal-viewtoggle">
          <button class="pcal-vt${_pcalView === 'week' ? ' active' : ''}" data-pcal-view="week">Week</button>
          <button class="pcal-vt${_pcalView === 'month' ? ' active' : ''}" data-pcal-view="month">Month</button>
        </div>`}
      </div>
    </div>`;
}

function renderPlanningCalendar(projId) {
  _pcalProj = projId || null;
  _pcalShowAll = false;   // projects-view calendar shows commitment work only
  const body = document.getElementById('plan-tl-body');
  if (!body) return;
  const byDate = _pcalItems(_pcalProj);
  const anyItems = Object.keys(byDate).length > 0;
  const empty = anyItems ? '' :
    `<div class="pcal-empty">${_pcalProj ? 'No milestones or events for this initiative yet.' : 'No initiative milestones or events scheduled yet.'}</div>`;
  // Commitment summary ribbon below the calendar (item 5)
  let ribbon = '';
  const rproj = _pcalProj ? MILESTONE_PROJECTS.find(p => p.id === _pcalProj) : null;
  if (rproj) {
    const rt = _commitmentTasks(rproj.id);
    const rpct = Math.round(_commitmentProgress(rproj.id) * 100);
    const rdates = (rproj.startDate && rproj.endDate) ? `${fmtDate(rproj.startDate)} – ${fmtDate(rproj.endDate)}` : (rproj.bigRock ? 'Ongoing · BAU' : 'No dates');
    const brief = (rproj.missionBrief || rproj.notes || '').trim();
    ribbon = `<div class="plan-cal-ribbon" style="--commit-clr:${rproj.color || '#fff'}">
      <span class="pcr-title">${escHtml(rproj.title)}</span>
      <span class="pcr-meta">${escHtml(rdates)} · ${rt.length} TASK${rt.length === 1 ? '' : 'S'}${rproj.bigRock ? ' · ⛰ BAU' : ''}</span>
      ${brief ? `<span class="pcr-brief">“${escHtml(brief)}”</span>` : '<span style="flex:1"></span>'}
      <span class="pcr-pct">${rt.filter(t => t.done).length}/${rt.length} · ${rpct}%</span>
      <div class="pcr-addtask">
        <input class="pcr-task-title" id="pcr-task-title" placeholder="＋ Add task…" autocomplete="off">
        <input class="pcr-task-due" id="pcr-task-due" type="date" title="Due date (required)">
        <button class="pcr-task-add" id="pcr-task-add">Add</button>
      </div>
    </div>`;
  }
  body.innerHTML = `<div class="pcal">${_pcalToolbar()}${_pcalView === 'week' ? _pcalRenderWeek(byDate) : _pcalRenderMonth(byDate)}${empty}</div>${ribbon}`;

  body.querySelectorAll('[data-pcal-view]').forEach(b =>
    b.onclick = () => { _pcalView = b.dataset.pcalView; renderPlanningCalendar(_pcalProj); });
  body.querySelectorAll('[data-pcal-nav]').forEach(b => b.onclick = () => {
    const dir = b.dataset.pcalNav;
    if (dir === 'today') _pcalAnchor = new Date();
    else {
      const step = dir === 'next' ? 1 : -1;
      _pcalAnchor = _pcalView === 'week'
        ? new Date(_pcalAnchor.getFullYear(), _pcalAnchor.getMonth(), _pcalAnchor.getDate() + 7 * step)
        : new Date(_pcalAnchor.getFullYear(), _pcalAnchor.getMonth() + step, 1);
    }
    renderPlanningCalendar(_pcalProj);
  });
  body.querySelectorAll('[data-pcal-open]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    const kind = el.dataset.pcalOpen, id = el.dataset.id, proj = el.dataset.proj;
    if (kind === 'milestone' && typeof openMsEventModal === 'function') {
      openMsEventModal(proj, id);
    } else if (kind === 'event' && typeof showEventModal === 'function') {
      const ev = (CAL_EVENTS || []).find(x => x.id === id);
      if (ev) showEventModal(ev, e.clientX, e.clientY);
    }
  });
  // Empty-day click adds a milestone to the selected initiative (month view only)
  if (_pcalProj && _pcalView === 'month') {
    body.querySelectorAll('[data-pcal-day]').forEach(cell => cell.onclick = () => {
      if (typeof openMsEventModal === 'function') openMsEventModal(_pcalProj, null, cell.dataset.pcalDay);
    });
  }
  // Ribbon inline add-task (item: dedicated add-task in commitments, no edit modal needed)
  const rTitle = document.getElementById('pcr-task-title');
  const rDue   = document.getElementById('pcr-task-add');
  if (rTitle && _pcalProj) {
    const submit = async () => {
      const ok = await _commitmentAddTask(_pcalProj, rTitle.value, document.getElementById('pcr-task-due')?.value || '');
      if (ok) rTitle.value = '';
      // onSnapshot re-render refreshes the ribbon count automatically
    };
    document.getElementById('pcr-task-add').onclick = submit;
    rTitle.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
  }
}

// Default centre-panel state: calendar across every initiative
function showPlanningCalendarAll() {
  const empty   = document.getElementById('plan-ctx-empty');
  const content = document.getElementById('plan-ctx-content');
  if (empty)   empty.style.display   = 'none';
  if (content) content.style.display = 'flex';
  const titleEl = document.getElementById('plan-ctx-title');
  if (titleEl) titleEl.textContent = 'All Commitments';
  ['plan-tl-add-ms', 'plan-edit-proj', 'plan-ms-close'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.querySelectorAll('.plan-left .ms-dash-card-outer').forEach(c => c.classList.remove('ctx-active'));
  const listsEmpty = document.getElementById('plan-lists-empty');
  const listsBody  = document.getElementById('plan-tl-lists-body');
  if (listsEmpty) listsEmpty.style.display = 'flex';
  if (listsBody)  listsBody.style.display  = 'none';
  renderPlanningCalendar(null);
}

/* ══════════════════════════════════════════════════════════════════════
   PLANNING — design-kit 7-tab controller + views
   Four new commitment/reflection tabs (This Week · Weekly Review · Quarter ·
   North Star) render into #plan-view-design; Week/Month/Buckets route to the
   existing calendar sub-views. Commitments = MILESTONE_PROJECTS, surfaced by
   cadence. Reflective tabs persist to Firestore (weeklyPlans + planningMeta).
   ══════════════════════════════════════════════════════════════════════ */
window._planTab2 = 'thisweek';

function _planShowView(view) { // 'projects' | 'calendar' | 'design'
  const p = document.getElementById('plan-view-projects');
  const c = document.getElementById('plan-view-calendar');
  const d = document.getElementById('plan-view-design');
  if (p) p.style.display = view === 'projects' ? 'flex'  : 'none';
  if (c) c.style.display = view === 'calendar' ? 'flex'  : 'none';
  if (d) d.style.display = view === 'design'   ? 'block' : 'none';
}

// Jump from a progress card to the Commitments tab with that commitment selected
// (its timeline/calendar focused) — instead of popping the edit modal.
window._planOpenCommitment = function(id) {
  if (!id) return;
  _msView = 'timeline';
  _msFocusProj = id;
  showPlanTab2('commitments');
};

window.showPlanTab2 = function(tab) {
  window._planTab2 = tab;
  document.querySelectorAll('#plan-tabs2 .plan-tab2').forEach(b =>
    b.classList.toggle('active', b.dataset.ptab2 === tab));
  if (tab === 'buckets') { _planShowView('calendar'); window._switchPlanCalTab && window._switchPlanCalTab('focus'); return; }
  if (tab === 'commitments') { _planShowView('projects'); renderMilestones(); return; }
  _planShowView('design');
  if      (tab === 'thisweek') renderPlanThisWeek();
  else if (tab === 'month')    renderPlanCalendarTab('month');
  else if (tab === 'week')     renderPlanCalendarTab('week');
  else if (tab === 'quarter')  renderPlanQuarter();
  else if (tab === 'review')   renderPlanReview();
  else if (tab === 'north')    renderPlanNorth();
};

// Re-render the active design tab on data changes — but never while the user is
// editing a field inside it.
window._refreshPlanDesign = function() {
  const v = document.getElementById('plan-view-design');
  if (!v || v.style.display === 'none') return;
  const ae = document.activeElement;
  if (ae && ae.closest && ae.closest('#plan-view-design') && /INPUT|TEXTAREA/.test(ae.tagName)) return;
  const t = window._planTab2;
  if      (t === 'thisweek') renderPlanThisWeek();
  else if (t === 'month')    renderPlanCalendarTab('month');
  else if (t === 'week')     renderPlanCalendarTab('week');
  else if (t === 'quarter')  renderPlanQuarter();
  else if (t === 'review')   renderPlanReview();
  else if (t === 'north')    renderPlanNorth();
};

/* ── Commitment progress (derived from linked tasks, then activities) ──── */
function _commitmentTasks(projId) {
  const map = {};
  TASKS.forEach(t => { if (t.projectId === projId) map[t.id] = t; });
  MILESTONE_EVENTS.filter(e => e.projectId === projId).forEach(e =>
    (e.activities || []).forEach(a => {
      if (a.taskId) { const t = TASKS.find(x => x.id === a.taskId); if (t) map[t.id] = t; }
    }));
  return Object.values(map);
}
function _commitmentProgress(projId) {
  const ts = _commitmentTasks(projId);
  if (ts.length) return ts.filter(t => t.done).length / ts.length;
  const acts = MILESTONE_EVENTS.filter(e => e.projectId === projId).flatMap(e => e.activities || []);
  if (acts.length) return acts.filter(a => a.done).length / acts.length;
  return 0;
}
function _activeCommitments(cadence) {
  // Big rocks are BAU — they live in their own pinned section, not weekly/quarterly (item 6).
  return MILESTONE_PROJECTS
    .filter(p => !p.isArchived && !p.bigRock && commitmentCadence(p) === cadence);
}
function _bauCommitments() {
  return MILESTONE_PROJECTS.filter(p => !p.isArchived && p.bigRock);
}
// BAU (big-rock) pinned section for the This Week / Quarter tabs.
function _bauSectionHtml() {
  const bau = _bauCommitments();
  if (!bau.length) return '';
  return `<div class="plan-glass plan-bau">
    <div class="plan-glass-head"><span class="plan-glass-title">⛰ BAU · Always on</span>
      <span class="plan-tel">${bau.length} BIG ROCK${bau.length === 1 ? '' : 'S'}</span></div>
    <div class="plan-commit-list">${bau.map(c => _commitmentRow(c)).join('')}</div>
  </div>`;
}
function _addCommitment(cadence) {
  openMsProjectModal();
  const s = document.getElementById('ms-proj-cadence'); if (s) s.value = cadence;
}

/* ── Firestore doc helpers for reflective tabs ────────────────────────── */
async function _planLoadDoc(coll, key) {
  const uid = window.CDX_USER?.uid;
  if (!uid || !window.CDX_FB || !window.CDX_DB) return {};
  try {
    const { doc, getDoc, collection } = window.CDX_FB;
    const snap = await getDoc(doc(collection(window.CDX_DB, 'users', uid, coll), key));
    return snap.exists() ? snap.data() : {};
  } catch (e) { return {}; }
}
function _planSaveDoc(coll, key, payload) {
  const uid = window.CDX_USER?.uid;
  if (!uid || !window.CDX_FB || !window.CDX_DB) return;
  const { doc, setDoc, collection, serverTimestamp } = window.CDX_FB;
  setDoc(doc(collection(window.CDX_DB, 'users', uid, coll), key),
    { ...payload, updatedAt: serverTimestamp() }, { merge: true })
    .then(() => {
      // The dashboard's "Today's Non-Negotiable" caches this week's anchor; drop the
      // cache so an edit here shows up immediately (no perceptible lag on return).
      if (coll === 'weeklyPlans') {
        window._dashInvalidateAnchor?.();
        window.renderDashboardBoard?.(); // self-guards to the dashboard panel
      }
    })
    .catch(() => {});
}
let _planDocSaveTimer;
function _planDebSave(coll, key, getPayload) {
  clearTimeout(_planDocSaveTimer);
  _planDocSaveTimer = setTimeout(() => _planSaveDoc(coll, key, getPayload()), 700);
}
let _ptwWeekOffset = 0; // 0 = current week; ± navigates "The week, shaped"
function _planWeekMonday() {
  const now = new Date(); const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + _ptwWeekOffset * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
function _planWeekKey() { return localDateStr(_planWeekMonday()); }
function _planWeekDays() {
  const mon = _planWeekMonday();
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return localDateStr(d); });
}
function _ptwWeekLabel() {
  const days = _planWeekDays();
  const s = new Date(days[0] + 'T00:00'), e = new Date(days[6] + 'T00:00');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rel = _ptwWeekOffset === 0 ? 'THIS WEEK' : _ptwWeekOffset === -1 ? 'LAST WEEK' : _ptwWeekOffset === 1 ? 'NEXT WEEK' : (_ptwWeekOffset < 0 ? `${-_ptwWeekOffset} WEEKS AGO` : `IN ${_ptwWeekOffset} WEEKS`);
  return `${rel} · ${s.getDate()} ${mo[s.getMonth()]} – ${e.getDate()} ${mo[e.getMonth()]}`;
}

/* ── Shared bits ──────────────────────────────────────────────────────── */
function _planHeader(eyebrow, title, italic, rightHtml) {
  return `<div class="plan-dsn-head">
    <div>
      <div class="plan-dsn-eyebrow">${escHtml(eyebrow)}</div>
      <div class="plan-dsn-title">${escHtml(title)}</div>
      ${italic ? `<div class="plan-dsn-italic">${escHtml(italic)}</div>` : ''}
    </div>
    ${rightHtml || ''}
  </div>`;
}
function _commitmentRow(c, opts) {
  const pr  = _commitmentProgress(c.id);
  const pct = Math.round(pr * 100);
  const cat = c.category ? CATEGORIES[c.category] : null;
  const clr = c.color || 'rgba(255,255,255,.55)';
  return `<div class="plan-commit-row${c.bigRock ? ' bigrock' : ''}" data-commit="${escAttr(c.id)}" style="--commit-clr:${clr}">
    <div class="plan-commit-top">
      ${c.bigRock ? `<span class="plan-commit-rock">⛰ BAU</span>` : ''}
      <span class="plan-commit-name">${escHtml(c.title)}</span>
      <div style="flex:1"></div>
      ${cat ? `<span class="plan-pill">${escHtml(cat.label.toUpperCase())}</span>` : ''}
      <span class="plan-commit-pct">${pct}%</span>
    </div>
    <div class="plan-commit-track"><div class="plan-commit-fill" style="width:${pct}%"></div></div>
  </div>`;
}

/* ── THIS WEEK ────────────────────────────────────────────────────────── */
function renderPlanThisWeek() {
  const body = document.getElementById('plan-design-body'); if (!body) return;
  const commits = _activeCommitments('weekly');
  const done = commits.filter(c => _commitmentProgress(c.id) >= 1).length;
  const days = _planWeekDays();
  const wkDoneTasks = TASKS.filter(t => t.done && days.includes(t.doneDate || t.dueDate)).length;

  const DOW = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const todayStr = localDateStr(new Date());
  const shapedCells = days.map((ds, i) => {
    const d = new Date(ds + 'T00:00');
    const isToday = ds === todayStr;
    return `<div class="ptw-shape-cell${isToday ? ' today' : ''}">
      <div class="ptw-shape-h"><span>${DOW[i]}</span><span class="ptw-shape-dd">${d.getDate()}</span></div>
      <input class="ptw-shape-in" data-shape="${i}" placeholder="One anchor…" autocomplete="off">
    </div>`;
  }).join('');

  const ENERGY = ['MON','TUE','WED','THU','FRI'];
  const energyRows = ENERGY.map(dy => `
    <div class="ptw-energy-row">
      <span class="plan-tel">${dy}</span>
      <div class="ptw-energy-track"><div class="ptw-energy-fill" data-efill="${dy}"></div></div>
      <select class="ptw-energy-sel" data-energy="${dy}">
        <option value="">—</option><option value="high">HIGH</option><option value="mid">MID</option><option value="low">LOW</option>
      </select>
    </div>`).join('');

  body.innerHTML = `
    ${_planHeader('THIS WEEK · YOUR WEEKLY COMMITMENTS', 'Commitments you made. Watch them meet reality.',
      'Weekly-cadence commitments live here. BAU big rocks are pinned above.',
      `<button class="plan-liquid-btn" id="ptw-add">＋ Add commitment</button>`)}
    ${_bauSectionHtml()}
    <div class="plan-glass">
      <div class="plan-glass-head">
        <span class="plan-glass-title">This week's commitments</span>
        <span class="plan-tel">${done}/${commits.length} COMPLETE · ${wkDoneTasks} TASKS DONE</span>
      </div>
      <div class="plan-commit-list">
        ${commits.length ? commits.map(c => _commitmentRow(c)).join('')
          : `<div class="plan-empty">No weekly commitments yet. Add one, or set an existing commitment's cadence to Weekly.</div>`}
      </div>
    </div>
    <div class="plan-glass">
      <div class="plan-glass-head">
        <span class="plan-glass-title">The week, shaped</span>
        <div class="ptw-week-nav">
          <button class="ptw-week-arrow" id="ptw-week-prev" title="Previous week">‹</button>
          <span class="ptw-week-label" id="ptw-week-label">${escHtml(_ptwWeekLabel())}</span>
          <button class="ptw-week-arrow" id="ptw-week-next" title="Next week">›</button>
          <button class="ptw-week-today" id="ptw-week-today" title="Back to this week">◈ Today</button>
        </div>
      </div>
      <div class="plan-dsn-sub">Each day gets one anchor. One. Not three.</div>
      <div class="ptw-shape-grid">${shapedCells}</div>
    </div>
    <div class="plan-two">
      <div class="plan-glass">
        <div class="plan-dsn-eyebrow">ENERGY FORECAST</div>
        <div class="plan-glass-title" style="margin:2px 0 10px">Match the work to the day</div>
        ${energyRows}
      </div>
      <div class="plan-glass">
        <div class="plan-dsn-eyebrow" style="color:var(--gold)">NOT DOING THIS WEEK</div>
        <div class="plan-glass-title" style="margin:2px 0 6px">The list that protects the list</div>
        <div class="plan-dsn-sub">One per line.</div>
        <textarea class="plan-dsn-textarea" id="ptw-notdoing" rows="6" placeholder="Read new AI papers (next week)&#10;Refactor the pipeline&#10;Coffee chats"></textarea>
      </div>
    </div>`;

  document.getElementById('ptw-add').onclick = () => _addCommitment('weekly');
  body.querySelectorAll('[data-commit]').forEach(el => el.onclick = () => _planOpenCommitment(el.dataset.commit));
  document.getElementById('ptw-week-prev')?.addEventListener('click', () => { _ptwWeekOffset--; renderPlanThisWeek(); });
  document.getElementById('ptw-week-next')?.addEventListener('click', () => { _ptwWeekOffset++; renderPlanThisWeek(); });
  document.getElementById('ptw-week-today')?.addEventListener('click', () => { _ptwWeekOffset = 0; renderPlanThisWeek(); });

  const key = _planWeekKey();
  const EFILL = { high: 90, mid: 55, low: 30, '': 0 };
  const applyEnergyBar = (dy, v) => {
    const f = body.querySelector(`[data-efill="${dy}"]`);
    if (f) { f.style.width = (EFILL[v] || 0) + '%'; f.classList.toggle('high', v === 'high'); }
  };
  const readThisWeek = () => ({
    notDoing: document.getElementById('ptw-notdoing')?.value || '',
    weekShaped: Array.from(body.querySelectorAll('[data-shape]')).map(i => i.value),
    energy: Object.fromEntries(Array.from(body.querySelectorAll('[data-energy]')).map(s => [s.dataset.energy, s.value])),
  });
  const saveThisWeek = () => _planDebSave('weeklyPlans', key, readThisWeek);

  const nd = document.getElementById('ptw-notdoing');
  nd.oninput = saveThisWeek;
  body.querySelectorAll('[data-shape]').forEach(i => i.oninput = saveThisWeek);
  body.querySelectorAll('[data-energy]').forEach(s => s.onchange = () => { applyEnergyBar(s.dataset.energy, s.value); saveThisWeek(); });

  _planLoadDoc('weeklyPlans', key).then(d => {
    if (nd && document.activeElement !== nd) nd.value = d.notDoing || '';
    (d.weekShaped || []).forEach((v, i) => { const el = body.querySelector(`[data-shape="${i}"]`); if (el && document.activeElement !== el) el.value = v || ''; });
    const en = d.energy || {};
    body.querySelectorAll('[data-energy]').forEach(s => { s.value = en[s.dataset.energy] || ''; applyEnergyBar(s.dataset.energy, s.value); });
  });
}

/* ── QUARTER ──────────────────────────────────────────────────────────── */
function renderPlanQuarter() {
  const body = document.getElementById('plan-design-body'); if (!body) return;
  const commits = _activeCommitments('quarterly');
  const now = new Date();
  const qNum = Math.floor(now.getMonth() / 3) + 1;
  // Quarter progress = tasks done ÷ total tasks across every quarter commitment (item 11)
  let _qTotT = 0, _qDoneT = 0;
  commits.forEach(c => { const ts = _commitmentTasks(c.id); _qTotT += ts.length; _qDoneT += ts.filter(t => t.done).length; });
  const qPct = _qTotT ? Math.round(_qDoneT / _qTotT * 100) : 0;

  const qTodayStr = localDateStr(new Date());
  const cardsHtml = commits.map(c => {
    const pct = Math.round(_commitmentProgress(c.id) * 100);
    const cat = c.category ? CATEGORIES[c.category] : null;
    // Tasks-tab-inspired list of the work under this commitment (item 10)
    const cTasks = _commitmentTasks(c.id)
      .sort((a, b) => (a.done - b.done) || String(a.dueDate || '~').localeCompare(String(b.dueDate || '~')));
    const doneN = cTasks.filter(t => t.done).length;
    const tasksHtml = cTasks.length ? cTasks.map(t => {
      const over = t.dueDate && !t.done && t.dueDate < qTodayStr;
      return `<div class="pq-task-row${t.done ? ' done' : ''}">
        <span class="pq-task-check${t.done ? ' on' : ''}" data-pqcheck="${escAttr(t.id)}"></span>
        <span class="pq-task-dot" style="background:${getCatColor(t.category)}"></span>
        <span class="pq-task-name" data-pqopen="${escAttr(t.id)}">${escHtml(t.title)}</span>
        <span class="pq-task-due${over ? ' over' : ''}">${t.dueDate ? escHtml(fmtDate(t.dueDate)) : '—'}</span>
      </div>`;
    }).join('') : `<div class="plan-ms-empty">No tasks yet — open to add the work.</div>`;
    return `<div class="plan-goal-card" style="--commit-clr:${c.color || 'rgba(255,255,255,.4)'}">
      <div class="plan-goal-top">
        <div style="display:flex;gap:6px;align-items:center">
          ${cat ? `<span class="plan-pill">${escHtml(cat.label.toUpperCase())}</span>` : ''}
        </div>
        <span class="plan-commit-pct">${doneN}/${cTasks.length} · ${pct}%</span>
      </div>
      <div class="plan-goal-title" data-commit="${escAttr(c.id)}">${escHtml(c.title)}</div>
      <div class="plan-commit-track"><div class="plan-commit-fill" style="width:${pct}%"></div></div>
      <div class="pq-task-list">${tasksHtml}</div>
      <button class="plan-ms-add" data-commit-edit="${escAttr(c.id)}">＋ Add / edit tasks</button>
    </div>`;
  }).join('');

  body.innerHTML = `
    ${_planHeader(`Q${qNum} ${now.getFullYear()} · GOALS ACROSS THE QUARTER`, 'Goals long enough to change something.',
      'Quarterly-cadence commitments and their tasks. BAU big rocks are pinned above.',
      `<button class="plan-liquid-btn" id="pq-add">＋ Add commitment</button>`)}
    ${_bauSectionHtml()}
    <div class="plan-glass plan-quarter-bar">
      <div class="plan-glass-head"><span class="plan-glass-title">Quarter progress</span>
        <span class="plan-tel">${commits.length} COMMITMENTS · ${_qDoneT}/${_qTotT} TASKS · ${qPct}%</span></div>
      <div class="plan-commit-track big"><div class="plan-commit-fill neon" style="width:${qPct}%"></div></div>
    </div>
    <div class="plan-goal-grid">
      ${commits.length ? cardsHtml : `<div class="plan-empty">No quarterly commitments yet. Add one, or set an existing commitment's cadence to Quarterly.</div>`}
    </div>`;

  document.getElementById('pq-add').onclick = () => _addCommitment('quarterly');
  body.querySelectorAll('[data-commit]').forEach(el => el.onclick = () => _planOpenCommitment(el.dataset.commit));
  body.querySelectorAll('[data-commit-edit]').forEach(el => el.onclick = e => { e.stopPropagation(); openMsProjectModal(el.dataset.commitEdit); });
  body.querySelectorAll('[data-pqopen]').forEach(el => el.onclick = e => { e.stopPropagation(); showMainPanel('alltasks'); setTimeout(() => window.openAtkDetail?.(el.dataset.pqopen), 40); });
  body.querySelectorAll('[data-pqcheck]').forEach(el => el.onclick = e => {
    e.stopPropagation();
    const t = TASKS.find(x => x.id === el.dataset.pqcheck); if (!t) return;
    if (t.done) toggleTask(t.id); else handleCheckClick(t.id, e);
  });
}

/* ── WEEKLY REVIEW ────────────────────────────────────────────────────── */
function renderPlanReview() {
  const body = document.getElementById('plan-design-body'); if (!body) return;
  const key = _planWeekKey();
  const days = _planWeekDays();
  const wkDone = TASKS.filter(t => t.done && days.includes(t.doneDate || t.dueDate)).length;
  const wkTotal = TASKS.filter(t => days.includes(t.dueDate)).length;
  const commits = _activeCommitments('weekly');
  const commitsDone = commits.filter(c => _commitmentProgress(c.id) >= 1).length;

  const prompts = [
    ['worked', 'What worked?', 'positive'],
    ['didnt',  "What didn't?", 'warning'],
    ['learned','What did I learn?', 'neutral'],
    ['change', 'What will I change?', 'neutral'],
  ];
  body.innerHTML = `
    ${_planHeader('WEEKLY REVIEW · FRIDAY RITUAL', 'The 20-minute look back.', 'Four prompts. Honest answers. Tomorrow starts Monday.')}
    <div class="plan-review-grid">
      <div class="plan-review-col">
        ${prompts.map(([k, q, tone], i) => `
          <div class="plan-glass plan-review-card ${tone}">
            <div class="plan-tel review-num">REVIEW 0${i + 1}</div>
            <div class="plan-glass-title" style="margin-top:2px">${q}</div>
            <textarea class="plan-dsn-textarea" id="prv-${k}" rows="3" placeholder="Honest answer…"></textarea>
          </div>`).join('')}
      </div>
      <div class="plan-review-col">
        <div class="plan-glass">
          <div class="plan-dsn-eyebrow">WEEK TELEMETRY</div>
          <div class="plan-tele-grid">
            <div><div class="plan-dsn-eyebrow">COMMITMENTS</div><div class="plan-tele-val">${commitsDone}/${commits.length}</div></div>
            <div><div class="plan-dsn-eyebrow">TASKS DONE</div><div class="plan-tele-val">${wkDone}/${wkTotal}</div></div>
          </div>
        </div>
        <div class="plan-glass">
          <div class="plan-dsn-eyebrow">GRATITUDE</div>
          <textarea class="plan-dsn-textarea" id="prv-gratitude" rows="4" placeholder="Three small things worth keeping…"></textarea>
        </div>
      </div>
    </div>`;

  _planLoadDoc('weeklyPlans', key).then(d => {
    ['worked','didnt','learned','change','gratitude'].forEach(k => {
      const el = document.getElementById('prv-' + k);
      if (el && document.activeElement !== el) el.value = (d.review && d.review[k]) || '';
    });
  });
  const saveReview = () => _planDebSave('weeklyPlans', key, () => ({
    review: {
      worked: document.getElementById('prv-worked')?.value || '',
      didnt: document.getElementById('prv-didnt')?.value || '',
      learned: document.getElementById('prv-learned')?.value || '',
      change: document.getElementById('prv-change')?.value || '',
      gratitude: document.getElementById('prv-gratitude')?.value || '',
    }
  }));
  ['worked','didnt','learned','change','gratitude'].forEach(k => {
    const el = document.getElementById('prv-' + k); if (el) el.oninput = saveReview;
  });
}

/* ── NORTH STAR ───────────────────────────────────────────────────────── */
function renderPlanNorth() {
  const body = document.getElementById('plan-design-body'); if (!body) return;
  body.innerHTML = `
    ${_planHeader('NORTH STAR · THE THING UNDERNEATH', 'Why you do any of this.', 'The identity beneath the tasks. Revisit quarterly.')}
    <div class="plan-glass plan-north-vision">
      <div class="plan-dsn-eyebrow">VISION · 5 YEARS</div>
      <textarea class="plan-dsn-textarea vision" id="pns-vision" rows="3" placeholder="A quiet craftsman who ships one thing that matters each year…"></textarea>
    </div>
    <div class="plan-north-grid">
      <div class="plan-glass">
        <div class="plan-dsn-eyebrow">ROLES</div>
        <div class="plan-glass-title" style="margin:2px 0 8px">The hats I choose to wear</div>
        <textarea class="plan-dsn-textarea" id="pns-roles" rows="6" placeholder="Partner — present, patient&#10;Craftsman — slow, rigorous&#10;(one per line)"></textarea>
      </div>
      <div class="plan-glass">
        <div class="plan-dsn-eyebrow">VALUES</div>
        <div class="plan-glass-title" style="margin:2px 0 8px">What I protect when it's costly</div>
        <textarea class="plan-dsn-textarea" id="pns-values" rows="6" placeholder="Depth over breadth&#10;Slow compound&#10;Honest signal&#10;(one per line)"></textarea>
      </div>
    </div>
    <div class="plan-glass">
      <div class="plan-dsn-eyebrow">ONE-YEAR EULOGY TEST</div>
      <div class="plan-glass-title" style="margin:2px 0 8px">If the year ended tonight, what would I want said?</div>
      <textarea class="plan-dsn-textarea" id="pns-eulogy" rows="4" placeholder="He showed up. Every morning, the same quiet way…"></textarea>
    </div>`;

  _planLoadDoc('planningMeta', 'northStar').then(d => {
    [['vision','vision'],['roles','roles'],['values','values'],['eulogy','eulogy']].forEach(([id, k]) => {
      const el = document.getElementById('pns-' + id);
      if (el && document.activeElement !== el) el.value = d[k] || '';
    });
  });
  const save = () => _planDebSave('planningMeta', 'northStar', () => ({
    vision: document.getElementById('pns-vision')?.value || '',
    roles: document.getElementById('pns-roles')?.value || '',
    values: document.getElementById('pns-values')?.value || '',
    eulogy: document.getElementById('pns-eulogy')?.value || '',
  }));
  ['vision','roles','values','eulogy'].forEach(id => {
    const el = document.getElementById('pns-' + id); if (el) el.oninput = save;
  });
}

/* ── Week/Month tabs: unified planning calendar (events+tasks+milestones+holidays) ── */
function renderPlanCalendarTab(mode) {
  const body = document.getElementById('plan-design-body'); if (!body) return;
  _pcalView = mode; _pcalShowAll = true; _pcalProj = null;
  const byDate = _pcalItems(null);
  body.innerHTML = `
    ${_planHeader(mode === 'week' ? 'WEEK · FULL CALENDAR' : 'MONTH · FULL CALENDAR',
      mode === 'week' ? 'Your week, in full.' : 'Your month, in full.',
      'Events, tasks, milestones and holidays — all in one place.',
      `<button class="plan-liquid-btn" id="pcal2-addms">＋ Milestone</button>`)}
    <div class="plan-glass" style="padding:14px">
      <div class="pcal pcal-embed">${_pcalToolbar(true)}${mode === 'week' ? _pcalRenderWeek(byDate) : _pcalRenderMonth(byDate)}</div>
    </div>`;
  _wirePlanCal2(body, mode);
}

function _wirePlanCal2(body, mode) {
  body.querySelectorAll('[data-pcal-nav]').forEach(b => b.onclick = () => {
    const dir = b.dataset.pcalNav;
    if (dir === 'today') _pcalAnchor = new Date();
    else {
      const step = dir === 'next' ? 1 : -1;
      _pcalAnchor = mode === 'week'
        ? new Date(_pcalAnchor.getFullYear(), _pcalAnchor.getMonth(), _pcalAnchor.getDate() + 7 * step)
        : new Date(_pcalAnchor.getFullYear(), _pcalAnchor.getMonth() + step, 1);
    }
    renderPlanCalendarTab(mode);
  });
  body.querySelectorAll('[data-pcal-open]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    const kind = el.dataset.pcalOpen, id = el.dataset.id, proj = el.dataset.proj;
    if (kind === 'milestone') { openMsEventModal(proj, id); }
    else if (kind === 'event') { const ev = (CAL_EVENTS || []).find(x => x.id === id); if (ev) showEventModal(ev, e.clientX, e.clientY); }
    // task / holiday chips are display-only here
  });
  body.querySelectorAll('[data-pcal-day]').forEach(el => el.onclick = () => _planMilestonePicker(el.dataset.pcalDay));
  const addBtn = document.getElementById('pcal2-addms');
  if (addBtn) addBtn.onclick = () => _planMilestonePicker(localDateStr(new Date()));
}

// Lightweight commitment picker → open the milestone modal for the chosen commitment/date.
function _planMilestonePicker(dateStr) {
  const commits = MILESTONE_PROJECTS.filter(p => !p.isArchived);
  if (!commits.length) { showToast('Create a commitment first', 'error'); return; }
  if (commits.length === 1) { openMsEventModal(commits[0].id, null, dateStr || ''); return; }
  const back = document.createElement('div');
  back.className = 'pcal-picker-back';
  back.innerHTML = `<div class="pcal-picker" role="dialog">
    <div class="pcal-picker-h">Add milestone${dateStr ? ` · <span>${escHtml(dateStr)}</span>` : ''}</div>
    ${commits.map(c => `<button class="pcal-picker-item" data-pid="${escAttr(c.id)}">
      <span class="pcal-picker-dot" style="background:${c.color || 'rgba(255,255,255,.5)'}"></span>${escHtml(c.title)}</button>`).join('')}
  </div>`;
  document.body.appendChild(back);
  back.addEventListener('click', e => { if (e.target === back) back.remove(); });
  back.querySelectorAll('[data-pid]').forEach(b =>
    b.onclick = () => { back.remove(); openMsEventModal(b.dataset.pid, null, dateStr || ''); });
}
/* ══ FOCUS BUCKETS ══ */
const BUCKET_COLORS = ['#4a7c5e','#c45c2a','#e8a020','#6b9fd4','#9b7fd4','#c49a6c','#8a8070'];
let _focusBuckets = [];
let _focusBucketsInited = false;
let _focusRenameTmr = null;

function focusBucketsSubscribe() {
  if (_focusBucketsInited) return;
  _focusBucketsInited = true;
  const uid = window.CDX_USER?.uid;
  if (!uid) return;
  const { collection, query, orderBy, onSnapshot } = window.CDX_FB;
  onSnapshot(query(_uc('focusBuckets'), orderBy('order')), snap => {
    _focusBuckets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFocusBuckets();
  });
}

async function buildFocusBuckets() {
  focusBucketsSubscribe();
  if (!_focusBuckets.length) {
    const uid = window.CDX_USER?.uid;
    if (uid) {
      const { getDocs, query, orderBy } = window.CDX_FB;
      const snap = await getDocs(query(_uc('focusBuckets'), orderBy('order')));
      _focusBuckets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  }
  renderFocusBuckets();
}

function renderFocusBuckets() {
  const row = document.getElementById('focus-bucket-row');
  if (!row) return;

  if (!_focusBuckets.length) {
    row.innerHTML = `
      <div class="focus-empty-state">
        <span>No focus buckets yet</span>
        <button class="plan-nav-btn" id="focus-empty-add">+ Create your first bucket</button>
      </div>`;
    document.getElementById('focus-empty-add')?.addEventListener('click', addFocusBucket);
    return;
  }

  row.innerHTML = _focusBuckets.map((b, idx) => {
    const items = b.items || [];
    const color = b.color || BUCKET_COLORS[0];
    return `
    <div class="focus-bucket" style="animation-delay:${idx * 60}ms" data-bucket-id="${escAttr(b.id)}">
      <div class="focus-bucket-header">
        <div class="focus-bucket-color" style="background:${escAttr(color)};box-shadow:inset 0 0 8px ${escAttr(color)}55"></div>
        <input class="focus-bucket-title" value="${escAttr(b.title || '')}" placeholder="Untitled" data-rename-bucket="${escAttr(b.id)}" />
        <span class="focus-bucket-count">${items.length}</span>
        <button class="focus-bucket-del" data-del-bucket="${escAttr(b.id)}" title="Delete bucket">✕</button>
      </div>
      <div class="focus-bucket-items">
        ${items.length ? items.map((it, ii) => `
          <div class="focus-item" style="animation-delay:${ii * 30}ms" data-bucket-id="${escAttr(b.id)}" data-item-id="${escAttr(it.id)}">
            <span style="flex:1;min-width:0">${linkifyText(it.text)}</span>
            <span class="focus-item-del" data-fbdel-item="${escAttr(it.id)}" data-fbdel-bucket="${escAttr(b.id)}">✕</span>
          </div>
        `).join('') : '<div class="focus-bucket-items-empty">empty bucket. gravity intact.</div>'}
      </div>
      <div class="focus-add-item">
        <input type="text" placeholder="Add item..." maxlength="300" data-add-item-bucket="${escAttr(b.id)}" />
      </div>
    </div>`;
  }).join('') + `
    <div class="focus-add-bucket-card" id="focus-add-bucket-ghost">+ Bucket</div>`;
}

async function addFocusBucket() {
  const uid = window.CDX_USER?.uid;
  if (!uid) return;
  const { addDoc, serverTimestamp } = window.CDX_FB;
  const color = BUCKET_COLORS[_focusBuckets.length % BUCKET_COLORS.length];
  try {
    const ref = await addDoc(_uc('focusBuckets'), {
      title: '', color, order: _focusBuckets.length, items: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    // Focus the new bucket's title after re-render
    setTimeout(() => {
      const inp = document.querySelector(`[data-rename-bucket="${ref.id}"]`);
      if (inp) { inp.focus(); inp.select(); }
    }, 150);
  } catch (err) {
    console.error('addFocusBucket error:', err);
    showToast('Failed to create bucket', 'error');
  }
}

async function deleteFocusBucket(bucketId) {
  const { deleteDoc } = window.CDX_FB;
  try {
    await deleteDoc(_ud('focusBuckets', bucketId));
  } catch (err) {
    console.error('deleteFocusBucket error:', err);
    showToast('Failed to delete bucket', 'error');
  }
}

function renameFocusBucket(bucketId, title) {
  clearTimeout(_focusRenameTmr);
  _focusRenameTmr = setTimeout(async () => {
    const { updateDoc, serverTimestamp } = window.CDX_FB;
    try {
      await updateDoc(_ud('focusBuckets', bucketId), { title: title.trim(), updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('renameFocusBucket error:', err);
    }
  }, 800);
}

async function addFocusBucketItem(bucketId, text) {
  if (!text?.trim()) return;
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  const newItem = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString() };
  try {
    await runTransaction(window.CDX_DB, async tx => {
      const ref = _ud('focusBuckets', bucketId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Bucket not found');
      const items = [...(snap.data().items || []), newItem];
      tx.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('addFocusBucketItem error:', err);
    showToast('Failed to add item', 'error');
  }
}

async function deleteFocusBucketItem(bucketId, itemId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async tx => {
      const ref = _ud('focusBuckets', bucketId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Bucket not found');
      const items = (snap.data().items || []).filter(i => i.id !== itemId);
      tx.update(ref, { items, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('deleteFocusBucketItem error:', err);
    showToast('Failed to delete item', 'error');
  }
}

function initFocusBuckets() {
  const row = document.getElementById('focus-bucket-row');
  if (!row) return;

  // Delegated event handling on the bucket row
  row.addEventListener('click', async e => {
    // Delete bucket — show inline confirm
    const delBtn = e.target.closest('[data-del-bucket]');
    if (delBtn) {
      const bucketId = delBtn.dataset.delBucket;
      const header = delBtn.closest('.focus-bucket-header');
      if (!header) return;
      // Replace header content with confirm
      const origHTML = header.innerHTML;
      header.innerHTML = `<div class="focus-bucket-confirm">Delete? <button data-confirm-del-bucket="${escAttr(bucketId)}">Yes</button><button data-cancel-del-bucket>No</button></div>`;
      return;
    }

    // Confirm delete bucket
    const confirmDel = e.target.closest('[data-confirm-del-bucket]');
    if (confirmDel) {
      await deleteFocusBucket(confirmDel.dataset.confirmDelBucket);
      return;
    }

    // Cancel delete bucket — re-render restores it
    const cancelDel = e.target.closest('[data-cancel-del-bucket]');
    if (cancelDel) {
      renderFocusBuckets();
      return;
    }

    // Delete item
    const delItem = e.target.closest('[data-fbdel-item]');
    if (delItem) {
      await deleteFocusBucketItem(delItem.dataset.fbdelBucket, delItem.dataset.fbdelItem);
      return;
    }

    // Ghost card click — add bucket
    if (e.target.closest('#focus-add-bucket-ghost')) {
      addFocusBucket();
      return;
    }
  });

  // Add item on Enter
  row.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest('[data-add-item-bucket]');
    if (inp) {
      const bucketId = inp.dataset.addItemBucket;
      if (inp.value.trim()) {
        await addFocusBucketItem(bucketId, inp.value);
        inp.value = '';
      }
    }
  });

  // Rename bucket on blur/input
  row.addEventListener('input', e => {
    const inp = e.target.closest('[data-rename-bucket]');
    if (inp) renameFocusBucket(inp.dataset.renameBucket, inp.value);
  });

  // Header + Bucket add button
  document.getElementById('focus-add-bucket-btn')?.addEventListener('click', addFocusBucket);
}


/* ══ ORB PETAL QUICK-ADD ══ */
function openOrbAddTaskModal(hour) {
  _orbClickHour = hour;
  const label = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
  document.getElementById('orb-add-task-title').textContent = `Add task at ${label}`;
  document.getElementById('orb-task-time').value = `${String(hour).padStart(2, '0')}:00`;
  document.getElementById('orb-task-title-input').value = '';
  openOverlay('orb-add-task-modal');
  setTimeout(() => document.getElementById('orb-task-title-input')?.focus(), 80);
}

async function confirmOrbAddTask() {
  const title    = document.getElementById('orb-task-title-input').value.trim();
  const time     = document.getElementById('orb-task-time').value;
  const duration = parseInt(document.getElementById('orb-task-duration').value) || 60;
  if (!title || !time) return;
  const { addDoc, serverTimestamp } = window.CDX_FB;
  const today = localDateStr(new Date());
  const endTime = addMinutes(time, duration);
  // Create calendar event
  const evRef = await addDoc(_uc('calEvents'), {
    title, date: today, startTime: time, endTime, duration,
    color: getCatColor('personal'), createdAt: serverTimestamp()
  });
  // Create linked task
  await addDoc(_uc('tasks'), {
    title, done: false, priority: 'med',
    dueDate: today, category: 'personal',
    calEventId: evRef.id, subtasks: [],
    createdAt: serverTimestamp()
  });
  closeOverlay('orb-add-task-modal');
}

function initOrbAddTask() {
  document.getElementById('orb-add-task-confirm')?.addEventListener('click', confirmOrbAddTask);
  document.getElementById('orb-task-title-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmOrbAddTask();
  });
}

/* ── Date label ────────────────────────────────────────── */
(function setPageDate() {
  const now = new Date();
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  const pdEl = document.getElementById('page-date');
  if (pdEl) pdEl.textContent = now.toLocaleDateString('en-GB', opts).toUpperCase();
  const calEl = document.getElementById('cal-date-label');
  if (calEl) calEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
})();

/* ── Build day view skeleton ───────────────────────────── */
(function buildDayView() {
  const container = document.getElementById('cal-hours-container');
  if (!container) return;
  for (let h = 5; h <= 23; h++) {
    const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
    const row = document.createElement('div');
    row.className = 'cal-hour-row';
    row.dataset.hour = h;
    row.innerHTML = `<div class="cal-hour-label">${label}</div><div class="cal-hour-slot"></div>`;
    container.appendChild(row);
  }
  // Position now-line (initial)
  updateCalNowLine();
})();

function updateCalNowLine() {
  const line = document.getElementById('cal-now-line');
  // Skip update when element is not visible (panel is hidden)
  if (!line || !line.offsetParent) return;
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const minutesSince5am = (h - 5) * 60 + m;
  const px = Math.max(0, minutesSince5am); // 1 hour = 60px, so 1 min = 1px
  line.style.top = px + 'px';
}
// Update every minute so it stays accurate
_calNowLineInterval = setInterval(updateCalNowLine, 60 * 1000);

/* ── Dashboard Hero Summary Strip ────────────────────── */
function updateDashboardHero() {
  const heroEl = document.getElementById('dashboard-hero');
  if (!heroEl) return;

  const now = new Date();
  const today = localDateStr(now);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  // Time
  const timeEl = document.getElementById('hero-time');
  if (timeEl) timeEl.textContent = `${hh}:${mm}`;

  // Date
  const dateEl = document.getElementById('hero-date');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  // Stats
  const statsEl = document.getElementById('hero-stats');
  if (statsEl) {
    const todayTasks = TASKS.filter(t => !t.someday && !t.done && t.dueDate === today).length;
    const overdue = TASKS.filter(t => !t.someday && !t.done && t.dueDate && t.dueDate < today).length;
    const todayEvents = CAL_EVENTS.filter(e => e.date === today).length;
    const momentum = typeof computeMomentumScore === 'function' ? computeMomentumScore().score : 0;
    const pills = [
      `<span class="hero-pill" style="animation-delay:0ms"><span class="hero-pill-val">${todayTasks}</span> today</span>`,
      overdue > 0 ? `<span class="hero-pill overdue" style="animation-delay:80ms"><span class="hero-pill-val">${overdue}</span> overdue</span>` : '',
      `<span class="hero-pill" style="animation-delay:160ms"><span class="hero-pill-val">${todayEvents}</span> events</span>`,
      `<span class="hero-pill" style="animation-delay:240ms">momentum <span class="hero-pill-val">${momentum}</span></span>`,
    ].filter(Boolean);
    statsEl.innerHTML = pills.join('');
  }

  // Next event
  const nextEvEl = document.getElementById('hero-next-event');
  const nextCdEl = document.getElementById('hero-next-countdown');
  if (nextEvEl) {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const upcoming = CAL_EVENTS
      .filter(e => e.date === today && e.startTime)
      .map(e => { const [h, m] = e.startTime.split(':').map(Number); return { ...e, mins: h * 60 + m }; })
      .filter(e => e.mins > nowMins)
      .sort((a, b) => a.mins - b.mins);
    if (upcoming.length) {
      const next = upcoming[0];
      const diff = next.mins - nowMins;
      const title = next.title || 'Event';
      nextEvEl.textContent = title.length > 28 ? title.slice(0, 27) + '…' : title;
      if (nextCdEl) nextCdEl.textContent = diff < 60 ? `in ${diff}m` : `in ${Math.floor(diff / 60)}h ${diff % 60}m`;
    } else {
      nextEvEl.textContent = 'Nothing planned';
      nextEvEl.style.color = 'var(--muted)';
      if (nextCdEl) nextCdEl.textContent = '';
    }
  }

  // Current hour highlight on calendar rows
  const rows = document.querySelectorAll('.cal-hour-row');
  const currentH = now.getHours();
  rows.forEach(row => {
    const label = row.querySelector('.cal-hour-label');
    if (!label) return;
    const rowHour = parseInt(label.textContent);
    const isPm = label.textContent.toLowerCase().includes('pm');
    const isAm = label.textContent.toLowerCase().includes('am');
    let h24 = rowHour;
    if (isPm && rowHour !== 12) h24 = rowHour + 12;
    if (isAm && rowHour === 12) h24 = 0;
    row.classList.toggle('current-hour', h24 === currentH);
  });
}
setInterval(updateDashboardHero, 30 * 1000); // update every 30s

/* ══ TIMEDRIFT — SVG rotating rings (cosmodex-timedrift v9) ══ */
// → future file: cosmodex-timedrift.js

/* ═══════════════════════════════════════════════════════════════════════════
   TIMEDRIFT DESIGN LANGUAGE V2 — FEATURE FLAG
   Set to false to revert all three V2 enhancements:
     1. Specular top-edge on horizon arc (CSS — remove the `.td-dlv2` block too)
     2. Glass center hub instead of solid black
     3. Neon-green current-hour tick when weekly focus goal is met
   ═══════════════════════════════════════════════════════════════════════════ */
const _TD_DLV2_ENABLED = true;
const _TD_DLV2_FOCUS_THRESHOLD_SECS = 4 * 3600; // 4h/week matches Insights page
let _tdDlv2FocusGoalMet = false;
let _tdDlv2LastFocusCheck = 0;
function _tdDlv2IsFocusGoalMet() {
  if (!_TD_DLV2_ENABLED) return false;
  const now = performance.now();
  // Recompute at most once per 5s to keep per-frame cost near zero
  if (now - _tdDlv2LastFocusCheck < 5000) return _tdDlv2FocusGoalMet;
  _tdDlv2LastFocusCheck = now;
  try {
    if (typeof TASKS === 'undefined' || typeof localDateStr !== 'function') return _tdDlv2FocusGoalMet;
    const weekAgo = localDateStr(new Date(Date.now() - 6 * 86400000));
    let weekSecs = 0;
    TASKS.forEach(t => {
      const taskSecs = taskEffortSecs(t);
      if (taskSecs <= 0) return;
      const dd = t.doneDate || t.dueDate || '';
      if (dd >= weekAgo) weekSecs += taskSecs;
    });
    _tdDlv2FocusGoalMet = weekSecs >= _TD_DLV2_FOCUS_THRESHOLD_SECS;
  } catch {}
  return _tdDlv2FocusGoalMet;
}

const _TD_NS = 'http://www.w3.org/2000/svg';
const _tdMk = t => document.createElementNS(_TD_NS, t);
const _TD_CX = 500, _TD_CY = 500;
const _tdClamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const _tdWa = a => `rgba(255,255,255,${+a.toFixed(3)})`;
const _tdLerp2 = (a,b,t) => a+(b-a)*t;

const TD_RINGS = [
  { id:'dom', r:74,  bw:32, items:Array.from({length:31},(_,i)=>String(i+1)),
    cur:d=>d.getDate()-1,
    sub:d=>0,
    maj:1,th:5.2,tm:5.2,fs:7.2,lr:67,bandFill:'rgba(255,255,255,0)',bandStroke:'rgba(255,255,255,0.22)',dimA:0.52 },
  { id:'mon', r:106, bw:32, items:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    cur:d=>d.getMonth(),
    sub:d=>0,
    maj:1,th:5.2,tm:5.2,fs:7.2,lr:99,bandFill:'rgba(255,255,255,0)',bandStroke:'rgba(255,255,255,0.22)',dimA:0.52 },
  { id:'dow', r:138, bw:32, items:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    cur:d=>d.getDay(),
    sub:d=>0,
    maj:1,th:5.6,tm:5.6,fs:7.5,lr:131,bandFill:'rgba(255,255,255,0)',bandStroke:'rgba(255,255,255,0.18)',dimA:0.50 },
  { id:'hr',  r:170, bw:32, items:Array.from({length:24},(_,i)=>String(i)),
    cur:d=>d.getHours(),
    sub:d=>_tdHrSnapFrac,
    maj:1,th:4.8,tm:2.0,fs:6.8,lr:163,bandFill:'rgba(255,255,255,0)',bandStroke:'rgba(255,255,255,0.18)',dimA:0.44 },
  { id:'min', r:202, bw:32, items:Array.from({length:60},(_,i)=>String((60-i)%60).padStart(2,'0')),
    cur:d=>(60-d.getMinutes())%60,
    sub:d=>-_tdMinSnapFrac,
    maj:1,th:4.4,tm:1.6,fs:6.2,lr:195,bandFill:'rgba(255,255,255,0)',bandStroke:'rgba(255,255,255,0.14)',dimA:0.38 },
  { id:'sec', r:234, bw:32, items:Array.from({length:60},(_,i)=>String(i).padStart(2,'0')),
    cur:d=>d.getSeconds(),
    sub:d=>d.getMilliseconds()/1000,
    maj:1,th:4.4,tm:1.6,fs:6.0,lr:227,bandFill:'rgba(255,255,255,0)',bandStroke:'rgba(255,255,255,0.10)',dimA:0.32 },
];

let _tdSvg=null, _tdElYear=null, _tdElTime=null, _tdElDate=null;
let _tdRingGroups={}, _tdRaf=null, _tdResizeObs=null, _tdInitialized=false;
let _tdAnimT0=null;
let _tdMinSnapT0=-Infinity, _tdLastMin=-1, _tdMinSnapFrac=0;
let _tdHrSnapT0=-Infinity, _tdLastHr=-1, _tdHrSnapFrac=0;
let _tdTlCvs=null, _tdTlCtx=null;

function _tdInitTimeline(){
  _tdTlCvs=document.getElementById('td-tl-cvs');
  if(!_tdTlCvs) return;
  _tdTlCtx=_tdTlCvs.getContext('2d');
}

function _tdDrawTimeline(now){
  if(!_tdTlCvs||!_tdTlCtx) return;
  const cvs=_tdTlCvs, ctx=_tdTlCtx;
  const dpr=window.devicePixelRatio||1;
  const wrap=cvs.parentElement;
  const cssW=Math.max(1, wrap.clientWidth);
  const cssH=Math.max(1, wrap.clientHeight);
  if(cvs.dataset.cw!==String(cssW)||cvs.dataset.ch!==String(cssH)){
    cvs.width=cssW*dpr; cvs.height=cssH*dpr;
    cvs.style.width=cssW+'px'; cvs.style.height=cssH+'px';
    cvs.dataset.cw=String(cssW); cvs.dataset.ch=String(cssH);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cssW,cssH);
  const W=cssW, H=cssH;
  const TWO_PI=Math.PI*2;
  const cx=W/2;

  // ── Horizon arc parameters ───────────────────────────────
  // Shows ±3 hours (6 h total) = ±π/4 radians around the arc peak
  const HALF_SPAN=Math.PI/4;
  const bandH=Math.max(14, H*0.09);
  // Radius sized so arc spans ~94% of canvas width at the ±3 h endpoints
  const R=(W*0.47)/Math.sin(HALF_SPAN);
  const arcTopY=H*0.65;    // y of the arc peak (current time marker)
  const cy_arc=arcTopY+R; // circle centre — below canvas bottom
  const innerR=R-bandH/2, outerR=R+bandH/2, midR=R;
  const aStart=-Math.PI/2-HALF_SPAN, aEnd=-Math.PI/2+HALF_SPAN;

  // ── Time helpers ─────────────────────────────────────────
  const todayStr=localDateStr(now);
  const curFrac=(now.getHours()*3600+now.getMinutes()*60+now.getSeconds())/86400;
  // theta: angular offset of a time fraction from current time (rad)
  const toTheta=frac=>{
    let d=frac-curFrac; if(d>0.5)d-=1; if(d<-0.5)d+=1; return d*TWO_PI;
  };
  // Canvas point on a circle of given radius at angle-offset theta from top
  const tPt=(theta,r)=>[cx+r*Math.sin(theta), cy_arc-r*Math.cos(theta)];

  // ── Pre-compute event angular spans ───────────────────────
  const todayEvts=(CAL_EVENTS||[]).filter(e=>e.date===todayStr&&e.startTime&&!e.allDay);
  const evtSpans=[];
  todayEvts.forEach(ev=>{
    const [sh,sm]=(ev.startTime||'0:0').split(':').map(Number);
    const sFrac=(sh*60+sm)/1440;
    const isPast=sFrac<curFrac;
    let eFrac=sFrac+1/24;
    if(ev.endTime){const [eh,em]=(ev.endTime||'0:0').split(':').map(Number);eFrac=(eh*60+em)/1440;}
    const sT=toTheta(sFrac), eT=toTheta(eFrac);
    const cS=Math.max(sT,-HALF_SPAN), cE=Math.min(eT,HALF_SPAN);
    if(cS>=cE) return;
    evtSpans.push({aS:-Math.PI/2+cS, aE2:-Math.PI/2+cE, cS, cE, isPast, ev});
  });
  evtSpans.sort((a,b)=>a.aS-b.aS);

  // ── White arc drawn in gaps between events ─────────────────
  ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.2;
  ctx.shadowColor='rgba(255,255,255,0.35)'; ctx.shadowBlur=6;
  let arcPos=aStart;
  evtSpans.forEach(({aS,aE2})=>{
    if(arcPos<aS){ctx.beginPath();ctx.arc(cx,cy_arc,midR,arcPos,aS);ctx.stroke();}
    arcPos=Math.max(arcPos,aE2);
  });
  if(arcPos<aEnd){ctx.beginPath();ctx.arc(cx,cy_arc,midR,arcPos,aEnd);ctx.stroke();}
  ctx.shadowBlur=0;

  // ── Hour ticks & labels ──────────────────────────────────
  for(let h=0;h<24;h++){
    const theta=toTheta(h/24);
    if(Math.abs(theta)>HALF_SPAN*1.05) continue;
    // Tick — radial line across most of the band
    const [t0x,t0y]=tPt(theta, innerR+(outerR-innerR)*0.18);
    const [t1x,t1y]=tPt(theta, outerR-(outerR-innerR)*0.08);
    ctx.beginPath(); ctx.moveTo(t0x,t0y); ctx.lineTo(t1x,t1y);
    ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.7; ctx.stroke();
    // Label outside the outer edge
    if(Math.abs(theta)<=HALF_SPAN*0.97){
      const [lx,ly]=tPt(theta, outerR+15);
      const fade=1-Math.abs(theta)/HALF_SPAN*0.65;
      ctx.save();
      ctx.translate(lx,ly);
      ctx.rotate(theta); // tangential rotation follows arc curvature
      ctx.font="300 9px 'DM Mono',monospace";
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=`rgba(255,255,255,${(fade*0.50).toFixed(2)})`;
      ctx.fillText(String(h).padStart(2,'0'),0,0);
      ctx.restore();
    }
    // Half-hour tick — white, shorter than hour tick
    const ht=toTheta((h+0.5)/24);
    if(Math.abs(ht)<=HALF_SPAN){
      const [h0x,h0y]=tPt(ht, innerR+(outerR-innerR)*0.28);
      const [h1x,h1y]=tPt(ht, innerR+(outerR-innerR)*0.72);
      ctx.beginPath(); ctx.moveTo(h0x,h0y); ctx.lineTo(h1x,h1y);
      ctx.strokeStyle='rgba(255,255,255,0.38)'; ctx.lineWidth=0.6; ctx.stroke();
    }
  }

  // ── Calendar event arcs ──────────────────────────────────
  const phase=performance.now()*0.001;
  evtSpans.forEach(({aS,aE2,cS,cE,isPast,ev})=>{
    const evG='rgba(57,255,20,';
    // Thin fill around single arc
    ctx.beginPath();
    ctx.arc(cx,cy_arc,midR+4,aS,aE2);
    ctx.arc(cx,cy_arc,midR-4,aE2,aS,true);
    ctx.closePath();
    ctx.fillStyle=isPast?evG+'0.04)':evG+'0.10)'; ctx.fill();
    // Animated waveform originating from arc line
    const wSpan=cE-cS;
    if(wSpan>0.01){
      const steps=Math.max(20,Math.round(wSpan*midR));
      ctx.beginPath();
      for(let i=0;i<=steps;i++){
        const t=i/steps, wa=-Math.PI/2+cS+t*wSpan;
        const ef=Math.min(t*6,(1-t)*6,1);
        const wr=midR+Math.sin(t*wSpan*midR*0.3+phase*2.8)*(bandH*0.3)*ef;
        i===0?ctx.moveTo(cx+wr*Math.cos(wa),cy_arc+wr*Math.sin(wa))
             :ctx.lineTo(cx+wr*Math.cos(wa),cy_arc+wr*Math.sin(wa));
      }
      ctx.strokeStyle=isPast?evG+'0.22)':evG+'0.52)'; ctx.lineWidth=1.8; ctx.stroke();
    }
    // Start dot
    const [dx,dy]=tPt(cS,midR);
    ctx.beginPath(); ctx.arc(dx,dy,2.5,0,TWO_PI);
    ctx.fillStyle=isPast?evG+'0.55)':evG+'1.0)';
    if(!isPast){ctx.shadowColor=evG+'0.7)';ctx.shadowBlur=6;}
    ctx.fill(); ctx.shadowBlur=0;
    // Pill label above arc
    if(ev.title&&Math.abs(cS)<HALF_SPAN*0.85){
      const midAngle=(cS+cE)/2;
      const [lx0,ly0]=tPt(midAngle, midR+6);
      const [lx1,ly1]=tPt(midAngle, midR+44);
      const glowAlpha=isPast?0.35:0.9;
      // Soft outer glow pass
      ctx.save();
      ctx.beginPath(); ctx.moveTo(lx0,ly0); ctx.lineTo(lx1,ly1);
      ctx.strokeStyle=`rgba(57,255,20,${(glowAlpha*0.30).toFixed(2)})`;
      ctx.lineWidth=6; ctx.shadowColor='rgba(57,255,20,0.6)'; ctx.shadowBlur=14; ctx.stroke();
      // Core bright line
      ctx.beginPath(); ctx.moveTo(lx0,ly0); ctx.lineTo(lx1,ly1);
      ctx.strokeStyle=`rgba(57,255,20,${glowAlpha.toFixed(2)})`;
      ctx.lineWidth=1.2; ctx.shadowColor='rgba(57,255,20,0.9)'; ctx.shadowBlur=8; ctx.stroke();
      ctx.restore();
      // Event title text at end of connector — etched on the bezel, not glued to the line
      const titleTxt = ev.title.length > 18 ? ev.title.slice(0,17)+'…' : ev.title;
      ctx.save();
      // Translate to the connector tip so we can rotate around it
      ctx.translate(lx1, ly1);
      // Rotate to follow the arc tangent (perpendicular to the radial connector),
      // so the label reads as if etched along the instrument bezel
      ctx.rotate(midAngle);
      ctx.font="500 10px 'DM Mono',monospace";
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.04em';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      // Subtle white glow (no green) — keeps text crisp against the waveforms
      ctx.shadowColor='rgba(255,255,255,0.22)'; ctx.shadowBlur=isPast?0:3;
      ctx.fillStyle=`rgba(255,255,255,${isPast?0.35:0.95})`;
      ctx.fillText(titleTxt, 0, -8);
      ctx.shadowBlur=0;
      ctx.restore();
    }
  });

  // ── Current-time arrow below arc ─────────────────────────
  const arrowY=arcTopY+bandH/2+4;
  // Tiny upward arrow (▲)
  ctx.beginPath();
  ctx.moveTo(cx, arrowY);        // tip
  ctx.lineTo(cx-4, arrowY+7);    // bottom-left
  ctx.lineTo(cx+4, arrowY+7);    // bottom-right
  ctx.closePath();
  ctx.fillStyle='rgba(255,255,255,0.85)';
  ctx.shadowColor='rgba(255,255,255,0.5)'; ctx.shadowBlur=6;
  ctx.fill(); ctx.shadowBlur=0;

  // ── Time display below arrow ──────────────────────────────
  const tY=arcTopY+bandH/2+16;
  const hh=String(now.getHours()).padStart(2,'0');
  const mm=String(now.getMinutes()).padStart(2,'0');
  ctx.font="300 20px 'DM Mono',monospace";
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillStyle='rgba(255,255,255,0.92)';
  ctx.shadowColor='rgba(255,255,255,0.4)'; ctx.shadowBlur=8;
  ctx.fillText(hh+':'+mm,cx,tY);
  ctx.shadowBlur=0;

  // ── Upcoming events (next 30 mins) ───────────────────────
  const nowMins=now.getHours()*60+now.getMinutes();
  const allTodayEvts=(CAL_EVENTS||[])
    .filter(ev=>ev.date===todayStr&&ev.startTime&&!ev.allDay)
    .map(ev=>{
      const[sh,sm]=ev.startTime.split(':').map(Number);
      const sMins=sh*60+sm;
      let eMins=sMins+60;
      if(ev.endTime){const[eh,em]=ev.endTime.split(':').map(Number);eMins=eh*60+em;}
      return{...ev,sMins,eMins};
    });
  const ongoing=allTodayEvts.find(ev=>ev.sMins<=nowMins&&nowMins<ev.eMins);
  const soon=allTodayEvts.filter(ev=>ev.sMins>nowMins&&ev.sMins-nowMins<=30).sort((a,b)=>a.sMins-b.sMins);
  ctx.textBaseline='top'; ctx.textAlign='center';
  let ey=tY+32;
  const maxY=H-8; // clamp to canvas height
  if(ongoing && ey<maxY){
    const label=ongoing.title?(ongoing.title.length>20?ongoing.title.slice(0,19)+'…':ongoing.title):'event';
    ctx.font="300 10px 'DM Mono',monospace";
    ctx.fillStyle='rgba(57,255,20,0.60)';
    ctx.fillText('ongoing · '+label,cx,ey); ey+=15;
    if(ey<maxY){
      ctx.font="300 9px 'DM Mono',monospace";
      ctx.fillStyle='rgba(57,255,20,0.38)';
      ctx.fillText('continues '+(ongoing.eMins-nowMins)+'m more',cx,ey); ey+=20;
    }
  }
  if(soon.length>0 && ey<maxY){
    soon.slice(0,2).forEach(ev=>{
      if(ey>=maxY) return;
      const delta=ev.sMins-nowMins;
      const label=ev.title?(ev.title.length>22?ev.title.slice(0,21)+'…':ev.title):'event';
      ctx.font="400 11px 'DM Mono',monospace";
      ctx.fillStyle='rgba(255,255,255,0.88)';
      ctx.fillText(label,cx,ey); ey+=15;
      if(ey<maxY){
        ctx.font="300 9px 'DM Mono',monospace";
        ctx.fillStyle='rgba(57,255,20,0.65)';
        ctx.fillText('in '+delta+'m',cx,ey); ey+=20;
      }
    });
  } else if(!ongoing && ey<maxY){
    ctx.font="300 10px 'DM Mono',monospace";
    ctx.fillStyle='rgba(255,255,255,0.22)';
    ctx.fillText('nothing in next 30m',cx,ey);
  }

  // Drift indicator — shown while the rings are scrubbed away from now
  if (Math.abs(_tdScrubOffset) > 500) {
    ctx.font="300 10px 'DM Mono',monospace";
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.textAlign='center'; ctx.textBaseline='top';
    const dir=_tdScrubOffset>0?'ahead':'behind';
    ctx.fillText(`⟲ adrift · ${_tdFmtOffset(Math.abs(_tdScrubOffset))} ${dir} · release returns to now`,cx,6);
  }
}

function _tdInit(){
  if(_tdInitialized) return;
  _tdInitialized=true;
  _tdInitTimeline();
  _tdSvg=document.getElementById('td-svg');
  if(!_tdSvg) return;
  while(_tdSvg.firstChild) _tdSvg.removeChild(_tdSvg.firstChild);

  const defs=_tdMk('defs'); _tdSvg.appendChild(defs);

  // Strong white glow filter
  (()=>{
    const f=_tdMk('filter'); f.id='td-wglow';
    f.setAttribute('x','-200%'); f.setAttribute('y','-200%');
    f.setAttribute('width','500%'); f.setAttribute('height','500%');
    const b1=_tdMk('feGaussianBlur'); b1.setAttribute('in','SourceGraphic'); b1.setAttribute('stdDeviation','2.5'); b1.setAttribute('result','r1');
    const b2=_tdMk('feGaussianBlur'); b2.setAttribute('in','SourceGraphic'); b2.setAttribute('stdDeviation','7'); b2.setAttribute('result','r2');
    const m=_tdMk('feMerge');
    ['r2','r1','SourceGraphic'].forEach(s=>{const n=_tdMk('feMergeNode');n.setAttribute('in',s);m.appendChild(n);});
    f.appendChild(b1); f.appendChild(b2); f.appendChild(m); defs.appendChild(f);
  })();

  // Soft glow filter
  (()=>{
    const f=_tdMk('filter'); f.id='td-sglow';
    f.setAttribute('x','-80%'); f.setAttribute('y','-80%');
    f.setAttribute('width','260%'); f.setAttribute('height','260%');
    const b=_tdMk('feGaussianBlur'); b.setAttribute('in','SourceGraphic'); b.setAttribute('stdDeviation','2'); b.setAttribute('result','r');
    const m=_tdMk('feMerge');
    ['r','SourceGraphic'].forEach(s=>{const n=_tdMk('feMergeNode');n.setAttribute('in',s);m.appendChild(n);});
    f.appendChild(b); f.appendChild(m); defs.appendChild(f);
  })();

  // Radial gradient for ring band fills (high transparency, center-out glow)
  (()=>{
    const rg=_tdMk('radialGradient');
    rg.setAttribute('id','td-band-grad');
    rg.setAttribute('cx',String(_TD_CX));
    rg.setAttribute('cy',String(_TD_CY));
    rg.setAttribute('r','234');
    rg.setAttribute('fx',String(_TD_CX));
    rg.setAttribute('fy',String(_TD_CY));
    rg.setAttribute('gradientUnits','userSpaceOnUse');
    const stops=[
      [0.00,'rgba(255,255,255,0.04)'],
      [1.00,'rgba(255,255,255,0)'],
    ];
    stops.forEach(([off,col])=>{
      const s=_tdMk('stop');
      s.setAttribute('offset',String(off));
      s.setAttribute('stop-color',col);
      rg.appendChild(s);
    });
    defs.appendChild(rg);
  })();


  const gBg=_tdMk('g'); _tdSvg.appendChild(gBg);
  const gRings=_tdMk('g'); _tdSvg.appendChild(gRings);
  const gOver=_tdMk('g'); _tdSvg.appendChild(gOver);


  // Year text in center hub
  _tdElYear=_tdMk('text');
  _tdElYear.setAttribute('x',_TD_CX); _tdElYear.setAttribute('y',String(_TD_CY+42));
  _tdElYear.setAttribute('text-anchor','middle'); _tdElYear.setAttribute('dominant-baseline','middle');
  _tdElYear.setAttribute('font-family',"'DM Mono',monospace");
  _tdElYear.setAttribute('font-size','9'); _tdElYear.setAttribute('font-weight','300');
  _tdElYear.setAttribute('fill','rgba(255,255,255,0.50)'); _tdElYear.setAttribute('letter-spacing','1.5');
  _tdElYear.textContent=String(new Date().getFullYear());
  gOver.appendChild(_tdElYear);

  // Static ring bands + strokes
  TD_RINGS.forEach(ring=>{
    const ro=ring.r, ri=ring.r-ring.bw;
    const p=_tdMk('path');
    p.setAttribute('d',`M${_TD_CX},${_TD_CY-ro} A${ro},${ro} 0 1,1 ${_TD_CX-0.01},${_TD_CY-ro}Z M${_TD_CX},${_TD_CY-ri} A${ri},${ri} 0 1,0 ${_TD_CX-0.01},${_TD_CY-ri}Z`);
    p.setAttribute('fill','url(#td-band-grad)'); p.setAttribute('fill-rule','evenodd'); gBg.appendChild(p);
    const c=_tdMk('circle');
    c.setAttribute('cx',_TD_CX); c.setAttribute('cy',_TD_CY); c.setAttribute('r',String(ro));
    c.setAttribute('fill','none'); c.setAttribute('stroke',ring.bandStroke); c.setAttribute('stroke-width','0.4'); c.setAttribute('stroke-dasharray','3,4'); gBg.appendChild(c);
    const ci=_tdMk('circle');
    ci.setAttribute('cx',_TD_CX); ci.setAttribute('cy',_TD_CY); ci.setAttribute('r',String(ri));
    ci.setAttribute('fill','none'); ci.setAttribute('stroke',ring.bandStroke); ci.setAttribute('stroke-width','0.3'); ci.setAttribute('stroke-dasharray','2,5'); gBg.appendChild(ci);

    // Specular rim — light catching the band edge nearest the viewer
    // (the visible portion of each ring is its bottom arc, +90° ± 30°)
    const a0=(60)*Math.PI/180, a1=(120)*Math.PI/180;
    const sx=_TD_CX+ro*Math.cos(a0), sy=_TD_CY+ro*Math.sin(a0);
    const ex=_TD_CX+ro*Math.cos(a1), ey=_TD_CY+ro*Math.sin(a1);
    const rim=_tdMk('path');
    rim.setAttribute('d',`M${sx.toFixed(1)},${sy.toFixed(1)} A${ro},${ro} 0 0,1 ${ex.toFixed(1)},${ey.toFixed(1)}`);
    rim.setAttribute('fill','none');
    rim.setAttribute('stroke','rgba(255,255,255,0.20)'); // --glass-highlight
    rim.setAttribute('stroke-width','0.8');
    rim.setAttribute('stroke-linecap','round');
    rim.setAttribute('filter','url(#td-sglow)');
    gBg.appendChild(rim);
  });


  // Center hub — explicit black fill so year text sits on pure black
  const hubCirc=_tdMk('circle'); hubCirc.setAttribute('cx',_TD_CX); hubCirc.setAttribute('cy',_TD_CY);
  hubCirc.setAttribute('r','42');
  /* Design Language V2: glass hub — semi-transparent fill lets rings ghost through,
     with a crisper stroke + subtle inner shadow-like double-ring for the frosted
     bezel effect. Revert by setting _TD_DLV2_ENABLED = false. */
  if (_TD_DLV2_ENABLED) {
    hubCirc.setAttribute('fill','rgba(0,0,0,0.45)');
    hubCirc.setAttribute('stroke','rgba(255,255,255,0.28)');
    hubCirc.setAttribute('stroke-width','0.7');
    gBg.appendChild(hubCirc);
    // Inner frosted ring — gives the hub a subtle glass bezel
    const hubInner=_tdMk('circle');
    hubInner.setAttribute('cx',_TD_CX); hubInner.setAttribute('cy',_TD_CY);
    hubInner.setAttribute('r','40');
    hubInner.setAttribute('fill','none');
    hubInner.setAttribute('stroke','rgba(255,255,255,0.08)');
    hubInner.setAttribute('stroke-width','0.4');
    gBg.appendChild(hubInner);
  } else {
    hubCirc.setAttribute('fill','#000000');
    hubCirc.setAttribute('stroke','rgba(255,255,255,0.15)');
    hubCirc.setAttribute('stroke-width','0.5');
    gBg.appendChild(hubCirc);
  }

  // Build rotating ring groups — store text el refs for per-frame counter-rotation
  _tdRingGroups={};
  TD_RINGS.forEach(ring=>{
    const g=_tdMk('g'); g.setAttribute('id','td-rg-'+ring.id); gRings.appendChild(g);
    const n=ring.items.length, step=360/n;
    const textEls=[];
    ring.items.forEach((label,i)=>{
      const isMaj=(i%ring.maj===0), tH=isMaj?ring.th:ring.tm;
      const aDeg=i*step-90, aRad=aDeg*Math.PI/180;
      const cosA=Math.cos(aRad), sinA=Math.sin(aRad);
      const ig=_tdMk('g'); ig.setAttribute('class','td-ri'); ig.dataset.i=i; ig.dataset.maj=isMaj?'1':'0';
      const ox=_TD_CX+ring.r*cosA, oy=_TD_CY+ring.r*sinA;
      const ox2=_TD_CX+(ring.r+tH)*cosA, oy2=_TD_CY+(ring.r+tH)*sinA;
      const tk=_tdMk('line');
      tk.setAttribute('x1',ox); tk.setAttribute('y1',oy); tk.setAttribute('x2',ox2); tk.setAttribute('y2',oy2);
      tk.setAttribute('stroke',_tdWa(ring.dimA)); tk.setAttribute('stroke-width',isMaj?'0.9':'0.4');
      tk.setAttribute('class','td-tk'); ig.appendChild(tk);
      const showLabel=true;
      if(showLabel){
        const lx=_TD_CX+ring.lr*cosA, ly=_TD_CY+ring.lr*sinA;
        const txt=_tdMk('text');
        txt.setAttribute('x',lx); txt.setAttribute('y',ly);
        txt.setAttribute('text-anchor','middle'); txt.setAttribute('dominant-baseline','middle');
        txt.setAttribute('font-family',"'DM Mono',monospace");
        txt.setAttribute('font-size',String(ring.fs)); txt.setAttribute('font-weight','300');
        txt.setAttribute('fill',_tdWa(ring.dimA)); txt.setAttribute('class','td-rl');
        txt.textContent=label; txt.dataset.lx=lx; txt.dataset.ly=ly;
        ig.appendChild(txt); textEls.push(txt);
      }
      g.appendChild(ig);
    });
    _tdRingGroups[ring.id]={g,ring,textEls};
  });
}

/* Glass depth: backdrop-filter can't apply inside SVG, and blur over pure
   black is invisible — so a faint nebula (something to blur) sits behind an
   HTML glass annulus, and the SVG rings get specular rims on top. */
function _tdEnsureGlassLayers(){
  const top=document.getElementById('td-top');
  const stage=document.getElementById('td-stage');
  if(!top||!stage) return null;
  if(!document.getElementById('td-nebula')){
    const neb=document.createElement('div');
    neb.id='td-nebula';
    top.insertBefore(neb,stage);
  }
  let disc=document.getElementById('td-glass-disc');
  if(!disc){
    disc=document.createElement('div');
    disc.id='td-glass-disc';
    stage.insertBefore(disc,_tdSvg||stage.firstChild);
  }
  return disc;
}

function _tdLayout(){
  const container=document.getElementById('td-top');
  if(!container||!_tdSvg) return;
  const vw=container.clientWidth||window.innerWidth;
  const scale=vw/1000*1.28;
  const CROP=530, VBH=845-CROP;
  const pw=Math.round(1000*scale), ph=Math.round(VBH*scale);
  _tdSvg.setAttribute('viewBox',`0 ${CROP} 1000 ${VBH}`);
  _tdSvg.style.width=pw+'px'; _tdSvg.style.height=ph+'px';
  const stage=document.getElementById('td-stage');
  if(stage){ stage.style.width=pw+'px'; stage.style.height=ph+'px'; }
  // Glass disc tracks the outer ring (r=234 in viewBox units, centre 500,500)
  const disc=_tdEnsureGlassLayers();
  if(disc){
    const r=234*pw/1000;
    const cy=((500-CROP)/VBH)*ph; // centre sits above the visible crop
    disc.style.width=disc.style.height=(r*2)+'px';
    disc.style.left=(pw/2-r)+'px';
    disc.style.top=(cy-r)+'px';
  }
}

function _tdUpdateRing(info,now,animEase){
  const {g,ring,textEls}=info;
  const n=ring.items.length;
  const cur=ring.cur(now), frac=ring.sub(now), exact=cur+frac;
  const rot=180-(exact/n)*360;
  let animRot = rot;
  if (animEase < 1) {
    const ringIdx = TD_RINGS.indexOf(ring);
    const dir = (ringIdx % 2 === 0) ? 1 : -1;
    const sweep = 360 * (1 - animEase) * dir;
    animRot = rot + sweep;
  }
  g.setAttribute('transform',`rotate(${animRot},${_TD_CX},${_TD_CY})`);
  // Counter-rotate text so labels stay upright
  textEls.forEach(txt=>{
    const lx=+txt.dataset.lx, ly=+txt.dataset.ly;
    txt.setAttribute('transform',`rotate(${-rot},${lx},${ly})`);
  });
  const vis=n*0.28;
  /* Design Language V2: when the user has met their weekly focus goal (4h),
     the active tick on the hour ring glows neon green instead of white —
     ties Timedrift into the cross-app threshold reward system.
     Revert by setting _TD_DLV2_ENABLED = false. */
  const dlv2Green = _TD_DLV2_ENABLED && ring.id === 'hr' && _tdDlv2IsFocusGoalMet();
  const activeStroke = dlv2Green ? 'rgba(57,255,20,1)' : 'rgba(255,255,255,1)';
  const activeFill   = dlv2Green ? 'rgba(57,255,20,1)' : 'rgba(255,255,255,1)';
  g.querySelectorAll('.td-ri').forEach(item=>{
    const i=+item.dataset.i, maj=item.dataset.maj==='1';
    let dist=i-exact;
    while(dist>n/2) dist-=n; while(dist<-n/2) dist+=n;
    const abs=Math.abs(dist);
    const norm=abs/vis, opac=_tdClamp(Math.pow(Math.max(0,1-norm),1.5),0,1);
    const tk=item.querySelector('.td-tk'), rl=item.querySelector('.td-rl');
    if(abs<0.45){
      if(tk){tk.setAttribute('stroke',activeStroke);tk.setAttribute('stroke-width','1.0');tk.setAttribute('filter','url(#td-wglow)');}
      if(rl){rl.setAttribute('fill',activeFill);rl.setAttribute('font-weight','500');rl.setAttribute('font-size',String(ring.fs*1.22));rl.setAttribute('filter','url(#td-wglow)');}
      item.style.opacity='1';
    } else {
      if(tk){tk.setAttribute('stroke','rgba(255,255,255,0.48)');tk.setAttribute('stroke-width',maj?'0.5':'0.22');tk.removeAttribute('filter');}
      if(rl){rl.setAttribute('fill','rgba(255,255,255,0.48)');rl.setAttribute('font-weight','300');rl.setAttribute('font-size',String(ring.fs));rl.removeAttribute('filter');}
      item.style.opacity=opac<0.02?'0':String(opac);
    }
  });
}

function _tdUpdateCenter(now){
  if(_tdElYear) _tdElYear.textContent=String(now.getFullYear());
}

/* ── Time scrub — drag any ring to drift through time ─────
   The whole panel renders from `now`, so offsetting `now` time-travels
   everything: rings, horizon arc, that day's events. Release springs back. */
let _tdScrubOffset=0, _tdScrubDrag=null, _tdScrubReleaseT0=0, _tdScrubReleaseFrom=0;

function _tdFmtOffset(ms){
  const m=Math.round(ms/60000);
  if(m<60) return m+'m';
  const h=Math.round(m/60); if(h<48) return h+'h';
  return Math.round(h/24)+'d';
}

function _tdScrubNow(){
  if(!_tdScrubDrag && _tdScrubReleaseT0){
    const age=performance.now()-_tdScrubReleaseT0, D=800;
    if(age>=D){ _tdScrubReleaseT0=0; _tdScrubOffset=0; }
    else { _tdScrubOffset=_tdScrubReleaseFrom*(1-(1-Math.pow(1-age/D,3))); }
  }
  return new Date(Date.now()+_tdScrubOffset);
}

function _tdInitScrub(){
  if(!_tdSvg||_tdSvg.dataset.scrub==='1') return;
  _tdSvg.dataset.scrub='1';
  // ms per ring item; min ring counts down so its drag direction flips
  const UNIT={dom:86400e3,mon:2629800e3,dow:86400e3,hr:3600e3,min:60e3,sec:1000};
  const SIGN={dom:1,mon:1,dow:1,hr:1,min:-1,sec:1};
  const BANDS=[['dom',42,74],['mon',74,106],['dow',106,138],['hr',138,170],['min',170,202],['sec',202,234]];
  const center=()=>{
    const r=_tdSvg.getBoundingClientRect();
    // viewBox "0 530 1000 315" — ring centre (500,500) sits above the visible crop
    return { x:r.left+r.width*0.5, y:r.top+((500-530)/315)*r.height, scale:r.width/1000 };
  };
  _tdSvg.addEventListener('pointerdown',e=>{
    const c=center();
    const d=Math.hypot(e.clientX-c.x,e.clientY-c.y)/c.scale;
    const band=BANDS.find(([,ri,ro])=>d>=ri&&d<=ro+8);
    if(!band) return;
    e.preventDefault();
    _tdScrubReleaseT0=0;
    _tdScrubDrag={ id:band[0], lastA:Math.atan2(e.clientY-c.y,e.clientX-c.x), c };
    try{_tdSvg.setPointerCapture(e.pointerId);}catch{}
    _tdSvg.classList.add('td-scrubbing');
  });
  _tdSvg.addEventListener('pointermove',e=>{
    if(!_tdScrubDrag) return;
    const {c,id}=_tdScrubDrag;
    const a=Math.atan2(e.clientY-c.y,e.clientX-c.x);
    let dA=a-_tdScrubDrag.lastA;
    if(dA>Math.PI)dA-=2*Math.PI; if(dA<-Math.PI)dA+=2*Math.PI;
    _tdScrubDrag.lastA=a;
    const ring=TD_RINGS.find(r=>r.id===id);
    const dExact=-(dA*180/Math.PI)*ring.items.length/360;
    _tdScrubOffset+=SIGN[id]*dExact*UNIT[id];
    // Clamp the drift to ±1 year — it's a scrub, not a wormhole
    _tdScrubOffset=_tdClamp(_tdScrubOffset,-31557600e3,31557600e3);
  });
  const endScrub=()=>{
    if(!_tdScrubDrag) return;
    _tdScrubDrag=null;
    _tdSvg.classList.remove('td-scrubbing');
    _tdScrubReleaseFrom=_tdScrubOffset;
    _tdScrubReleaseT0=performance.now();
  };
  _tdSvg.addEventListener('pointerup',endScrub);
  _tdSvg.addEventListener('pointercancel',endScrub);
}

function _tdFrame(){
  const now=_tdScrubNow();
  if(!_tdAnimT0) _tdAnimT0=performance.now();
  const t0=performance.now();
  const progress=Math.min(1,(t0-_tdAnimT0)/900);
  const animEase=1-Math.pow(1-progress,3);
  // Minute snap animation: ring jumps to new minute with ease-out over 400ms
  const curMin=now.getMinutes();
  if(_tdLastMin!==-1 && curMin!==_tdLastMin) _tdMinSnapT0=t0;
  _tdLastMin=curMin;
  const minAge=t0-_tdMinSnapT0;
  _tdMinSnapFrac=(minAge<400) ? -(1-Math.pow(1-minAge/400,3)) : 0;
  // Hour snap animation: ring jumps to new hour with ease-out over 500ms
  const curHr=now.getHours();
  if(_tdLastHr!==-1 && curHr!==_tdLastHr) _tdHrSnapT0=t0;
  _tdLastHr=curHr;
  const hrAge=t0-_tdHrSnapT0;
  _tdHrSnapFrac=(hrAge<500) ? -(1-Math.pow(1-hrAge/500,3)) : 0;
  Object.values(_tdRingGroups).forEach(info=>_tdUpdateRing(info,now,animEase));
  _tdUpdateCenter(now);
  _tdDrawTimeline(now);
  _tdRaf=requestAnimationFrame(_tdFrame);
}

function startTimedrift(){
  // Design Language V2: toggle scope class on the panel
  const panel = document.getElementById('panel-timedrift');
  if (panel) panel.classList.toggle('td-dlv2', _TD_DLV2_ENABLED);
  _tdInit();
  _tdInitScrub();
  _tdLayout();
  if(!_tdResizeObs){
    _tdResizeObs=new ResizeObserver(()=>{
      _tdLayout();
      if(_tdTlCvs){_tdTlCvs.dataset.cw='';_tdTlCvs.dataset.ch='';}
    });
    const top=document.getElementById('td-top');
    if(top) _tdResizeObs.observe(top);
  }
  if(!_tdRaf){ _tdAnimT0=null; _tdFrame(); }
}

function stopTimedrift(){
  if(_tdRaf){ cancelAnimationFrame(_tdRaf); _tdRaf=null; }
  if(_tdResizeObs){ _tdResizeObs.disconnect(); _tdResizeObs=null; }
  _tdInitialized=false;
}


/* ══ HELPERS ══ */
// → future file: cosmodex-utils.js
// Exports: escHtml, escAttr, localDateStr, fmtDate, fmtTimeSched, fmtHour,
//          minutesToDuration, addMinutes, cdxConfirm, showToast, updateNavCounts
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) { return String(s ?? '').replace(/"/g,'&quot;'); }
function linkifyText(s) {
  const esc = escHtml(s);
  return esc.replace(/https?:\/\/[^\s<>&"]+/g, url => `<a href="${url}" target="_blank" rel="noopener" class="list-link">${url}</a>`);
}
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── Custom confirm dialog ───────────────────────────── */
function cdxConfirm(msg, { okLabel = 'Delete', okColor = '#ffffff', okBg = 'rgba(255,255,255,0.18)', okBorder = 'rgba(255,255,255,0.4)' } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('cdx-confirm-overlay');
    const msgEl   = document.getElementById('cdx-confirm-msg');
    const okBtn   = document.getElementById('cdx-confirm-ok');
    const cancelBtn = document.getElementById('cdx-confirm-cancel');
    if (!overlay) { resolve(window.confirm(msg)); return; }
    msgEl.textContent = msg;
    okBtn.textContent = okLabel;
    okBtn.style.color = okColor;
    okBtn.style.background = okBg;
    okBtn.style.borderColor = okBorder;
    overlay.style.display = 'flex';
    const cleanup = (val) => {
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      resolve(val);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlay = (e) => { if (e.target === overlay) cleanup(false); };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
  });
}

/* ── Toast notifications ─────────────────────────────── */
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('cdx-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `cdx-toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── Undo toast — reversible actions get a 6s escape hatch ── */
function showUndoToast(msg, onUndo, duration = 6000) {
  const container = document.getElementById('cdx-toast-container');
  if (!container) { return; }
  const toast = document.createElement('div');
  toast.className = 'cdx-toast info';
  const msgEl = document.createElement('span');
  msgEl.className = 'cdx-toast-msg';
  msgEl.textContent = msg;
  const btn = document.createElement('button');
  btn.className = 'cdx-toast-undo';
  btn.type = 'button';
  btn.textContent = 'undo';
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };
  btn.addEventListener('click', async () => {
    dismiss();
    try { await onUndo(); } catch (e) {
      console.error('undo failed:', e);
      showToast('undo failed — the cosmos resisted.', 'error');
    }
  });
  toast.appendChild(msgEl);
  toast.appendChild(btn);
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(dismiss, duration);
}

// Surface otherwise-silent async failures (e.g. Firestore writes that lack a try/catch)
// instead of letting a change quietly fail with no feedback to the user.
window.addEventListener('unhandledrejection', ev => {
  console.error('Unhandled async error:', ev.reason);
  try { showToast('that didn\'t save — the cosmos is flaky. try again.', 'error', 5000); } catch (_) {}
});
// Refresh the orb immediately when the tab becomes visible again (paired with the hidden-guard above).
document.addEventListener('visibilitychange', () => { if (!document.hidden) drawCosmodex(); });

// Double-submit guard: absorb an accidental double-click on single-shot confirm/save
// buttons so a record isn't created twice. Deliberately scoped to confirm/save only —
// "add"/"create" controls (subtasks, list items, focus buckets) are meant to be clicked
// rapidly, so guarding them made the app feel like it dropped clicks. 450ms cooldown.
const _cdxClickGuard = new WeakMap();
document.addEventListener('click', e => {
  const btn = e.target.closest('button, [data-confirm]');
  if (!btn) return;
  const cls = typeof btn.className === 'string' ? btn.className : '';
  if (!/(?:^|[-_ ])(confirm|save)(?:[-_ ]|$)/i.test((btn.id || '') + ' ' + cls)) return;
  const now = Date.now();
  if (now - (_cdxClickGuard.get(btn) || 0) < 450) { e.stopImmediatePropagation(); e.preventDefault(); return; }
  _cdxClickGuard.set(btn, now);
}, true);

function fmtDate(s) {
  if (!s) return '';
  const [,m,d] = s.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${+d}`;
}
function fmtTimeSched(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2,'0')}${h < 12 ? 'am' : 'pm'}`;
}
function fmtHour(h) {
  if (h === 0) return '12am'; if (h < 12) return `${h}am`;
  if (h === 12) return '12pm'; return `${h-12}pm`;
}
function minutesToDuration(m) {
  const h = Math.floor(m/60), r = m%60;
  return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}
function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h*60 + m + mins;
  return `${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
function updateNavCounts() {
  const today = localDateStr(new Date());
  const todayEl = document.getElementById('nav-count-today');
  if (todayEl) todayEl.textContent = TASKS.filter(t => !t.done && t.dueDate === today).length || '—';
}

/* ══ FIREBASE HELPERS ══ */
// → future file: cosmodex-firebase.js
// Exports: waitForFirebase, getUserUid, getHabitsUid, _uc, _ud
function waitForFirebase(fn) {
  if (window.CDX_DB && window.CDX_FB) { fn(); return; }
  setTimeout(() => waitForFirebase(fn), 120);
}

/* ══ USER-SCOPED FIRESTORE HELPERS ══ */
function _uc(name) { // user-scoped collection ref
  const uid = window.CDX_USER?.uid;
  if (!uid) throw new Error('Not authenticated');
  return window.CDX_FB.collection(window.CDX_DB, 'users', uid, name);
}
function _ud(name, id) { // user-scoped doc ref
  const uid = window.CDX_USER?.uid;
  if (!uid) throw new Error('Not authenticated');
  return window.CDX_FB.doc(window.CDX_DB, 'users', uid, name, id);
}

/* ══ DATA INIT ══ */
function initData() {
  const { onSnapshot, query, orderBy } = window.CDX_FB;

  // Restart intervals in case they were cleared by a previous signout
  if (!_calNowLineInterval) _calNowLineInterval = setInterval(updateCalNowLine, 60 * 1000);
  if (!_cosmodexInterval)   _cosmodexInterval   = setInterval(drawCosmodex, 1000);

  // Clean up any existing listeners before creating new ones
  if (_tasksUnsub)     { _tasksUnsub();     _tasksUnsub     = null; }
  if (_calEventsUnsub) { _calEventsUnsub(); _calEventsUnsub = null; }
  if (_holidaysUnsub)  { _holidaysUnsub();  _holidaysUnsub  = null; }
  if (_listsUnsub)     { _listsUnsub();     _listsUnsub     = null; }
  if (_msProjUnsub)    { _msProjUnsub();    _msProjUnsub    = null; }
  if (_msEventsUnsub)  { _msEventsUnsub();  _msEventsUnsub  = null; }
  if (_msListsUnsub)   { _msListsUnsub();   _msListsUnsub   = null; }
  if (_drillUnsub)     { _drillUnsub();     _drillUnsub     = null; }

  _tasksUnsub = onSnapshot(query(_uc('tasks'), orderBy('createdAt', 'asc')), snap => {
    TASKS = snap.docs.map(d => ({ id: d.id, subtasks: [], ...d.data() }));
    renderTasks(); renderCalendar(); updateNavCounts(); updateDashboardHero();
    drawCosmodex(); // immediate orb sync on task change
    if (_mainPanel === "insights") (window.renderInsightsX || renderInsights)();
    window._refreshPlanTaskViews?.();
  });

  _calEventsUnsub = onSnapshot(query(_uc('calEvents'), orderBy('date', 'asc')), snap => {
    CAL_EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTasks(); renderCalendar(); updateDashboardHero();
    drawCosmodex(); // immediate orb sync on calendar change
    if (_mainPanel === "insights") (window.renderInsightsX || renderInsights)();
    if (_mainPanel === 'calendarx') window._calxAutoRefresh?.();
  });

  _holidaysUnsub = onSnapshot(_uc('holidays'), snap => {
    HOLIDAYS = {};
    snap.docs.forEach(d => { HOLIDAYS[d.id] = { docId: d.id, ...d.data() }; });
    renderCalendar(); renderSettingsHolidays();
  });

  _listsUnsub = onSnapshot(query(_uc('lists'), orderBy('createdAt', 'asc')), snap => {
    LISTS = snap.docs.map(d => ({ id: d.id, items: [], ...d.data() }));
    // Reset stale list selection if the viewed list was deleted
    if (_listView && !LISTS.find(l => l.id === _listView)) _listView = null;
    if (_mainPanel === 'lists') {
      renderLists();
      if (_listView) renderListDetail(_listView);
    }
  });

  _msProjUnsub = onSnapshot(query(_uc('milestoneProjects'), orderBy('startDate', 'asc')), snap => {
    MILESTONE_PROJECTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMilestones();
    renderTasks(); // re-render task panel so initiative grouping updates
    renderCalendar(); // commitment colours drive the global milestone layer
    if (_mainPanel === 'archived') renderArchivedPage();
  });

  _msEventsUnsub = onSnapshot(query(_uc('milestoneEvents'), orderBy('date', 'asc')), snap => {
    MILESTONE_EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data(), activities: d.data().activities || [] }));
    renderMilestones();
    renderTasks(); // re-render task panel so initiative grouping updates
    renderCalendar(); // milestones are a global calendar layer
  });

  _msListsUnsub = onSnapshot(_uc('milestone_lists'), snap => {
    MILESTONE_LISTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (_mainPanel === 'milestones' && _msView === 'timeline' && _msFocusProj) renderMilestoneListsPanel(_msFocusProj);
  });

  _drillUnsub = onSnapshot(query(_uc('drillResponses'), orderBy('date', 'asc')), snap => {
    DRILL_RESPONSES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (_mainPanel === 'drill') renderDrill();
  });

  seedHolidays();

  // One-time backfill: stamp projectId on tasks linked via milestone activities
  setTimeout(() => {
    if (!MILESTONE_EVENTS.length || !TASKS.length) return;
    MILESTONE_EVENTS.forEach(ev => {
      if (!ev.projectId) return;
      (ev.activities || []).forEach(act => {
        if (!act.taskId) return;
        const task = TASKS.find(t => t.id === act.taskId);
        if (task && !task.projectId) {
          updateTask(act.taskId, { projectId: ev.projectId });
        }
      });
    });
  }, 3000); // delay to ensure all data is loaded
}

/* ══ HOLIDAYS ══ */
async function seedHolidays() {
  const { getDoc, writeBatch } = window.CDX_FB;
  const db = window.CDX_DB;
  const sentinel = _ud('holidays', '_seeded_hk');
  const snap = await getDoc(sentinel);
  if (snap.exists()) return;
  const batch = writeBatch(db);
  HK_HOLIDAYS.forEach(h => batch.set(_ud('holidays', h.date), { name: h.name, type: h.type, date: h.date }));
  batch.set(sentinel, { seeded: true });
  await batch.commit();
}

async function addHoliday(date, name, type) {
  const { setDoc } = window.CDX_FB;
  if (!date || !name) return;
  await setDoc(_ud('holidays', date), { name, type: type || 'personal', date });
}

async function deleteHoliday(docId) {
  const { deleteDoc } = window.CDX_FB;
  await deleteDoc(_ud('holidays', docId));
}

/* ══ RENDER TASKS ══ */
// → future file: cosmodex-tasks.js
function _buildTaskToProjectMap() {
  const map = {}; // taskId → { projectId, projectTitle, projectColor }
  if (typeof MILESTONE_PROJECTS === 'undefined') return map;

  // 1. Direct: task has projectId field (set when created via addMilestoneActivity)
  if (typeof TASKS !== 'undefined') {
    TASKS.forEach(task => {
      if (!task.projectId) return;
      const proj = MILESTONE_PROJECTS.find(p => p.id === task.projectId);
      if (!proj || proj.isArchived) return;
      map[task.id] = { projectId: proj.id, projectTitle: proj.title, projectColor: proj.color || '#8a8070' };
    });
  }

  // 2. Fallback: scan milestone event activities for taskId links
  if (typeof MILESTONE_EVENTS !== 'undefined') {
    MILESTONE_EVENTS.forEach(ev => {
      const proj = MILESTONE_PROJECTS.find(p => p.id === ev.projectId);
      if (!proj || proj.isArchived) return;
      (ev.activities || []).forEach(act => {
        if (act.taskId && !map[act.taskId]) {
          map[act.taskId] = { projectId: proj.id, projectTitle: proj.title, projectColor: proj.color || '#8a8070' };
        }
      });
    });
  }

  return map;
}

function _renderTaskGroup(container, tasks, taskProjMap, rowIdxRef) {
  // Separate tasks into initiative-linked and standalone
  const byProject = {};
  const standalone = [];
  tasks.forEach(task => {
    const proj = taskProjMap[task.id];
    if (proj) {
      if (!byProject[proj.projectId]) byProject[proj.projectId] = { ...proj, tasks: [] };
      byProject[proj.projectId].tasks.push(task);
    } else {
      standalone.push(task);
    }
  });

  // Render standalone tasks as collapsible "Independent" group (only if there are also initiative tasks)
  const hasInitiatives = Object.keys(byProject).length > 0;
  if (standalone.length && hasInitiatives) {
    const storageKey = 'cdx_init_collapsed_independent';
    const isCollapsed = localStorage.getItem(storageKey) !== 'false';
    const indLabel = document.createElement('div');
    indLabel.className = 'tasks-initiative-label';
    indLabel.innerHTML = `<span style="margin-right:4px;transition:transform 0.2s;display:inline-block;font-size:10px;${isCollapsed ? '' : 'transform:rotate(90deg)'}">\u203A</span><span class="tasks-initiative-dot" style="background:var(--muted)"></span>Independent<span class="tasks-initiative-count">${standalone.length}</span>`;
    const indContainer = document.createElement('div');
    indContainer.style.display = isCollapsed ? 'none' : '';
    indLabel.addEventListener('click', () => {
      const collapsed = indContainer.style.display === 'none';
      indContainer.style.display = collapsed ? '' : 'none';
      const arrow = indLabel.querySelector('span');
      if (arrow) arrow.style.transform = collapsed ? 'rotate(90deg)' : '';
      localStorage.setItem(storageKey, !collapsed);
    });
    container.appendChild(indLabel);
    standalone.forEach(task => indContainer.appendChild(buildTaskRow(task, rowIdxRef.idx++)));
    container.appendChild(indContainer);
  } else {
    standalone.forEach(task => container.appendChild(buildTaskRow(task, rowIdxRef.idx++)));
  }

  // Render initiative sub-groups (collapsed by default)
  Object.values(byProject).forEach(projGroup => {
    const storageKey = 'cdx_init_collapsed_' + projGroup.projectId;
    const isCollapsed = localStorage.getItem(storageKey) !== 'false'; // collapsed by default

    const initLabel = document.createElement('div');
    initLabel.className = 'tasks-initiative-label';
    initLabel.innerHTML = `<span style="margin-right:4px;transition:transform 0.2s;display:inline-block;font-size:10px;${isCollapsed ? '' : 'transform:rotate(90deg)'}">\u203A</span><span class="tasks-initiative-dot" style="background:${escAttr(projGroup.projectColor)}"></span>${escHtml(projGroup.projectTitle)}<span class="tasks-initiative-count">${projGroup.tasks.length}</span>`;

    const initContainer = document.createElement('div');
    initContainer.style.display = isCollapsed ? 'none' : '';

    initLabel.addEventListener('click', () => {
      const collapsed = initContainer.style.display === 'none';
      initContainer.style.display = collapsed ? '' : 'none';
      const arrow = initLabel.querySelector('span');
      if (arrow) arrow.style.transform = collapsed ? 'rotate(90deg)' : '';
      localStorage.setItem(storageKey, !collapsed);
    });

    container.appendChild(initLabel);
    projGroup.tasks.forEach(task => initContainer.appendChild(buildTaskRow(task, rowIdxRef.idx++)));
    container.appendChild(initContainer);
  });
}

function renderTasks() {
  const body = document.getElementById('tasks-body');
  if (!body) return;
  body.innerHTML = '';

  const visible  = _settings.visibleCategories;
  const filtered = TASKS.filter(t => !t.category || visible.includes(t.category));
  const today    = localDateStr(new Date());
  // Exclude someday tasks from normal groups
  const active   = filtered.filter(t => !t.someday);
  const groups   = [
    { label: 'Overdue',  tasks: active.filter(t => !t.done && t.dueDate && t.dueDate < today) },
    { label: 'Today',    tasks: active.filter(t => !t.done && t.dueDate === today) },
    { label: 'Upcoming', tasks: active.filter(t => !t.done && t.dueDate && t.dueDate > today) },
    { label: 'No date',  tasks: active.filter(t => !t.done && !t.dueDate) },
    { label: 'Done',     tasks: active.filter(t =>  t.done && t.doneDate === today) },
  ];

  const taskProjMap = _buildTaskToProjectMap();
  const rowIdxRef = { idx: 0 };
  const collapsibleGroups = ['No date', 'Upcoming', 'Done'];
  groups.forEach(group => {
    if (!group.tasks.length) return;
    const isCollapsible = collapsibleGroups.includes(group.label);
    const storageKey = 'cdx_group_collapsed_' + group.label.replace(' ', '_');
    // Done group is collapsed by default; others only if explicitly saved
    const isCollapsed = isCollapsible && (
      group.label === 'Done'
        ? localStorage.getItem(storageKey) !== 'false'
        : localStorage.getItem(storageKey) === 'true'
    );

    const labelEl = document.createElement('div');
    labelEl.className = 'tasks-group-label' + (group.label === 'Overdue' ? ' overdue' : '');
    labelEl.style.cursor = isCollapsible ? 'pointer' : 'default';
    const countBadge = `<span class="tasks-group-count">${group.tasks.length}</span>`;
    labelEl.innerHTML = isCollapsible
      ? `<span style="margin-right:4px;transition:transform 0.2s;display:inline-block;${isCollapsed ? '' : 'transform:rotate(90deg)'}">›</span>${group.label} ${countBadge}`
      : `${group.label} ${countBadge}`;

    const taskContainer = document.createElement('div');
    taskContainer.style.display = isCollapsed ? 'none' : '';

    if (isCollapsible) {
      labelEl.addEventListener('click', () => {
        const collapsed = taskContainer.style.display === 'none';
        taskContainer.style.display = collapsed ? '' : 'none';
        const arrow = labelEl.querySelector('span');
        if (arrow) arrow.style.transform = collapsed ? 'rotate(90deg)' : '';
        localStorage.setItem(storageKey, !collapsed);
      });
    }

    body.appendChild(labelEl);
    _renderTaskGroup(taskContainer, group.tasks, taskProjMap, rowIdxRef);
    body.appendChild(taskContainer);
  });

  // Someday Graveyard
  renderSomedaySection(body, filtered.filter(t => t.someday), rowIdxRef.idx);

  // All clear — say so, in voice
  if (!body.children.length) {
    body.innerHTML = '<div class="tasks-void-empty">inbox zero. the void approves. ✦<br><span>press n to disturb the peace</span></div>';
  }

  // Keep the standalone Tasks page + its drawer live on data changes.
  const atkPanel = document.getElementById('panel-alltasks');
  if (atkPanel && atkPanel.style.display !== 'none' && document.getElementById('alltasks-body')) {
    renderAllTasksList();
    // Don't rebuild the drawer while the user is editing inside it.
    const ae = document.activeElement;
    const editingDrawer = ae && ae.closest && ae.closest('#atk-detail') && /INPUT|TEXTAREA/.test(ae.tagName);
    if (!editingDrawer) renderAtkDetail();
  }
  // Commitment progress on the planning design tabs tracks task completion.
  window._refreshPlanDesign && window._refreshPlanDesign();
  // Minimalist dashboard reflects today's tasks/cards.
  if (_mainPanel === 'default') window.renderDashboardBoard && window.renderDashboardBoard();
}

/* ── Task Decay helper ───────────────────────────────── */
function getTaskDecay(task) {
  if (!task.createdAt) return null;
  const created = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
  const ageMs = Date.now() - created.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const pct = Math.min(100, Math.round((ageDays / 14) * 100)); // 0–100% over 14 days
  const state = ageDays < 3 ? 'fresh' : ageDays < 7 ? 'aging' : 'stale';
  const label = ageDays < 1 ? 'new' : ageDays < 3 ? `${Math.floor(ageDays)}d` : ageDays < 7 ? `${Math.floor(ageDays)}d` : ageDays < 14 ? `${Math.floor(ageDays)}d` : '14d+';
  return { pct, state, label, ageDays };
}

function buildTaskRow(task, idx) {
  const wrap = document.createElement('div');
  wrap.className = 'task-row-wrap';
  wrap.dataset.taskId = task.id;

  const hasSubs  = task.subtasks && task.subtasks.length > 0;
  const cat      = task.category ? CATEGORIES[task.category] : null;
  const catClr   = getCatColor(task.category);
  const catBadge = cat
    ? `<span class="task-cat-badge" data-setcat="${escAttr(task.id)}" title="Click to change category" style="cursor:pointer;background:${catClr}22;color:${catClr};border:1px solid ${catClr}44">${cat.label}</span>`
    : `<span class="task-cat-badge" data-setcat="${escAttr(task.id)}" title="Click to set category" style="cursor:pointer;opacity:0.35;border:1px dashed var(--border)">+ cat</span>`;

  let schedBadge = '';
  if (task.calEventId) {
    const ev = CAL_EVENTS.find(e => e.id === task.calEventId);
    const ts = ev?.startTime ? fmtTimeSched(ev.startTime) : '';
    const te = ev?.endTime ? fmtTimeSched(ev.endTime) : '';
    const timeStr = ts && te ? `${ts}–${te}` : ts || 'Scheduled';
    schedBadge = `<span class="task-cal-badge">⊙ ${timeStr}</span>`;
  }

  const PRIORITY_LABELS = { high: 'High', med: 'Med', low: 'Low' };
  const priorityLabel = task.priority ? PRIORITY_LABELS[task.priority] || '' : '';
  const priorityBadge = priorityLabel ? `<span style="font-family:var(--font-mono);font-size:10px;color:${task.priority==='high'?'var(--gold)':task.priority==='med'?'rgba(255,255,255,0.55)':'var(--muted)'}">${priorityLabel}</span>` : '';

  let recurBadge = '';
  if (task.recurrence) {
    const rl = task.recurrence === 'daily' ? '↻ Daily'
      : task.recurrence === 'weekdays' ? '↻ Weekdays'
      : task.recurrence === 'weekly' ? '↻ Weekly'
      : task.recurrence === 'monthly' ? '↻ Monthly'
      : task.recurrence === 'yearly' ? '↻ Yearly'
      : task.recurrence.startsWith('custom:') ? `↻ ${task.recurrence.replace('custom:','')}`
      : `↻ ${task.recurrence}`;
    recurBadge = `<span class="task-recur-badge">${rl}</span>`;
  }

  // Decay bar
  const decay = !task.done ? getTaskDecay(task) : null;
  const decayBarHtml = decay
    ? `<div class="task-decay-bar"><div class="task-decay-fill ${decay.state}" style="width:${decay.pct}%"></div></div>
       <span class="task-decay-label ${decay.state}">${decay.label}</span>`
    : '';

  // Energy badge
  const energyInfo = task.energyType ? ENERGY_TYPES[task.energyType] : null;
  const energyBadge = energyInfo
    ? `<span class="task-energy-badge ${energyInfo.cssClass}">${energyInfo.icon} ${energyInfo.label}</span>`
    : '';

  // Time-spent badge
  const timeBadge = (task.done && task.timeSpentMinutes)
    ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--neon);background:rgba(74,124,94,0.1);border:1px solid rgba(74,124,94,0.3);border-radius:100px;padding:1px 6px">⏱ ${task.timeSpentMinutes < 60 ? task.timeSpentMinutes + 'm' : Math.floor(task.timeSpentMinutes/60) + 'h' + (task.timeSpentMinutes%60 ? ' ' + task.timeSpentMinutes%60 + 'm' : '')}</span>`
    : '';

  // Friction indicator — a task placed on the calendar 3+ times and still open.
  const frictionBadge = ((task.scheduleCount || 0) >= 3 && !task.done)
    ? `<span class="task-friction-badge" data-friction="${escAttr(task.id)}" title="Scheduled ${task.scheduleCount} times — click to tag">⚠ Friction</span>`
    : '';

  // People badges
  const peopleBadgesHtml = (task.people && task.people.length)
    ? task.people.map(id => {
        const p = PEOPLE.find(p => p.id === id);
        if (!p) return '';
        return `<span class="task-person-badge" style="background:${p.color}18;border-color:${p.color}44;color:${p.color}" title="${escAttr(p.name)}">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;background:${p.color};font-size:6px;font-weight:600;color:#0d0c0a;margin-right:3px">${escHtml(p.initials)}</span>@${escHtml(p.name)}</span>`;
      }).join('')
    : '';

  // Re-entry snapshot display
  const snapshotHtml = task.reentrySnapshot
    ? `<div class="task-snapshot-display">↩ ${escHtml(task.reentrySnapshot)}</div>`
    : '';

  const row = document.createElement('div');
  row.className = 'task-row';
  row.draggable = true;
  row.dataset.taskId = task.id;
  row.style.animationDelay = `${idx * 35}ms`;
  const today = localDateStr(new Date());
  const isOverdue = task.dueDate && task.dueDate < today && !task.done;
  const inlineDue = task.dueDate
    ? `<span class="task-inline-due ${isOverdue ? 'overdue' : ''}">${fmtDate(task.dueDate)}</span>`
    : '';
  const inlineCatDot = cat
    ? `<span class="task-inline-cat-dot" style="background:${catClr}" title="${cat.label}"></span>`
    : '';
  const inlineDecay = decay
    ? `<span class="task-inline-decay ${decay.state}">${decay.label}</span>`
    : '';
  const priorityClass = task.priority ? ` priority-${task.priority}` : '';

  row.innerHTML = `
    <button class="task-expand-btn ${hasSubs ? 'open' : 'ghost'}" data-expand="${escAttr(task.id)}">›</button>
    <div class="task-check ${task.done ? 'done' : ''}" data-check="${escAttr(task.id)}">${task.done ? '✓' : ''}</div>
    <div class="task-content">
      <div class="task-title-line">
        ${inlineCatDot}
        <span class="task-title ${task.done ? 'done' : ''}${priorityClass}" data-edit="${escAttr(task.id)}">${escHtml(task.title)}</span>
        ${inlineDue}
        ${inlineDecay}
      </div>
      <div class="task-meta">
        <div class="task-priority-dot ${task.priority || 'low'}"></div>
        ${priorityBadge}
        ${catBadge}
        ${schedBadge}
        ${recurBadge}
        ${energyBadge}
        ${frictionBadge}
        ${timeBadge}
        ${peopleBadgesHtml}
        ${snapshotHtml}
      </div>
    </div>
    <div class="task-actions-group">
      ${!task.done ? `<button class="task-action-btn commit" data-commit="${escAttr(task.id)}" title="Enter commit mode">▶</button>` : ''}
      <button class="task-action-btn" data-task-edit="${escAttr(task.id)}" title="Edit task">✎</button>
      <button class="task-action-btn" data-add-sub="${escAttr(task.id)}" title="Add subtask">⊕</button>
      <button class="task-action-btn danger" data-del="${escAttr(task.id)}" title="Delete task">✕</button>
    </div>`;
  wrap.appendChild(row);

  const subWrap = document.createElement('div');
  subWrap.className = hasSubs ? 'subtasks-wrap expanded' : 'subtasks-wrap';
  subWrap.dataset.taskId = task.id;
  if (hasSubs) task.subtasks.forEach(sub => subWrap.appendChild(buildSubtaskRow(task.id, sub)));

  const addSubRow = document.createElement('div');
  addSubRow.className = 'subtask-add-row hidden';
  addSubRow.dataset.taskId = task.id;
  addSubRow.innerHTML = `
    <input class="subtask-add-input" placeholder="Subtask…" data-parent="${escAttr(task.id)}" autocomplete="off" />
    <button class="subtask-add-confirm" data-parent="${escAttr(task.id)}">↵</button>`;
  subWrap.appendChild(addSubRow);
  wrap.appendChild(subWrap);

  row.addEventListener('dragstart', e => {
    _dragTaskId = task.id; _dragSubId = null;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', task.id);
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging'); _dragTaskId = null; _dragSubId = null;
  });
  return wrap;
}

function buildSubtaskRow(parentId, sub) {
  const row = document.createElement('div');
  row.className = 'subtask-row';
  row.dataset.subId = sub.id;
  row.draggable = true;

  let schedBadge = '';
  if (sub.calEventId) {
    const ev = CAL_EVENTS.find(e => e.id === sub.calEventId);
    if (ev?.startTime) schedBadge = `<span class="task-cal-badge" style="font-size:10px">⊙ ${fmtTimeSched(ev.startTime)}</span>`;
  }

  row.innerHTML = `
    <div class="task-check ${sub.done ? 'done' : ''}" data-subcheck="${escAttr(parentId)}" data-sub="${escAttr(sub.id)}">${sub.done ? '✓' : ''}</div>
    <span class="subtask-title ${sub.done ? 'done' : ''}">${escHtml(sub.title)}</span>
    ${schedBadge}
    <button class="task-action-btn danger" style="opacity:0;margin-left:auto" data-delsub="${escAttr(parentId)}" data-sub="${escAttr(sub.id)}">✕</button>`;
  row.addEventListener('mouseenter', () => row.querySelector('.task-action-btn').style.opacity = '1');
  row.addEventListener('mouseleave', () => row.querySelector('.task-action-btn').style.opacity = '0');
  row.addEventListener('dragstart', e => {
    _dragTaskId = parentId; _dragSubId = sub.id;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', `${parentId}:${sub.id}`);
    e.stopPropagation();
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging'); _dragTaskId = null; _dragSubId = null;
  });
  return row;
}

/* ── Category cycle ───────────────────────────────────── */
async function cycleTaskCategory(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const catCycle = Object.keys(CATEGORIES).concat([null]);
  const idx  = catCycle.indexOf(task.category || null);
  const next = catCycle[(idx + 1) % catCycle.length];
  await updateTask(taskId, { category: next });
}

/* ── Event delegation for task lists (dashboard #tasks-body + Tasks page) ──
   Extracted into named handlers + wireTaskListEvents() so any container that
   holds buildTaskRow() rows gets identical behaviour. */
function _tlClick(e) {
  const check    = e.target.closest('[data-check]');
  const subCheck = e.target.closest('[data-subcheck]');
  const del      = e.target.closest('[data-del]');
  const delSub   = e.target.closest('[data-delsub]');
  const addSub   = e.target.closest('[data-add-sub]');
  const expand   = e.target.closest('[data-expand]');
  const editEl   = e.target.closest('[data-edit]');
  const setCat   = e.target.closest('[data-setcat]');
  const confirmSub = e.target.closest('.subtask-add-confirm');
  const commitBtn  = e.target.closest('[data-commit]');
  const frictionEl = e.target.closest('[data-friction]');
  const taskEditBtn = e.target.closest('[data-task-edit]');

  if (check)    { handleCheckClick(check.dataset.check, e); return; }
  if (subCheck) { toggleSubtask(subCheck.dataset.subcheck, subCheck.dataset.sub); return; }
  if (del)      { deleteTask(del.dataset.del); return; }
  if (delSub)   { deleteSubtask(delSub.dataset.delsub, delSub.dataset.sub); return; }
  if (setCat)   { cycleTaskCategory(setCat.dataset.setcat); return; }
  if (commitBtn) { openCommitRitual(commitBtn.dataset.commit); return; }
  if (frictionEl) { openFrictionModal(frictionEl.dataset.friction); return; }
  if (taskEditBtn) { openTaskEditModal(taskEditBtn.dataset.taskEdit); return; }

  if (addSub) {
    const taskId  = addSub.dataset.addSub;
    const subWrap = document.querySelector(`.subtasks-wrap[data-task-id="${taskId}"]`);
    const addRow  = subWrap?.querySelector('.subtask-add-row');
    if (addRow) {
      addRow.classList.toggle('hidden');
      if (!addRow.classList.contains('hidden')) {
        subWrap.classList.add('expanded');
        addRow.querySelector('.subtask-add-input')?.focus();
        // show expand btn
        const wrap = document.querySelector(`.task-row-wrap[data-task-id="${taskId}"]`);
        wrap?.querySelector('.task-expand-btn')?.classList.remove('ghost');
      }
    }
    return;
  }

  if (expand) {
    const taskId  = expand.dataset.expand;
    const subWrap = document.querySelector(`.subtasks-wrap[data-task-id="${taskId}"]`);
    if (subWrap) {
      subWrap.classList.toggle('expanded');
      expand.classList.toggle('open');
    }
    return;
  }

  if (confirmSub) {
    const parentId = confirmSub.dataset.parent;
    const input = document.querySelector(`.subtask-add-input[data-parent="${parentId}"]`);
    const title = input?.value.trim();
    if (title) { addSubtask(parentId, title); input.value = ''; }
    return;
  }

  if (editEl && !e.target.closest('button')) {
    startInlineEdit(editEl);
    return;
  }
}

/* Keyboard events on task lists */
function _tlKeydown(e) {
  if (e.key === 'Enter') {
    if (e.target.classList.contains('subtask-add-input')) {
      const parentId = e.target.dataset.parent;
      const title = e.target.value.trim();
      if (title) { addSubtask(parentId, title); e.target.value = ''; }
      return;
    }
    if (e.target.classList.contains('task-inline-input')) {
      commitInlineEdit(e.target); return;
    }
  }
  if (e.key === 'Escape') {
    if (e.target.classList.contains('task-inline-input')) cancelInlineEdit(e.target);
    if (e.target.classList.contains('subtask-add-input')) {
      e.target.closest('.subtask-add-row')?.classList.add('hidden');
    }
  }
}

function _tlFocusout(e) {
  if (e.target.classList.contains('task-inline-input')) commitInlineEdit(e.target);
}

function wireTaskListEvents(el) {
  if (!el || el.dataset.tlWired) return;
  el.dataset.tlWired = '1';
  el.addEventListener('click', _tlClick);
  el.addEventListener('keydown', _tlKeydown);
  el.addEventListener('focusout', _tlFocusout);
}
wireTaskListEvents(document.getElementById('tasks-body'));

/* ── Inline title editing ─────────────────────────────── */
function startInlineEdit(titleEl) {
  const taskId = titleEl.dataset.edit;
  const input  = document.createElement('input');
  input.className = 'task-inline-input';
  input.value = titleEl.textContent;
  input.dataset.taskId   = taskId;
  input.dataset.original = titleEl.textContent;
  titleEl.replaceWith(input);
  input.focus(); input.select();
}

function syncTaskTitleToMilestone(taskId, newTitle) {
  for (const msEv of MILESTONE_EVENTS) {
    const act = (msEv.activities || []).find(a => a.taskId === taskId);
    if (act && act.text !== newTitle) {
      const activities = msEv.activities.map(a => a.taskId === taskId ? { ...a, text: newTitle } : a);
      updateMilestoneEvent(msEv.id, { activities });
    }
  }
}

function commitInlineEdit(input) {
  const title  = input.value.trim();
  const taskId = input.dataset.taskId;
  const orig   = input.dataset.original;
  if (title && title !== orig) {
    updateTask(taskId, { title });
    syncTaskTitleToMilestone(taskId, title);
  }
  // Firestore onSnapshot will re-render and restore the span
  const span = document.createElement('span');
  span.className = 'task-title';
  span.dataset.edit = taskId;
  span.textContent = title || orig;
  input.replaceWith(span);
}

function cancelInlineEdit(input) {
  const span = document.createElement('span');
  span.className = 'task-title';
  span.dataset.edit = input.dataset.taskId;
  span.textContent = input.dataset.original;
  input.replaceWith(span);
}

/* ── Task Edit Modal ──────────────────────────────────── */
let _editTaskId = null;

function openTaskEditModal(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  _editTaskId = taskId;

  document.getElementById('te-title').value    = task.title || '';
  document.getElementById('te-date').value     = task.dueDate || '';
  document.getElementById('te-priority').value = task.priority || 'med';
  document.getElementById('te-notes').value    = task.notes || '';

  // Category select
  const catSel = document.getElementById('te-category');
  catSel.innerHTML = '<option value="">No category</option>' +
    Object.entries(CATEGORIES).map(([k,v]) =>
      `<option value="${escAttr(k)}">${escHtml(v.label)}</option>`).join('');
  catSel.value = task.category || '';

  // Recurrence select — preserve an existing custom:… value as its own option
  const recSel = document.getElementById('te-recur');
  if (recSel) {
    const rv = task.recurrence || '';
    recSel.querySelectorAll('option[data-custom]').forEach(o => o.remove());
    if (rv && !Array.from(recSel.options).some(o => o.value === rv)) {
      const o = document.createElement('option');
      o.value = rv; o.dataset.custom = '1'; o.textContent = _recurLabel(rv);
      recSel.appendChild(o);
    }
    recSel.value = rv;
  }

  // Energy picker
  const picker = document.getElementById('te-energy-picker');
  picker.querySelectorAll('.energy-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.energy === (task.energyType || ''));
  });

  openOverlay('task-edit-modal');
  setTimeout(() => document.getElementById('te-title')?.focus(), 80);
}

async function confirmTaskEdit() {
  if (!_editTaskId) return;
  const title    = document.getElementById('te-title').value.trim();
  const dueDate  = document.getElementById('te-date').value || null;
  const priority = document.getElementById('te-priority').value;
  const category = document.getElementById('te-category').value || null;
  const recurrence = document.getElementById('te-recur')?.value || '';
  const notes    = document.getElementById('te-notes').value.trim() || null;
  const energyType = document.getElementById('te-energy-picker')
    .querySelector('.energy-pill.active')?.dataset.energy || null;

  if (!title) { showToast('Title is required', 'error'); return; }
  await updateTask(_editTaskId, { title, dueDate, priority, category, recurrence, notes, energyType });
  syncTaskTitleToMilestone(_editTaskId, title);
  closeOverlay('task-edit-modal');
  _editTaskId = null;
  showToast('Task updated', 'success');
}

function initTaskEditModal() {
  document.getElementById('te-save-btn')?.addEventListener('click', confirmTaskEdit);
  document.getElementById('te-title')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmTaskEdit();
  });
  document.getElementById('te-energy-picker')?.querySelectorAll('.energy-pill').forEach(pill => {
    pill.addEventListener('click', e => {
      e.stopPropagation();
      const val = pill.dataset.energy;
      const picker = document.getElementById('te-energy-picker');
      if (picker.querySelector('.energy-pill.active')?.dataset.energy === val) {
        picker.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
        document.querySelector('.energy-pill[data-energy=""]')?.classList.add('active');
      } else {
        picker.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      }
    });
  });
}

/* ── Firestore CRUD ───────────────────────────────────── */
async function addTask(title, priority = 'med', dueDate = '', category = '', recurrence = '', energyType = '', people = []) {
  if (!title?.trim()) { showToast('Task title cannot be empty', 'error'); return; }
  const { addDoc, serverTimestamp } = window.CDX_FB;
  try {
    await addDoc(_uc('tasks'), {
      title, done: false, priority,
      dueDate: dueDate || null,
      category: category || null,
      recurrence: recurrence || null,
      energyType: energyType || null,
      people: people.length ? people : null,
      calEventId: null, subtasks: [],
      scheduleCount: 0,
      createdAt: serverTimestamp()
    });
    showToast('Task added', 'success');
  } catch (err) {
    console.error('addTask error:', err);
    showToast('Failed to add task', 'error');
  }
}

/* Duplicate an existing task into a fresh, not-done copy. Useful when a task is
   in-progress or already done but needs to be done again. Copies the shape/meta
   (priority, due, category, recurrence, energy, people, notes, subtasks) but
   resets completion state and any single-use links (calendar event, schedule count). */
async function duplicateTask(taskId) {
  const src = TASKS.find(t => t.id === taskId);
  if (!src) return;
  const { addDoc, serverTimestamp } = window.CDX_FB;
  try {
    const ref = await addDoc(_uc('tasks'), {
      title: src.title,
      done: false,
      priority: src.priority || 'med',
      dueDate: src.dueDate || null,
      category: src.category || null,
      recurrence: src.recurrence || null,
      energyType: src.energyType || null,
      people: (src.people && src.people.length) ? src.people : null,
      projectId: src.projectId || null,
      notes: src.notes || null,
      // Fresh copy: subtasks reset to not-done, no calendar link, no time logged
      subtasks: (src.subtasks || []).map(s => ({ ...s, id: crypto.randomUUID(), done: false })),
      calEventId: null,
      scheduleCount: 0,
      createdAt: serverTimestamp()
    });
    showToast('Task duplicated', 'success');
    // Select the new copy in the Tasks page detail pane if we're there
    if (_mainPanel === 'alltasks') { _atkSelectedId = ref.id; }
  } catch (err) {
    console.error('duplicateTask error:', err);
    showToast('Failed to duplicate task', 'error');
  }
}

async function updateTask(taskId, data) {
  const { updateDoc, serverTimestamp } = window.CDX_FB;
  try {
    await updateDoc(_ud('tasks', taskId), { ...data, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('updateTask error:', err);
    showToast('Failed to update task', 'error');
  }
}

async function toggleTask(taskId, timeSpentMinutes = null, category = null) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const updates = { done: !task.done };
  if (!task.done) {
    updates.doneDate = localDateStr(new Date());
    updates.doneAt = new Date().toISOString(); // exact time — used by the orbit recap constellation
    if (timeSpentMinutes != null) updates.timeSpentMinutes = timeSpentMinutes;
    if (category) updates.category = category;
  }
  // Celebration fires before the snapshot re-render wipes the row
  if (!task.done) _taskFireCelebration(taskId, task);
  await updateTask(taskId, updates);
  if (!task.done) {
    const short = task.title.length > 30 ? task.title.slice(0, 30) + '…' : task.title;
    showUndoToast(`done: ${short}`, () => updateTask(taskId, { done: false, doneDate: null }));
  }
  // Sync done status to linked milestone activities
  const newDone = !task.done;
  for (const msEv of MILESTONE_EVENTS) {
    const act = (msEv.activities || []).find(a => a.taskId === taskId);
    if (act && act.done !== newDone) {
      const activities = msEv.activities.map(a => a.taskId === taskId ? { ...a, done: newDone } : a);
      updateMilestoneEvent(msEv.id, { activities });
    }
  }
}

/* ── Task completion celebration ──────────────────────────
   Same reward grammar as habits: burst + identity vote + haptic.
   Elements are appended to <body> so the snapshot re-render can't wipe them. */
function _taskFireCelebration(taskId, task) {
  const esc = (window.CSS && CSS.escape) ? CSS.escape(taskId) : taskId;
  const check = document.querySelector(`[data-check="${esc}"]`);
  if (!check) return;
  const r = check.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  const ring = document.createElement('div');
  ring.className = 'task-burst-ring';
  ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 700);

  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'task-burst-star';
    p.textContent = '✦';
    const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 18 + Math.random() * 22;
    p.style.left = cx + 'px'; p.style.top = cy + 'px';
    p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }

  const proj = (typeof MILESTONE_PROJECTS !== 'undefined' ? MILESTONE_PROJECTS : [])
    .find(p => p.id === task.projectId);
  const vote = document.createElement('div');
  vote.className = 'task-vote-float';
  vote.textContent = '+1 for ' + (proj ? proj.title : 'future you');
  vote.style.left = (r.right + 10) + 'px'; vote.style.top = cy + 'px';
  document.body.appendChild(vote);
  setTimeout(() => vote.remove(), 1900);

  if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
}

/* ── Time-to-complete popover ─────────────────────────── */
let _timePickerTaskId = null;
let _timePickerMins   = null;
let _timePickerCat    = null;

function handleCheckClick(taskId, clickEvent) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  // Un-completing: no popover needed
  if (task.done) { toggleTask(taskId); return; }
  // Completing: show time picker near the checkbox
  _timePickerTaskId = taskId;
  _timePickerMins   = null;
  _timePickerCat    = task.category || null;
  const pop = document.getElementById('task-time-popover');
  // Reset state
  pop.querySelectorAll('.time-opt-btn').forEach(b => b.classList.remove('active'));
  const customInp = document.getElementById('task-time-custom');
  if (customInp) customInp.value = '';
  const warn = document.getElementById('task-time-warn');
  if (warn) warn.style.display = 'none';
  // Populate theme chips from CATEGORIES; preselect the task's current theme
  const catWrap = document.getElementById('task-time-cats');
  if (catWrap) {
    catWrap.innerHTML = Object.keys(CATEGORIES).map(id => {
      const c = CATEGORIES[id];
      const active = id === _timePickerCat;
      return `<button class="time-cat-btn${active ? ' active' : ''}" data-cat="${escAttr(id)}"
        style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:100px;cursor:pointer;
        background:${active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'};
        border:1px solid ${active ? 'rgba(255,255,255,0.35)' : 'var(--border)'};
        color:${active ? '#fff' : 'var(--muted)'};font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase">
        <span style="width:7px;height:7px;border-radius:50%;background:${getCatColor(id)}"></span>${escHtml(c.label)}</button>`;
    }).join('');
  }
  // Position near the click target when we have one; otherwise centre it in
  // the viewport (used by keyboard / commit / pomo completion paths).
  const popW = 250, popH = 180;
  const tgt = clickEvent && clickEvent.target && clickEvent.target.getBoundingClientRect
    ? clickEvent.target : null;
  if (tgt) {
    const rect = tgt.getBoundingClientRect();
    let left = rect.left;
    let top  = rect.bottom + 8;
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    if (top + popH > window.innerHeight - 12) top = rect.top - popH - 8;
    pop.style.left = left + 'px';
    pop.style.top  = top + 'px';
  } else {
    pop.style.left = Math.round((window.innerWidth - popW) / 2) + 'px';
    pop.style.top  = Math.round((window.innerHeight - popH) / 2) + 'px';
  }
  pop.style.display = 'block';
}

function initTimePickerPopover() {
  const pop = document.getElementById('task-time-popover');

  pop.querySelectorAll('.time-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pop.querySelectorAll('.time-opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _timePickerMins = parseInt(btn.dataset.mins, 10);
      const customInp = document.getElementById('task-time-custom');
      if (customInp) customInp.value = '';
    });
  });

  document.getElementById('task-time-custom')?.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    pop.querySelectorAll('.time-opt-btn').forEach(b => b.classList.remove('active'));
    _timePickerMins = isNaN(v) || v <= 0 ? null : v;
  });

  // Theme chips (delegated — repopulated each open)
  document.getElementById('task-time-cats')?.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    _timePickerCat = b.dataset.cat;
    pop.querySelectorAll('.time-cat-btn').forEach(x => {
      const on = x === b;
      x.classList.toggle('active', on);
      x.style.background = on ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
      x.style.border = `1px solid ${on ? 'rgba(255,255,255,0.35)' : 'var(--border)'}`;
      x.style.color = on ? '#fff' : 'var(--muted)';
    });
    const warn = document.getElementById('task-time-warn');
    if (warn) warn.style.display = 'none';
  });

  document.getElementById('task-time-confirm')?.addEventListener('click', async () => {
    // Theme is mandatory on completion — nudge instead of closing if unset
    if (!_timePickerCat) {
      const warn = document.getElementById('task-time-warn');
      if (warn) warn.style.display = 'block';
      return;
    }
    pop.style.display = 'none';
    if (_timePickerTaskId) await toggleTask(_timePickerTaskId, _timePickerMins, _timePickerCat);
    _timePickerTaskId = null;
  });

  // "Skip time" — still records the theme (mandatory), just no minutes logged
  document.getElementById('task-time-skip')?.addEventListener('click', async () => {
    if (!_timePickerCat) {
      const warn = document.getElementById('task-time-warn');
      if (warn) warn.style.display = 'block';
      return;
    }
    pop.style.display = 'none';
    if (_timePickerTaskId) await toggleTask(_timePickerTaskId, null, _timePickerCat);
    _timePickerTaskId = null;
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (pop.style.display !== 'none' && !pop.contains(e.target) && !e.target.closest('[data-check]')) {
      pop.style.display = 'none';
      _timePickerTaskId = null;
    }
  }, true);
}

/* ── Safe calendar event delete helper ──────────────────── */
async function _safeDeleteCalEvent(eventId) {
  if (!eventId) return;
  try {
    await window.CDX_FB.deleteDoc(_ud('calEvents', eventId));
  } catch (err) {
    console.warn('calEvent delete failed (may already be gone):', eventId, err.message);
  }
}

async function deleteTask(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const snapshot = { ...task };   // for undo — restore with the same doc id
  const { deleteDoc } = window.CDX_FB;
  try {
    // Delete the task's own linked calendar event
    await _safeDeleteCalEvent(task.calEventId);
    // Delete any subtask calendar events
    for (const sub of (task.subtasks || [])) {
      await _safeDeleteCalEvent(sub.calEventId);
    }
    // Clean up orphaned calEvents that reference this task by taskId
    // (handles cases where task.calEventId was null/mismatched)
    for (const ev of CAL_EVENTS.filter(e => e.taskId === taskId && e.id !== task.calEventId)) {
      await _safeDeleteCalEvent(ev.id);
    }
    // Remove from any milestone activities that reference this task
    for (const msEv of MILESTONE_EVENTS) {
      if ((msEv.activities || []).some(a => a.taskId === taskId)) {
        await updateMilestoneEvent(msEv.id, { activities: msEv.activities.filter(a => a.taskId !== taskId) });
      }
    }
    await deleteDoc(_ud('tasks', taskId));
    showUndoToast('task banished.', async () => {
      const { setDoc, serverTimestamp } = window.CDX_FB;
      const { id, ...data } = snapshot;
      // calEventId / milestone links were cleaned up above and are not restored
      delete data.calEventId;
      await setDoc(_ud('tasks', id), { ...data, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('deleteTask error:', err);
    showToast('Failed to delete task', 'error');
  }
}

async function addSubtask(taskId, title) {
  if (!title?.trim()) return;
  const { arrayUnion, serverTimestamp, updateDoc } = window.CDX_FB;
  const sub = { id: crypto.randomUUID(), title: title.trim(), done: false, createdAt: new Date().toISOString() };
  try {
    await updateDoc(_ud('tasks', taskId), { subtasks: arrayUnion(sub), updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('addSubtask error:', err);
    showToast('Failed to add subtask', 'error');
  }
}

async function toggleSubtask(taskId, subId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('tasks', taskId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Task not found');
      const subtasks = (snap.data().subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s);
      transaction.update(ref, { subtasks, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('toggleSubtask error:', err);
    showToast('Failed to update subtask', 'error');
  }
}

async function deleteSubtask(taskId, subId) {
  const { runTransaction, serverTimestamp } = window.CDX_FB;
  // Find the calEventId from local state before transacting
  const sub = TASKS.find(t => t.id === taskId)?.subtasks?.find(s => s.id === subId);
  if (sub?.calEventId) await _safeDeleteCalEvent(sub.calEventId);
  try {
    await runTransaction(window.CDX_DB, async (transaction) => {
      const ref = _ud('tasks', taskId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Task not found');
      const subtasks = (snap.data().subtasks || []).filter(s => s.id !== subId);
      transaction.update(ref, { subtasks, updatedAt: serverTimestamp() });
    });
  } catch (err) {
    console.error('deleteSubtask error:', err);
    showToast('Failed to delete subtask', 'error');
  }
}

/* ── Schedule Modal ───────────────────────────────────── */
function openScheduleModal(date, startTime, taskId, subId) {
  _schedCtx = { taskId, subId, date, startTime };
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  document.getElementById('sched-title').value = subId
    ? (task.subtasks?.find(s => s.id === subId)?.title || task.title)
    : task.title;
  document.getElementById('sched-date').value = date;
  document.getElementById('sched-time').value = startTime;
  document.getElementById('sched-duration').value = 30;
  // Commitment link — only for the main task (a subtask inherits its parent's).
  const commitRow = document.getElementById('sched-commitment-row');
  const csel = document.getElementById('sched-commitment');
  if (commitRow) commitRow.style.display = subId ? 'none' : '';
  if (csel && !subId) {
    const commits = (typeof MILESTONE_PROJECTS !== 'undefined' ? MILESTONE_PROJECTS : [])
      .filter(p => !p.isArchived)
      .sort((a, b) => (b.bigRock ? 1 : 0) - (a.bigRock ? 1 : 0));
    csel.innerHTML = '<option value="">No commitment</option>' +
      commits.map(p => `<option value="${escAttr(p.id)}">${escHtml(p.title || 'Untitled')}</option>`).join('');
    csel.value = task.projectId || '';
  }
  const subsSection = document.getElementById('sched-subtasks-section');
  const subsList    = document.getElementById('sched-subtasks-list');
  if (!subId && task.subtasks && task.subtasks.length > 0) {
    subsSection.style.display = 'block';
    subsList.innerHTML = task.subtasks.map(s => `
      <div class="sched-subtask-item">
        <input type="checkbox" id="sched-sub-${s.id}" value="${escAttr(s.id)}" checked />
        <label for="sched-sub-${s.id}" style="flex:1">${escHtml(s.title)}</label>
        <input type="time" class="sched-input" style="width:100px;font-size:11px;padding:4px 6px"
               id="sched-sub-time-${s.id}" value="${startTime}" />
      </div>`).join('');
  } else {
    subsSection.style.display = 'none';
    subsList.innerHTML = '';
  }
  document.getElementById('schedule-modal').classList.add('open');
}

async function confirmSchedule() {
  const { addDoc, deleteDoc, serverTimestamp } = window.CDX_FB;
  const title     = document.getElementById('sched-title').value.trim();
  const date      = document.getElementById('sched-date').value;
  const startTime = document.getElementById('sched-time').value;
  const duration  = parseInt(document.getElementById('sched-duration').value) || 60;
  const endTime   = addMinutes(startTime, duration);
  if (!title || !date || !startTime) return;

  const { taskId, subId } = _schedCtx;
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const color = getCatColor(task.category);

  if (subId) {
    const sub = task.subtasks?.find(s => s.id === subId);
    if (!sub) return;
    await _safeDeleteCalEvent(sub.calEventId);
    const ref = await addDoc(_uc('calEvents'), {
      title, taskId, subId, date, startTime, endTime, duration, color,
      createdAt: serverTimestamp()
    });
    await updateTask(taskId, {
      subtasks: task.subtasks.map(s => s.id === subId ? { ...s, calEventId: ref.id } : s)
    });
  } else {
    await _safeDeleteCalEvent(task.calEventId);
    const ref = await addDoc(_uc('calEvents'), {
      title, taskId, date, startTime, endTime, duration, color,
      createdAt: serverTimestamp()
    });
    // Count each placement as a scheduling attempt (productivity signal).
    // Also persist the commitment link chosen in the modal (null = no commitment).
    const projectId = document.getElementById('sched-commitment')?.value || null;
    await updateTask(taskId, { calEventId: ref.id, scheduleCount: (task.scheduleCount || 0) + 1, projectId });
    // Schedule checked subtasks
    const checkedBoxes = document.querySelectorAll('#sched-subtasks-list input[type="checkbox"]:checked');
    for (const cb of checkedBoxes) {
      const sid = cb.value;
      const st  = document.getElementById(`sched-sub-time-${sid}`)?.value || startTime;
      const freshTask = TASKS.find(t => t.id === taskId);
      const sub = freshTask?.subtasks?.find(s => s.id === sid);
      if (!sub) continue;
      await _safeDeleteCalEvent(sub.calEventId);
      const sref = await addDoc(_uc('calEvents'), {
        title: sub.title, taskId, subId: sid, date,
        startTime: st, endTime: addMinutes(st, 30), duration: 30, color,
        createdAt: serverTimestamp()
      });
      const latestTask = TASKS.find(t => t.id === taskId);
      await updateTask(taskId, {
        subtasks: (latestTask?.subtasks || []).map(s => s.id === sid ? { ...s, calEventId: sref.id } : s)
      });
    }
  }
  document.getElementById('schedule-modal').classList.remove('open');
  _schedCtx = {};
}

function initScheduleModal() {
  document.getElementById('sched-confirm-btn')?.addEventListener('click', confirmSchedule);
}

/* ── Drag-to-schedule helpers ─────────────────────────────
   Shared by the dashboard time-block grid and the Calendar page. Dropping a
   task onto a slot gives it a calEvent (a place on the timeline); dropping an
   existing event moves it. Both keep the task ↔ calEvent link in sync. */
async function scheduleTaskAt(taskId, date, startTime, duration = 30) {
  const { addDoc, serverTimestamp } = window.CDX_FB;
  const task = TASKS.find(t => t.id === taskId);
  if (!task || !window.CDX_USER?.uid) return;
  try {
    await _safeDeleteCalEvent(task.calEventId);
    const endTime = addMinutes(startTime, duration);
    const ref = await addDoc(_uc('calEvents'), {
      title: task.title, taskId, date, startTime, endTime, duration,
      color: getCatColor(task.category), createdAt: serverTimestamp()
    });
    // Anchor the task to this day so it stops showing as "anytime/unscheduled".
    // Count each placement — a productivity signal (how many attempts to land it).
    await updateTask(taskId, { calEventId: ref.id, dueDate: date, someday: false, scheduleCount: (task.scheduleCount || 0) + 1 });
    showToast(`Scheduled at ${_dashFmtTime(startTime)}`, 'success');
  } catch (e) { console.error('scheduleTaskAt', e); showToast('Could not schedule', 'error'); }
}

async function moveCalEventTo(eventId, date, startTime) {
  const { updateDoc } = window.CDX_FB;
  const ev = (CAL_EVENTS || []).find(e => e.id === eventId);
  if (!ev) return;
  try {
    const dur = ev.duration || 30;
    await updateDoc(_ud('calEvents', eventId), {
      date, startTime, endTime: addMinutes(startTime, dur), allDay: false
    });
    if (ev.taskId) await updateTask(ev.taskId, { dueDate: date });
  } catch (e) { console.error('moveCalEventTo', e); showToast('Could not move event', 'error'); }
}

/* ── Calendar helpers ─────────────────────────────────── */
function getCatColor(cat) {
  return cat && CATEGORIES[cat] ? CATEGORIES[cat].color : '#e4e4e4';
}

/* ── Calendar render dispatch ─────────────────────────── */
function renderCalendar() {
  if (_calView === 'day')   renderDayView(_calDate);
  if (_calView === 'week')  renderWeekView(_calDate);
  if (_calView === 'month') renderMonthView(_calDate);
  updateCalLabel();
  // Events + milestones also feed the minimalist dashboard's today spine.
  if (_mainPanel === 'default') window.renderDashboardBoard && window.renderDashboardBoard();
}

function updateCalLabel() {
  const el = document.getElementById('cal-date-label');
  if (!el) return;
  const d = _calDate;
  if (_calView === 'day') {
    el.textContent = d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  } else if (_calView === 'week') {
    const ws = weekStart(d);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    el.textContent = `${ws.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${we.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;
  } else {
    el.textContent = d.toLocaleDateString('en-GB', { month:'long', year:'numeric' });
  }
}

function weekStart(d) {
  const ws = new Date(d);
  const dow = ws.getDay();
  ws.setDate(ws.getDate() + (dow === 0 ? -6 : 1 - dow));
  ws.setHours(0,0,0,0);
  return ws;
}

/* ── Day view ─────────────────────────────────────────── */
function renderDayView(date) {
  const calPanel  = document.getElementById('cal-day-view');
  const container = document.getElementById('cal-hours-container');
  if (!container) return;
  document.getElementById('cal-week-view')?.remove();
  document.getElementById('cal-month-view')?.remove();
  calPanel.style.display = '';

  const dateStr   = localDateStr(date);
  const dayEvents = CAL_EVENTS.filter(ev => ev.date === dateStr && !ev.allDay);
  const allDayEvs = CAL_EVENTS.filter(ev => ev.date === dateStr && ev.allDay);
  const dow = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = (dow === 0 || dow === 6);
  calPanel.style.borderTop = isWeekend ? '2px solid rgba(255,255,255,0.12)' : '';

  // Render all-day strip
  const alldayRow = document.getElementById('cal-allday-row');
  const msDay = _calMilestones(dateStr);
  if (alldayRow) alldayRow.style.display = '';
  if (alldayRow) alldayRow.innerHTML = msDay + (allDayEvs.length
    ? allDayEvs.map(ev => `<span class="cal-allday-chip" data-event-id="${escAttr(ev.id)}">${escHtml(ev.title)}</span>`).join('')
    : (msDay ? '' : `<span style="font-size:10px;color:var(--muted);font-family:var(--font-mono)">All-day</span>`));
  if (alldayRow) _wireCalMilestones(alldayRow);

  // Clear old event chips
  container.querySelectorAll('.cal-event').forEach(e => e.remove());

  // Build hour rows if not yet present
  if (!container.querySelector('.cal-hour-row')) {
    for (let h = 5; h <= 23; h++) {
      const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
      const row = document.createElement('div');
      row.className = 'cal-hour-row';
      row.dataset.hour = h;
      row.innerHTML = `<div class="cal-hour-label">${label}</div><div class="cal-hour-slot"></div>`;
      container.appendChild(row);
    }
  }

  dayEvents.forEach(ev => {
    const startH = ev.startTime ? parseInt(ev.startTime.split(':')[0]) : (ev.startHour || 9);
    const startM = ev.startTime ? parseInt(ev.startTime.split(':')[1] || '0') : 0;
    const durationMins = ev.duration || 60;
    const endTotalMins = startH * 60 + startM + durationMins;
    const endH = Math.floor(endTotalMins / 60);
    const endM = endTotalMins % 60;
    const endTimeStr = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;

    const slot = container.querySelector(`[data-hour="${startH}"] .cal-hour-slot`);
    if (!slot) return;
    const chip = document.createElement('div');
    chip.className = 'cal-event';
    chip.dataset.eventId = ev.id;
    const color = getCatColor(TASKS.find(t => t.id === ev.taskId)?.category);
    // top = startM px (1 minute = 1px), height = durationMins px
    const topPx = startM;
    const heightPx = Math.max(durationMins, 20);
    chip.style.cssText = `border-left-color:${color};background:${color}18;top:${topPx}px;height:${heightPx}px;`;
    const startTimeStr = fmtTimeSched(ev.startTime || `${String(startH).padStart(2,'0')}:00`);
    chip.innerHTML = `
      <span class="cal-event-title">${escHtml(ev.title)} <span class="cal-event-time" style="display:inline;margin-top:0">${startTimeStr}–${fmtTimeSched(endTimeStr)}</span></span>`;
    chip.addEventListener('click', e => {
      e.stopPropagation();
      showEventModal(ev, e.clientX, e.clientY);
    });
    slot.appendChild(chip);
  });

  // Now-line position — delegate to updateCalNowLine so timezone is consistent
  updateCalNowLine();
}

/* ── Week view ─────────────────────────────────────────── */
function renderWeekView(date) {
  const calPanel = document.getElementById('cal-day-view');
  calPanel.style.display = 'none';
  document.getElementById('cal-allday-row').style.display = 'none';
  document.getElementById('cal-month-view')?.remove();

  let weekView = document.getElementById('cal-week-view');
  if (!weekView) {
    weekView = document.createElement('div');
    weekView.id = 'cal-week-view';
    weekView.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column';
    calPanel.parentNode.insertBefore(weekView, calPanel.nextSibling);
  }

  const ws    = weekStart(date);
  const today = localDateStr(new Date());
  const DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let html = `<div class="week-header-row"><div class="week-time-label" style="border-bottom:none"></div>`;
  for (let i = 0; i < 7; i++) {
    const d  = new Date(ws); d.setDate(d.getDate() + i);
    const ds = localDateStr(d);
    const isToday = ds === today;
    const isWeekend = (i === 5 || i === 6); // Sat=5, Sun=6
    const hol = HOLIDAYS[ds];
    html += `<div class="week-day-header${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}" data-date="${ds}" style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;${isToday ? 'color:rgba(57,255,20,0.9);text-shadow:0 0 8px rgba(57,255,20,0.4);border-bottom:2px solid rgba(57,255,20,0.45)' : ''}">
      ${DAYS[i]} ${d.getDate()}${hol ? `<br><span style="font-size:7px;color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.12);border-radius:2px;padding:0 2px;display:block">${escHtml(hol.name)}</span>` : ''}
    </div>`;
  }
  html += `</div>`;
  // All-day row
  const weekCols = `grid-template-columns:48px repeat(7,1fr)`;
  html += `<div class="week-allday-row" style="${weekCols}"><div class="week-time-label" style="font-size:10px;color:var(--muted)">all-day</div>`;
  for (let i = 0; i < 7; i++) {
    const d  = new Date(ws); d.setDate(d.getDate() + i);
    const ds = localDateStr(d);
    const adEvs = CAL_EVENTS.filter(ev => ev.date === ds && ev.allDay);
    html += `<div class="week-allday-cell">${_calMilestones(ds)}${adEvs.map(ev => `<span class="week-allday-chip">${escHtml(ev.title)}</span>`).join('')}</div>`;
  }
  html += `</div><div class="week-body">`;

  for (let h = 5; h <= 23; h++) {
    const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
    html += `<div class="week-time-label">${label}</div>`;
    for (let i = 0; i < 7; i++) {
      const d   = new Date(ws); d.setDate(d.getDate() + i);
      const ds  = localDateStr(d);
      const isWeekend = (i === 5 || i === 6);
      const hh  = String(h).padStart(2,'0');
      const evs = CAL_EVENTS.filter(ev => ev.date === ds && ev.startTime?.startsWith(hh));
      const chips = evs.map(ev => {
        const color = getCatColor(TASKS.find(t => t.id === ev.taskId)?.category);
        return `<div class="week-event-chip" data-event-id="${escAttr(ev.id)}" style="border-left-color:${color};background:${color}18">
          <span class="chip-title">${escHtml(ev.title)}</span>
          <span class="chip-time">${fmtTimeSched(ev.startTime)}</span>
        </div>`;
      }).join('');
      html += `<div class="week-cell${isWeekend ? ' weekend' : ''}" data-date="${ds}" data-hour="${h}">${chips}</div>`;
    }
  }
  html += `</div>`;
  weekView.innerHTML = html;
  _wireCalMilestones(weekView);

  // Click week-event-chip → show event action modal
  weekView.querySelectorAll('.week-event-chip[data-event-id]').forEach(chip => {
    chip.style.cursor = 'pointer';
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const ev = CAL_EVENTS.find(ev => ev.id === chip.dataset.eventId);
      if (!ev) return;
      showEventModal(ev, e.clientX, e.clientY);
    });
  });

  // Reposition multi-hour chips to span correct duration height
  const weekBodyEl = weekView.querySelector('.week-body');
  const WEEK_CELL_H = 44; // px per hour slot (min-height of .week-cell)
  weekView.querySelectorAll('.week-event-chip[data-event-id]').forEach(chip => {
    const ev = CAL_EVENTS.find(e => e.id === chip.dataset.eventId);
    if (!ev || !weekBodyEl) return;
    const cell = chip.parentElement;
    if (!cell) return;
    const durationMins = ev.duration || 60;
    const startM = ev.startTime ? parseInt(ev.startTime.split(':')[1] || '0') : 0;
    const topPx    = cell.offsetTop  + Math.round(startM / 60 * WEEK_CELL_H);
    const leftPx   = cell.offsetLeft + 2;
    const widthPx  = cell.offsetWidth - 6;
    const heightPx = Math.max(Math.round(durationMins / 60 * WEEK_CELL_H), 18);
    chip.style.position  = 'absolute';
    chip.style.top       = topPx  + 'px';
    chip.style.left      = leftPx + 'px';
    chip.style.width     = widthPx + 'px';
    chip.style.height    = heightPx + 'px';
    chip.style.zIndex    = '3';
    chip.style.margin    = '0';
    chip.style.boxSizing = 'border-box';
    weekBodyEl.appendChild(chip);
  });

  // Click header day → switch to day view
  weekView.querySelectorAll('.week-day-header[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      _calDate = new Date(el.dataset.date + 'T00:00:00');
      _calView = 'day';
      document.querySelectorAll('.view-tab[data-view]').forEach(t => t.classList.remove('active'));
      document.querySelector('.view-tab[data-view="day"]')?.classList.add('active');
      renderCalendar();
    });
  });
}

/* ── Month view ───────────────────────────────────────── */
function renderMonthView(date) {
  const calPanel = document.getElementById('cal-day-view');
  calPanel.style.display = 'none';
  document.getElementById('cal-allday-row').style.display = 'none';
  document.getElementById('cal-week-view')?.remove();

  let monthView = document.getElementById('cal-month-view');
  if (!monthView) {
    monthView = document.createElement('div');
    monthView.id = 'cal-month-view';
    monthView.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column';
    calPanel.parentNode.insertBefore(monthView, calPanel.nextSibling);
  }

  const year  = date.getFullYear();
  const month = date.getMonth();
  const today = localDateStr(new Date());
  const DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let html = `<div class="month-dow-header">${DAYS.map(d => `<div class="month-dow-label">${d}</div>`).join('')}</div><div class="month-grid">`;

  const firstDow   = new Date(year, month, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const lastDay    = new Date(year, month + 1, 0).getDate();
  const prevLast   = new Date(year, month, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i--) {
    html += buildMonthCell(localDateStr(new Date(year, month - 1, prevLast - i)), false);
  }
  for (let day = 1; day <= lastDay; day++) {
    const ds = localDateStr(new Date(year, month, day));
    html += buildMonthCell(ds, true);
  }
  const total = startOffset + lastDay;
  const rem   = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= rem; i++) {
    html += buildMonthCell(localDateStr(new Date(year, month + 1, i)), false);
  }

  html += `</div>`;
  monthView.innerHTML = html;

  monthView.querySelectorAll('.month-event-pill[data-event-id]').forEach(pill => {
    pill.addEventListener('click', e => {
      e.stopPropagation();
      const ev = CAL_EVENTS.find(ev => ev.id === pill.dataset.eventId);
      if (!ev) return;
      showEventModal(ev, e.clientX, e.clientY);
    });
  });

  monthView.querySelectorAll('.month-day-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      _calDate = new Date(cell.dataset.date + 'T00:00:00');
      _calView = 'day';
      document.querySelectorAll('.view-tab[data-view]').forEach(t => t.classList.remove('active'));
      document.querySelector('.view-tab[data-view="day"]')?.classList.add('active');
      renderCalendar();
    });
  });
  _wireCalMilestones(monthView);
}

// Global milestone layer — the same markers render on every calendar surface,
// pinned to the top of a date, with their own flag design (not task/event chips).
function _calMilestones(dateStr) {
  const evs = (typeof MILESTONE_EVENTS !== 'undefined' ? MILESTONE_EVENTS : [])
    .filter(e => String(e.date || '').slice(0, 10) === dateStr);
  return evs.map(e => {
    const c = (typeof _pcalProjColor === 'function') ? _pcalProjColor(e.projectId) : 'var(--gold)';
    return `<div class="cal-ms" data-ms-id="${escAttr(e.id)}" data-ms-proj="${escAttr(e.projectId || '')}" style="--c:${c}" title="◆ ${escAttr(e.title || 'Milestone')}">
      <span class="cal-ms-ico">⚑</span><span class="cal-ms-t">${escHtml(e.title || 'Milestone')}</span></div>`;
  }).join('');
}
function _wireCalMilestones(scopeEl) {
  scopeEl.querySelectorAll('.cal-ms[data-ms-id]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof openMsEventModal === 'function') openMsEventModal(el.dataset.msProj || null, el.dataset.msId);
  }));
}

function buildMonthCell(dateStr, isCurrentMonth) {
  const today  = localDateStr(new Date());
  const day    = parseInt(dateStr.split('-')[2]);
  const hol    = HOLIDAYS[dateStr];
  const evs    = CAL_EVENTS.filter(ev => ev.date === dateStr);
  const cellDate = new Date(dateStr + 'T00:00:00');
  const dow = cellDate.getDay(); // 0=Sun, 6=Sat
  const isWeekend = (dow === 0 || dow === 6);

  const classes = ['month-day-cell',
    !isCurrentMonth ? 'other-month' : '',
    dateStr === today ? 'today' : '',
    hol ? 'holiday' : '',
    isWeekend ? 'weekend' : '',
    dow === 6 ? 'saturday' : ''
  ].filter(Boolean).join(' ');

  const timedEvs  = evs.filter(ev => !ev.allDay);
  const allDayEvs = evs.filter(ev => ev.allDay);
  const doneTasks = TASKS.filter(t => t.done && t.dueDate === dateStr);
  const catCounts = {};
  doneTasks.forEach(t => { const c = t.category || 'personal'; catCounts[c] = (catCounts[c]||0) + 1; });
  const maxCount  = Math.max(1, ...Object.values(catCounts));
  const sparkBars = Object.entries(catCounts).map(([cat, cnt]) => {
    const h = Math.round((cnt / maxCount) * 12) + 2;
    return `<div class="month-spark-bar" style="height:${h}px;background:${getCatColor(cat)}"></div>`;
  }).join('');
  const spark = sparkBars ? `<div class="month-spark">${sparkBars}</div>` : '';

  const holBadge = hol ? `<span class="month-holiday-name">${escHtml(hol.name)}</span>` : '';
  const adBadges = allDayEvs.slice(0,1).map(ev =>
    `<span style="font-family:var(--font-mono);font-size:7px;color:#fff;background:var(--neon);border-radius:2px;padding:0 3px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${escHtml(ev.title)}</span>`
  ).join('');
  const pills = timedEvs.slice(0,2).map(ev => {
    const color = getCatColor(TASKS.find(t => t.id === ev.taskId)?.category);
    return `<span class="month-event-pill" data-event-id="${escAttr(ev.id)}" style="background:${color}22;color:${color};cursor:pointer">${escHtml(ev.title)}</span>`;
  }).join('');
  const more = timedEvs.length > 2 ? `<span style="font-size:10px;color:var(--muted);font-family:var(--font-mono)">+${timedEvs.length-2} more</span>` : '';

  const msBanner = _calMilestones(dateStr);
  return `<div class="${classes}" data-date="${dateStr}">
    ${msBanner}
    <span class="month-day-num">${day}</span>
    ${holBadge}${adBadges}${spark}${pills}${more}
  </div>`;
}

/* ── Event Action Modal ───────────────────────────────── */
let _eamEvent = null;

function showEventModal(ev, clientX, clientY) {
  _eamEvent = ev;
  const modal = document.getElementById('event-action-modal');
  if (!modal) return;
  // Show "Delete event & task" only when this event is actually linked to a task
  const hasTask = !!(ev.taskId ? TASKS.find(t => t.id === ev.taskId) : TASKS.find(t => t.calEventId === ev.id));
  const delTaskBtn = document.getElementById('eam-delete-task');
  if (delTaskBtn) delTaskBtn.style.display = hasTask ? '' : 'none';
  document.getElementById('eam-title').textContent = ev.title;
  document.getElementById('eam-start').value = ev.startTime || '';
  document.getElementById('eam-dur').value   = ev.duration  || 60;

  // Linked task → theme picker + complete button (edit/close from the dashboard)
  const linkedTask = ev.taskId ? TASKS.find(t => t.id === ev.taskId) : TASKS.find(t => t.calEventId === ev.id);
  const taskSection = document.getElementById('eam-task-section');
  const completeBtn = document.getElementById('eam-complete');
  const catRow = document.getElementById('eam-cats');
  if (linkedTask && catRow) {
    taskSection.style.display = '';
    completeBtn.style.display = linkedTask.done ? 'none' : '';
    catRow.innerHTML = Object.keys(CATEGORIES).map(id => {
      const c = CATEGORIES[id], active = id === linkedTask.category;
      return `<button class="eam-cat-chip${active ? ' active' : ''}" data-eam-cat="${escAttr(id)}">
        <span class="eam-cat-dot" style="background:${getCatColor(id)}"></span>${escHtml(c.label)}</button>`;
    }).join('');
    catRow.querySelectorAll('[data-eam-cat]').forEach(b => b.onclick = () => {
      updateTask(linkedTask.id, { category: b.dataset.eamCat });
      catRow.querySelectorAll('.eam-cat-chip').forEach(x => x.classList.toggle('active', x === b));
    });
    // Commitment link — change persists immediately to the linked task's projectId.
    const eamCommit = document.getElementById('eam-commitment');
    if (eamCommit) {
      const commits = (typeof MILESTONE_PROJECTS !== 'undefined' ? MILESTONE_PROJECTS : [])
        .filter(p => !p.isArchived)
        .sort((a, b) => (b.bigRock ? 1 : 0) - (a.bigRock ? 1 : 0));
      eamCommit.innerHTML = '<option value="">No commitment</option>' +
        commits.map(p => `<option value="${escAttr(p.id)}">${escHtml(p.title || 'Untitled')}</option>`).join('');
      eamCommit.value = linkedTask.projectId || '';
      eamCommit.onchange = () => updateTask(linkedTask.id, { projectId: eamCommit.value || null });
    }
    completeBtn.onclick = () => { hideEventModal(); handleCheckClick(linkedTask.id); };
  } else if (taskSection) {
    taskSection.style.display = 'none';
    if (completeBtn) completeBtn.style.display = 'none';
  }

  modal.classList.add('open');
  // Position near click, keep within viewport
  const mW = 320, mH = linkedTask ? 340 : 200;
  const vW = window.innerWidth, vH = window.innerHeight;
  let x = clientX + 14, y = clientY - 14;
  if (x + mW > vW - 8) x = clientX - mW - 14;
  if (y + mH > vH - 8) y = vH - mH - 8;
  if (y < 8) y = 8;
  modal.style.left = x + 'px';
  modal.style.top  = y + 'px';
}

function hideEventModal() {
  document.getElementById('event-action-modal')?.classList.remove('open');
  _eamEvent = null;
}

function initEventModal() {
  const { updateDoc, deleteDoc } = window.CDX_FB || {};

  document.getElementById('eam-close')?.addEventListener('click', hideEventModal);

  document.getElementById('eam-save')?.addEventListener('click', async () => {
    if (!_eamEvent || !updateDoc) return;
    const startTime = document.getElementById('eam-start').value;
    const duration  = parseInt(document.getElementById('eam-dur').value) || 60;
    if (!startTime) return;
    const [h, m] = startTime.split(':').map(Number);
    const endMins = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMins/60) % 24).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`;
    try {
      await updateDoc(_ud('calEvents', _eamEvent.id), { startTime, endTime, duration });
      hideEventModal();
      showToast('Event updated', 'success');
    } catch(e) { showToast('Could not update event', 'error'); }
  });

  document.getElementById('eam-delete')?.addEventListener('click', async () => {
    if (!_eamEvent || !deleteDoc) return;
    if (!await cdxConfirm(`Delete "${_eamEvent.title}"?`)) return;
    try {
      await deleteDoc(_ud('calEvents', _eamEvent.id));
      // Clear calEventId on linked task
      const linkedTask = _eamEvent.taskId
        ? TASKS.find(t => t.id === _eamEvent.taskId)
        : TASKS.find(t => t.calEventId === _eamEvent.id);
      if (linkedTask) await updateTask(linkedTask.id, { calEventId: null });
      hideEventModal();
      showToast('Event deleted', 'success');
    } catch(e) { showToast('Could not delete event', 'error'); }
  });

  // Delete the event AND its linked task (deleteTask cascades the calEvent + subtask events)
  document.getElementById('eam-delete-task')?.addEventListener('click', async () => {
    if (!_eamEvent) return;
    const linkedTask = _eamEvent.taskId
      ? TASKS.find(t => t.id === _eamEvent.taskId)
      : TASKS.find(t => t.calEventId === _eamEvent.id);
    if (!linkedTask) { document.getElementById('eam-delete')?.click(); return; }
    if (!await cdxConfirm(`Delete the event AND the task "${linkedTask.title}"? This removes the task entirely.`)) return;
    try {
      await deleteTask(linkedTask.id);   // cascades: task + its calEvent + subtask events + milestone refs
      hideEventModal();
    } catch(e) { showToast('Could not delete event & task', 'error'); }
  });

  document.getElementById('eam-play')?.addEventListener('click', () => {
    if (!_eamEvent) return;
    const ev = _eamEvent;
    hideEventModal();
    showMainPanel('focus');
    const titleEl = document.getElementById('pomo-ev-title');
    if (titleEl) titleEl.textContent = ev.title;
    window.setPomoEvent?.(ev);
  });

  // Close on outside click
  document.addEventListener('click', e => {
    const modal = document.getElementById('event-action-modal');
    if (!modal || !modal.classList.contains('open')) return;
    if (!modal.contains(e.target)) hideEventModal();
  }, true);
}

/* ── Calendar nav ─────────────────────────────────────── */
function initCalNav() {
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    if (_calView === 'day')   _calDate.setDate(_calDate.getDate() - 1);
    else if (_calView === 'week')  _calDate.setDate(_calDate.getDate() - 7);
    else _calDate.setMonth(_calDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    if (_calView === 'day')   _calDate.setDate(_calDate.getDate() + 1);
    else if (_calView === 'week')  _calDate.setDate(_calDate.getDate() + 7);
    else _calDate.setMonth(_calDate.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    _calDate = new Date(); renderCalendar();
  });
  document.getElementById('cal-add-milestone')?.addEventListener('click', () => {
    if (typeof _planMilestonePicker === 'function') _planMilestonePicker(localDateStr(_calDate || new Date()));
  });
}

/* ── Drag-to-timebox ──────────────────────────────────────
   Implementation intentions: dropping a task on a time slot converts
   "I'll do X" into "I'll do X at 2:15pm". 15-min snap, ghost preview,
   direct schedule (no modal) for plain tasks, undo toast. */

let _dragGhostEl = null;

function _dragSnapQuarter(slot, clientY) {
  const rect = slot.getBoundingClientRect();
  const frac = Math.min(0.999, Math.max(0, (clientY - rect.top) / rect.height));
  const mins = Math.floor(frac * 4) * 15;
  return { mins, rect };
}

function _showDragGhost(slot, hour, mins, rect) {
  if (!_dragGhostEl) {
    _dragGhostEl = document.createElement('div');
    _dragGhostEl.className = 'cal-drop-ghost';
    document.body.appendChild(_dragGhostEl);
  }
  const task = TASKS.find(t => t.id === _dragTaskId);
  const start = `${String(hour).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  const title = _dragSubId
    ? (task?.subtasks?.find(s => s.id === _dragSubId)?.title || task?.title || '')
    : (task?.title || '');
  _dragGhostEl.textContent = `${fmtTimeSched(start)} — ${title}`;
  _dragGhostEl.style.left   = rect.left + 'px';
  _dragGhostEl.style.width  = rect.width + 'px';
  _dragGhostEl.style.top    = (rect.top + (mins / 60) * rect.height) + 'px';
  _dragGhostEl.style.height = Math.max(14, rect.height / 2) + 'px';
}

function _clearDragGhost() {
  _dragGhostEl?.remove();
  _dragGhostEl = null;
}

/* Direct schedule (drag-drop path) — mirrors confirmSchedule for a single task/subtask */
async function scheduleTaskDirect(date, startTime, taskId, subId, duration = 30) {
  const { addDoc, serverTimestamp, setDoc, doc } = window.CDX_FB;
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  const endTime = addMinutes(startTime, duration);
  const color = getCatColor(task.category);
  const sub = subId ? task.subtasks?.find(s => s.id === subId) : null;
  if (subId && !sub) return;
  const title = sub ? sub.title : task.title;

  // Snapshot the event being replaced so undo can restore it
  const prevEvId = sub ? sub.calEventId : task.calEventId;
  const prevEv = prevEvId ? CAL_EVENTS.find(ev => ev.id === prevEvId) : null;
  const prevEvData = prevEv ? { ...prevEv } : null;

  await _safeDeleteCalEvent(prevEvId);
  const payload = sub
    ? { title, taskId, subId, date, startTime, endTime, duration, color, createdAt: serverTimestamp() }
    : { title, taskId, date, startTime, endTime, duration, color, createdAt: serverTimestamp() };
  const ref = await addDoc(_uc('calEvents'), payload);
  if (sub) {
    await updateTask(taskId, { subtasks: task.subtasks.map(s => s.id === subId ? { ...s, calEventId: ref.id } : s) });
  } else {
    // Count each placement as a scheduling attempt (productivity signal).
    await updateTask(taskId, { calEventId: ref.id, scheduleCount: (task.scheduleCount || 0) + 1 });
  }

  showUndoToast(`${fmtTimeSched(startTime)} claimed. future you says thanks.`, async () => {
    await _safeDeleteCalEvent(ref.id);
    let restoredId = null;
    if (prevEvData) {
      const { id, ...data } = prevEvData;
      await setDoc(_ud('calEvents', id), data);
      restoredId = id;
    }
    const fresh = TASKS.find(t => t.id === taskId);
    if (sub) {
      await updateTask(taskId, { subtasks: (fresh?.subtasks || []).map(s => s.id === subId ? { ...s, calEventId: restoredId } : s) });
    } else {
      await updateTask(taskId, { calEventId: restoredId });
    }
  });
}

function initCalDropZones() {
  // Day view
  const dayContainer = document.getElementById('cal-hours-container');
  if (dayContainer) {
    dayContainer.addEventListener('dragover', e => {
      const slot = e.target.closest('.cal-hour-slot');
      if (!slot || !_dragTaskId) return;
      e.preventDefault();
      const h = parseInt(slot.closest('.cal-hour-row')?.dataset.hour ?? '9');
      const { mins, rect } = _dragSnapQuarter(slot, e.clientY);
      _showDragGhost(slot, h, mins, rect);
    });
    dayContainer.addEventListener('dragleave', e => {
      if (!dayContainer.contains(e.relatedTarget)) _clearDragGhost();
    });
    dayContainer.addEventListener('drop', e => {
      const slot = e.target.closest('.cal-hour-slot');
      if (!slot || !_dragTaskId) return;
      e.preventDefault();
      _clearDragGhost();
      const h = parseInt(slot.closest('.cal-hour-row')?.dataset.hour ?? '9');
      const { mins } = _dragSnapQuarter(slot, e.clientY);
      const start = `${String(h).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
      const task = TASKS.find(t => t.id === _dragTaskId);
      // Tasks with subtasks keep the modal (it offers scheduling them together)
      if (!_dragSubId && task?.subtasks?.length) {
        openScheduleModal(localDateStr(_calDate), start, _dragTaskId, _dragSubId);
      } else {
        scheduleTaskDirect(localDateStr(_calDate), start, _dragTaskId, _dragSubId);
      }
    });
    document.addEventListener('dragend', _clearDragGhost);
    // Click empty slot to create new event (or open pomodoro for spanning multi-hour events)
    // Half-hour precision: top half of slot = :00, bottom half = :30
    dayContainer.addEventListener('click', e => {
      if (_dragTaskId) return;
      const slot = e.target.closest('.cal-hour-slot');
      if (!slot) return;
      if (e.target.closest('.cal-event')) return; // clicking existing event chip
      const h = parseInt(slot.closest('.cal-hour-row')?.dataset.hour ?? '9');
      const rect = slot.getBoundingClientRect();
      const yFrac = (e.clientY - rect.top) / rect.height;
      const m = yFrac >= 0.5 ? 30 : 0;
      const dateStr = localDateStr(_calDate);
      const hourFrac = h + m / 60;
      // Check if an event is already running at this exact half-hour slot
      const coveringEvent = CAL_EVENTS.find(ev => {
        if (ev.date !== dateStr || !ev.startTime) return false;
        const [sh, sm] = ev.startTime.split(':').map(Number);
        const startFrac = sh + sm / 60;
        const endFrac = startFrac + (ev.duration || 60) / 60;
        // Skip the event's own start (its chip handles its own click)
        if (Math.abs(startFrac - hourFrac) < 0.01) return false;
        return hourFrac > startFrac && hourFrac < endFrac;
      });
      if (coveringEvent) {
        showEventModal(coveringEvent, e.clientX, e.clientY);
      } else {
        openQuickCalModal(dateStr, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
      }
    });
  }

  // Week view (delegated via document)
  document.addEventListener('dragover', e => {
    const cell = e.target.closest('.week-cell');
    if (!cell || !_dragTaskId) return;
    e.preventDefault();
    document.querySelectorAll('.week-cell.drop-over').forEach(c => c.classList.remove('drop-over'));
    cell.classList.add('drop-over');
  });
  document.addEventListener('dragleave', e => {
    e.target.closest('.week-cell')?.classList.remove('drop-over');
  });
  document.addEventListener('drop', e => {
    const cell = e.target.closest('.week-cell');
    if (!cell || !_dragTaskId) return;
    e.preventDefault();
    cell.classList.remove('drop-over');
    const h = parseInt(cell.dataset.hour ?? '9');
    openScheduleModal(cell.dataset.date, `${String(h).padStart(2,'0')}:00`, _dragTaskId, _dragSubId);
  });
}

/* ── Quick Calendar Event Creation ───────────────────── */
function openQuickCalModal(date, startTime) {
  const titleEl = document.getElementById('qcal-title');
  if (titleEl) { titleEl.value = ''; }
  const dateEl = document.getElementById('qcal-date');
  if (dateEl) dateEl.value = date;
  const timeEl = document.getElementById('qcal-time');
  if (timeEl) timeEl.value = startTime;
  const allDayEl = document.getElementById('qcal-allday');
  if (allDayEl) { allDayEl.checked = false; }
  document.getElementById('qcal-time-wrap').style.display = '';
  document.getElementById('qcal-dur-wrap').style.display  = '';
  const durEl = document.getElementById('qcal-duration');
  if (durEl) durEl.value = 30;
  const sel = document.getElementById('qcal-category');
  if (sel) {
    sel.innerHTML = '<option value="">No category</option>' + Object.entries(CATEGORIES).map(([k,v]) => `<option value="${escAttr(k)}">${escHtml(v.label)}</option>`).join('');
    if (_settings.defaultCategory) sel.value = _settings.defaultCategory;
  }
  // Commitment link — attaches the created task to a commitment (shows on its page)
  const csel = document.getElementById('qcal-commitment');
  if (csel) {
    const commits = (typeof MILESTONE_PROJECTS !== 'undefined' ? MILESTONE_PROJECTS : [])
      .filter(p => !p.isArchived)
      .sort((a, b) => (b.bigRock ? 1 : 0) - (a.bigRock ? 1 : 0));
    csel.innerHTML = '<option value="">No commitment</option>' +
      commits.map(p => `<option value="${escAttr(p.id)}">${escHtml(p.title || 'Untitled')}</option>`).join('');
  }
  document.getElementById('quick-cal-modal')?.classList.add('open');
  setTimeout(() => titleEl?.focus(), 100);
}

async function confirmQuickCalEvent() {
  const title    = document.getElementById('qcal-title')?.value.trim();
  const date     = document.getElementById('qcal-date')?.value;
  const isAllDay = document.getElementById('qcal-allday')?.checked;
  const startTime= isAllDay ? null : document.getElementById('qcal-time')?.value;
  const duration = isAllDay ? null : (parseInt(document.getElementById('qcal-duration')?.value) || 60);
  const category = document.getElementById('qcal-category')?.value || null;
  const projectId = document.getElementById('qcal-commitment')?.value || null;
  if (!title || !date) { showToast('Please fill in title and date', 'error'); return; }
  if (!isAllDay && !startTime) { showToast('Please fill in start time', 'error'); return; }
  const { addDoc, serverTimestamp } = window.CDX_FB;
  if (!window.CDX_USER?.uid) return;
  try {
    const taskDoc = { title, category, done: false, dueDate: date, createdAt: serverTimestamp() };
    if (projectId) taskDoc.projectId = projectId; // link the task to a commitment
    const taskRef = await addDoc(_uc('tasks'), taskDoc);
    if (isAllDay) {
      await addDoc(_uc('calEvents'), {
        title, date, allDay: true, taskId: taskRef.id, projectId,
        color: getCatColor(category), createdAt: serverTimestamp()
      });
    } else {
      const endTime = addMinutes(startTime, duration);
      await addDoc(_uc('calEvents'), {
        title, date, startTime, endTime, duration, taskId: taskRef.id, projectId,
        color: getCatColor(category), createdAt: serverTimestamp()
      });
    }
    document.getElementById('quick-cal-modal')?.classList.remove('open');
    showToast(projectId ? `Created "${title}" · linked to commitment` : `Created "${title}"`, 'success');
  } catch(e) { showToast('Error creating event', 'error'); console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('qcal-confirm-btn')?.addEventListener('click', confirmQuickCalEvent);
  document.getElementById('qcal-title')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmQuickCalEvent(); });
  // Toggle time/duration fields visibility based on all-day checkbox
  document.getElementById('qcal-allday')?.addEventListener('change', e => {
    const hide = e.target.checked;
    document.getElementById('qcal-time-wrap').style.display = hide ? 'none' : '';
    document.getElementById('qcal-dur-wrap').style.display  = hide ? 'none' : '';
  });
});

/* ── Add-task form ────────────────────────────────────── */
function initAddTaskForm() {
  const input   = document.getElementById('task-add-input');
  const confirm = document.getElementById('task-add-confirm');

  // ── Recurrence state ──
  let _taskRecur = '';
  let _taskRecurDays = new Set();

  function recurLabel(val) {
    if (!val) return 'One-time';
    if (val === 'daily') return 'Daily';
    if (val === 'weekdays') return 'Weekdays';
    if (val === 'weekly') return 'Weekly';
    if (val === 'monthly') return 'Monthly';
    if (val === 'yearly') return 'Yearly';
    if (val.startsWith('custom:')) {
      const days = val.replace('custom:', '');
      return days || 'Custom';
    }
    return val;
  }

  function setRecur(val, skipClose) {
    _taskRecur = val;
    document.getElementById('task-recur-label').textContent = recurLabel(val);
    const recurBtn = document.getElementById('task-recur-btn');
    recurBtn.classList.toggle('active', !!val);
    document.querySelectorAll('#task-recur-popover .task-recur-option').forEach(o => {
      const match = o.dataset.recur === val || (val.startsWith('custom:') && o.dataset.recur === 'custom');
      o.querySelector('.recur-check').textContent = match ? '✓' : '';
      o.classList.toggle('selected', match);
    });
    if (!skipClose) {
      document.getElementById('task-recur-popover').classList.remove('open');
      recurBtn.classList.remove('active');
      if (!!val) recurBtn.classList.add('active');
    }
  }

  function resetRecur() {
    _taskRecur = '';
    _taskRecurDays.clear();
    document.getElementById('task-recur-label').textContent = 'One-time';
    document.getElementById('task-recur-btn').classList.remove('active');
    document.getElementById('task-recur-custom-days').style.display = 'none';
    document.querySelectorAll('#task-recur-popover .task-recur-day-btn').forEach(b => b.classList.remove('on'));
    setRecur('');
  }

  const recurBtn = document.getElementById('task-recur-btn');
  const recurPopover = document.getElementById('task-recur-popover');

  recurBtn.addEventListener('click', e => {
    e.stopPropagation();
    recurPopover.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    if (!recurPopover.contains(e.target) && e.target !== recurBtn) {
      recurPopover.classList.remove('open');
    }
  });

  recurPopover.querySelectorAll('.task-recur-option').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      const val = opt.dataset.recur;
      if (val === 'custom') {
        document.getElementById('task-recur-custom-days').style.display = 'flex';
        setRecur('custom:', true);
        return;
      }
      document.getElementById('task-recur-custom-days').style.display = 'none';
      _taskRecurDays.clear();
      document.querySelectorAll('#task-recur-popover .task-recur-day-btn').forEach(b => b.classList.remove('on'));
      setRecur(val);
    });
  });

  recurPopover.querySelectorAll('.task-recur-day-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      btn.classList.toggle('on');
      if (btn.classList.contains('on')) _taskRecurDays.add(btn.dataset.day);
      else _taskRecurDays.delete(btn.dataset.day);
      const days = [..._taskRecurDays].join(',');
      _taskRecur = days ? `custom:${days}` : 'custom:';
      document.getElementById('task-recur-label').textContent = days || 'Custom';
      recurBtn.classList.toggle('active', !!days);
    });
  });

  // ── @mention people state ──
  let _taskPeople = []; // array of person IDs
  let _mentionQuery = null; // null = not in mention mode; string = current query
  const mentionDropdown = document.getElementById('task-mention-dropdown');
  const peoplePillsRow  = document.getElementById('task-people-pills');

  function renderPeoplePills() {
    if (!_taskPeople.length) { peoplePillsRow.style.display = 'none'; return; }
    peoplePillsRow.style.display = 'flex';
    peoplePillsRow.innerHTML = _taskPeople.map(id => {
      const p = PEOPLE.find(p => p.id === id);
      if (!p) return '';
      return `<span class="task-people-pill" style="background:${p.color}18;border-color:${p.color}44;color:${p.color}">
        <span class="mention-avatar" style="background:${p.color};width:14px;height:14px;font-size:7px">${escHtml(p.initials)}</span>
        @${escHtml(p.name)}
        <button class="pill-remove" data-remove-person="${escAttr(p.id)}" tabindex="-1">✕</button>
      </span>`;
    }).join('');
    peoplePillsRow.querySelectorAll('[data-remove-person]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _taskPeople = _taskPeople.filter(id => id !== btn.dataset.removePerson);
        renderPeoplePills();
      });
    });
  }

  function showMentionDropdown(query) {
    const matches = PEOPLE.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) && !_taskPeople.includes(p.id)
    );
    if (!matches.length) { hideMentionDropdown(); return; }
    mentionDropdown.style.display = 'block';
    mentionDropdown.innerHTML = matches.map((p, i) => `
      <div class="mention-item${i===0?' selected':''}" data-mention-id="${escAttr(p.id)}">
        <div class="mention-avatar" style="background:${p.color}">${escHtml(p.initials)}</div>
        ${escHtml(p.name)}
      </div>`).join('');
    mentionDropdown.querySelectorAll('.mention-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent blur
        selectMentionPerson(item.dataset.mentionId);
      });
    });
  }

  function hideMentionDropdown() {
    mentionDropdown.style.display = 'none';
    _mentionQuery = null;
  }

  function selectMentionPerson(personId) {
    const p = PEOPLE.find(p => p.id === personId);
    if (!p) return;
    if (!_taskPeople.includes(personId)) _taskPeople.push(personId);
    // Remove the @query from the input text
    const val = input.value;
    const cursor = input.selectionStart;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      input.value = val.slice(0, atIdx) + val.slice(cursor);
      input.setSelectionRange(atIdx, atIdx);
    }
    hideMentionDropdown();
    renderPeoplePills();
    input.focus();
  }

  function resetPeople() {
    _taskPeople = [];
    _mentionQuery = null;
    hideMentionDropdown();
    renderPeoplePills();
  }

  input.addEventListener('input', () => {
    const val = input.value;
    const cursor = input.selectionStart;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) {
      _mentionQuery = atMatch[1];
      showMentionDropdown(_mentionQuery);
    } else {
      hideMentionDropdown();
    }
  });

  input.addEventListener('keydown', e => {
    if (mentionDropdown.style.display === 'none') return;
    const items = mentionDropdown.querySelectorAll('.mention-item');
    const selIdx = [...items].findIndex(i => i.classList.contains('selected'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[selIdx]?.classList.remove('selected');
      items[(selIdx + 1) % items.length]?.classList.add('selected');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[selIdx]?.classList.remove('selected');
      items[(selIdx - 1 + items.length) % items.length]?.classList.add('selected');
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const sel = mentionDropdown.querySelector('.mention-item.selected');
      if (sel) { e.preventDefault(); selectMentionPerson(sel.dataset.mentionId); }
    } else if (e.key === 'Escape') {
      hideMentionDropdown();
    }
  });

  input.addEventListener('blur', () => {
    // Delay to allow mousedown on dropdown items to fire first
    setTimeout(hideMentionDropdown, 150);
  });

  // ── Energy type state ──
  let _taskEnergy = '';
  const energyPicker = document.getElementById('task-energy-picker');
  if (energyPicker) {
    energyPicker.querySelectorAll('.energy-pill').forEach(pill => {
      pill.addEventListener('click', e => {
        e.stopPropagation();
        const val = pill.dataset.energy;
        if (_taskEnergy === val) {
          // deselect
          _taskEnergy = '';
          energyPicker.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
        } else {
          _taskEnergy = val;
          energyPicker.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        }
      });
    });
  }

  // ── Submit ──
  async function submit() {
    const title = input.value.trim();
    if (!title) return;
    const priority = document.getElementById('task-add-priority').value;
    const dueDate  = document.getElementById('task-add-date').value;
    const category = document.getElementById('task-add-category').value;
    const recurrence = _taskRecur && _taskRecur !== 'custom:' ? _taskRecur : '';
    await addTask(title, priority, dueDate, category, recurrence, _taskEnergy, [..._taskPeople]);
    input.value = '';
    document.getElementById('task-add-date').value = '';
    const catSel = document.getElementById('task-add-category');
    if (catSel && _settings.defaultCategory) catSel.value = _settings.defaultCategory;
    // Reset energy
    _taskEnergy = '';
    energyPicker?.querySelectorAll('.energy-pill').forEach(p => p.classList.remove('active'));
    resetRecur();
    resetPeople();
    input.focus();
  }
  confirm.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });
}

/* ── Settings ─────────────────────────────────────────── */
/* ── Category Management ──────────────────────────────── */
function saveCategoriesLocal() {
  localStorage.setItem('cdx_categories', JSON.stringify(CATEGORIES));
}

async function saveCategories() {
  saveCategoriesLocal();
  const user = window.CDX_USER;
  if (!user || !window.CDX_FB || !window.CDX_DB) return;
  const { doc, setDoc } = window.CDX_FB;
  try {
    await setDoc(doc(window.CDX_DB, 'users', user.uid, 'config', 'categories'),
      { categories: CATEGORIES }, { merge: false });
  } catch(e) { console.warn('Categories Firestore save failed:', e); }
}

function addCategory(label, color) {
  const key = label.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20) || `cat${Date.now()}`;
  if (CATEGORIES[key]) return; // already exists
  CATEGORIES[key] = { label, color };
  saveCategories();
  renderSettingsCatList();
  renderSettingsCats();
  renderTasks();
  rebuildCategorySelects();
}

async function deleteCategory(key) {
  delete CATEGORIES[key];
  saveCategories();
  // Clear dangling category refs on tasks and milestone projects
  await Promise.all([
    ...TASKS.filter(t => t.category === key).map(t => updateTask(t.id, { category: '' })),
    ...MILESTONE_PROJECTS.filter(p => p.category === key).map(p => updateMilestoneProject(p.id, { category: '' })),
  ]);
  renderSettingsCatList();
  renderSettingsCats();
  renderTasks();
  rebuildCategorySelects();
}

function rebuildCategorySelects() {
  const def = _settings.defaultCategory;
  // Rebuild task-add-category select
  const taskCatSel = document.getElementById('task-add-category');
  if (taskCatSel) {
    const cur = taskCatSel.value || def;
    taskCatSel.innerHTML = Object.entries(CATEGORIES).map(([k,v]) =>
      `<option value="${k}"${k===cur?' selected':''}>${v.label}</option>`
    ).join('');
  }
  // Rebuild ms-proj-category select
  const projCatSel = document.getElementById('ms-proj-category');
  if (projCatSel) {
    const cur = projCatSel.value;
    projCatSel.innerHTML = '<option value="">— None —</option>' +
      Object.entries(CATEGORIES).map(([k,v]) =>
        `<option value="${k}"${k===cur?' selected':''}>${v.label}</option>`
      ).join('');
  }
  // Also refresh the settings default-category select if it's open
  renderSettingsDefaultCat();
}

function renderSettingsCatList() {
  const list = document.getElementById('settings-cat-list');
  if (!list) return;
  list.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="width:14px;height:14px;border-radius:50%;background:${cat.color};flex-shrink:0"></div>
      <span style="flex:1;font-family:var(--font-body);font-size:13px;color:var(--cream)">${escHtml(cat.label)}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);background:var(--elevated);border:1px solid var(--border);border-radius:4px;padding:1px 5px">${escHtml(key)}</span>
      <button class="task-action-btn danger" data-del-cat="${escAttr(key)}" title="Delete">✕</button>
    </div>`).join('');
  list.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(btn.dataset.delCat));
  });
}

function initNewCatColorPicker() {
  const picker = document.getElementById('new-cat-color-picker');
  if (!picker) return;
  picker.innerHTML = CAT_COLOR_PALETTE.map(c => `
    <div style="width:18px;height:18px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===_newCatColor?'var(--cream)':'transparent'};transition:transform 0.15s;box-sizing:border-box"
         data-newcatcolor="${c}"></div>`).join('');
  picker.querySelectorAll('[data-newcatcolor]').forEach(sw => {
    sw.addEventListener('click', () => {
      _newCatColor = sw.dataset.newcatcolor;
      initNewCatColorPicker();
    });
  });
}

function renderSettingsCats() {
  const grid = document.getElementById('settings-cat-filters');
  if (!grid) return;
  grid.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => {
    const active = _settings.visibleCategories.includes(key);
    return `<div class="settings-cat-pill${active ? ' active' : ''}" data-cat="${key}"
      style="border-color:${cat.color}44;${active ? `background:${cat.color}18` : ''}">
      <div class="cat-dot" style="background:${cat.color}"></div>${cat.label}
    </div>`;
  }).join('');
  grid.querySelectorAll('.settings-cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const cat = pill.dataset.cat;
      const idx = _settings.visibleCategories.indexOf(cat);
      if (idx >= 0) _settings.visibleCategories.splice(idx, 1);
      else _settings.visibleCategories.push(cat);
      localStorage.setItem('cdx_v2_settings', JSON.stringify(_settings));
      renderSettingsCats();
      renderTasks();
    });
  });
}

function renderSettingsDefaultCat() {
  const sel = document.getElementById('settings-default-category');
  if (!sel) return;
  const cur = _settings.defaultCategory;
  sel.innerHTML = Object.entries(CATEGORIES).map(([k,v]) =>
    `<option value="${k}"${k===cur?' selected':''}>${v.label}</option>`
  ).join('');
}

function renderSettingsHolidays() {
  const list = document.getElementById('settings-holidays-list');
  if (!list) return;
  // Filter out sentinel docs, sort: public first then personal, each by date (Jan→Dec)
  const entries = Object.values(HOLIDAYS)
    .filter(h => h.name && h.date)
    .sort((a, b) => {
      const aPublic = a.type === 'public' ? 0 : 1;
      const bPublic = b.type === 'public' ? 0 : 1;
      if (aPublic !== bPublic) return aPublic - bPublic;
      return a.date.localeCompare(b.date);
    });
  if (!entries.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:8px 0">Loading holidays…</div>`;
    return;
  }
  list.innerHTML = entries.map(h => `
    <div class="settings-holiday-row">
      <span style="flex:1">${escHtml(h.name)}</span>
      <span class="hol-type${h.type === 'public' ? ' public' : ''}">${h.type || 'personal'}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);white-space:nowrap">${fmtDate(h.date)}</span>
      ${h.type !== 'public' ? `<button class="task-action-btn danger" data-delhol="${escAttr(h.docId)}" title="Delete">✕</button>` : '<span style="width:22px"></span>'}
    </div>`).join('');
  list.querySelectorAll('[data-delhol]').forEach(btn => {
    btn.addEventListener('click', () => deleteHoliday(btn.dataset.delhol));
  });
}

/* ── People Management ────────────────────────────────── */
function renderSettingsPeople() {
  const list = document.getElementById('settings-people-list');
  if (!list) return;
  if (!PEOPLE.length) {
    list.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:8px 0">No people added yet.</div>`;
    return;
  }
  list.innerHTML = PEOPLE.map(p => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="width:26px;height:26px;border-radius:50%;background:${p.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#0d0c0a;flex-shrink:0">${escHtml(p.initials)}</div>
      <span style="flex:1;font-family:var(--font-body);font-size:13px;color:var(--cream)">${escHtml(p.name)}</span>
      <button class="task-action-btn danger" data-del-person="${escAttr(p.id)}" title="Remove">✕</button>
    </div>`).join('');
  list.querySelectorAll('[data-del-person]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.delPerson;
      PEOPLE = PEOPLE.filter(p => p.id !== pid);
      savePeople();
      renderSettingsPeople();
      // Clear dangling person id from any tasks that referenced them
      await Promise.all(TASKS.filter(t => Array.isArray(t.people) && t.people.includes(pid))
        .map(t => updateTask(t.id, { people: t.people.filter(id => id !== pid) })));
    });
  });
}

function initPeopleSettings() {
  document.getElementById('people-add-btn')?.addEventListener('click', addPersonFromInput);
  document.getElementById('people-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addPersonFromInput();
  });
}

function addPersonFromInput() {
  const input = document.getElementById('people-name-input');
  const name = input?.value.trim();
  if (!name) return;
  const initials = name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const color = PEOPLE_COLORS[PEOPLE.length % PEOPLE_COLORS.length];
  PEOPLE.push({ id: crypto.randomUUID(), name, initials, color });
  savePeople();
  renderSettingsPeople();
  if (input) { input.value = ''; input.focus(); }
}

function initSettingsNav() {
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.settings-content-panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const pane = document.getElementById('st-pane-' + item.dataset.settingsTab);
      if (pane) pane.classList.add('active');
    });
  });
}

function initSettingsPanel() {
  initSettingsNav();
  initPeopleSettings();

  document.getElementById('settings-btn')?.addEventListener('click', () => {
    renderSettingsCats();
    renderSettingsHolidays();
    renderSettingsCatList();
    renderSettingsDefaultCat();
    initNewCatColorPicker();
    renderSettingsPeople();
    // Update UID display
    const uid = window.CDX_USER?.uid;
    const uidEl = document.getElementById('settings-uid-display');
    if (uidEl && uid) uidEl.textContent = uid;
    // Sync theme button label
    const themeBtn = document.getElementById('settings-theme-btn');
    if (themeBtn) themeBtn.textContent = document.documentElement.dataset.theme === 'light' ? '☀ Light mode active' : '◐ Dark mode active';
    document.getElementById('settings-overlay').classList.add('open');
  });
  document.getElementById('settings-default-category')?.addEventListener('change', e => {
    _settings.defaultCategory = e.target.value;
    saveSettings();
    rebuildCategorySelects();
  });
  document.getElementById('holiday-add-btn')?.addEventListener('click', async () => {
    const dateEl = document.getElementById('holiday-date');
    const dateEndEl = document.getElementById('holiday-date-end');
    const nameEl = document.getElementById('holiday-name');
    const startDate = dateEl?.value;
    const endDate = dateEndEl?.value;
    const name = nameEl?.value.trim();
    const type = document.getElementById('holiday-type')?.value;
    if (!startDate || !name) { showToast('Please enter both date and name', 'error'); return; }
    try {
      if (endDate && endDate > startDate) {
        // Date range — create a holiday for each day
        const d = new Date(startDate + 'T00:00');
        const end = new Date(endDate + 'T00:00');
        let count = 0;
        while (d <= end && count < 60) { // cap at 60 days
          const ds = localDateStr(d);
          await addHoliday(ds, name, type);
          d.setDate(d.getDate() + 1);
          count++;
        }
        showToast(`${count} holiday days added`, 'success');
      } else {
        await addHoliday(startDate, name, type);
        showToast('Holiday added', 'success');
      }
      if (dateEl) dateEl.value = '';
      if (dateEndEl) dateEndEl.value = '';
      if (nameEl) nameEl.value = '';
    } catch (err) {
      console.error('addHoliday error:', err);
      showToast('Failed to add holiday', 'error');
    }
  });
  // Initialize manage categories section
  renderSettingsCatList();
  initNewCatColorPicker();
  document.getElementById('new-cat-add-btn')?.addEventListener('click', () => {
    const label = document.getElementById('new-cat-label').value.trim();
    if (label) { addCategory(label, _newCatColor); document.getElementById('new-cat-label').value = ''; }
  });
}

/* ── Cosmodex Orb ──────────────────────────────────────── */
const orb         = document.getElementById('cosmodex-orb');
const orbClose    = document.getElementById('orb-close');
const orbBackdrop = document.getElementById('orb-backdrop');
const orbDisplay  = document.getElementById('orb-time-display');
const orbHeader   = document.getElementById('orb-header');

function openOrb() {
  orb.style.display = 'block';
  orb.classList.add('expanded');
  orbClose.classList.add('visible');
  orbBackdrop.classList.add('visible');
  orbDisplay.classList.add('visible');
  orbHeader.classList.add('visible');
  // Continuously redraw canvas during the CSS transition (~480ms) to avoid blurry scaling
  const start = Date.now();
  (function animRedraw() {
    drawCosmodex();
    if (Date.now() - start < 550) requestAnimationFrame(animRedraw);
  })();
}

function closeOrb() {
  orb.classList.remove('expanded');
  orbClose.classList.remove('visible');
  orbBackdrop.classList.remove('visible');
  orbDisplay.classList.remove('visible');
  orbHeader.classList.remove('visible');
  orb.style.display = 'none'; drawCosmodex();
}

orb.addEventListener('click', e => {
  if (!orb.classList.contains('expanded')) { openOrb(); return; }
  // When expanded: ignore clicks that hit UI children (header, footer, close)
  // With pointer-events:none on canvas, direct canvas-area clicks land on orb itself
  if (e.target !== orb) return;
  // Petal click — detect which hour
  if (!_orbGeometry) return;
  const rect = orb.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const { cx, cy, innerR, eventR } = _orbGeometry;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= innerR * 0.85 && dist <= eventR + 28) {
    const angle = Math.atan2(dy, dx);
    const hour = Math.floor(((angle + Math.PI / 2) / (Math.PI * 2) * 24 + 24) % 24);
    openOrbAddTaskModal(hour);
  }
});
orbClose.addEventListener('click', e => { e.stopPropagation(); closeOrb(); });
orbBackdrop.addEventListener('click', closeOrb);

/* ── Radial chronodex canvas draw ─────────────────────── */

// Core drawing — pure canvas ops, no DOM side effects. Returns { cx, cy, maxR }.
function _cosmodexDrawCore(ctx, W, H, expanded, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = expanded ? H / 2 - 10 : H / 2;
  const maxR = expanded
    ? Math.min(W * 0.46, (H - 230) / 2)
    : Math.min(W, H) / 2 * 0.93;
  const innerR = maxR * (expanded ? 0.14 : 0.175);
  const baseR  = maxR * (expanded ? 0.52 : 0.65);
  const eventR = maxR * (expanded ? 0.70 : 0.72);

  const now    = new Date(Date.now() + (window._orbTimeOffset || 0)); // Bubble drag preview
  const today  = localDateStr(now);
  const curH   = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const TWO_PI = Math.PI * 2;
  const GAP    = (TWO_PI / 24) * 0.06;

  // Subtle outer ring guide
  ctx.beginPath();
  ctx.arc(cx, cy, eventR + (expanded ? 3 : 1), 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = expanded ? 1 : 0.5;
  ctx.stroke();

  for (let h = 0; h < 24; h++) {
    const a0 = (h / 24)       * TWO_PI - Math.PI / 2 + GAP;
    const a1 = ((h + 1) / 24) * TWO_PI - Math.PI / 2 - GAP;

    const evs  = CAL_EVENTS.filter(ev => {
      if (ev.date !== today || !ev.startTime) return false;
      const [eh, em] = ev.startTime.split(':').map(Number);
      const startFrac = eh + em / 60;
      const endFrac = startFrac + (ev.duration || 60) / 60;
      return h >= Math.floor(startFrac) && h < Math.ceil(endFrac);
    });
    const hasEv  = evs.length > 0;
    const isCur  = Math.floor(curH) === h;
    const isPast = h < Math.floor(curH);

    const isNight = h < 5 || h >= 23;
    const isRest  = h >= 5 && h < 7;
    const isEve   = h >= 20 && h < 23;

    const segR = hasEv ? eventR : baseR;

    let fill;
    if (hasEv) {
      const t = TASKS.find(t => t.id === evs[0].taskId);
      fill = getCatColor(t?.category) + (expanded ? 'cc' : 'bb');
    } else if (isCur) {
      fill = 'rgba(255,255,255,0.28)';
    } else if (isPast) {
      fill = isNight ? 'rgba(60,60,80,0.07)' : 'rgba(255,255,255,0.07)';
    } else {
      if (isNight)      fill = 'rgba(60,60,80,0.05)';
      else if (isRest)  fill = 'rgba(180,100,40,0.09)';
      else if (isEve)   fill = 'rgba(60,90,70,0.07)';
      else              fill = 'rgba(232,224,208,0.04)';
    }

    ctx.beginPath();
    ctx.arc(cx, cy, innerR, a0, a1);
    ctx.arc(cx, cy, segR,   a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    if (hasEv) {
      const t = TASKS.find(t => t.id === evs[0].taskId);
      ctx.strokeStyle = getCatColor(t?.category) + '55';
      ctx.lineWidth   = 0.6;
      ctx.stroke();
    }

    if (isCur && !hasEv) {
      const frac = curH - Math.floor(curH);
      const aElapsed = a0 + (a1 - a0) * frac;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, a0, aElapsed);
      ctx.arc(cx, cy, baseR,  aElapsed, a0, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
    }

    if (expanded) {
      const boundA = (h / 24) * TWO_PI - Math.PI / 2;
      const isQuarter = h % 6 === 0;
      const dotRad = isQuarter ? 2 : (h % 3 === 0 ? 1.4 : 0.8);
      const dotDist = eventR + (isQuarter ? 7 : 5);
      ctx.beginPath();
      ctx.arc(cx + dotDist * Math.cos(boundA), cy + dotDist * Math.sin(boundA), dotRad, 0, TWO_PI);
      ctx.fillStyle = isQuarter ? 'rgba(255,255,255,0.6)' : (h % 3 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)');
      ctx.fill();
    }

    if (expanded && h % 3 === 0) {
      const boundA = (h / 24) * TWO_PI - Math.PI / 2;
      const labelDist = eventR + (h % 6 === 0 ? 22 : 19);
      ctx.fillStyle = isCur ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
      ctx.font = `${h % 6 === 0 ? 14 : 11}px "DM Mono", monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(h), cx + labelDist * Math.cos(boundA), cy + labelDist * Math.sin(boundA));
    }

    if (hasEv && evs[0].title && segR > baseR) {
      const midA   = ((h + 0.5) / 24) * TWO_PI - Math.PI / 2;
      const isLeft = Math.cos(midA) < 0;
      const startDist = isLeft ? eventR - 2 : innerR + 2;
      const sx = cx + startDist * Math.cos(midA);
      const sy = cy + startDist * Math.sin(midA);
      const maxPx = eventR - innerR - 4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(isLeft ? midA + Math.PI : midA);
      ctx.fillStyle = 'rgba(232,224,208,0.95)';
      ctx.font = `${expanded ? 8 : 6}px "DM Mono", monospace`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(evs[0].title, 0, 0, maxPx);
      ctx.restore();
    }
  }

  // Red current-time needle
  const tAngle = (curH / 24) * TWO_PI - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx + (innerR + 2) * Math.cos(tAngle), cy + (innerR + 2) * Math.sin(tAngle));
  ctx.lineTo(cx + (eventR + 5) * Math.cos(tAngle), cy + (eventR + 5) * Math.sin(tAngle));
  ctx.strokeStyle = '#e05550';
  ctx.lineWidth   = expanded ? 2 : 1.5;
  ctx.lineCap     = 'round';
  ctx.stroke();

  if (expanded) {
    ctx.beginPath();
    ctx.arc(cx + (eventR + 5) * Math.cos(tAngle), cy + (eventR + 5) * Math.sin(tAngle), 2.5, 0, TWO_PI);
    ctx.fillStyle = '#e05550';
    ctx.fill();
  }

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 1, 0, TWO_PI);
  ctx.fillStyle = '#070707';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  if (!expanded) {
    const hh2 = String(now.getHours()).padStart(2, '0');
    const mm2 = String(now.getMinutes()).padStart(2, '0');
    const fontSize = Math.max(8, Math.round(innerR * 0.72));
    ctx.fillStyle    = 'rgba(255,255,255,0.88)';
    ctx.font         = `bold ${fontSize}px "DM Mono", monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hh2}:${mm2}`, cx, cy);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }

  return { cx, cy, maxR };
}

function drawCosmodex() {
  if (document.hidden) return;            // perf: don't redraw the 1Hz orb while the tab is hidden
  const canvas = document.getElementById('cosmodex-canvas');
  if (!canvas) return;

  const expanded = orb.classList.contains('expanded');
  const dpr = window.devicePixelRatio || 1;
  const W = orb.offsetWidth, H = orb.offsetHeight;
  if (W < 4) return;

  // Only resize canvas backing store when dimensions actually change (avoids costly clears)
  if (canvas.dataset.cw !== String(W) || canvas.dataset.ch !== String(H)) {
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    canvas.dataset.cw = String(W); canvas.dataset.ch = String(H);
  }

  const geo = _cosmodexDrawCore(canvas.getContext('2d'), W, H, expanded, dpr);

  // Store geometry for petal click detection
  if (expanded) {
    _orbGeometry = { cx: geo.cx, cy: geo.cy, innerR: geo.maxR * 0.14, eventR: geo.maxR * 0.70 };
  } else {
    _orbGeometry = null;
  }

  const now = new Date(Date.now() + (window._orbTimeOffset || 0));
  const today = localDateStr(now);

  // Update date line in orb header
  if (expanded) {
    const dateLine = document.getElementById('orb-date-line');
    if (dateLine) {
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      dateLine.textContent = `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
    const hh2 = String(now.getHours()).padStart(2, '0');
    const mm2 = String(now.getMinutes()).padStart(2, '0');
    const ss2 = String(now.getSeconds()).padStart(2, '0');
    const clockEl = document.getElementById('orb-clock');
    if (clockEl) clockEl.textContent = `${hh2}:${mm2}:${ss2}`;

    const nowMins = now.getHours() * 60 + now.getMinutes();
    const upcoming = CAL_EVENTS
      .filter(ev => ev.date === today && ev.startTime)
      .map(ev => { const [eh, em] = ev.startTime.split(':').map(Number); return { ...ev, evMins: eh * 60 + em }; })
      .filter(ev => ev.evMins > nowMins)
      .sort((a, b) => a.evMins - b.evMins);

    const nextEl = document.getElementById('orb-next-event');
    const nextLabelEl = document.querySelector('.orb-next-label');
    if (nextEl) {
      if (upcoming.length === 0) {
        if (nextLabelEl) nextLabelEl.textContent = 'Schedule';
        nextEl.textContent = 'nothing planned. a perfectly empty orbit — suspicious.';
      } else {
        if (nextLabelEl) nextLabelEl.textContent = 'Next';
        const next = upcoming[0];
        const diff = next.evMins - nowMins;
        const timeStr = diff <= 0 ? 'Now' : diff < 60 ? `In ${diff}m` : (() => { const dh = Math.floor(diff/60), dm = diff%60; return dm > 0 ? `In ${dh}h ${dm}m` : `In ${dh}h`; })();
        nextEl.innerHTML = `${timeStr}&thinsp;·&thinsp;<em>${escHtml(next.title)}</em>&thinsp;<span style="color:var(--muted);font-size:0.85em">${next.startTime}</span>`;
      }
    }
  }

  // Also draw to pomo canvas if focus overlay is open
  const pomoCanvas = document.getElementById('pomo-cosmo-canvas');
  if (pomoCanvas && document.getElementById('pomo-overlay')?.classList.contains('open')) {
    const pW = pomoCanvas.offsetWidth, pH = pomoCanvas.offsetHeight;
    if (pW > 4) {
      pomoCanvas.width = pW * dpr; pomoCanvas.height = pH * dpr;
      pomoCanvas.style.width = pW + 'px'; pomoCanvas.style.height = pH + 'px';
      _cosmodexDrawCore(pomoCanvas.getContext('2d'), pW, pH, true, dpr);

      // Update pomo cosmo info strip
      const hh2 = String(now.getHours()).padStart(2, '0');
      const mm2 = String(now.getMinutes()).padStart(2, '0');
      const ss2 = String(now.getSeconds()).padStart(2, '0');
      const clockEl = document.getElementById('pomo-cosmo-clock');
      const dateEl  = document.getElementById('pomo-cosmo-date');
      if (clockEl) clockEl.textContent = `${hh2}:${mm2}:${ss2}`;
      if (dateEl) {
        const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        dateEl.textContent = `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]}`;
      }
      const nowMins2 = now.getHours() * 60 + now.getMinutes();
      const upcoming2 = CAL_EVENTS
        .filter(ev => ev.date === today && ev.startTime)
        .map(ev => { const [eh, em] = ev.startTime.split(':').map(Number); return { ...ev, evMins: eh * 60 + em }; })
        .filter(ev => ev.evMins > nowMins2)
        .sort((a, b) => a.evMins - b.evMins);
      const nextEl2 = document.getElementById('pomo-cosmo-next');
      const nextLabelEl2 = document.getElementById('pomo-cosmo-next-label');
      if (nextEl2) {
        if (upcoming2.length === 0) {
          if (nextLabelEl2) nextLabelEl2.textContent = 'Schedule';
          nextEl2.textContent = 'nothing planned. a perfectly empty orbit — suspicious.';
        } else {
          if (nextLabelEl2) nextLabelEl2.textContent = 'Next';
          const next2 = upcoming2[0];
          const diff2 = next2.evMins - nowMins2;
          const ts2 = diff2 <= 0 ? 'Now' : diff2 < 60 ? `In ${diff2}m` : (() => { const dh=Math.floor(diff2/60),dm=diff2%60; return dm>0?`In ${dh}h ${dm}m`:`In ${dh}h`; })();
          nextEl2.innerHTML = `${ts2}&thinsp;·&thinsp;<em>${escHtml(next2.title)}</em>&thinsp;<span style="color:var(--muted);font-size:0.85em">${next2.startTime}</span>`;
        }
      }
    }
  }
}

// Tick every second (drives both mini and expanded states)
_cosmodexInterval = setInterval(drawCosmodex, 1000);
drawCosmodex(); // immediate first draw

/* ── Entropy — the rail-side dice (choice-overload breaker) ── */
function rollEntropy() {
  const btn = document.getElementById('task-entropy-btn');
  if (!btn || btn.dataset.rolling === '1') return;
  let pool = TASKS.filter(t => !t.done && (t.energyType === 'shallow' || t.energyType === 'admin'));
  if (pool.length === 0) pool = TASKS.filter(t => !t.done);
  if (pool.length === 0) { showToast('nothing left to roll. the void approves.', 'info'); return; }

  btn.dataset.rolling = '1';
  btn.classList.add('rolling');
  let frame = 0;
  const ticker = setInterval(() => {
    btn.textContent = DICE_FACES[frame % 6];
    frame++;
    if (frame >= 14) {
      clearInterval(ticker);
      btn.classList.remove('rolling');
      btn.dataset.rolling = '0';
      const picked = pool[Math.floor(Math.random() * pool.length)];
      btn.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
      const row = document.querySelector(`#tasks-body .task-row[data-task-id="${(window.CSS && CSS.escape) ? CSS.escape(picked.id) : picked.id}"]`);
      if (row) {
        _kbSelect(row);
        row.classList.remove('entropy-hit');
        void row.offsetWidth;
        row.classList.add('entropy-hit');
      }
      const short = picked.title.length > 34 ? picked.title.slice(0, 34) + '…' : picked.title;
      showToast(`the universe has spoken: ${short}`, 'info', 4000);
    }
  }, 55);
}
document.getElementById('task-entropy-btn')?.addEventListener('click', rollEntropy);

/* ── Dice Gadget ───────────────────────────────────────── */
const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

function rollDice() {
  const btn = document.getElementById('orb-dice-btn');
  if (!btn || btn.dataset.rolling === '1') return;

  // Pick from shallow/admin energy tasks only (undone)
  let pool = TASKS.filter(t => !t.done && (t.energyType === 'shallow' || t.energyType === 'admin'));
  if (pool.length === 0) pool = TASKS.filter(t => !t.done); // fallback to all undone
  if (pool.length === 0) {
    btn.textContent = '⚀';
    btn.title = 'No tasks to roll!';
    return;
  }

  btn.dataset.rolling = '1';
  btn.classList.add('rolling');

  let frame = 0;
  const total = 16;
  const ticker = setInterval(() => {
    btn.textContent = DICE_FACES[frame % 6];
    frame++;
    if (frame >= total) {
      clearInterval(ticker);
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const face = DICE_FACES[Math.floor(Math.random() * 6)];
      btn.textContent = face;
      btn.title = picked.title;
      btn.classList.remove('rolling');
      btn.dataset.rolling = '0';

      // Show result in next-event display
      const nextEl = document.getElementById('orb-next-event');
      const nextLabelEl = document.querySelector('.orb-next-label');
      if (nextEl) {
        if (nextLabelEl) nextLabelEl.textContent = 'Rolled';
        nextEl.innerHTML = `${face}&thinsp;<em>${escHtml(picked.title)}</em>`;
        setTimeout(() => { if (nextLabelEl) nextLabelEl.textContent = 'Next'; }, 5000);
      }
    }
  }, 55);
}

document.getElementById('orb-dice-btn')?.addEventListener('click', rollDice);

/* ── Spinning Wheel Gadget ────────────────────────────── */
let wheelAngle   = 0;
let wheelVelocity = 0;
let wheelSpinning = false;
let wheelTasks    = [];

function drawWheel(canvas, angle) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const r  = Math.min(W, H) / 2 - 6;
  ctx.clearRect(0, 0, W, H);

  const n = wheelTasks.length;
  if (n === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '13px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No tasks', cx, cy);
    return;
  }

  const slice = (Math.PI * 2) / n;
  const WHEEL_COLORS = [
    '#c9a227','#6b9fd4','#4a7c5e','#c45c2a','#8a6bbf','#2a8a7c','#bf6b8a','#a27c4a'
  ];

  for (let i = 0; i < n; i++) {
    const a0 = angle + i * slice;
    const a1 = a0 + slice;

    // Slice fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length] + '33';
    ctx.fill();
    ctx.strokeStyle = WHEEL_COLORS[i % WHEEL_COLORS.length] + '88';
    ctx.lineWidth = 1;
    ctx.stroke();

    // No text labels inside slices — winner shown below wheel
  }

  // Pointer triangle on the right
  ctx.beginPath();
  ctx.moveTo(cx + r + 6, cy);
  ctx.lineTo(cx + r + 14, cy - 7);
  ctx.lineTo(cx + r + 14, cy + 7);
  ctx.closePath();
  ctx.fillStyle = '#e05550';
  ctx.fill();

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#0e0e0e';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function openWheelOverlay() {
  wheelTasks = TASKS.filter(t => !t.done).slice(0, 8);
  const overlay = document.getElementById('orb-wheel-overlay');
  const canvas  = document.getElementById('orb-wheel-canvas');
  const resultEl = document.getElementById('orb-wheel-result');
  if (!overlay || !canvas) return;
  resultEl.textContent = '';
  document.getElementById('orb-wheel-spin').disabled = false;
  overlay.classList.add('visible');
  drawWheel(canvas, wheelAngle);
}

function spinWheel() {
  if (wheelSpinning) return;
  const canvas  = document.getElementById('orb-wheel-canvas');
  const resultEl = document.getElementById('orb-wheel-result');
  const spinBtn  = document.getElementById('orb-wheel-spin');
  if (!canvas) return;

  wheelSpinning = true;
  spinBtn.disabled = true;
  resultEl.textContent = '';
  wheelVelocity = 0.18 + Math.random() * 0.22; // random starting velocity

  function tick() {
    wheelAngle    += wheelVelocity;
    wheelVelocity *= 0.978; // decelerate
    drawWheel(canvas, wheelAngle);

    if (wheelVelocity > 0.003) {
      requestAnimationFrame(tick);
    } else {
      wheelSpinning = false;
      spinBtn.disabled = false;

      // Determine winner: pointer is at angle 0 (right side = 3 o'clock)
      // Normalize angle so 0 = top (pointer at right means offset by -PI/2)
      const n = wheelTasks.length;
      if (n === 0) return;
      const slice = (Math.PI * 2) / n;
      // pointer is on the RIGHT side, so we find which slice is at angle 0
      const norm = ((-wheelAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const winIdx = Math.floor(norm / slice) % n;
      const winner = wheelTasks[winIdx];
      resultEl.innerHTML = `<em>${escHtml(winner.title)}</em>`;
    }
  }
  requestAnimationFrame(tick);
}

document.getElementById('orb-wheel-btn')?.addEventListener('click', openWheelOverlay);
document.getElementById('orb-wheel-spin')?.addEventListener('click', spinWheel);
document.getElementById('orb-wheel-close')?.addEventListener('click', () => {
  document.getElementById('orb-wheel-overlay')?.classList.remove('visible');
});

/* ── Overlay system ────────────────────────────────────── */
/* ── Focus-trap utility for overlays ──
   Keeps Tab/Shift-Tab inside an open overlay and restores focus to the
   previously-focused element when the overlay closes. Ensures accessibility
   within the "Liquid Glass" spatial UI so tab doesn't leak into the blurred
   background. */
const _focusTrapState = new WeakMap(); // overlayEl -> { handler, prevActive }
const _focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function _getFocusable(el) {
  return Array.from(el.querySelectorAll(_focusableSelector)).filter(n => {
    if (n.offsetParent === null && getComputedStyle(n).position !== 'fixed') return false;
    return n.tabIndex !== -1;
  });
}

function _attachFocusTrap(overlayEl) {
  if (!overlayEl || _focusTrapState.has(overlayEl)) return;
  const prevActive = document.activeElement;
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    if (!overlayEl.classList.contains('open')) return;
    const focusable = _getFocusable(overlayEl);
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const active = document.activeElement;
    // If focus is outside the overlay, pull it back to the first focusable
    if (!overlayEl.contains(active)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', handler, true);
  _focusTrapState.set(overlayEl, { handler, prevActive });
  // Focus first focusable element after open animation
  setTimeout(() => {
    const focusable = _getFocusable(overlayEl);
    if (focusable.length) focusable[0].focus();
  }, 60);
}

function _detachFocusTrap(overlayEl) {
  if (!overlayEl) return;
  const state = _focusTrapState.get(overlayEl);
  if (!state) return;
  document.removeEventListener('keydown', state.handler, true);
  _focusTrapState.delete(overlayEl);
  // Restore focus to whatever was focused before the overlay opened
  if (state.prevActive && typeof state.prevActive.focus === 'function' && document.contains(state.prevActive)) {
    try { state.prevActive.focus(); } catch {}
  }
}

function openOverlay(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    _attachFocusTrap(el);
  }
  if (id === 'notes-overlay') initNotesCanvas();
  if (id === 'pomo-overlay') window.initPomoOverlay?.();
}

function closeOverlay(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    _detachFocusTrap(el);
  }
}

// MutationObserver: watch every .overlay element for .open class toggles so
// the focus trap attaches/detaches even when code bypasses openOverlay()
// (many call sites use classList.add('open') directly).
(function _observeOverlays() {
  const observe = (el) => {
    const mo = new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.attributeName !== 'class') return;
        const isOpen = el.classList.contains('open');
        const hasTrap = _focusTrapState.has(el);
        if (isOpen && !hasTrap) _attachFocusTrap(el);
        else if (!isOpen && hasTrap) _detachFocusTrap(el);
      });
    });
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
  };
  const attachAll = () => {
    document.querySelectorAll('.overlay').forEach(observe);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAll, { once: true });
  } else {
    attachAll();
  }
  // Also catch overlays added later via dynamic DOM
  const bodyObserver = new MutationObserver(muts => {
    muts.forEach(m => {
      m.addedNodes?.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.classList?.contains('overlay')) observe(n);
        n.querySelectorAll?.('.overlay').forEach(observe);
      });
    });
  });
  const startBody = () => bodyObserver.observe(document.body, { childList: true, subtree: true });
  if (document.body) startBody();
  else document.addEventListener('DOMContentLoaded', startBody, { once: true });
})();

// Delegated handlers for [data-close] buttons and overlay click-outside — covers
// elements inserted after script execution (e.g. #quick-cal-modal at end of body)
//
// Close-outside uses mousedown-origin tracking to avoid false closes when users
// click inside an input (especially number-input spinner arrows, which can fire
// click events with unexpected targets in some browsers).
// Focus / Commit are deliberate "locked" modes: while one is open, the outside
// world cannot be interacted with (the full-screen backdrop already blocks it)
// AND a click on the backdrop or Escape must NOT dismiss it — the user has to
// exit explicitly via the overlay's own controls.
const LOCKED_OVERLAYS = new Set(['pomo-overlay', 'commit-overlay']);

let _overlayMousedownInsidePanel = false;
document.addEventListener('mousedown', e => {
  _overlayMousedownInsidePanel = !!e.target.closest?.('.overlay-panel, #td-pomo-float');
}, true);

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-close]');
  if (btn) {
    closeOverlay(btn.dataset.close); return;
  }
  // Don't close on modifier+click (e.g. Ctrl+click for text selection)
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }
  // If the click started inside a panel, never close (protects inputs, spinners, text selection)
  if (_overlayMousedownInsidePanel) {
    _overlayMousedownInsidePanel = false;
    return;
  }
  // Only close if the click target is an open overlay itself AND not inside its panel
  const overlay = e.target.closest?.('.overlay.open');
  if (overlay && !e.target.closest('.overlay-panel, #td-pomo-float')) {
    if (LOCKED_OVERLAYS.has(overlay.id)) return; // focus/commit mode — no click-outside dismiss
    if (overlay.id === 'pomo-overlay') {
      document.getElementById('pomo-close')?.click();
    } else {
      closeOverlay(overlay.id);
    }
  }
});

// Header action buttons
document.getElementById('btn-notes')?.addEventListener('click', () => openOverlay('notes-overlay'));
document.getElementById('btn-focus')?.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('btn-focus')?.classList.add('active');
  showMainPanel('focus');
});
document.getElementById('btn-cosmodex-bubble')?.addEventListener('click', () => openOrb());
document.getElementById('btn-cosmos')?.addEventListener('click', () => openOverlay('claude-panel'));

// Nav footer overlays
document.getElementById('cmd-btn')?.addEventListener('click', openCmdPalette);

/* ── Command Palette ──────────────────────────────────── */
const CMD_COMMANDS_BASE = [
  { label: 'Today',            icon: '◈', action: () => {}, keys: '' },
  { label: 'Open Calendar',    icon: '◻', action: () => {}, keys: '' },
  { label: 'New Task',         icon: '+', action: () => {}, keys: 'N' },
  { label: 'Focus — Timedrift', icon: '◎', action: () => { showMainPanel('timedrift'); document.getElementById('left-nav')?.classList.add('collapsed'); }, keys: 'F' },
  { label: 'Open Notes',       icon: '✎', action: () => openOverlay('notes-overlay'), keys: '' },
  { label: 'Ask Cosmos',       icon: '✦', action: () => openOverlay('claude-panel'), keys: '' },
  { label: 'Insights',         icon: '◈', action: () => showMainPanel('insights'), keys: '' },
  { label: 'Habits',           icon: '◎', action: () => showMainPanel('habits'), keys: '' },
  { label: 'Lists',            icon: '▤', action: () => showMainPanel('lists'), keys: '' },
  { label: 'Planning',         icon: '◉', action: () => showMainPanel('milestones'), keys: '' },
  { label: 'Toggle Theme',     icon: '◑', action: toggleTheme, keys: '' },
  { label: 'Zen Mode',         icon: '◎', action: () => document.getElementById('left-nav').classList.toggle('collapsed'), keys: '' },
  { label: 'Add Shallow Task', icon: '💬', action: async () => {
    const title = prompt('Shallow task title:');
    if (!title?.trim()) return;
    await addTask(title.trim(), 'med', '', _settings.defaultCategory || '', '', 'shallow', []);
  }, keys: '' },
];

function getCmdCommands() {
  const personCmds = PEOPLE.map(p => ({
    label: `@${p.name} — tasks`,
    icon: '◎',
    action: () => showPersonTasks(p),
    keys: '',
    _personColor: p.color,
    _personInitials: p.initials,
  }));
  const initiativeCmds = MILESTONE_PROJECTS.filter(p => !p.isArchived).map(proj => ({
    label: `◉ ${proj.title} — tasks`,
    icon: '◉',
    action: () => showInitiativeTasks(proj),
    keys: '',
    _projColor: proj.color,
  }));
  return [...CMD_COMMANDS_BASE, ...personCmds, ...initiativeCmds];
}

function showInitiativeTasks(proj) {
  // Sort milestone events by date (calendar order)
  const linkedEvents = MILESTONE_EVENTS
    .filter(e => e.projectId === proj.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const titleEl = document.getElementById('person-tasks-title');
  const listEl  = document.getElementById('person-tasks-list');
  if (titleEl) {
    titleEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px">
      <span style="width:20px;height:20px;border-radius:6px;background:${proj.color};display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#0d0c0a">◉</span>
      Tasks in ${escHtml(proj.title)}
    </span>`;
  }
  if (listEl) {
    const renderTask = t => {
      const cat = t.category ? CATEGORIES[t.category] : null;
      const catBadge = cat ? `<span style="font-family:var(--font-mono);font-size:10px;padding:1px 5px;border-radius:100px;background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.label}</span>` : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 16px 9px 28px;border-bottom:1px solid var(--border)">
        <div style="width:14px;height:14px;border-radius:4px;border:1.5px solid ${t.done?'var(--neon)':'var(--border)'};background:${t.done?'var(--neon)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:var(--ink)">${t.done?'✓':''}</div>
        <span style="flex:1;font-size:13px;color:${t.done?'var(--muted)':'var(--cream)'};${t.done?'text-decoration:line-through':''}">${escHtml(t.title)}</span>
        ${catBadge}
        ${t.dueDate ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${fmtDate(t.dueDate)}</span>` : ''}
      </div>`;
    };

    let html = '';
    let totalTasks = 0;
    linkedEvents.forEach(ev => {
      const evTaskIds = (ev.activities || []).filter(a => a.taskId).map(a => a.taskId);
      const evTasks = TASKS.filter(t => evTaskIds.includes(t.id));
      if (!evTasks.length) return;
      totalTasks += evTasks.length;
      const dateLabel = ev.date ? fmtDate(ev.date) : '';
      html += `<div style="display:flex;align-items:center;gap:8px;padding:10px 16px 7px;border-bottom:1px solid var(--border);background:var(--elevated);position:sticky;top:0;z-index:1">
        <span style="width:7px;height:7px;border-radius:50%;background:${proj.color};flex-shrink:0"></span>
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.06em;color:var(--cream);font-weight:500;flex:1">${escHtml(ev.title || 'Milestone')}</span>
        ${dateLabel ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${dateLabel}</span>` : ''}
      </div>`;
      evTasks.forEach(t => { html += renderTask(t); });
    });

    if (!totalTasks) {
      html = `<div style="padding:20px 16px;font-size:13px;color:var(--muted)">No tasks linked to <strong>${escHtml(proj.title)}</strong> yet. Link tasks via milestone activities in Life OS.</div>`;
    }
    listEl.innerHTML = html;
  }
  document.getElementById('person-tasks-overlay').classList.add('open');
}

function showPersonTasks(person) {
  const tasks = TASKS.filter(t => t.people && t.people.includes(person.id));
  const titleEl = document.getElementById('person-tasks-title');
  const listEl  = document.getElementById('person-tasks-list');
  if (titleEl) {
    titleEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px">
      <span style="width:20px;height:20px;border-radius:50%;background:${person.color};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#0d0c0a">${escHtml(person.initials)}</span>
      Tasks linked to @${escHtml(person.name)}
    </span>`;
  }
  if (listEl) {
    if (!tasks.length) {
      listEl.innerHTML = `<div style="padding:20px 16px;font-size:13px;color:var(--muted)">No tasks linked to @${escHtml(person.name)} yet.</div>`;
    } else {
      const open = tasks.filter(t => !t.done);
      const done = tasks.filter(t => t.done);
      const renderGroup = (arr, label) => arr.length ? `
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);padding:10px 16px 4px">${label}</div>
        ${arr.map(t => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid var(--border)">
            <div style="width:14px;height:14px;border-radius:4px;border:1.5px solid ${t.done?'var(--neon)':'var(--border)'};background:${t.done?'var(--neon)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:var(--ink)">${t.done?'✓':''}</div>
            <span style="flex:1;font-size:13px;color:${t.done?'var(--muted)':'var(--cream)'};${t.done?'text-decoration:line-through':''}">${escHtml(t.title)}</span>
            ${t.dueDate ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${fmtDate(t.dueDate)}</span>` : ''}
          </div>`).join('')}` : '';
      listEl.innerHTML = renderGroup(open, 'Open') + renderGroup(done, 'Done');
    }
  }
  document.getElementById('person-tasks-overlay').classList.add('open');
}

function openCmdPalette() {
  const pal = document.getElementById('cmd-palette');
  pal.classList.add('open');
  setTimeout(() => document.getElementById('cmd-input')?.focus(), 50);
  renderCmdResults('');
}

function closeCmdPalette() {
  document.getElementById('cmd-palette').classList.remove('open');
  document.getElementById('cmd-input').value = '';
}

function renderCmdResults(query) {
  const container = document.getElementById('cmd-results');
  const commands = getCmdCommands();
  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );
  if (!filtered.length) {
    container.innerHTML = `<div class="cmd-empty">the cosmos found nothing. try fewer letters.</div>`;
    return;
  }
  container.innerHTML = filtered.map((c, i) => `
    <div class="cmd-result-item ${i===0?'selected':''}" data-cmd="${i}">
      ${c._personColor
        ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:${c._personColor};font-size:7px;font-weight:600;color:#0d0c0a;flex-shrink:0">${escHtml(c._personInitials)}</span>`
        : c._projColor
          ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:${c._projColor};font-size:10px;color:#0d0c0a;flex-shrink:0">◉</span>`
          : `<span class="cmd-result-icon">${c.icon}</span>`}
      ${escHtml(c.label)}
      ${c.keys ? `<span class="cmd-result-keys">${c.keys}</span>` : ''}
    </div>`).join('');

  container.querySelectorAll('.cmd-result-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      filtered[idx].action();
      closeCmdPalette();
    });
  });
}

document.getElementById('cmd-input')?.addEventListener('input', e => {
  renderCmdResults(e.target.value);
});

document.getElementById('cmd-input')?.addEventListener('keydown', e => {
  const items = document.querySelectorAll('#cmd-results .cmd-result-item');
  if (!items.length) return;
  const selIdx = [...items].findIndex(i => i.classList.contains('selected'));
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[selIdx]?.classList.remove('selected');
    const next = items[(selIdx + 1) % items.length];
    next?.classList.add('selected');
    next?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[selIdx]?.classList.remove('selected');
    const prev = items[(selIdx - 1 + items.length) % items.length];
    prev?.classList.add('selected');
    prev?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const sel = document.querySelector('#cmd-results .cmd-result-item.selected');
    if (sel) sel.click();
  }
});

document.getElementById('cmd-palette')?.addEventListener('click', e => {
  if (e.target.id === 'cmd-palette') closeCmdPalette();
});

/* ── Keyboard shortcuts ────────────────────────────────── */

/* Task-rail selection (j/k/x/s) */
let _kbSelTaskId = null;

function _kbVisibleRows() {
  return [...document.querySelectorAll('#tasks-body .task-row')]
    .filter(r => r.offsetParent !== null);
}
function _kbSelect(row) {
  document.querySelectorAll('.task-row.kb-selected').forEach(r => r.classList.remove('kb-selected'));
  if (!row) { _kbSelTaskId = null; return; }
  row.classList.add('kb-selected');
  _kbSelTaskId = row.dataset.taskId;
  row.scrollIntoView({ block: 'nearest' });
}
function _kbMove(dir) {
  const rows = _kbVisibleRows();
  if (!rows.length) return;
  const idx = rows.findIndex(r => r.dataset.taskId === _kbSelTaskId);
  const next = idx === -1 ? (dir > 0 ? rows[0] : rows[rows.length - 1])
                          : rows[Math.min(rows.length - 1, Math.max(0, idx + dir))];
  _kbSelect(next);
}

/* "?" shortcut chart */
function toggleShortcutChart() {
  let el = document.getElementById('kb-chart');
  if (el) { el.remove(); return; }
  el = document.createElement('div');
  el.id = 'kb-chart';
  const rows = [
    ['n', 'new task'], ['j / k', 'drift down / up the rail'], ['x', 'complete selection'],
    ['s', 'edit / schedule selection'], ['e', 'entropy — roll a random task'],
    ['t', 'today'], ['[  /  ]', 'previous / next day'],
    ['⌘K · ⌘Space', 'command palette'], ['esc', 'close the nearest thing'], ['?', 'this chart'],
  ];
  el.innerHTML = `<div class="kb-chart-card" role="dialog" aria-label="Keyboard shortcuts">
    <div class="kb-chart-title">star chart</div>
    ${rows.map(([k, d]) => `<div class="kb-chart-row"><span class="kb-chart-key">${k}</span><span class="kb-chart-desc">${d}</span></div>`).join('')}
  </div>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

document.addEventListener('keydown', e => {
  const inField = e.target.matches('input,textarea,select,[contenteditable="true"]');

  // Cmd/Ctrl+K or Cmd/Ctrl+Space — command palette (skip if a modal overlay is already open)
  if ((e.metaKey || e.ctrlKey) && (e.key === ' ' || e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    const pal = document.getElementById('cmd-palette');
    if (pal.classList.contains('open')) { closeCmdPalette(); }
    else if (!document.querySelector('.overlay.open')) { openCmdPalette(); }
    return;
  }

  if (!inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
    // N — new task from anywhere: jump to the Tasks page and focus its capture input
    if (e.key === 'n') {
      e.preventDefault();
      if (_mainPanel !== 'alltasks') showMainPanel('alltasks');
      setTimeout(() => {
        const inp = document.getElementById('atk-add-input') || document.getElementById('task-add-input');
        inp?.focus();
      }, _mainPanel === 'alltasks' ? 0 : 40);
      return;
    }
    // j / k — walk the task rail
    if (e.key === 'j') { _kbMove(1);  return; }
    if (e.key === 'k') { _kbMove(-1); return; }
    // x — complete the selected task (routes through the mandatory close prompt)
    if (e.key === 'x' && _kbSelTaskId) { handleCheckClick(_kbSelTaskId); return; }
    // s — schedule/edit the selected task
    if (e.key === 's' && _kbSelTaskId) { openTaskEditModal(_kbSelTaskId); return; }
    // e — entropy: let the universe pick
    if (e.key === 'e') { if (typeof rollEntropy === 'function') rollEntropy(); return; }
    // t — jump to today
    if (e.key === 't') { document.getElementById('cal-today')?.click(); return; }
    // [ / ] — previous / next day
    if (e.key === '[') { document.getElementById('cal-prev')?.click(); return; }
    if (e.key === ']') { document.getElementById('cal-next')?.click(); return; }
    // ? — shortcut chart
    if (e.key === '?') { toggleShortcutChart(); return; }
  }
  // ESC — close topmost open thing
  if (e.key === 'Escape') {
    const chart = document.getElementById('kb-chart');
    if (chart) { chart.remove(); return; }
    // Focus is a page now — ESC leaves it back to the dashboard.
    if (_mainPanel === 'focus') { showMainPanel('default'); return; }
    if (document.querySelector('.task-row.kb-selected')) { _kbSelect(null); return; }
    if (document.getElementById('cmd-palette').classList.contains('open')) {
      closeCmdPalette(); return;
    }
    if (orb.classList.contains('expanded')) {
      closeOrb(); return;
    }
    document.querySelectorAll('.overlay.open').forEach(o => { if (!LOCKED_OVERLAYS.has(o.id)) o.classList.remove('open'); });
  }
});

/* ── Mobile nav ────────────────────────────────────────── */
document.querySelectorAll('.mob-nav-btn[data-mob]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.mob;
    document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Close drawer
    document.getElementById('mob-more-drawer').classList.remove('open');

    if (target === 'more') {
      document.getElementById('mob-more-drawer').classList.toggle('open');
    } else if (target === 'orb') {
      openOrb();
    } else if (target === 'tasks') {
      document.getElementById('panel-tasks').classList.add('mob-active');
    } else {
      document.getElementById('panel-tasks').classList.remove('mob-active');
    }
  });
});

// Drawer items — overlays
document.querySelectorAll('.drawer-item[data-open]').forEach(item => {
  item.addEventListener('click', () => {
    document.getElementById('mob-more-drawer').classList.remove('open');
    openOverlay(item.dataset.open);
  });
});

// Drawer items — full panels (habits, lists, insights)
document.querySelectorAll('.drawer-item[data-mob-panel]').forEach(item => {
  item.addEventListener('click', () => {
    document.getElementById('mob-more-drawer').classList.remove('open');
    showMainPanel(item.dataset.mobPanel);
  });
});
document.querySelectorAll('.drawer-item[data-panel-nav]').forEach(item => {
  item.addEventListener('click', () => {
    document.getElementById('mob-more-drawer').classList.remove('open');
    showMainPanel(item.dataset.panelNav);
  });
});

/* ── Cursor spotlight ──────────────────────────────────── */
const spotlight = document.getElementById('cursor-spotlight');
let spotlightVisible = false;
document.addEventListener('mousemove', e => {
  spotlight.style.left = e.clientX + 'px';
  spotlight.style.top  = e.clientY + 'px';
  if (!spotlightVisible) {
    spotlight.style.opacity = '1';
    spotlightVisible = true;
  }
});

document.addEventListener('mouseleave', () => {
  spotlight.style.opacity = '0';
  spotlightVisible = false;
});

/* ── View tabs ─────────────────────────────────────────── */
document.querySelectorAll('.view-tab[data-view]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tab[data-view]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    _calView = tab.dataset.view;
    renderCalendar();
  });
});

/* ── Sign-in crystal background ──────────────────────── */
(function initSigninCrystal() {
  const cv = document.getElementById('signin-crystal-bg');
  if (!cv) return;
  cv.width  = cv.offsetWidth  * devicePixelRatio;
  cv.height = cv.offsetHeight * devicePixelRatio;
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');

  // Seed points — denser toward centre
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.6) * 0.48 * Math.min(W, H);
    pts.push({ x: W/2 + Math.cos(a)*r, y: H/2 + Math.sin(a)*r });
  }
  for (let i = 0; i < 8; i++) pts.push({ x: Math.random()*W, y: Math.random()*H });

  // Build triangles (fan from centre only)
  const tris = [];
  const centre = { x: W/2, y: H/2 };
  for (let i = 0; i < pts.length; i++) {
    const j = (i+1) % pts.length;
    tris.push([centre, pts[i], pts[j]]);
  }

  // Assign luminance per triangle
  const triData = tris.map(tri => {
    const mx = (tri[0].x+tri[1].x+tri[2].x)/3;
    const my = (tri[0].y+tri[1].y+tri[2].y)/3;
    const d = Math.sqrt((mx-W/2)**2 + (my-H/2)**2);
    const norm = d / Math.sqrt((W/2)**2+(H/2)**2);
    const angle = Math.atan2(my-H*0.15, mx-W*0.3);
    const brightness = Math.sin(angle+Math.PI)*0.5+0.5;
    return {
      pts: tri,
      fill:   brightness*(0.03+norm*0.02),
      stroke: 0.03+norm*0.08,
      phase:  Math.random()*Math.PI*2,
      pulse:  Math.random()*0.006+0.002,
    };
  });

  let t = 0;
  function loop() {
    t += 0.018;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#080706'; ctx.fillRect(0,0,W,H);

    const lx = W*(0.3+0.2*Math.sin(t*0.35));
    const ly = H*(0.15+0.1*Math.cos(t*0.28));
    const maxL = Math.sqrt(W*W+H*H)*0.5;

    triData.forEach(tri => {
      tri.phase += tri.pulse;
      const mx = (tri.pts[0].x+tri.pts[1].x+tri.pts[2].x)/3;
      const my = (tri.pts[0].y+tri.pts[1].y+tri.pts[2].y)/3;
      const ld = Math.sqrt((lx-mx)**2+(ly-my)**2);
      const lit = Math.max(0, 1-ld/maxL)*0.8 + Math.sin(tri.phase)*0.04;

      ctx.beginPath();
      ctx.moveTo(tri.pts[0].x, tri.pts[0].y);
      ctx.lineTo(tri.pts[1].x, tri.pts[1].y);
      ctx.lineTo(tri.pts[2].x, tri.pts[2].y);
      ctx.closePath();
      ctx.fillStyle   = `rgba(255,255,255,${(tri.fill+lit*0.04).toFixed(4)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${(tri.stroke+lit*0.06).toFixed(4)})`;
      ctx.lineWidth   = 0.5*devicePixelRatio;
      ctx.stroke();
    });

    // Centre glow
    const grd = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2, W*0.22);
    grd.addColorStop(0, 'rgba(255,255,255,0.04)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);

    requestAnimationFrame(loop);
  }
  loop();
})();

/* ── Sign-in overlay ──────────────────────────────────── */
function dismissSigninOverlay() {
  const overlay = document.getElementById('signin-overlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.4s ease';
  setTimeout(() => { overlay.style.display = 'none'; }, 400);
}

function waitForFirebaseAuth(fn) {
  if (window.CDX_AUTH && window.CDX_FB) { fn(); return; }
  setTimeout(() => waitForFirebaseAuth(fn), 100);
}

// onAuthStateChanged in the ESM module handles returning Google sessions automatically.
// No silent sign-in attempt needed — Google persists the session via IndexedDB.

// Show redirect auth errors on the login page
window.addEventListener('cdx-redirect-auth-error', (e) => {
  const errEl = document.getElementById('signin-error');
  const btn = document.getElementById('signin-btn');
  if (!errEl) return;
  const err = e.detail;
  const msg = err.code === 'auth/unauthorized-domain'
    ? 'This domain is not authorised for sign-in. Please contact the app owner.'
    : `Sign-in failed: ${err.message || err.code}`;
  errEl.textContent = msg;
  errEl.style.display = 'block';
  if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
});

// If a redirect error was already dispatched before the DOM was ready, show it now
document.addEventListener('DOMContentLoaded', () => {
  if (window.__cdxRedirectAuthError) {
    const errEl = document.getElementById('signin-error');
    if (errEl) { errEl.textContent = `Sign-in failed: ${window.__cdxRedirectAuthError}`; errEl.style.display = 'block'; }
  }
});

document.getElementById('signin-btn')?.addEventListener('click', () => {
  const btn = document.getElementById('signin-btn');
  const errEl = document.getElementById('signin-error');
  btn.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border:2px solid #ccc;border-top-color:#333;border-radius:50%;animation:spin 0.7s linear infinite"></span>';
  btn.disabled = true;
  errEl.style.display = 'none';

  const resetBtn = (errMsg = '') => {
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" style="flex-shrink:0"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Try again`;
    btn.disabled = false;
    if (errMsg) { errEl.textContent = errMsg; errEl.style.display = 'block'; }
  };

  waitForFirebaseAuth(() => {
    const provider = new window.CDX_FB.GoogleAuthProvider();
    window.CDX_FB.signInWithPopup(window.CDX_AUTH, provider)
      .then(() => { /* onAuthStateChanged → cdx-auth-ready → dismiss overlay */ })
      .catch(err => {
        console.error('Google sign-in failed:', err);
        // Popup blocked or internal error (e.g. third-party cookies disabled) — fall back to redirect
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/internal-error') {
          window.CDX_FB.signInWithRedirect(window.CDX_AUTH, provider);
          return;
        }
        const msg = err.code === 'auth/popup-closed-by-user'
          ? 'Sign-in cancelled. Click the button to try again.'
          : `Sign-in failed: ${err.message}`;
        resetBtn(msg);
      });
  });
});

// If returning visitor already has an anonymous session, skip sign-in screen
window.addEventListener('cdx-auth-ready', () => {
  dismissSigninOverlay();
});

/* ═══════════════════════════════════════════════════════════
   SOMEDAY GRAVEYARD
═══════════════════════════════════════════════════════════ */
function renderSomedaySection(body, somedayTasks, startIdx) {
  if (!somedayTasks.length) return;
  const stored = localStorage.getItem('cdx_someday_open');
  const isOpen = stored === 'true';

  const section = document.createElement('div');
  section.className = 'someday-section';

  const header = document.createElement('div');
  header.className = 'someday-section-header' + (isOpen ? ' open' : '');
  header.innerHTML = `<span class="someday-toggle-icon">›</span> Someday — ${somedayTasks.length} task${somedayTasks.length !== 1 ? 's' : ''}`;
  header.addEventListener('click', () => {
    header.classList.toggle('open');
    list.style.display = header.classList.contains('open') ? '' : 'none';
    localStorage.setItem('cdx_someday_open', header.classList.contains('open') ? 'true' : 'false');
  });

  const list = document.createElement('div');
  list.className = 'someday-list';
  list.style.display = isOpen ? '' : 'none';

  let rowIdx = startIdx;
  somedayTasks.forEach(task => {
    const row = buildTaskRow(task, rowIdx++);
    // Add restore button
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'someday-restore-btn';
    restoreBtn.textContent = '↑ Restore';
    restoreBtn.title = 'Move back to active tasks';
    restoreBtn.addEventListener('click', e => { e.stopPropagation(); restoreFromSomeday(task.id); });
    row.querySelector('.task-actions-group')?.prepend(restoreBtn);
    list.appendChild(row);
  });

  section.appendChild(header);
  section.appendChild(list);
  body.appendChild(section);
}

async function restoreFromSomeday(taskId) {
  await updateTask(taskId, { someday: false });
  showToast('Task restored to active list', 'success');
}

/* ═══════════════════════════════════════════════════════════
   DAILY RITUAL
═══════════════════════════════════════════════════════════ */
/* One-click re-entry: every overdue task moves to tomorrow. Reversible. */
async function rescheduleAllOverdue() {
  const today = localDateStr(new Date());
  const overdue = TASKS.filter(t => !t.done && t.dueDate && t.dueDate < today);
  if (!overdue.length) { showToast('no slipped orbits. all clear.', 'info'); return; }
  const tomorrow = localDateStr(new Date(Date.now() + 86400000));
  const previous = overdue.map(t => ({ id: t.id, dueDate: t.dueDate }));
  for (const t of overdue) await updateTask(t.id, { dueDate: tomorrow });
  showUndoToast(`${overdue.length} task${overdue.length > 1 ? 's' : ''} re-entered — tomorrow morning.`, async () => {
    for (const p of previous) await updateTask(p.id, { dueDate: p.dueDate });
  });
}

function computeMomentumScore() {
  // Habit streak contribution (up to 50pts)
  const today = localDateStr(new Date());
  let habitPts = 0;
  if (_habits.length > 0) {
    let streakSum = 0;
    _habits.forEach(h => {
      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = localDateStr(d);
        if (_habitLogs[ds]?.completions?.[h.id]) streak++;
        else break;
      }
      streakSum += streak;
    });
    habitPts = Math.min(50, Math.round((streakSum / (_habits.length * 7)) * 50));
  }

  // Task completion today (up to 30pts)
  const doneTodayCount = TASKS.filter(t => t.done && t.doneDate === today).length;
  const taskPts = Math.min(30, doneTodayCount * 5);

  // Pending overdue penalty (−5 per overdue, max −20)
  const overduePenalty = Math.min(20, TASKS.filter(t => !t.done && t.dueDate && t.dueDate < today).length * 5);

  const score = Math.max(0, habitPts + taskPts - overduePenalty);
  return { score, habitPts, taskPts, overduePenalty };
}

function openDailyRitual() {
  if (new Date().getHours() >= 11) return; // only show before 11 AM
  const today = localDateStr(new Date());
  const last = localStorage.getItem('cdx_ritual_date');
  if (last === today) return; // already shown today
  if (document.querySelector('.overlay.open')) return; // don't bury active modals

  const overlay = document.getElementById('ritual-overlay');
  if (!overlay) return;

  // Set date label
  const dateLabel = document.getElementById('ritual-date-label');
  if (dateLabel) {
    const d = new Date();
    dateLabel.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  // Show momentum score
  const { score, habitPts, taskPts, overduePenalty } = computeMomentumScore();
  const mWrap = document.getElementById('ritual-momentum-wrap');
  const mScore = document.getElementById('ritual-momentum-score');
  const mSub = document.getElementById('ritual-momentum-sub');
  if (mWrap && score > 0) {
    mWrap.style.display = '';
    if (mScore) mScore.textContent = score;
    if (mSub) {
      const parts = [];
      if (habitPts > 0) parts.push(`+${habitPts} habits`);
      if (taskPts > 0)  parts.push(`+${taskPts} tasks`);
      if (overduePenalty > 0) parts.push(`−${overduePenalty} overdue`);
      mSub.textContent = parts.join('  ·  ');
    }
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('ritual-focus-input')?.focus(), 300);
}

function initDailyRitual() {
  const overlay = document.getElementById('ritual-overlay');
  if (!overlay) return;

  let _ritualEnergy = '';

  // Energy buttons
  overlay.querySelectorAll('.ritual-energy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.ritual-energy-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _ritualEnergy = btn.dataset.energy;
    });
  });

  function closeRitual() {
    overlay.classList.remove('open');
    localStorage.setItem('cdx_ritual_date', localDateStr(new Date()));
  }

  document.getElementById('ritual-skip-btn')?.addEventListener('click', closeRitual);

  document.getElementById('ritual-start-btn')?.addEventListener('click', () => {
    const focus = document.getElementById('ritual-focus-input')?.value.trim();
    if (focus) localStorage.setItem('cdx_daily_focus', focus);
    if (_ritualEnergy) localStorage.setItem('cdx_daily_energy', _ritualEnergy);
    // Persist to the synced habitLogs doc (not localStorage-only) so the day's
    // focus + energy survive a cache clear and follow the user across devices.
    const uid = (typeof getHabitsUid === 'function') ? getHabitsUid() : null;
    if (uid && window.CDX_FB && window.CDX_DB && (focus || _ritualEnergy)) {
      const ds = localDateStr(new Date());
      if (typeof _habitLogs !== 'undefined') {
        _habitLogs[ds] = _habitLogs[ds] || { date: ds, completions: {} };
        if (focus) _habitLogs[ds].nonNegotiable = focus;
        if (_ritualEnergy) _habitLogs[ds].dailyEnergy = _ritualEnergy;
      }
      const { doc, setDoc } = window.CDX_FB;
      const payload = { date: ds };
      if (focus) payload.nonNegotiable = focus;
      if (_ritualEnergy) payload.dailyEnergy = _ritualEnergy;
      setDoc(doc(window.CDX_DB, 'users', uid, 'habitLogs', ds), payload, { merge: true })
        .catch(e => console.warn('daily ritual persist failed:', e.message));
    }
    closeRitual();
    showToast('Day started — ' + (focus ? `"${focus}"` : 'good luck!'), 'success', 4000);
  });

  document.getElementById('ritual-focus-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('ritual-start-btn')?.click();
  });
}

/* ═══════════════════════════════════════════════════════════
   RE-ENTRY SNAPSHOT MODAL
═══════════════════════════════════════════════════════════ */
let _reentryTaskId = null;

function openReentryModal(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  _reentryTaskId = taskId;
  const modal = document.getElementById('reentry-modal');
  if (!modal) return;
  const label = document.getElementById('reentry-task-label');
  if (label) label.textContent = task.title;
  const input = document.getElementById('reentry-snapshot-input');
  if (input) { input.value = task.reentrySnapshot || ''; input.focus(); }
  modal.classList.add('open');
}

function closeReentryModal() {
  document.getElementById('reentry-modal')?.classList.remove('open');
  _reentryTaskId = null;
}

function initReentryModal() {
  const modal = document.getElementById('reentry-modal');
  if (!modal) return;

  document.getElementById('reentry-close-btn')?.addEventListener('click', closeReentryModal);
  document.getElementById('reentry-skip-btn')?.addEventListener('click', closeReentryModal);

  document.getElementById('reentry-save-btn')?.addEventListener('click', async () => {
    if (!_reentryTaskId) return;
    const snapshot = document.getElementById('reentry-snapshot-input')?.value.trim();
    if (snapshot) {
      await updateTask(_reentryTaskId, { reentrySnapshot: snapshot });
      showToast('Snapshot saved', 'success');
    }
    closeReentryModal();
  });
}

/* ═══════════════════════════════════════════════════════════
   COMMIT MODE
═══════════════════════════════════════════════════════════ */
let _commitTaskId = null;
let _commitInterval = null;
let _commitElapsed = 0;
let _commitSnapshotShown = false;

function openCommitMode(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;

  _commitTaskId = taskId;
  _commitElapsed = 0;
  _commitSnapshotShown = false;

  const overlay = document.getElementById('commit-overlay');
  if (!overlay) return;

  const titleEl = document.getElementById('commit-task-title');
  if (titleEl) titleEl.textContent = task.title;

  const timerEl = document.getElementById('commit-timer');
  if (timerEl) timerEl.textContent = '00:00';

  const promptEl = document.getElementById('commit-snapshot-prompt');
  if (promptEl) promptEl.style.display = 'none';

  const snapshotInput = document.getElementById('commit-snapshot-input');
  if (snapshotInput) snapshotInput.value = '';

  overlay.classList.add('open');

  clearInterval(_commitInterval);
  _commitInterval = setInterval(() => {
    _commitElapsed++;
    const m = Math.floor(_commitElapsed / 60);
    const s = _commitElapsed % 60;
    if (timerEl) timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    // Show snapshot prompt at 10 minutes
    if (_commitElapsed === 600 && !_commitSnapshotShown) {
      _commitSnapshotShown = true;
      if (promptEl) promptEl.style.display = '';
    }
  }, 1000);
}

function closeCommitMode() {
  clearInterval(_commitInterval);
  _commitInterval = null;
  if (_commitTaskId && _commitElapsed > 0) {
    updateTask(_commitTaskId, { timeSpentSeconds: _commitElapsed });
  }
  _commitTaskId = null;
  document.getElementById('commit-overlay')?.classList.remove('open');
}

function initCommitMode() {
  const overlay = document.getElementById('commit-overlay');
  if (!overlay) return;

  document.getElementById('commit-exit-btn')?.addEventListener('click', () => {
    if (_commitTaskId) {
      openReentryModal(_commitTaskId);
    }
    closeCommitMode();
  });

  document.getElementById('commit-pause-btn')?.addEventListener('click', () => {
    if (_commitTaskId) openReentryModal(_commitTaskId);
    closeCommitMode();
  });

  document.getElementById('commit-done-btn')?.addEventListener('click', () => {
    const taskId = _commitTaskId;
    closeCommitMode();
    // Route through the mandatory close prompt (theme + logged time) instead of
    // silently completing — keeps focus-time attribution deliberate.
    if (taskId) handleCheckClick(taskId);
  });

  document.getElementById('commit-snapshot-save-btn')?.addEventListener('click', async () => {
    const snapshot = document.getElementById('commit-snapshot-input')?.value.trim();
    if (snapshot && _commitTaskId) {
      await updateTask(_commitTaskId, { reentrySnapshot: snapshot });
      showToast('Snapshot saved — keep going!', 'success');
    }
    const promptEl = document.getElementById('commit-snapshot-prompt');
    if (promptEl) promptEl.style.display = 'none';
  });
}

/* ═══════════════════════════════════════════════════════════
   FRICTION TAGGING MODAL
═══════════════════════════════════════════════════════════ */
let _frictionTaskId = null;
let _frictionReason = '';

function openFrictionModal(taskId) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return;
  _frictionTaskId = taskId;
  _frictionReason = '';

  const modal = document.getElementById('friction-modal');
  if (!modal) return;

  const label = document.getElementById('friction-task-label');
  if (label) label.textContent = task.title;

  // Reset reasons
  modal.querySelectorAll('.friction-reason-btn').forEach(b => b.classList.remove('active'));

  modal.classList.add('open');
}

function closeFrictionModal() {
  document.getElementById('friction-modal')?.classList.remove('open');
  _frictionTaskId = null;
  _frictionReason = '';
}

function initFrictionModal() {
  const modal = document.getElementById('friction-modal');
  if (!modal) return;

  document.getElementById('friction-close-btn')?.addEventListener('click', closeFrictionModal);

  modal.querySelectorAll('.friction-reason-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.friction-reason-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _frictionReason = btn.dataset.reason;
    });
  });

  document.getElementById('friction-kill-btn')?.addEventListener('click', async () => {
    if (!_frictionTaskId) return;
    if (await cdxConfirm('Delete this task permanently?')) {
      await deleteTask(_frictionTaskId);
      closeFrictionModal();
    }
  });

  document.getElementById('friction-someday-btn')?.addEventListener('click', async () => {
    if (!_frictionTaskId) return;
    const updates = { someday: true };
    if (_frictionReason) updates.frictionReason = _frictionReason;
    await updateTask(_frictionTaskId, updates);
    showToast('Moved to Someday', 'info');
    closeFrictionModal();
  });

  document.getElementById('friction-keep-btn')?.addEventListener('click', async () => {
    if (!_frictionTaskId) return;
    // Reset the scheduling-attempt count (fresh start) + tag reason
    const updates = { scheduleCount: 0 };
    if (_frictionReason) updates.frictionReason = _frictionReason;
    await updateTask(_frictionTaskId, updates);
    showToast('Friction tagged — you\'ve got this', 'success');
    closeFrictionModal();
  });
}

/* ═══════════════════════════════════════════════════════════
   DONE WALL
═══════════════════════════════════════════════════════════ */
let _doneWallFilter = 'all';

function loadDoneWall() {
  _doneWallFilter = 'all';
  document.querySelectorAll('.done-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  renderDoneWall();
}

function renderDoneWall() {
  const today = localDateStr(new Date());
  const startOfWeek = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return localDateStr(d);
  })();
  const startOfMonth = today.slice(0, 7) + '-01';

  let tasks = TASKS.filter(t => t.done);
  if (_doneWallFilter === 'today')  tasks = tasks.filter(t => t.doneDate === today);
  if (_doneWallFilter === 'week')   tasks = tasks.filter(t => t.doneDate >= startOfWeek);
  if (_doneWallFilter === 'month')  tasks = tasks.filter(t => t.doneDate >= startOfMonth);

  // Stats
  const statsEl = document.getElementById('done-wall-stats');
  if (statsEl) {
    const totalDone = TASKS.filter(t => t.done).length;
    const todayDone = TASKS.filter(t => t.done && t.doneDate === today).length;
    const weekDone  = TASKS.filter(t => t.done && t.doneDate >= startOfWeek).length;
    // Habit streaks: longest active
    let maxStreak = 0;
    _habits.forEach(h => {
      let s = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if (_habitLogs[localDateStr(d)]?.completions?.[h.id]) s++;
        else break;
      }
      if (s > maxStreak) maxStreak = s;
    });
    statsEl.innerHTML = `
      <div class="done-stat-card"><div class="done-stat-number">${totalDone}</div><div class="done-stat-label">All time</div></div>
      <div class="done-stat-card"><div class="done-stat-number">${weekDone}</div><div class="done-stat-label">This week</div></div>
      <div class="done-stat-card"><div class="done-stat-number">${todayDone}</div><div class="done-stat-label">Today</div></div>
      <div class="done-stat-card"><div class="done-stat-number">${maxStreak}</div><div class="done-stat-label">Best habit streak</div></div>`;
  }

  // Grid
  const grid = document.getElementById('done-grid');
  if (!grid) return;
  if (!tasks.length) {
    grid.innerHTML = `<div style="font-family:var(--font-mono);font-size:12px;color:var(--muted);text-align:center;padding:40px 0">Nothing here yet — go complete something!</div>`;
    return;
  }
  grid.innerHTML = tasks.map(task => {
    const cat = task.category ? CATEGORIES[task.category] : null;
    const catBadge = cat
      ? `<span style="font-family:var(--font-mono);font-size:10px;padding:1px 6px;border-radius:100px;background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44;white-space:nowrap">${cat.label}</span>`
      : '';
    const dateLabel = task.doneDate ? fmtDate(task.doneDate) : '';
    const timeBadge = task.timeSpentMinutes
      ? `<span style="font-family:var(--font-mono);font-size:10px;color:var(--neon);white-space:nowrap">⏱ ${task.timeSpentMinutes < 60 ? task.timeSpentMinutes + 'm' : (task.timeSpentMinutes / 60).toFixed(1) + 'h'}</span>`
      : '';
    return `<div class="done-card">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--neon);flex-shrink:0">✓</span>
      <span class="done-card-title">${escHtml(task.title)}</span>
      <div class="done-card-meta">${catBadge}${timeBadge}</div>
      ${dateLabel ? `<span class="done-card-date">${dateLabel}</span>` : ''}
    </div>`;
  }).join('');
}

function initDoneWall() {
  document.getElementById('done-filter-bar')?.addEventListener('click', e => {
    const btn = e.target.closest('.done-filter-btn');
    if (!btn) return;
    _doneWallFilter = btn.dataset.filter;
    document.querySelectorAll('.done-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === _doneWallFilter));
    renderDoneWall();
  });

  // Fold/unfold toggle
  let _doneWallFolded = false;
  const foldBtn = document.getElementById('done-wall-fold-btn');
  const wrap    = document.getElementById('done-grid-wrap');
  const header  = document.getElementById('done-wall-header');
  const toggle  = () => {
    _doneWallFolded = !_doneWallFolded;
    if (wrap) wrap.style.display = _doneWallFolded ? 'none' : '';
    if (foldBtn) foldBtn.textContent = _doneWallFolded ? '▼ unfold' : '▲ fold';
  };
  foldBtn?.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  header?.addEventListener('click', toggle);

  // Insights viz tab switching
  window._insVizTab = window._insVizTab || 'pulse';
  document.querySelector('.ins-viz-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.ins-viz-tab');
    if (!btn) return;
    window._insVizTab = btn.dataset.viz;
    document.querySelectorAll('.ins-viz-tab').forEach(b => b.classList.toggle('active', b.dataset.viz === window._insVizTab));
    if (typeof renderInsights === 'function') renderInsights();
  });
}

/* ── Teardown — call on signout to prevent listener leaks ── */
function cleanupAllListeners() {
  // Data collection listeners
  if (_tasksUnsub)       { _tasksUnsub();       _tasksUnsub       = null; }
  if (_calEventsUnsub)   { _calEventsUnsub();   _calEventsUnsub   = null; }
  if (_holidaysUnsub)    { _holidaysUnsub();    _holidaysUnsub    = null; }
  if (_listsUnsub)       { _listsUnsub();       _listsUnsub       = null; }
  if (_msProjUnsub)      { _msProjUnsub();      _msProjUnsub      = null; }
  if (_msEventsUnsub)    { _msEventsUnsub();    _msEventsUnsub    = null; }
  if (_msListsUnsub)     { _msListsUnsub();     _msListsUnsub     = null; }
  // Config listeners
  if (_catUnsub)         { _catUnsub();         _catUnsub         = null; }
  if (_peopleUnsub)      { _peopleUnsub();      _peopleUnsub      = null; }
  // Habits/routines/behaviour listeners
  if (_habitsUnsub)      { _habitsUnsub();      _habitsUnsub      = null; }
  if (_habitLogsUnsub)   { _habitLogsUnsub();   _habitLogsUnsub   = null; }
  if (_routinesUnsub)    { _routinesUnsub();    _routinesUnsub    = null; }
  if (_behavUnsub)       { _behavUnsub();       _behavUnsub       = null; }
  if (_hbSettingsUnsub)  { _hbSettingsUnsub();  _hbSettingsUnsub  = null; }
  if (_valuesUnsub)      { _valuesUnsub();      _valuesUnsub      = null; }
  if (_stacksUnsub)      { _stacksUnsub();      _stacksUnsub      = null; }
  // Intervals
  if (_calNowLineInterval) { clearInterval(_calNowLineInterval); _calNowLineInterval = null; }
  if (_cosmodexInterval)   { clearInterval(_cosmodexInterval);   _cosmodexInterval   = null; }
  // Reset global data state so a subsequent login starts clean
  TASKS = []; CAL_EVENTS = []; HOLIDAYS = {}; LISTS = [];
  MILESTONE_PROJECTS = []; MILESTONE_EVENTS = []; MILESTONE_LISTS = [];
  _values = []; _stacks = [];
  _listView = null;
}

window.addEventListener('cdx-auth-signout', () => {
  cleanupAllListeners();
});

/* ── Boot task system after auth ──────────────────────── */
window.addEventListener('cdx-auth-ready', () => {
  waitForFirebase(() => {
    // Subscribe to Firestore categories config
    const _catUser = window.CDX_USER;
    if (_catUser && window.CDX_FB && window.CDX_DB) {
      const { doc, onSnapshot } = window.CDX_FB;

      if (_catUnsub) { _catUnsub(); _catUnsub = null; }
      _catUnsub = onSnapshot(doc(window.CDX_DB, 'users', _catUser.uid, 'config', 'categories'), snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.categories && typeof data.categories === 'object' && Object.keys(data.categories).length) {
            // Firestore is the single source of truth: overwrite so deletions on
            // another device propagate here instead of resurrecting via merge.
            CATEGORIES = data.categories;
            saveCategoriesLocal();
            renderSettingsCatList?.();
            renderSettingsCats?.();
            rebuildCategorySelects?.();
          }
        }
      }, err => console.warn('Categories snapshot error:', err));

      // Subscribe to people config
      if (_peopleUnsub) { _peopleUnsub(); _peopleUnsub = null; }
      _peopleUnsub = onSnapshot(doc(window.CDX_DB, 'users', _catUser.uid, 'config', 'people'), snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.people)) {
            // Firestore is the single source of truth: overwrite so a person
            // deleted on another device isn't resurrected by a local-only merge.
            PEOPLE = data.people;
            localStorage.setItem('cdx_people', JSON.stringify(PEOPLE));
            renderSettingsPeople?.();
          }
        }
      }, err => console.warn('People snapshot error:', err));
    }
    // Rebuild selects with any custom categories loaded from localStorage
    rebuildCategorySelects();
    initData();
    initCalDropZones();
    initEventModal();
    initAddTaskForm();
    initTimePickerPopover();
    initScheduleModal();
    initTaskEditModal();
    initSettingsPanel();
    initCalNav();
    renderCalendar();
    initListsPage();
    initHabitsPage();
    initMilestonesPanel();
    initFocusBuckets();
    initOrbAddTask();
    initDailyRitual();
    initReentryModal();
    initCommitMode();
    initFrictionModal();
    initDoneWall();
    updateDashboardHero();
    // (Removed: the first-open "single focus for today" ritual prompt. Today's
    //  anchor is now captured on the dashboard, so the startup prompt is redundant.)
  });
}, { once: true });

/* ─────────────────────────────────────────────────────────────
   NOTES CANVAS
───────────────────────────────────────────────────────────── */
// Shared across Notes and Pomo scribble canvases
const SCRIB_COLORS = ['#f5f0e8','#c9a227','#6b9fd4','#6b8f5e','#c45c2a','#d4913a','#1a1510'];
const SCRIB_SIZES  = [1, 2, 4, 8, 16];
(function() {
  // SCRIB_COLORS and SCRIB_SIZES are global (defined above)
  let _notesInited = false;

  window.initNotesCanvas = function() {
    const cv = document.getElementById('notes-canvas');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    function sizeCanvas() {
      const rect = cv.getBoundingClientRect();
      const w = rect.width || cv.offsetWidth || 700;
      const h = rect.height || cv.offsetHeight || 440;
      const tmp = document.createElement('canvas');
      tmp.width = cv.width; tmp.height = cv.height;
      tmp.getContext('2d').drawImage(cv, 0, 0);
      cv.width  = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width  = w + 'px';
      cv.style.height = h + 'px';
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.drawImage(tmp, 0, 0, w, h);
    }
    if (!_notesInited) {
      _notesInited = true;
      requestAnimationFrame(sizeCanvas);

      let color = SCRIB_COLORS[0], penSz = 2, eraser = false, drawing = false, lx = 0, ly = 0;

      // Pen size bar
      const penBar = document.getElementById('notes-pen-bar');
      SCRIB_SIZES.forEach(sz => {
        const b = document.createElement('button');
        b.className = 'pen-size-btn' + (sz === 2 ? ' active' : '');
        const dp = Math.min(sz + 4, 18);
        b.innerHTML = `<span style="width:${dp}px;height:${dp}px;border-radius:50%;background:currentColor;display:inline-block"></span>`;
        b.addEventListener('click', () => {
          penSz = sz; eraser = false;
          penBar.querySelectorAll('.pen-size-btn').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          document.getElementById('notes-eraser-btn').classList.remove('active');
        });
        penBar.appendChild(b);
      });

      // Color swatches
      const colBar = document.getElementById('notes-color-bar');
      SCRIB_COLORS.forEach(c => {
        const s = document.createElement('div');
        s.className = 'scribble-swatch' + (c === color ? ' active' : '');
        s.style.background = c;
        s.addEventListener('click', () => {
          color = c; eraser = false;
          colBar.querySelectorAll('.scribble-swatch').forEach(x => x.classList.remove('active'));
          s.classList.add('active');
          document.getElementById('notes-eraser-btn').classList.remove('active');
        });
        colBar.appendChild(s);
      });

      document.getElementById('notes-eraser-btn').addEventListener('click', function() {
        eraser = !eraser; this.classList.toggle('active', eraser);
      });
      document.getElementById('notes-clear-btn').addEventListener('click', () => {
        cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
      });
      document.getElementById('notes-save-btn').addEventListener('click', () => {
        const link = document.createElement('a');
        const today = localDateStr(new Date());
        link.download = `cosmodex-notes-${today}.png`;
        const tmp = document.createElement('canvas');
        tmp.width = cv.width; tmp.height = cv.height;
        const tc = tmp.getContext('2d');
        tc.fillStyle = '#0e0c08';
        tc.fillRect(0, 0, tmp.width, tmp.height);
        tc.drawImage(cv, 0, 0);
        link.href = tmp.toDataURL('image/png'); link.click();
      });

      function getPos(e) {
        const r = cv.getBoundingClientRect();
        const sx = cv.width / dpr / r.width, sy = cv.height / dpr / r.height;
        return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
      }
      function startDraw(e) {
        e.preventDefault(); drawing = true; [lx, ly] = getPos(e);
        const ctx = cv.getContext('2d');
        ctx.save();
        if (eraser) { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(lx, ly, penSz * 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(lx, ly, penSz / 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
        ctx.restore();
      }
      function moveDraw(e) {
        if (!drawing) return; e.preventDefault();
        const [x, y] = getPos(e);
        const ctx = cv.getContext('2d');
        ctx.save();
        if (eraser) { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, penSz * 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.strokeStyle = color; ctx.lineWidth = penSz; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
        ctx.restore(); lx = x; ly = y;
      }
      function endDraw() { drawing = false; }
      cv.addEventListener('pointerdown',  startDraw, { passive: false });
      cv.addEventListener('pointermove',  moveDraw,  { passive: false });
      cv.addEventListener('pointerup',    endDraw,   { passive: false });
      cv.addEventListener('pointercancel',endDraw,   { passive: false });
    } else {
      requestAnimationFrame(sizeCanvas);
    }
  };
})();

/* ─────────────────────────────────────────────────────────────
   FOCUS / POMODORO
───────────────────────────────────────────────────────────── */
(function() {
  const PMIN = 1, PMAX = 90;

  let pomoDur = 25;
  const pomo = { running: false, totalSecs: 25 * 60, remainSecs: 25 * 60, interval: null, sessions: 0, _endTarget: 0 };
  let _breathInterval = null;
  const _breathPhases = ['Breathe in ↑', 'Hold', 'Breathe out ↓', 'Hold'];
  let _breathIdx = 0;
  let focusChecklist = [];
  // Session checklist persists to the browser only (localStorage). Fine if it's
  // cleared — it's a scratch list, never synced to Firestore.
  const _FC_KEY = 'cosmodex_session_checklist';
  function _saveFocusChecklist() {
    try { localStorage.setItem(_FC_KEY, JSON.stringify(focusChecklist)); } catch (e) {}
  }
  function _loadFocusChecklist() {
    try {
      const raw = localStorage.getItem(_FC_KEY);
      focusChecklist = raw ? (JSON.parse(raw) || []) : [];
    } catch (e) { focusChecklist = []; }
  }

  function clamp(v) { return Math.max(PMIN, Math.min(PMAX, Math.round(v))); }

  function setDuration(v) {
    pomoDur = clamp(v);
    if (!pomo.running) { pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60; }
    const el = document.getElementById('pomo-sw-val'); if (el) el.textContent = String(pomoDur);
    buildTicks(); renderPomo();
  }

  function buildTicks() {
    const c = document.getElementById('pomo-ticks'); if (!c) return; c.innerHTML = '';
    for (let i = -12; i <= 12; i++) {
      const val = pomoDur + i, el = document.createElement('div');
      if (val < PMIN || val > PMAX) { el.style.width = '3px'; c.appendChild(el); continue; }
      el.className = 'pomo-tick' + (i === 0 ? ' current' : val % 5 === 0 ? ' major' : '');
      el.style.height = i === 0 ? '14px' : val % 5 === 0 ? '9px' : '5px';
      c.appendChild(el);
    }
  }

  function drawPomoRing() {
    const cv = document.getElementById('pomo-ring'); if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = W * 0.40;
    const lw = Math.max(6, W * 0.045);
    ctx.clearRect(0, 0, W, H);
    const frac = pomo.totalSecs > 0 ? pomo.remainSecs / pomo.totalSecs : 1;
    const sa = -Math.PI / 2, ea = sa + (1 - frac) * Math.PI * 2;
    // Track
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = lw; ctx.stroke();
    // Progress — design-system white glow
    if (frac < 1) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, sa, ea);
      ctx.strokeStyle = pomo.running ? '#ffffff' : pomo.remainSecs < pomo.totalSecs ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255,255,255,0.55)'; ctx.shadowBlur = pomo.running ? 16 : 6;
      ctx.stroke();
      ctx.restore();
    }
  }

  function renderPomo() {
    const m = Math.floor(pomo.remainSecs / 60), s = pomo.remainSecs % 60;
    const tEl = document.getElementById('pomo-time');
    if (tEl) tEl.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    const phEl = document.getElementById('pomo-phase');
    if (phEl) phEl.textContent = pomo.running ? 'Focusing' : pomo.remainSecs === 0 ? 'Complete ✓' : pomo.remainSecs < pomo.totalSecs ? 'Paused' : 'Ready';
    const startBtn = document.getElementById('pomo-start');
    if (startBtn) startBtn.textContent = pomo.running ? 'Pause' : pomo.remainSecs > 0 && pomo.remainSecs < pomo.totalSecs ? 'Resume' : 'Start';
    document.querySelectorAll('.pomo-sess-dot').forEach((d, i) => d.classList.toggle('done', i < pomo.sessions));
    const sw = document.querySelector('.pomo-swipe-section');
    if (sw) { sw.style.opacity = pomo.running ? '0.4' : '1'; sw.style.pointerEvents = pomo.running ? 'none' : 'auto'; }
    if (!pomo.running) document.getElementById('pomo-lock-msg')?.classList.remove('show');
    drawPomoRing();
  }

  function startBreathing() {
    _breathIdx = 0;
    const el = document.getElementById('pomo-breath-phase'); if (el) el.textContent = _breathPhases[0];
    clearInterval(_breathInterval);
    _breathInterval = setInterval(() => {
      _breathIdx = (_breathIdx + 1) % 4;
      const el = document.getElementById('pomo-breath-phase'); if (el) el.textContent = _breathPhases[_breathIdx];
    }, 4000);
  }
  function stopBreathing() { clearInterval(_breathInterval); _breathInterval = null; }

  function renderFocusChecklist() {
    const el = document.getElementById('pomo-check-items'); if (!el) return;
    el.innerHTML = '';
    focusChecklist.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'pomo-check-item' + (item.done ? ' done' : '');
      div.innerHTML = `<div class="pomo-check-box">${item.done ? '✓' : ''}</div><span class="pomo-check-txt">${escHtml(item.text)}</span><span class="pomo-check-del" title="Remove">✕</span>`;
      div.querySelector('.pomo-check-box').addEventListener('click', () => {
        focusChecklist[i].done = !focusChecklist[i].done; _saveFocusChecklist(); renderFocusChecklist();
      });
      div.querySelector('.pomo-check-del').addEventListener('click', () => {
        focusChecklist.splice(i, 1); _saveFocusChecklist(); renderFocusChecklist();
      });
      el.appendChild(div);
    });
  }

  let _pomoEvent = null; // active calendar event (set when opened from calendar)

  window.setPomoEvent = function(ev) {
    _pomoEvent = ev || null;
    if (ev && ev.duration) {
      const mins = Math.max(1, Math.round(ev.duration));
      setDuration(mins);
    }
    // Show/hide delete event button (only for real calendar events, not task-only focus)
    const delBtn = document.getElementById('pomo-del-event-btn');
    if (delBtn) delBtn.style.display = (_pomoEvent && !_pomoEvent._taskOnly) ? 'inline-flex' : 'none';
    // Hide completion prompt when opening fresh
    const prompt = document.getElementById('pomo-complete-prompt');
    if (prompt) prompt.style.display = 'none';
  };

  // Focus-task picker: today's open tasks by default, search across all uncompleted.
  function _pomoRenderTaskList(query) {
    const listEl = document.getElementById('pomo-task-list');
    const lblEl  = document.getElementById('pomo-tasks-lbl');
    if (!listEl) return;
    const q = (query || '').trim().toLowerCase();
    const today = localDateStr(new Date());
    let tasks;
    if (q) { tasks = TASKS.filter(t => !t.done && (t.title || '').toLowerCase().includes(q)).slice(0, 25); if (lblEl) lblEl.textContent = 'SEARCH · UNCOMPLETED'; }
    else   { tasks = TASKS.filter(t => !t.done && t.dueDate === today);                                   if (lblEl) lblEl.textContent = "FOCUS TASK · TODAY"; }
    const activeId = _pomoEvent && _pomoEvent.taskId;
    if (!tasks.length) {
      listEl.innerHTML = `<div class="pomo-task-empty">${q ? 'No matching open tasks' : 'Nothing due today — search to pick a task'}</div>`;
      return;
    }
    listEl.innerHTML = tasks.map(t => {
      const cat = t.category ? CATEGORIES[t.category] : null;
      return `<div class="pomo-task-item${t.id === activeId ? ' active' : ''}" data-pomo-task="${escAttr(t.id)}">
        <span class="pomo-task-dot" style="background:${getCatColor(t.category)}"></span>
        <span class="pomo-task-title">${escHtml(t.title)}</span>
        ${cat ? `<span class="pomo-task-cat">${escHtml(cat.label.toUpperCase())}</span>` : ''}
        ${t.id === activeId ? '<span class="pomo-task-live">● FOCUS</span>' : ''}
      </div>`;
    }).join('');
    listEl.querySelectorAll('[data-pomo-task]').forEach(el => el.onclick = () => {
      const t = TASKS.find(x => x.id === el.dataset.pomoTask); if (t) _pomoSelectTask(t);
    });
  }

  function _pomoSelectTask(task) {
    _pomoEvent = task ? { taskId: task.id, title: task.title, _taskOnly: true } : null;
    const titleEl = document.getElementById('pomo-ev-title');
    if (titleEl) titleEl.textContent = task ? task.title : '—';
    const nameEl = document.getElementById('pomo-focusname');
    if (nameEl) nameEl.textContent = task ? task.title : 'No task — free focus';
    const delBtn = document.getElementById('pomo-del-event-btn');
    if (delBtn) delBtn.style.display = 'none';
    _pomoRenderTaskList(document.getElementById('pomo-task-search')?.value || '');
  }

  // Commit ritual → Begin hands off here: set task + duration and reset to a fresh session.
  window.setPomoTask = function(task, durMins) {
    if (durMins) setDuration(durMins);
    clearInterval(pomo.interval); pomo.running = false;
    pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60;
    _pomoSelectTask(task || null);
    renderPomo();
  };
  window.setPomoTitle = function(title) {
    _pomoEvent = title ? { title, _taskOnly: true } : null;
    const titleEl = document.getElementById('pomo-ev-title');
    if (titleEl) titleEl.textContent = title || '—';
    const nameEl = document.getElementById('pomo-focusname');
    if (nameEl) nameEl.textContent = title || 'No task — free focus';
  };

  window.initPomoOverlay = function() {
    _loadFocusChecklist();
    buildTicks(); renderPomo(); startBreathing(); renderFocusChecklist();
    // Focus-task picker: default to today's tasks; search picks other open tasks.
    _pomoRenderTaskList('');
    const searchEl = document.getElementById('pomo-task-search');
    if (searchEl && !searchEl.dataset.wired) { searchEl.dataset.wired = '1'; searchEl.addEventListener('input', e => _pomoRenderTaskList(e.target.value)); }
    // Reset completion prompt
    const prompt = document.getElementById('pomo-complete-prompt');
    if (prompt) prompt.style.display = 'none';
    // Wire delete event button
    const delBtn = document.getElementById('pomo-del-event-btn');
    if (delBtn) {
      delBtn.style.display = (_pomoEvent && !_pomoEvent._taskOnly) ? 'inline-flex' : 'none';
      delBtn.onclick = async () => {
        if (!_pomoEvent) return;
        if (!await cdxConfirm(`Delete event "${_pomoEvent.title}"?`)) return;
        const { deleteDoc } = window.CDX_FB;
        const ev = _pomoEvent;
        try {
          await deleteDoc(_ud('calEvents', ev.id));
          // Keep parity with the event-modal delete: unschedule the linked task (don't orphan its calEventId)
          const linkedTask = ev.taskId ? TASKS.find(t => t.id === ev.taskId) : TASKS.find(t => t.calEventId === ev.id);
          if (linkedTask) await updateTask(linkedTask.id, { calEventId: null });
        } catch(e) {}
        _pomoEvent = null; delBtn.style.display = 'none';
        showToast('Event deleted', 'success');
      };
    }
  };

  // Duration swipe
  let swX = null, swDur = null;
  const swTrack = document.getElementById('pomo-sw-track');
  if (swTrack) {
    swTrack.addEventListener('pointerdown', e => { swX = e.clientX; swDur = pomoDur; swTrack.setPointerCapture(e.pointerId); e.preventDefault(); });
    swTrack.addEventListener('pointermove', e => { if (swX === null) return; setDuration(swDur + Math.round((e.clientX - swX) / 12)); });
    swTrack.addEventListener('pointerup',   () => swX = null);
    swTrack.addEventListener('pointercancel', () => swX = null);
    swTrack.addEventListener('wheel', e => { e.preventDefault(); setDuration(pomoDur + (e.deltaY > 0 ? -1 : 1)); }, { passive: false });
  }
  document.getElementById('pomo-sw-minus')?.addEventListener('click', () => setDuration(pomoDur - 1));
  document.getElementById('pomo-sw-plus')?.addEventListener('click',  () => setDuration(pomoDur + 1));

  // Start / Pause
  document.getElementById('pomo-start')?.addEventListener('click', () => {
    if (pomo.running) {
      clearInterval(pomo.interval); pomo.running = false;
    } else {
      if (pomo.remainSecs === 0) { pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60; }
      pomo.running = true;
      pomo._endTarget = Date.now() + pomo.remainSecs * 1000;
      pomo.interval = setInterval(() => {
        pomo.remainSecs = Math.max(0, Math.round((pomo._endTarget - Date.now()) / 1000));
        if (pomo.remainSecs <= 0) {
          clearInterval(pomo.interval); pomo.running = false; pomo.remainSecs = 0;
          pomo.sessions = Math.min(4, pomo.sessions + 1);
          stopBreathing();
          document.getElementById('pomo-lock-msg')?.classList.remove('show');
          // Completion chime
          try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.35, 0.7].forEach((t, i) => { const osc = ac.createOscillator(), g = ac.createGain(); osc.connect(g); g.connect(ac.destination); osc.frequency.value = [528,660,792][i]; g.gain.value = 0.18; osc.start(ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.9); osc.stop(ac.currentTime + t + 0.9); }); } catch(e) {}
          // Show task completion prompt if there's a linked task
          const elapsedSecs = pomo.totalSecs;
          const promptEl = document.getElementById('pomo-complete-prompt');
          if (promptEl && _pomoEvent?.taskId) {
            promptEl.style.display = 'block';
            document.getElementById('pomo-done-yes').onclick = () => {
              promptEl.style.display = 'none';
              // Route through the mandatory close prompt (theme + logged time)
              const tid = _pomoEvent?.taskId;
              if (tid) handleCheckClick(tid);
            };
            document.getElementById('pomo-done-no').onclick = () => { promptEl.style.display = 'none'; };
          }
        }
        renderPomo();
      }, 500);
    }
    renderPomo();
  });

  // Reset
  document.getElementById('pomo-reset')?.addEventListener('click', () => {
    clearInterval(pomo.interval); pomo.running = false;
    pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60;
    renderPomo();
  });

  // Leave — pomo is a page now; return to the dashboard.
  document.getElementById('pomo-close')?.addEventListener('click', () => {
    stopBreathing(); showMainPanel('default');
  });
  // Withdraw: reset timer state without closing any overlay
  document.getElementById('pomo-withdraw')?.addEventListener('click', () => {
    clearInterval(pomo.interval); pomo.running = false;
    pomo.totalSecs = pomoDur * 60; pomo.remainSecs = pomoDur * 60;
    renderPomo(); stopBreathing();
    document.getElementById('pomo-lock-msg')?.classList.remove('show');
  });

  // Checklist
  function addCheckItem() {
    const inp = document.getElementById('pomo-check-input'); if (!inp) return;
    const text = inp.value.trim(); if (!text) return;
    focusChecklist.push({ text, done: false }); inp.value = ''; _saveFocusChecklist(); renderFocusChecklist();
  }
  document.getElementById('pomo-check-add-btn')?.addEventListener('click', addCheckItem);
  document.getElementById('pomo-check-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addCheckItem(); });

  // Floating pomo panel collapse/expand
  let _pomoCollapsed = localStorage.getItem('cosmodex_pomo_collapsed') === '1';
  function togglePomoCol() {
    const panel = document.getElementById('td-pomo-float');
    if (!panel) return;
    _pomoCollapsed = !_pomoCollapsed;
    panel.classList.toggle('pf-collapsed', _pomoCollapsed);
    localStorage.setItem('cosmodex_pomo_collapsed', _pomoCollapsed ? '1' : '0');
  }
  if (_pomoCollapsed) {
    document.getElementById('td-pomo-float')?.classList.add('pf-collapsed');
  }
  document.getElementById('td-pomo-toggle')?.addEventListener('click', togglePomoCol);
})();


/* ══ KINETIC: Bubble time-drag — spin the day dial to preview any hour ══ */
(function initOrbTimeDrag() {
  const cvs = document.getElementById('cosmodex-canvas');
  if (!cvs) return;
  window._orbTimeOffset = 0;
  let drag = null, springRaf = null;

  const center = () => {
    const r = cvs.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  cvs.addEventListener('pointerdown', e => {
    if (!orb.classList.contains('expanded')) return;
    if (springRaf) { cancelAnimationFrame(springRaf); springRaf = null; }
    const c = center();
    drag = { lastA: Math.atan2(e.clientY - c.y, e.clientX - c.x), c };
    try { cvs.setPointerCapture(e.pointerId); } catch {}
    cvs.classList.add('orb-dragging');
  });
  cvs.addEventListener('pointermove', e => {
    if (!drag) return;
    const a = Math.atan2(e.clientY - drag.c.y, e.clientX - drag.c.x);
    let dA = a - drag.lastA;
    if (dA > Math.PI) dA -= Math.PI * 2;
    if (dA < -Math.PI) dA += Math.PI * 2;
    drag.lastA = a;
    drag.moved = (drag.moved || 0) + Math.abs(dA);
    // full turn of the dial = 24 h; clamp preview to ±48 h
    window._orbTimeOffset = Math.max(-172800e3, Math.min(172800e3,
      window._orbTimeOffset + (dA / (Math.PI * 2)) * 86400e3));
    drawCosmodex();
  });
  const endDrag = () => {
    if (!drag) return;
    const wasSpin = (drag.moved || 0) > 0.02;
    drag = null;
    cvs.classList.remove('orb-dragging');
    if (!wasSpin) { window._orbTimeOffset = 0; drawCosmodex(); return; } // plain click: petal taps still work
    const from = window._orbTimeOffset, t0 = performance.now(), D = 700;
    const spring = () => {
      const p = Math.min(1, (performance.now() - t0) / D);
      window._orbTimeOffset = from * (1 - (1 - Math.pow(1 - p, 3)));
      drawCosmodex();
      springRaf = p < 1 ? requestAnimationFrame(spring) : null;
    };
    spring();
  };
  cvs.addEventListener('pointerup', endDrag);
  cvs.addEventListener('pointercancel', endDrag);
})();

/* ══════════════════════════════════════════════════════════════════════
   TASKS PAGE — full "every task you've captured" view (left-nav "Tasks").
   Reuses the dashboard's buildTaskRow() + shared task-list event wiring, so
   rows behave exactly like the Today list. Timeboxing (drag-to-schedule) is
   intentionally disabled here — this page is for triage, not calendar work.
   Chrome (filter pills, search, sort, inline add) follows the design kit.
   ══════════════════════════════════════════════════════════════════════ */
let _atkFilter = 'all';
let _atkSort   = 'smart';
let _atkQuery  = '';

const _ATK_FILTERS = [
  { id:'all',     label:'All',       match: (t) => !t.done },
  { id:'today',   label:'Today',     match: (t, today) => !t.done && !t.someday && t.dueDate === today },
  { id:'week',    label:'This week', match: (t, today, wk) => !t.done && !t.someday && t.dueDate && t.dueDate >= today && t.dueDate <= wk },
  { id:'overdue', label:'Overdue',   match: (t, today) => !t.done && !t.someday && t.dueDate && t.dueDate < today },
  { id:'recur',   label:'Recurring', match: (t) => !!t.recurrence },
  { id:'someday', label:'Someday',   match: (t) => !t.done && !!t.someday },
  { id:'done',    label:'Done',      match: (t) => t.done },
];
const _ATK_SORTS = [
  { id:'smart',   label:'Smart' },
  { id:'due',     label:'Due' },
  { id:'created', label:'Created' },
  { id:'prio',    label:'Priority' },
];
const _ATK_PRIO_RANK = { high: 0, med: 1, low: 2 };

function _atkCreatedMs(t) {
  if (!t.createdAt) return 0;
  return t.createdAt.toDate ? t.createdAt.toDate().getTime() : new Date(t.createdAt).getTime();
}

function _atkMatch(fid, t, today, wk) {
  const f = _ATK_FILTERS.find(x => x.id === fid) || _ATK_FILTERS[0];
  return f.match(t, today, wk);
}

// Build the static page chrome once; the list re-renders on filter/search/sort.
function renderTasksPage() {
  const panel = document.getElementById('panel-alltasks');
  if (!panel) return;
  if (!document.getElementById('alltasks-body')) {
    panel.innerHTML = `
      <div class="atk-layout">
        <div class="atk-main">
          <div class="atk-scroll">
            <div class="atk-head">
              <div>
                <div class="atk-eyebrow" id="atk-count-line">TASKS</div>
                <div class="atk-title">Tasks</div>
                <div class="atk-sub">Everything you've captured — one list, one truth.</div>
              </div>
            </div>
            <div class="atk-filters" id="atk-filters"></div>
            <div class="atk-searchsort">
              <div class="atk-search">
                <span class="atk-search-ic">⌕</span>
                <input id="atk-search-input" placeholder="Search every task you've captured…" autocomplete="off">
                <span class="atk-shown" id="atk-shown"></span>
              </div>
              <div class="atk-sortwrap">
                <span class="atk-eyebrow">SORT</span>
                <div class="atk-sort" id="atk-sort"></div>
              </div>
            </div>
            <div class="atk-add">
              <span class="atk-add-plus">+</span>
              <input id="atk-add-input" placeholder="Capture a task… press Enter to add" autocomplete="off">
              <span class="atk-eyebrow">ENTER ↵</span>
            </div>
            <div class="atk-colhead">
              <span></span><span></span>
              <span>Task</span><span>List</span><span>Due</span><span>Category</span>
              <span style="text-align:right">Prio</span>
            </div>
            <div class="atk-list" id="alltasks-body"></div>
          </div>
        </div>
        <aside class="atk-detail" id="atk-detail"></aside>
      </div>`;

    // Sort toggle
    document.getElementById('atk-sort').innerHTML = _ATK_SORTS.map(s =>
      `<button class="atk-sort-btn" data-atk-sort="${s.id}">${s.label}</button>`).join('');
    document.getElementById('atk-sort').addEventListener('click', e => {
      const b = e.target.closest('[data-atk-sort]'); if (!b) return;
      _atkSort = b.dataset.atkSort; renderAllTasksList();
    });
    // Filter pills (delegated)
    document.getElementById('atk-filters').addEventListener('click', e => {
      const b = e.target.closest('[data-atk-filter]'); if (!b) return;
      _atkFilter = b.dataset.atkFilter; renderAllTasksList();
    });
    // Search
    document.getElementById('atk-search-input').addEventListener('input', e => {
      _atkQuery = e.target.value; renderAllTasksList();
    });
    // Inline add — reuse the app's addTask()
    const addInput = document.getElementById('atk-add-input');
    addInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && addInput.value.trim()) {
        addTask(addInput.value.trim());
        addInput.value = '';
      }
    });
  }
  renderAllTasksList();
  renderAtkDetail();
}

function renderAllTasksList() {
  const body = document.getElementById('alltasks-body');
  if (!body) return;
  const today = localDateStr(new Date());
  const wkDate = new Date(); wkDate.setDate(wkDate.getDate() + 6);
  const wk = localDateStr(wkDate);
  const q = _atkQuery.trim().toLowerCase();

  // Counts per filter (over all tasks, ignoring category visibility — one truth)
  const counts = {};
  _ATK_FILTERS.forEach(f => { counts[f.id] = TASKS.filter(t => _atkMatch(f.id, t, today, wk)).length; });

  // Filter pills
  const filtersEl = document.getElementById('atk-filters');
  if (filtersEl) filtersEl.innerHTML = _ATK_FILTERS.map(f =>
    `<button class="atk-pill${_atkFilter === f.id ? ' active' : ''}" data-atk-filter="${f.id}">${f.label}<span class="atk-pill-n">${counts[f.id]}</span></button>`).join('');
  // Sort active state
  document.querySelectorAll('#atk-sort .atk-sort-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.atkSort === _atkSort));

  // Apply filter + search
  let rows = TASKS.filter(t => _atkMatch(_atkFilter, t, today, wk));
  if (q) rows = rows.filter(t =>
    (t.title || '').toLowerCase().includes(q) ||
    (t.category ? (CATEGORIES[t.category]?.label || t.category) : '').toLowerCase().includes(q));

  // Sort
  const dueKey = t => t.dueDate || '9999-99-99';
  if (_atkSort === 'due')          rows = [...rows].sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  else if (_atkSort === 'created') rows = [...rows].sort((a, b) => _atkCreatedMs(b) - _atkCreatedMs(a));
  else if (_atkSort === 'prio')    rows = [...rows].sort((a, b) => (_ATK_PRIO_RANK[a.priority] ?? 3) - (_ATK_PRIO_RANK[b.priority] ?? 3));
  else /* smart */                 rows = [...rows].sort((a, b) =>
    (a.done - b.done) || (dueKey(a).localeCompare(dueKey(b))) || ((_ATK_PRIO_RANK[a.priority] ?? 3) - (_ATK_PRIO_RANK[b.priority] ?? 3)));

  // Header counts + shown
  const openCount = TASKS.filter(t => !t.done).length;
  const countLine = document.getElementById('atk-count-line');
  if (countLine) countLine.textContent = `${TASKS.length} CAPTURED · ${openCount} OPEN`;
  const shownEl = document.getElementById('atk-shown');
  if (shownEl) shownEl.textContent = `${rows.length} SHOWN`;

  // Render design-kit tabular rows (checkbox · dot · title · list · due · cat · prio)
  const projMap = _buildTaskToProjectMap();
  body.innerHTML = '';
  if (!rows.length) {
    body.innerHTML = `<div class="atk-empty">— None —<br><span>Nothing matches this filter</span></div>`;
    return;
  }
  rows.forEach(task => body.appendChild(buildAtkRow(task, projMap, today)));
}

/* ── Tabular row + detail drawer (design-kit Tasks.jsx) ───────────────────
   The Tasks page uses its own clean row/grid + a right-hand detail drawer,
   distinct from the dashboard's rich stacked rows. Real task fields map to
   the design's columns; the drawer surfaces status/notes/subtasks/actions. */
let _atkSelectedId = null;

function _recurLabel(r) {
  if (!r) return '';
  const m = { daily:'Daily', weekdays:'Weekdays', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' };
  if (m[r]) return m[r];
  return r.startsWith('custom:') ? r.replace('custom:', '') : r;
}

function _atkRelTime(task) {
  const ms = _atkCreatedMs(task);
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7)    return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5)    return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)  return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function _atkPrioLevel(p) { return p === 'high' ? 3 : p === 'med' ? 2 : p === 'low' ? 1 : 0; }
function _atkPrioDots(p) {
  const lvl = _atkPrioLevel(p);
  return [1,2,3].map(i => `<span class="atk-dot${i <= lvl ? ' on' : ''}"></span>`).join('');
}

function buildAtkRow(task, projMap, today) {
  const row = document.createElement('div');
  row.className = 'atk-row' + (task.id === _atkSelectedId ? ' sel' : '') + (task.done ? ' done' : '');
  row.dataset.taskId = task.id;

  const cat       = task.category ? CATEGORIES[task.category] : null;
  const catClr    = getCatColor(task.category);
  const proj      = projMap[task.id];
  const isOverdue = task.dueDate && task.dueDate < today && !task.done;

  const recur   = task.recurrence ? `<span class="atk-tel">↻ ${escHtml(_recurLabel(task.recurrence).toUpperCase())}</span>` : '';
  const note    = task.notes ? `<span class="atk-tel">✎ NOTE</span>` : '';
  const created = _atkCreatedMs(task) ? `<span class="atk-tel dim">${escHtml(_atkRelTime(task).toUpperCase())}</span>` : '';

  const dueCell = task.dueDate
    ? `<span class="atk-due${isOverdue ? ' overdue' : ''}">${isOverdue ? '△ ' : ''}${escHtml(fmtDate(task.dueDate).toUpperCase())}</span>`
    : (task.someday ? `<span class="atk-due someday">SOMEDAY</span>` : `<span class="atk-dash">—</span>`);

  row.innerHTML = `
    <div class="atk-check${task.done ? ' done' : ''}" data-atk-check="${escAttr(task.id)}">${task.done ? '✓' : ''}</div>
    <span class="atk-catdot" style="${cat ? `background:${catClr};box-shadow:0 0 6px ${catClr}88` : 'background:transparent;border:1px solid rgba(255,255,255,.15)'}"></span>
    <div class="atk-titlecell">
      <div class="atk-rtitle${task.done ? ' done' : ''}">${escHtml(task.title)}</div>
      <div class="atk-rmeta">${recur}${note}${created}</div>
    </div>
    <span class="atk-tel list"${proj ? ` style="color:${proj.projectColor}"` : ''}>${proj ? escHtml(proj.projectTitle) : '<span class="atk-dash">—</span>'}</span>
    <div class="atk-duecell">${dueCell}</div>
    <span class="atk-tel">${cat ? escHtml(cat.label.toUpperCase()) : '<span class="atk-dash">—</span>'}</span>
    <div class="atk-priocell">${_atkPrioDots(task.priority)}</div>`;

  row.addEventListener('click', e => {
    if (e.target.closest('[data-atk-check]')) return;
    openAtkDetail(task.id);
  });
  row.querySelector('[data-atk-check]').addEventListener('click', e => {
    e.stopPropagation();
    // Completing routes through the theme/time prompt; reopening skips it
    if (task.done) toggleTask(task.id); else handleCheckClick(task.id, e);
  });
  return row;
}

function openAtkDetail(taskId) {
  _atkSelectedId = taskId;
  renderAllTasksList();
  renderAtkDetail();
}

function renderAtkDetail() {
  const el = document.getElementById('atk-detail');
  if (!el) return;
  const task = TASKS.find(t => t.id === _atkSelectedId);
  if (!task) {
    _atkSelectedId = null;
    el.classList.remove('open');
    el.innerHTML = `<div class="atk-detail-empty"><div class="atk-detail-empty-mark">✦</div><div>Select a task<br><span>to see its full context</span></div></div>`;
    return;
  }
  el.classList.add('open');

  const cat     = task.category ? CATEGORIES[task.category] : null;
  const catClr  = getCatColor(task.category);
  const proj    = _buildTaskToProjectMap()[task.id];
  const dueTxt  = task.dueDate ? fmtDate(task.dueDate) : (task.someday ? 'Someday' : '—');
  const recurTxt= task.recurrence ? _recurLabel(task.recurrence) : '—';
  const created = _atkCreatedMs(task) ? _atkRelTime(task) : '—';
  const prioTxt = task.priority ? task.priority.toUpperCase() : '—';

  const subs = task.subtasks || [];
  const subsHtml = subs.length
    ? subs.map(s => `<div class="atk-sub-item">
        <div class="atk-subcheck${s.done ? ' done' : ''}" data-atk-subcheck="${escAttr(s.id)}">${s.done ? '✓' : ''}</div>
        <span class="${s.done ? 'done' : ''}">${escHtml(s.title)}</span></div>`).join('')
    : `<div class="atk-subs-empty">— None —</div>`;

  const eyebrow = `${cat ? escHtml(cat.label.toUpperCase()) : 'NO CATEGORY'}${proj ? ' · ' + escHtml(proj.projectTitle.toUpperCase()) : ''}`;

  el.innerHTML = `
    <div class="atk-detail-head">
      <div class="atk-detail-topline">
        <span class="atk-catdot" style="${cat ? `background:${catClr};box-shadow:0 0 6px ${catClr}88` : 'background:transparent;border:1px solid rgba(255,255,255,.15)'}"></span>
        <span class="atk-tel atk-prio-click" data-atk-edit title="Click to edit category">${eyebrow}</span>
        <div style="flex:1"></div>
        <button class="atk-detail-x" data-atk-close>×</button>
      </div>
      <div class="atk-detail-title${task.done ? ' done' : ''}">${escHtml(task.title)}</div>
    </div>
    <div class="atk-detail-body">
      <div>
        <div class="atk-eyebrow" style="margin-bottom:8px">STATUS</div>
        <button class="atk-status-btn${task.done ? ' done' : ''}" data-atk-toggle>${task.done ? '✓ Done — reopen' : '● Mark done'}</button>
      </div>
      <div class="atk-detail-grid">
        <div><div class="atk-eyebrow">DUE</div><div class="atk-detail-val atk-prio-click" data-atk-edit title="Click to edit">${escHtml(dueTxt)}</div></div>
        <div><div class="atk-eyebrow">RECURRENCE</div><div class="atk-detail-val atk-prio-click" data-atk-edit title="Click to edit">↻ ${escHtml(recurTxt)}</div></div>
        <div><div class="atk-eyebrow">PRIORITY</div><div class="atk-detail-val atk-prio-click" data-atk-prio title="Click to cycle"><span class="atk-priocell inline">${_atkPrioDots(task.priority)}</span> ${prioTxt}</div></div>
        <div><div class="atk-eyebrow">CREATED</div><div class="atk-detail-val">${escHtml(created)}</div></div>
      </div>
      <div>
        <div class="atk-eyebrow" style="margin-bottom:8px">NOTES</div>
        <textarea class="atk-notes" data-atk-notes placeholder="No notes yet…">${escHtml(task.notes || '')}</textarea>
      </div>
      <div>
        <div class="atk-eyebrow" style="margin-bottom:8px">SUBTASKS</div>
        <div class="atk-subs">${subsHtml}</div>
        <input class="atk-subadd" data-atk-subadd placeholder="Add subtask… press Enter" autocomplete="off">
      </div>
    </div>
    <div class="atk-detail-foot">
      <button class="atk-foot-btn" data-atk-edit>✎ Edit</button>
      ${task.done ? '' : '<button class="atk-foot-btn" data-atk-focus>◉ Focus</button>'}
      <button class="atk-foot-btn" data-atk-sched>☷ Schedule</button>
      <button class="atk-foot-btn" data-atk-dup title="Duplicate this task">⧉ Duplicate</button>
      <button class="atk-foot-btn danger" data-atk-del title="Delete task">🗑 Delete</button>
    </div>`;

  el.querySelector('[data-atk-close]').onclick = () => { _atkSelectedId = null; renderAllTasksList(); renderAtkDetail(); };
  el.querySelectorAll('[data-atk-edit]').forEach(b => b.onclick = () => openTaskEditModal(task.id));
  el.querySelector('[data-atk-toggle]').onclick = (e) => {
    // Reopening skips the prompt; completing routes through the theme/time popover
    if (task.done) toggleTask(task.id); else handleCheckClick(task.id, e);
  };
  el.querySelector('[data-atk-prio]').onclick = () => {
    const order = ['high', 'med', 'low'];
    const next = order[(order.indexOf(task.priority) + 1) % order.length];
    updateTask(task.id, { priority: next });
  };
  const notes = el.querySelector('[data-atk-notes]');
  notes.addEventListener('blur', () => {
    if ((task.notes || '') !== notes.value) updateTask(task.id, { notes: notes.value });
  });
  el.querySelectorAll('[data-atk-subcheck]').forEach(c =>
    c.onclick = () => toggleSubtask(task.id, c.dataset.atkSubcheck));
  const subAdd = el.querySelector('[data-atk-subadd]');
  subAdd.addEventListener('keydown', e => {
    if (e.key === 'Enter' && subAdd.value.trim()) { addSubtask(task.id, subAdd.value.trim()); subAdd.value = ''; }
  });
  const focusBtn = el.querySelector('[data-atk-focus]');
  if (focusBtn) focusBtn.onclick = () => openCommitRitual(task.id);
  el.querySelector('[data-atk-sched]').onclick = () => openScheduleModal(task.dueDate || localDateStr(new Date()), '09:00', task.id, null);
  el.querySelector('[data-atk-dup]').onclick = () => duplicateTask(task.id);
  el.querySelector('[data-atk-del]').onclick = () => deleteTask(task.id);
}

/* ═══════════════════════════════════════════════════════════
   COMMIT RITUAL  (design: "What is the one thing?")
   Nav 'Commit' → ritual → Begin hands the chosen task + duration
   to the Focus (pomodoro) overlay via window.setPomoTask.
   ═══════════════════════════════════════════════════════════ */
let _ritualTaskId = null;
let _ritualDur = 45;
let _ritualWired = false;

function _ritualRenderSuggest(query) {
  const el = document.getElementById('cr-suggest');
  const lbl = document.getElementById('cr-suggest-lbl');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  const today = localDateStr(new Date());
  let tasks;
  if (q) { tasks = TASKS.filter(t => !t.done && (t.title || '').toLowerCase().includes(q)).slice(0, 20); if (lbl) lbl.textContent = 'SEARCH · UNCOMPLETED'; }
  else   { tasks = TASKS.filter(t => !t.done && t.dueDate === today);                                   if (lbl) lbl.textContent = "TODAY'S TASKS"; }
  if (!tasks.length) {
    el.innerHTML = `<div class="cr-suggest-empty">${q ? 'No matching open tasks' : 'Nothing due today — type a focus or search'}</div>`;
    return;
  }
  el.innerHTML = tasks.map(t => {
    const cat = t.category ? CATEGORIES[t.category] : null;
    return `<button class="cr-suggest-item${t.id === _ritualTaskId ? ' active' : ''}" data-cr-task="${escAttr(t.id)}">
      <span class="cr-suggest-dot" style="background:${getCatColor(t.category)}"></span>
      <span class="cr-suggest-t">${escHtml(t.title)}</span>
      ${cat ? `<span class="cr-suggest-cat">${escHtml(cat.label.toUpperCase())}</span>` : ''}
    </button>`;
  }).join('');
  el.querySelectorAll('[data-cr-task]').forEach(b => b.onclick = () => {
    const t = TASKS.find(x => x.id === b.dataset.crTask); if (!t) return;
    _ritualTaskId = t.id;
    const inp = document.getElementById('cr-intent'); if (inp) inp.value = t.title;
    _ritualRenderSuggest(''); // show today's list with this one highlighted
  });
}

function openCommitRitual(preselectTaskId) {
  const ov = document.getElementById('commit-ritual-overlay');
  if (!ov) return;
  _ritualDur = 45;
  // Preselect a task when launched from a task's Focus button so every focus
  // entry point flows through one ritual → one Focus Timer (no parallel screens).
  const pre = preselectTaskId ? TASKS.find(t => t.id === preselectTaskId) : null;
  _ritualTaskId = pre ? pre.id : null;
  const inp = document.getElementById('cr-intent'); if (inp) inp.value = pre ? pre.title : '';
  document.querySelectorAll('#cr-durs .cr-dur').forEach(b => b.classList.toggle('active', +b.dataset.dur === _ritualDur));
  _ritualRenderSuggest('');

  if (!_ritualWired) {
    _ritualWired = true;
    const close = () => ov.classList.remove('open');
    document.getElementById('cr-close')?.addEventListener('click', close);
    document.getElementById('cr-leave')?.addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('open')) close(); });
    inp?.addEventListener('input', e => { _ritualTaskId = null; _ritualRenderSuggest(e.target.value); });
    document.getElementById('cr-durs')?.addEventListener('click', e => {
      const b = e.target.closest('[data-dur]'); if (!b) return;
      _ritualDur = +b.dataset.dur;
      document.querySelectorAll('#cr-durs .cr-dur').forEach(x => x.classList.toggle('active', x === b));
    });
    document.getElementById('cr-begin')?.addEventListener('click', () => {
      const task = _ritualTaskId ? TASKS.find(t => t.id === _ritualTaskId) : null;
      const intent = (document.getElementById('cr-intent')?.value || '').trim();
      // A task or an intent is optional — you can just start the timer.
      window.setPomoTask && window.setPomoTask(task || null, _ritualDur);
      if (!task && window.setPomoTitle) window.setPomoTitle(intent || null);
      close();
      showMainPanel('focus');
    });
  }
  ov.classList.add('open');
  setTimeout(() => document.getElementById('cr-intent')?.focus(), 60);
}

document.getElementById('btn-commit')?.addEventListener('click', openCommitRitual);


/* ═══════════════════════════════════════════════════════════════════════════
   MINIMALIST DASHBOARD — compact today spine + telemetry cards
   Replaces the old calendar+tasks two-pane home. All CRUD reuses existing
   global functions (addTask / toggleTask / showEventModal / openScheduleModal /
   _calMilestones / _planMilestonePicker / openCommitRitual).
   ═══════════════════════════════════════════════════════════════════════════ */
function _dashFmtTime(t) {
  if (!t) return '';
  return (typeof fmtTimeSched === 'function') ? fmtTimeSched(t) : t;
}
function _dashPrioRank(p) { return p === 'high' ? 3 : p === 'low' ? 1 : 2; }

/* Dashboard today = a 30-minute time-block grid (08:00–22:00). Tasks from the
   "Due today" card are dragged onto a block to schedule them; placed events can
   be dragged to a new block. Drag state is held in a page-local var (reliable
   in-page; dataTransfer is also set so the browser initiates the drag). */
const DASH_H0 = 8, DASH_H1 = 22, DASH_SLOT_H = 30;
const DASH_SLOTS = (DASH_H1 - DASH_H0) * 2;
let _dashDragPayload = null;

function _dashSlotTime(idx) {
  const mins = DASH_H0 * 60 + idx * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

// Which day the dashboard calendar is showing (defaults to today; ‹ › navigate it).
let _dashCalDate = new Date();

function _dashRenderTodayLine() {
  const body = document.getElementById('dash-cal-body');
  if (!body) return;
  const viewDate = localDateStr(_dashCalDate);
  const isToday = viewDate === localDateStr(new Date());
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const gridStart = DASH_H0 * 60, gridEnd = DASH_H1 * 60;

  // 1. Milestones — pinned above the grid (reuse the global flag banner)
  const msHtml = (typeof _calMilestones === 'function') ? _calMilestones(viewDate) : '';

  // 2. Rail + drop-zone slots
  let rail = '', slots = '';
  for (let s = 0; s < DASH_SLOTS; s++) {
    const time = _dashSlotTime(s);
    const onHour = time.endsWith(':00');
    rail  += `<div class="dash-slot-rail${onHour ? ' hour' : ''}" style="height:${DASH_SLOT_H}px">${onHour ? escHtml(_dashFmtTime(time)) : ''}</div>`;
    slots += `<div class="dash-slot${onHour ? ' hour' : ''}" data-slot="${time}" style="height:${DASH_SLOT_H}px"></div>`;
  }

  // 3. Timed events → positioned chips (draggable to move)
  const events = (CAL_EVENTS || []).filter(e => e.date === viewDate && !e.allDay && e.startTime);
  let chips = '';
  events.forEach(ev => {
    const [h, m] = ev.startTime.split(':').map(Number);
    const startMins = h * 60 + (m || 0);
    if (startMins >= gridEnd) return;
    const dur = ev.duration || 30;
    const top = Math.max(0, (startMins - gridStart) / 30) * DASH_SLOT_H;
    const height = Math.max((dur / 30) * DASH_SLOT_H - 2, 22);
    const task = ev.taskId ? TASKS.find(t => t.id === ev.taskId) : null;
    const color = getCatColor(task?.category);
    const past = isToday && (startMins + dur <= nowMins);
    chips += `<div class="dash-chip${task?.done ? ' done' : ''}${past ? ' past' : ''}" draggable="true"
        data-ev-chip="${escAttr(ev.id)}" style="top:${top}px;height:${height}px;--nc:${color}">
        <span class="dash-chip-time">${escHtml(_dashFmtTime(ev.startTime))}</span>
        <span class="dash-chip-title">${escHtml(ev.title)}</span>
      </div>`;
  });

  // 4. Now-line — only when the calendar is actually showing today
  let nowLine = '';
  if (isToday && nowMins >= gridStart && nowMins <= gridEnd) {
    const top = ((nowMins - gridStart) / 30) * DASH_SLOT_H;
    nowLine = `<div class="dash-nowline" style="top:${top}px"><span class="dash-nowline-dot"></span></div>`;
  }

  body.innerHTML =
    (msHtml ? `<div class="dash-ms-row">${msHtml}</div>` : '') +
    `<div class="dash-day-grid">
       <div class="dash-slot-railcol">${rail}</div>
       <div class="dash-slot-col">${slots}
         <div class="dash-chip-layer">${chips}${nowLine}</div>
         <div class="dash-drop-marker" style="display:none"></div>
       </div>
     </div>`;

  if (typeof _wireCalMilestones === 'function') _wireCalMilestones(body);
  _dashWireGrid(body, viewDate);
}

function _dashWireGrid(body, dateStr) {
  const col = body.querySelector('.dash-slot-col');
  const marker = body.querySelector('.dash-drop-marker');
  if (col && marker) {
    const slotIdxAt = clientY => {
      const r = col.getBoundingClientRect();
      return Math.max(0, Math.min(DASH_SLOTS - 1, Math.floor((clientY - r.top) / DASH_SLOT_H)));
    };
    col.addEventListener('dragover', e => {
      if (!_dashDragPayload) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      marker.style.display = 'block';
      marker.style.top = (slotIdxAt(e.clientY) * DASH_SLOT_H) + 'px';
    });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) marker.style.display = 'none'; });
    col.addEventListener('drop', e => {
      e.preventDefault();
      marker.style.display = 'none';
      const p = _dashDragPayload; _dashDragPayload = null;
      if (!p) return;
      const time = _dashSlotTime(slotIdxAt(e.clientY));
      if (p.kind === 'task') scheduleTaskAt(p.id, dateStr, time, 30);
      else if (p.kind === 'event') moveCalEventTo(p.id, dateStr, time);
    });
    // Click an empty slot → create an event at that time (chips handle their own click)
    col.addEventListener('click', e => {
      if (e.target.closest('[data-ev-chip]')) return;
      openQuickCalModal(dateStr, _dashSlotTime(slotIdxAt(e.clientY)));
    });
  }
  // Placed event chips — drag to move, click to edit
  body.querySelectorAll('[data-ev-chip]').forEach(el => {
    el.addEventListener('dragstart', e => {
      _dashDragPayload = { kind: 'event', id: el.dataset.evChip };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'event:' + el.dataset.evChip);
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => { _dashDragPayload = null; el.classList.remove('dragging'); });
    el.addEventListener('click', e => {
      const ev = (CAL_EVENTS || []).find(x => x.id === el.dataset.evChip);
      if (ev) showEventModal(ev, e.clientX, e.clientY);
    });
  });
}

// Cache of today's anchor from Planning › "The week, shaped"
let _dashWeekAnchor = { key: null, text: '', loading: false };
function _dashLoadWeekAnchor() {
  if (typeof _planWeekKey !== 'function' || typeof _planLoadDoc !== 'function') return;
  const key = _planWeekKey();
  if (_dashWeekAnchor.key === key || _dashWeekAnchor.loading) return; // already have / fetching this week
  _dashWeekAnchor.loading = true;
  _planLoadDoc('weeklyPlans', key).then(d => {
    const days = _planWeekDays();
    const idx  = days.indexOf(localDateStr(new Date()));
    _dashWeekAnchor = { key, text: (d.weekShaped && idx >= 0 ? (d.weekShaped[idx] || '') : '').trim(), loading: false };
    if (_mainPanel === 'default') _dashRenderNonNeg();
  }).catch(() => { _dashWeekAnchor.loading = false; });
}
// Force a re-fetch of today's anchor on next dashboard render (e.g. after editing Planning).
// Also clears the cached text so a stale value never flashes before the fetch resolves.
window._dashInvalidateAnchor = () => { _dashWeekAnchor = { key: null, text: '', loading: false }; };

function _dashRenderNonNeg() {
  const nnEl = document.getElementById('dash-nn');
  if (!nnEl) return;
  const today = localDateStr(new Date());
  const anchor = _dashWeekAnchor.text;
  if (anchor) {
    nnEl.innerHTML = `<div class="dash-eyebrow">TODAY'S NON-NEGOTIABLE</div>
      <div class="dash-nn-title">“${escHtml(anchor)}”</div>
      <div class="dash-nn-meta">THIS WEEK, SHAPED · TODAY'S ANCHOR</div>`;
    return;
  }
  // Fallback: highest-priority incomplete task due today or overdue
  const pool = (TASKS || []).filter(t => !t.someday && !t.done && t.dueDate && t.dueDate <= today)
    .sort((a, b) => (_dashPrioRank(b.priority) - _dashPrioRank(a.priority)) || (a.dueDate < b.dueDate ? -1 : 1));
  const nn = pool[0];
  nnEl.innerHTML = `<div class="dash-eyebrow">TODAY'S NON-NEGOTIABLE</div>` + (nn
    ? `<div class="dash-nn-title" data-open="${escAttr(nn.id)}">“${escHtml(nn.title)}”</div>
       <div class="dash-nn-meta">${nn.dueDate < today ? 'OVERDUE · ' : ''}${(nn.priority || 'med').toUpperCase()} PRIORITY</div>`
    : `<div class="dash-nn-title muted">Set today's anchor.</div>
       <div class="dash-nn-meta">Planning › This week › "The week, shaped"</div>`);
  nn && nnEl.querySelector('[data-open]')?.addEventListener('click', () => {
    showMainPanel('alltasks');
    setTimeout(() => window.openAtkDetail?.(nn.id), 40);
  });
}

function _dashRenderCards() {
  const today = localDateStr(new Date());

  // ── Non-negotiable: today's anchor from Planning › "The week, shaped",
  //    falling back to the highest-priority task due today/overdue ──
  _dashLoadWeekAnchor();
  _dashRenderNonNeg();

  // ── Streak: consecutive days with a completed task + last-7 bar ──
  const stEl = document.getElementById('dash-streak');
  if (stEl) {
    const doneDays = new Set((TASKS || []).filter(t => t.done && t.doneDate).map(t => t.doneDate));
    const dstr = d => localDateStr(d);
    // streak counts back from today (with a one-day grace if today is empty so far)
    let streak = 0; const cur = new Date();
    if (!doneDays.has(dstr(cur))) cur.setDate(cur.getDate() - 1);
    while (doneDays.has(dstr(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
    // last 7 calendar days (Mon-anchored week not required — rolling 7)
    const ws = weekStart(new Date());
    const cells = [];
    for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); cells.push({ ds: dstr(d), today: dstr(d) === today }); }
    stEl.innerHTML = `<div class="dash-eyebrow">STREAK · DAILY</div>
      <div class="dash-streak-num"><span class="dash-big">${streak}</span><span class="dash-big-unit">day${streak === 1 ? '' : 's'}</span></div>
      <div class="dash-streak-bar">${cells.map(c =>
        `<div class="dash-streak-cell${doneDays.has(c.ds) ? ' on' : ''}${c.today ? ' today' : ''}"></div>`).join('')}</div>
      <div class="dash-eyebrow" style="margin-top:8px">M · T · W · T · F · S · S</div>`;
  }

  // ── Deep work / commit ──
  const cmEl = document.getElementById('dash-commit');
  if (cmEl) {
    const running = _commitInterval && _commitTaskId;
    if (running) {
      const task = TASKS.find(t => t.id === _commitTaskId);
      const m = Math.floor(_commitElapsed / 60), s = _commitElapsed % 60;
      cmEl.innerHTML = `<div class="dash-eyebrow">RUNNING · COMMIT MODE</div>
        <div class="dash-commit-timer" id="dash-commit-timer">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</div>
        <div class="dash-commit-task">${escHtml(task?.title || 'Focus session')}</div>`;
    } else {
      // Real telemetry: minutes of logged task time today (close-prompt only)
      let secs = 0;
      (TASKS || []).forEach(t => { if ((t.doneDate || t.dueDate) === today) secs += taskEffortSecs(t); });
      const mins = Math.round(secs / 60);
      cmEl.innerHTML = `<div class="dash-eyebrow">DEEP WORK · TODAY</div>
        <div class="dash-commit-timer">${mins}<span class="dash-big-unit">min</span></div>
        <button class="dash-cta" id="dash-begin-commit">◈ Begin commit</button>`;
      cmEl.querySelector('#dash-begin-commit')?.addEventListener('click', () => openCommitRitual());
    }
  }
}

/* ── Today's rituals: habits + morning/evening routine steps ──
   Reads the habits-module globals (_habits / _routines / _habitLogs), which are
   already subscribed at boot by initHabitsPage(). Toggling reuses habitToggle().  */
function _dashRenderRituals() {
  const el = document.getElementById('dash-rituals');
  if (!el) return;
  const ds = localDateStr(new Date());
  const habits = (typeof _habits !== 'undefined' ? _habits : [])
    .filter(h => h && h.status !== 'archived' && h.status !== 'graduated')
    // Only show rituals scheduled for today (daily / weekdays / weekends / picked days).
    .filter(h => (typeof _hxIsDue === 'function') ? _hxIsDue(h, new Date()) : true);
  // Firestore-backed routine completion (synced across devices) instead of localStorage.
  const routineDone = (typeof _routineDoneMap === 'function') ? _routineDoneMap(ds) : {};
  const morning = (typeof _routines !== 'undefined' ? _routines.morning : []) || [];
  const evening = (typeof _routines !== 'undefined' ? _routines.evening : []) || [];
  const logDone = id => !!(typeof _habitLogs !== 'undefined' && _habitLogs[ds]?.completions?.[id]);

  if (!habits.length && !morning.length && !evening.length) {
    el.innerHTML = `<div class="dash-eyebrow">TODAY'S RITUALS</div>
      <div class="dash-nn-title muted" style="font-size:14px">No rituals yet.</div>
      <div class="dash-nn-meta">Add habits &amp; routines in the Habits page.</div>`;
    return;
  }

  const habitDone = habits.filter(h => logDone(h.id)).length;
  const rows = [];
  habits.forEach(h => {
    const done = logDone(h.id);
    const name = h.tinyBehavior || h.name || 'Habit';
    rows.push(`<div class="dash-ritual-row${done ? ' done' : ''}" data-ritual-habit="${escAttr(h.id)}">
      <span class="dash-ritual-check${done ? ' on' : ''}">${done ? '✓' : ''}</span>
      <span class="dash-ritual-name">${escHtml(name)}</span>
      <span class="dash-ritual-dot" style="--nc:${getCatColor(h.category)}"></span>
    </div>`);
  });
  const routineBlock = (label, steps, kind) => {
    if (!steps.length) return '';
    return `<div class="dash-ritual-sub">${label}</div>` + steps.map((s, i) => {
      const key = (kind === 'morning' ? 'm' : 'e') + i;
      const done = !!routineDone[key];
      return `<div class="dash-ritual-row${done ? ' done' : ''}" data-ritual-step="${escAttr(key)}">
        <span class="dash-ritual-check${done ? ' on' : ''}">${done ? '✓' : ''}</span>
        <span class="dash-ritual-name">${escHtml(s.text || '')}</span>
        ${s.time ? `<span class="dash-ritual-time">${escHtml(s.time)}</span>` : ''}
      </div>`;
    }).join('');
  };

  el.innerHTML =
    `<div class="dash-eyebrow">TODAY'S RITUALS · ${habitDone}/${habits.length}</div>` +
    (habits.length ? `<div class="dash-ritual-list">${rows.join('')}</div>` : '') +
    routineBlock('MORNING', morning, 'morning') +
    routineBlock('EVENING', evening, 'evening');

  // Habit toggle (simple click on the dashboard)
  el.querySelectorAll('[data-ritual-habit]').forEach(r => r.addEventListener('click', () => {
    habitToggle(r.dataset.ritualHabit, ds).then(() => _dashRenderRituals());
  }));
  // Routine-step toggle → Firestore-backed (synced), re-renders on resolve
  el.querySelectorAll('[data-ritual-step]').forEach(r => r.addEventListener('click', () => {
    if (typeof toggleRoutineStep === 'function') toggleRoutineStep(ds, r.dataset.ritualStep).then(() => _dashRenderRituals());
    else _dashRenderRituals();
  }));
}

/* ── Tasks due today: quick-timebox list ──
   Incomplete tasks whose dueDate is today (or overdue). Each row is a one-click
   entry into the Commit Ritual (timebox → focus timer) for that task. */
function _dashRenderTasks() {
  const el = document.getElementById('dash-tasks');
  if (!el) return;
  const today = localDateStr(new Date());
  const due = (TASKS || [])
    .filter(t => !t.done && t.dueDate && t.dueDate <= today)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  if (!due.length) {
    el.innerHTML = `<div class="dash-eyebrow">DUE TODAY · TIMEBOX</div>
      <div class="dash-nn-title muted" style="font-size:14px">Nothing due today.</div>
      <div class="dash-nn-meta">Enjoy the open runway — or pull work forward.</div>`;
    return;
  }

  const rows = due.map(t => {
    const overdue = t.dueDate < today;
    return `<div class="dash-task-row" draggable="true" data-dash-task="${escAttr(t.id)}" title="Drag onto the timeline to place it — or click to pick a time">
      <span class="dash-task-check" data-dash-done="${escAttr(t.id)}" title="Mark complete"></span>
      <span class="dash-task-dot" style="--nc:${getCatColor(t.category)}"></span>
      <span class="dash-task-name">${escHtml(t.title)}</span>
      ${overdue ? '<span class="dash-task-over">OVERDUE</span>' : ''}
      <span class="dash-task-box" data-dash-timebox="${escAttr(t.id)}">◷ Timebox</span>
      <span class="dash-task-del" data-dash-del="${escAttr(t.id)}" title="Delete task">✕</span>
    </div>`;
  }).join('');

  el.innerHTML =
    `<div class="dash-eyebrow">DUE TODAY · ${due.length} · DRAG TO TIMEBOX</div>
     <div class="dash-task-list">${rows}</div>`;

  el.querySelectorAll('[data-dash-task]').forEach(r => {
    r.addEventListener('dragstart', e => {
      _dashDragPayload = { kind: 'task', id: r.dataset.dashTask };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'task:' + r.dataset.dashTask);
      r.classList.add('dragging');
    });
    r.addEventListener('dragend', () => { _dashDragPayload = null; r.classList.remove('dragging'); });
    // Plain click on the row (not on a control) → schedule modal to pick a time
    r.addEventListener('click', e => {
      if (e.target.closest('[data-dash-done],[data-dash-del],[data-dash-timebox]')) return;
      openScheduleModal(today, '09:00', r.dataset.dashTask, null);
    });
  });
  // Complete a task in place — opens the time-spent + category popover first
  // (same close flow as the Tasks page), so nothing is logged as done blindly.
  el.querySelectorAll('[data-dash-done]').forEach(c => c.addEventListener('click', e => {
    e.stopPropagation(); handleCheckClick(c.dataset.dashDone, e);
  }));
  // Delete a task in place (undo handled by deleteTask)
  el.querySelectorAll('[data-dash-del]').forEach(d => d.addEventListener('click', e => {
    e.stopPropagation(); deleteTask(d.dataset.dashDel);
  }));
  // Explicit timebox button → same schedule modal
  el.querySelectorAll('[data-dash-timebox]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); openScheduleModal(today, '09:00', b.dataset.dashTimebox, null);
  }));
}

function renderDashboardBoard() {
  if (_mainPanel !== 'default') return;
  const titleEl = document.getElementById('dash-cal-title');
  if (titleEl) titleEl.textContent = _dashCalDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  // Eyebrow shows TODAY / TOMORROW / YESTERDAY / the day-of-week for other days
  const eyebrowEl = document.getElementById('dash-cal-eyebrow');
  if (eyebrowEl) {
    const diff = Math.round((new Date(localDateStr(_dashCalDate)) - new Date(localDateStr(new Date()))) / 86400000);
    eyebrowEl.textContent = diff === 0 ? 'TODAY' : diff === 1 ? 'TOMORROW' : diff === -1 ? 'YESTERDAY'
      : _dashCalDate.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
  }
  _dashRenderTodayLine();
  _dashRenderCards();
  _dashRenderRituals();
  _dashRenderTasks();
}
window.renderDashboardBoard = renderDashboardBoard;

// Step the dashboard calendar day forward/back (or jump home) and re-render.
function _dashShiftDay(delta) {
  _dashCalDate = new Date(_dashCalDate.getTime());
  _dashCalDate.setDate(_dashCalDate.getDate() + delta);
  renderDashboardBoard();
}
function _dashGoToday() { _dashCalDate = new Date(); renderDashboardBoard(); }

// Toolbar actions
(function _wireDashQuickAdd() {
  const qa = document.getElementById('dash-quick-add');
  const inp = document.getElementById('dash-quick-add-input');
  const hide = () => { if (qa) qa.style.display = 'none'; if (inp) inp.value = ''; };
  document.getElementById('dash-add-task')?.addEventListener('click', () => {
    if (!qa) return;
    const showing = qa.style.display !== 'none';
    qa.style.display = showing ? 'none' : '';
    if (!showing) setTimeout(() => inp?.focus(), 20);
  });
  inp?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = inp.value.trim();
      if (v) addTask(v, 'med', localDateStr(_dashCalDate));
      hide();
    } else if (e.key === 'Escape') { hide(); }
  });
  inp?.addEventListener('blur', () => setTimeout(hide, 120));
})();
document.getElementById('dash-add-event')?.addEventListener('click', () => {
  openQuickCalModal(localDateStr(_dashCalDate), '09:00');
});
document.getElementById('dash-add-ms')?.addEventListener('click', () => {
  window._planMilestonePicker
    ? window._planMilestonePicker(localDateStr(_dashCalDate))
    : document.getElementById('cal-add-milestone')?.click();
});
// Day navigation (‹ today ›)
document.getElementById('dash-cal-prev')?.addEventListener('click', () => _dashShiftDay(-1));
document.getElementById('dash-cal-next')?.addEventListener('click', () => _dashShiftDay(1));
document.getElementById('dash-cal-today')?.addEventListener('click', () => _dashGoToday());

// Keep the running-commit timer live while the dashboard is visible
setInterval(() => {
  if (_mainPanel !== 'default') return;
  if (_commitInterval && _commitTaskId) {
    const el = document.getElementById('dash-commit-timer');
    if (el) {
      const m = Math.floor(_commitElapsed / 60), s = _commitElapsed % 60;
      el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
  }
}, 1000);
/* ══ MIND MAP ENGINE ══════════════════════════════════════════════════════ */
window.initMindMap = (function(){
  let _init = false;
  return function initMindMap() {
    const canvas = document.getElementById('mm-canvas');
    if (!canvas) return;
    if (_init) { _mmResize(); return; }
    _init = true;

    const ctx = canvas.getContext('2d');
    let nodes = [];      // { id, x, y, text, color }
    let edges = [];      // { from, to }
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    let tool = 'select'; // 'select' | 'connect'
    let drag = null;     // { nodeId, ox, oy }
    let panDrag = null;  // { sx, sy, px, py }
    let selected = null; // nodeId
    let connectFrom = null;
    let editing = null;  // nodeId being edited
    let editEl = null;
    const NODE_W = 140, NODE_H = 44, NODE_R = 10;
    const COLORS = [
      'rgba(61,184,255,0.18)','rgba(255,130,180,0.18)','rgba(224,85,85,0.18)',
      'rgba(255,255,255,0.08)','rgba(100,200,140,0.15)'
    ];
    const STROKE_COLORS = [
      'rgba(61,184,255,0.55)','rgba(255,130,180,0.55)','rgba(224,85,85,0.55)',
      'rgba(255,255,255,0.28)','rgba(100,200,140,0.5)'
    ];
    let colorIdx = 0;

    function _mmResize() {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      draw();
    }
    window._mmResize = _mmResize;

    function worldToScreen(wx, wy) {
      return { x: wx * zoom + pan.x, y: wy * zoom + pan.y };
    }
    function screenToWorld(sx, sy) {
      return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
    }
    function hitNode(wx, wy) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (wx >= n.x - NODE_W/2 && wx <= n.x + NODE_W/2 &&
            wy >= n.y - NODE_H/2 && wy <= n.y + NODE_H/2) return n;
      }
      return null;
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.lineTo(x+w-r, y);
      ctx.arcTo(x+w, y, x+w, y+r, r);
      ctx.lineTo(x+w, y+h-r);
      ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
      ctx.lineTo(x+r, y+h);
      ctx.arcTo(x, y+h, x, y+h-r, r);
      ctx.lineTo(x, y+r);
      ctx.arcTo(x, y, x+r, y, r);
      ctx.closePath();
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Grid dots
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      const gridSpacing = 32 * zoom;
      const ox = ((pan.x % gridSpacing) + gridSpacing) % gridSpacing;
      const oy = ((pan.y % gridSpacing) + gridSpacing) % gridSpacing;
      for (let gx = ox; gx < canvas.width; gx += gridSpacing)
        for (let gy = oy; gy < canvas.height; gy += gridSpacing)
          { ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI*2); ctx.fill(); }
      ctx.restore();

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Edges
      edges.forEach(e => {
        const a = nodes.find(n=>n.id===e.from);
        const b = nodes.find(n=>n.id===e.to);
        if (!a || !b) return;
        ctx.beginPath();
        const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      });

      // Connect-mode line preview handled via mousemove

      // Nodes
      nodes.forEach(n => {
        const x = n.x - NODE_W/2, y = n.y - NODE_H/2;
        const ci = n.colorIdx || 0;
        // Backdrop blur simulation via layered fills
        ctx.save();
        roundRect(ctx, x, y, NODE_W, NODE_H, NODE_R);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.fillStyle = COLORS[ci % COLORS.length];
        ctx.fill();
        ctx.strokeStyle = selected === n.id ? 'rgba(255,255,255,0.65)' :
                          connectFrom === n.id ? 'rgba(61,184,255,0.85)' :
                          STROKE_COLORS[ci % STROKE_COLORS.length];
        ctx.lineWidth = selected === n.id || connectFrom === n.id ? 1.5/zoom : 1/zoom;
        ctx.stroke();
        ctx.restore();

        // Text
        ctx.save();
        ctx.font = `300 ${12/zoom > 14 ? 14 : 12}px 'Instrument Sans', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxW = NODE_W - 20;
        let label = n.text || '…';
        if (ctx.measureText(label).width > maxW) {
          while (label.length > 1 && ctx.measureText(label+'…').width > maxW) label = label.slice(0,-1);
          label += '…';
        }
        ctx.fillText(label, n.x, n.y);
        ctx.restore();
      });

      ctx.restore();
    }

    function addNode(wx, wy, text='') {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
      const node = { id, x: wx, y: wy, text, colorIdx: colorIdx % COLORS.length };
      colorIdx++;
      nodes.push(node);
      selected = id;
      draw();
      if (!text) startEdit(node);
      return node;
    }

    function deleteSelected() {
      if (!selected) return;
      nodes = nodes.filter(n => n.id !== selected);
      edges = edges.filter(e => e.from !== selected && e.to !== selected);
      selected = null;
      connectFrom = null;
      draw();
    }

    function startEdit(node) {
      if (editing) finishEdit();
      editing = node.id;
      const sp = worldToScreen(node.x - NODE_W/2, node.y - NODE_H/2);
      if (!editEl) {
        editEl = document.createElement('input');
        editEl.style.cssText = `position:absolute;background:rgba(0,0,0,0.82);border:1px solid rgba(255,255,255,0.35);color:#fff;border-radius:6px;padding:4px 10px;font-family:'Instrument Sans',sans-serif;font-size:12px;outline:none;z-index:10;box-sizing:border-box;`;
        canvas.parentElement.appendChild(editEl);
        editEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
          if (e.key === 'Escape') { cancelEdit(); }
          e.stopPropagation();
        });
        editEl.addEventListener('blur', () => finishEdit());
      }
      editEl.value = node.text;
      editEl.style.left = sp.x + 'px';
      editEl.style.top = sp.y + 'px';
      editEl.style.width = (NODE_W * zoom) + 'px';
      editEl.style.height = (NODE_H * zoom) + 'px';
      editEl.style.display = 'block';
      editEl.style.lineHeight = (NODE_H * zoom) + 'px';
      editEl.style.textAlign = 'center';
      setTimeout(()=>{ editEl.focus(); editEl.select(); }, 10);
    }

    function finishEdit() {
      if (!editing) return;
      const node = nodes.find(n => n.id === editing);
      if (node && editEl) node.text = editEl.value.trim() || '…';
      editing = null;
      if (editEl) editEl.style.display = 'none';
      draw();
    }

    function cancelEdit() {
      const node = nodes.find(n => n.id === editing);
      // if node was just created with no text, remove it
      if (node && !node.text) { nodes = nodes.filter(n=>n.id!==editing); selected=null; }
      editing = null;
      if (editEl) editEl.style.display = 'none';
      draw();
    }

    function centerView() {
      if (!nodes.length) { pan = { x: canvas.width/2, y: canvas.height/2 }; zoom = 1; draw(); return; }
      const xs = nodes.map(n=>n.x), ys = nodes.map(n=>n.y);
      const cx = (Math.min(...xs)+Math.max(...xs))/2;
      const cy = (Math.min(...ys)+Math.max(...ys))/2;
      pan = { x: canvas.width/2 - cx*zoom, y: canvas.height/2 - cy*zoom };
      draw();
    }

    // ── Mouse / Touch ────────────────────────────────────
    let connectPreview = null;
    canvas.addEventListener('mousedown', e => {
      if (editing) { finishEdit(); return; }
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy);
      const hit = hitNode(w.x, w.y);

      if (tool === 'connect') {
        if (hit) {
          if (!connectFrom) { connectFrom = hit.id; draw(); }
          else if (connectFrom !== hit.id) {
            const exists = edges.find(ed=>(ed.from===connectFrom&&ed.to===hit.id)||(ed.from===hit.id&&ed.to===connectFrom));
            if (!exists) edges.push({ from: connectFrom, to: hit.id });
            connectFrom = null; draw();
          }
        } else { connectFrom = null; draw(); }
        return;
      }

      // select tool
      if (hit) {
        selected = hit.id;
        drag = { nodeId: hit.id, ox: w.x - hit.x, oy: w.y - hit.y };
        draw();
      } else {
        selected = null;
        panDrag = { sx, sy, px: pan.x, py: pan.y };
        draw();
      }
    });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy);

      if (tool === 'connect' && connectFrom) {
        connectPreview = { wx: w.x, wy: w.y };
        // Redraw with preview line
        draw();
        ctx.save();
        ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);
        const a = nodes.find(n=>n.id===connectFrom);
        if (a) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(w.x, w.y);
          ctx.strokeStyle = 'rgba(61,184,255,0.6)'; ctx.lineWidth = 1.5/zoom; ctx.setLineDash([4/zoom,4/zoom]); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();
        return;
      }
      connectPreview = null;

      if (drag) {
        const node = nodes.find(n=>n.id===drag.nodeId);
        if (node) { node.x = w.x - drag.ox; node.y = w.y - drag.oy; draw(); }
      } else if (panDrag) {
        pan.x = panDrag.px + (sx - panDrag.sx);
        pan.y = panDrag.py + (sy - panDrag.sy);
        draw();
      }

      // cursor
      const hit = hitNode(w.x, w.y);
      canvas.style.cursor = hit ? (tool==='connect' ? 'crosshair' : 'grab') : (tool==='connect'?'crosshair':'default');
    });

    canvas.addEventListener('mouseup', () => {
      drag = null; panDrag = null;
    });

    canvas.addEventListener('dblclick', e => {
      if (editing) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy);
      const hit = hitNode(w.x, w.y);
      if (hit) { selected = hit.id; startEdit(hit); }
      else { addNode(w.x, w.y); }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1.12 : 1/1.12;
      const newZoom = Math.min(4, Math.max(0.2, zoom * delta));
      pan.x = mx - (mx - pan.x) * (newZoom/zoom);
      pan.y = my - (my - pan.y) * (newZoom/zoom);
      zoom = newZoom;
      draw();
    }, { passive: false });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (document.getElementById('panel-mindmap')?.style.display === 'none') return;
      if (editing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { if(selected) { e.preventDefault(); deleteSelected(); } }
      if (e.key === ' ') { e.preventDefault(); centerView(); }
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'c' || e.key === 'C') setTool('connect');
      if (e.key === 'a' || e.key === 'A') {
        const w = screenToWorld(canvas.width/2, canvas.height/2);
        addNode(w.x + (Math.random()-0.5)*80, w.y + (Math.random()-0.5)*80);
      }
    });

    function setTool(t) {
      tool = t;
      connectFrom = null;
      document.querySelectorAll('.mm-tool-btn[data-tool]').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === t);
      });
      draw();
    }

    // Toolbar buttons
    document.getElementById('mm-tool-select')?.addEventListener('click', () => setTool('select'));
    document.getElementById('mm-tool-connect')?.addEventListener('click', () => setTool('connect'));
    document.getElementById('mm-btn-add')?.addEventListener('click', () => {
      const w = screenToWorld(canvas.width/2, canvas.height/2);
      addNode(w.x + (Math.random()-0.5)*100, w.y + (Math.random()-0.5)*100);
    });
    document.getElementById('mm-btn-delete')?.addEventListener('click', deleteSelected);
    document.getElementById('mm-btn-center')?.addEventListener('click', centerView);
    document.getElementById('mm-btn-clear')?.addEventListener('click', () => {
      if (!nodes.length || confirm('Clear all nodes?')) { nodes=[]; edges=[]; selected=null; connectFrom=null; draw(); }
    });

    // Initial state — seed with a root node
    pan = { x: canvas.width/2, y: canvas.height/2 };
    addNode(0, 0, 'Central Idea');
    selected = null;
    draw();

    new ResizeObserver(_mmResize).observe(canvas.parentElement);
  };
})();
/* ══ DAILY BUSINESS COMMUNICATION DRILL ══ */
// → future file: cosmodex-drill.js
// Practice defending decisions, translating technical issues, and communicating
// with executive presence — not English-language practice, business communication rigor.

/* ── Prompt bank ─────────────────────────────────────────── */
const DRILL_CATEGORIES = {
  stakeholder_pushback: { label: 'Stakeholder Pushback' },
  escalation:           { label: 'Escalation' },
  roadmap_defense:      { label: 'Roadmap & Scope Defense' },
  tech_translation:     { label: 'Technical → Non-Technical' },
  negotiation:          { label: 'Negotiation' },
  bad_news:             { label: 'Delivering Bad News' },
  feedback_upward:      { label: 'Feedback Upward' },
};

const DRILL_PROMPT_BANK = [
  // ── Stakeholder Pushback ──────────────────────────────
  { id: 'sp01', category: 'stakeholder_pushback', difficulty: 2,
    context_setup: "You're a PM on a card-issuing platform. A senior Ops director emails: \"I don't understand why the fraud-rules change needs a full sprint. Just flip the config.\"",
    scenario_text: 'Reply to the director explaining why this isn\'t a config flip, without sounding defensive.' },
  { id: 'sp02', category: 'stakeholder_pushback', difficulty: 1,
    context_setup: 'A regional sales lead insists your new onboarding flow will "kill conversion" based on a gut feeling, with no data. Leadership is in the thread.',
    scenario_text: 'Respond in a way that takes the concern seriously but keeps the decision anchored in evidence.' },
  { id: 'sp03', category: 'stakeholder_pushback', difficulty: 3,
    context_setup: "Compliance blocks your launch two days before go-live, citing a rule you believe doesn't apply to this product. The compliance lead won't get on a call, only email.",
    scenario_text: 'Write the email that gets this resolved without escalating over their head on day one.' },
  { id: 'sp04', category: 'stakeholder_pushback', difficulty: 2,
    context_setup: 'A vendor\'s account manager tells your steering committee the delay is "on your side" — it isn\'t; their sandbox has been down for a week.',
    scenario_text: 'Respond live in the meeting, correcting the record without making it personal.' },
  { id: 'sp05', category: 'stakeholder_pushback', difficulty: 1,
    context_setup: 'A designer pushes back on a deadline you set, saying it doesn\'t leave room for usability testing on the new payments flow.',
    scenario_text: 'Respond to the designer — decide whether to hold or move the date, and say why.' },
  { id: 'sp06', category: 'stakeholder_pushback', difficulty: 2,
    context_setup: 'The Head of Risk says your dashboard\'s "real-time" claim is misleading since data lags by 15 minutes, and wants the feature pulled from the release notes.',
    scenario_text: 'Respond to the Head of Risk with your position on the release notes.' },

  // ── Escalation ─────────────────────────────────────────
  { id: 'esc01', category: 'escalation', difficulty: 2,
    context_setup: 'A core banking API your platform depends on has been silently dropping ~2% of transactions for three days. The owning team hasn\'t replied to your ticket.',
    scenario_text: 'Draft the escalation message to your VP and their VP that gets action today.' },
  { id: 'esc02', category: 'escalation', difficulty: 3,
    context_setup: 'You discover the reconciliation job has been double-counting fees since last Tuesday\'s deploy. Finance hasn\'t noticed yet.',
    scenario_text: 'Write the message that surfaces this to your director before Finance finds it themselves.' },
  { id: 'esc03', category: 'escalation', difficulty: 1,
    context_setup: 'Your third-party KYC vendor has missed their SLA for the fourth time this quarter, and your team is quietly absorbing the delay.',
    scenario_text: 'Escalate this to your manager in a way that asks for something specific, not just sympathy.' },
  { id: 'esc04', category: 'escalation', difficulty: 2,
    context_setup: 'A peer PM keeps merging changes into the shared test environment without warning, breaking your team\'s QA runs twice this week.',
    scenario_text: 'Raise this with the peer PM directly before looping in either manager.' },
  { id: 'esc05', category: 'escalation', difficulty: 3,
    context_setup: 'A security scan flagged a credential left in a public repo six weeks ago. It was rotated last week, but no one reported the exposure window.',
    scenario_text: 'Escalate this incident to security leadership, including what you don\'t yet know.' },
  { id: 'esc06', category: 'escalation', difficulty: 2,
    context_setup: 'Your infra team says the migration is "on track," but your own dashboards show error rates climbing for two straight days.',
    scenario_text: 'Escalate the discrepancy without accusing the infra team of lying.' },

  // ── Roadmap & Scope Defense ────────────────────────────
  { id: 'rd01', category: 'roadmap_defense', difficulty: 2,
    context_setup: 'The CFO asks why the platform migration is taking two quarters when a competitor announced a similar feature "in weeks."',
    scenario_text: 'Defend the timeline to the CFO without sounding like you\'re making excuses.' },
  { id: 'rd02', category: 'roadmap_defense', difficulty: 1,
    context_setup: 'A stakeholder wants to add real-time currency conversion to next sprint — a two-line request that\'s actually a multi-week integration.',
    scenario_text: 'Respond, setting expectations on what "adding" this actually means.' },
  { id: 'rd03', category: 'roadmap_defense', difficulty: 3,
    context_setup: 'Three VPs each believe their initiative is "the top priority" for your team next quarter. You can fully deliver exactly one.',
    scenario_text: 'Write the message to all three that sets the record straight on sequencing.' },
  { id: 'rd04', category: 'roadmap_defense', difficulty: 2,
    context_setup: 'Leadership wants to cut your technical-debt sprint to fund a new dashboard feature demo for the board next month.',
    scenario_text: 'Make the case for keeping the tech-debt work, in terms leadership will act on.' },
  { id: 'rd05', category: 'roadmap_defense', difficulty: 1,
    context_setup: 'A stakeholder keeps asking "can we just also add" small requests into an already-committed sprint scope.',
    scenario_text: 'Respond to the latest request in a way that protects the sprint without shutting the door.' },
  { id: 'rd06', category: 'roadmap_defense', difficulty: 2,
    context_setup: 'Your roadmap review is in ten minutes and someone just asked why "fraud detection improvements" — one line on the roadmap — took a full quarter.',
    scenario_text: 'Give the 90-second verbal answer you\'d give walking into that review.' },

  // ── Technical → Non-Technical ──────────────────────────
  { id: 'tt01', category: 'tech_translation', difficulty: 2,
    context_setup: 'The platform had a 40-minute outage caused by a connection-pool exhaustion during a batch job. The exec summary is due in an hour.',
    scenario_text: 'Explain what happened and what\'s changing, for an audience with zero engineering background.' },
  { id: 'tt02', category: 'tech_translation', difficulty: 1,
    context_setup: 'A business stakeholder asks why "just adding an index" to the database will take two sprints, not an afternoon.',
    scenario_text: 'Explain the real scope in plain language, without being condescending.' },
  { id: 'tt03', category: 'tech_translation', difficulty: 3,
    context_setup: 'You need to explain to the Head of Retail Banking why moving to an event-driven architecture reduces risk, when the current system "works fine."',
    scenario_text: 'Make the case in business terms — no architecture jargon.' },
  { id: 'tt04', category: 'tech_translation', difficulty: 2,
    context_setup: 'Latency on the mobile app has crept from 200ms to 900ms over two months due to unindexed query growth. A regional director wants "the one-sentence version."',
    scenario_text: 'Give the one-sentence version, then the 30-second follow-up if they ask "why."' },
  { id: 'tt05', category: 'tech_translation', difficulty: 1,
    context_setup: 'A stakeholder wants to know why a "simple" API integration with a fintech partner needs a full security review.',
    scenario_text: 'Explain the review requirement in terms that don\'t sound like bureaucracy for its own sake.' },
  { id: 'tt06', category: 'tech_translation', difficulty: 3,
    context_setup: 'The board wants a plain-language explanation of why the platform can\'t simply "turn on" real-time fraud scoring for all transactions immediately.',
    scenario_text: 'Write the two-paragraph explanation for the board deck.' },

  // ── Negotiation ─────────────────────────────────────────
  { id: 'ng01', category: 'negotiation', difficulty: 2,
    context_setup: 'A vendor wants to charge a change-request fee for a fix to a bug that was in their original scope.',
    scenario_text: 'Negotiate the fee away, or justify why you\'d pay it.' },
  { id: 'ng02', category: 'negotiation', difficulty: 1,
    context_setup: 'Two teams both need the same shared QA environment the week before their respective launches.',
    scenario_text: 'Negotiate the schedule with the other team\'s lead.' },
  { id: 'ng03', category: 'negotiation', difficulty: 3,
    context_setup: 'You need three more engineers for Q3, but the platform lead says headcount is frozen and every other PM is asking the same thing.',
    scenario_text: 'Make your case for headcount in the resourcing meeting.' },
  { id: 'ng04', category: 'negotiation', difficulty: 2,
    context_setup: 'A partner bank wants to renegotiate the SLA terms mid-contract, citing "market conditions," right before your joint go-live.',
    scenario_text: 'Respond to their renegotiation request.' },
  { id: 'ng05', category: 'negotiation', difficulty: 1,
    context_setup: 'Your UX researcher and your engineering lead disagree on how much time user testing should take before build starts, and both want you to just pick a side.',
    scenario_text: 'Facilitate this — decide, and explain the decision to both of them.' },
  { id: 'ng06', category: 'negotiation', difficulty: 2,
    context_setup: 'A stakeholder offers to "help" your project by assigning their own analyst, but that analyst reports scope changes back to them, not to you.',
    scenario_text: 'Set the terms for accepting or declining this help.' },

  // ── Delivering Bad News ─────────────────────────────────
  { id: 'bn01', category: 'bad_news', difficulty: 2,
    context_setup: 'The Q3 platform launch will miss its date by three weeks because a critical vendor integration failed load testing.',
    scenario_text: 'Deliver this news to your steering committee.' },
  { id: 'bn02', category: 'bad_news', difficulty: 1,
    context_setup: 'A feature you promised in last month\'s roadmap review has to be cut from this release due to a security finding.',
    scenario_text: 'Tell the stakeholder who was most excited about it.' },
  { id: 'bn03', category: 'bad_news', difficulty: 3,
    context_setup: 'A production incident caused roughly 1,200 customers to see each other\'s account balances for eleven minutes before it was caught.',
    scenario_text: 'Deliver the initial notification to executive leadership, before the full root cause is known.' },
  { id: 'bn04', category: 'bad_news', difficulty: 2,
    context_setup: 'The cost estimate for the platform migration has grown 35% since the original business case was approved.',
    scenario_text: 'Tell the sponsoring VP, who approved the original budget.' },
  { id: 'bn05', category: 'bad_news', difficulty: 1,
    context_setup: 'Your team can\'t take on the "quick win" a stakeholder requested this quarter — it would require pulling engineers off a committed regulatory deadline.',
    scenario_text: 'Deliver the no.' },
  { id: 'bn06', category: 'bad_news', difficulty: 2,
    context_setup: 'A key engineer who owns most of the tribal knowledge for a critical service just resigned, effective in two weeks.',
    scenario_text: 'Tell your director what this means for the roadmap.' },

  // ── Feedback Upward ──────────────────────────────────────
  { id: 'fu01', category: 'feedback_upward', difficulty: 2,
    context_setup: 'Your director keeps committing your team to dates in exec meetings before checking with you, and it\'s eroding trust with engineering.',
    scenario_text: 'Raise this with your director in your next 1:1.' },
  { id: 'fu02', category: 'feedback_upward', difficulty: 1,
    context_setup: 'A senior stakeholder cc\'s your manager on every minor disagreement instead of resolving it with you directly.',
    scenario_text: 'Address this pattern with the stakeholder.' },
  { id: 'fu03', category: 'feedback_upward', difficulty: 3,
    context_setup: 'Your skip-level consistently interrupts you in cross-functional meetings and finishes your sentences with the wrong conclusion.',
    scenario_text: 'Give this feedback to your skip-level.' },
  { id: 'fu04', category: 'feedback_upward', difficulty: 2,
    context_setup: 'Your manager asked you to "just say yes" to a stakeholder\'s scope request to keep the peace, but you think it sets a bad precedent.',
    scenario_text: 'Push back on your manager\'s instruction.' },
  { id: 'fu05', category: 'feedback_upward', difficulty: 1,
    context_setup: 'Leadership praised a launch in the all-hands but credited the wrong team for the core work your team actually did.',
    scenario_text: 'Raise this with your leadership, without sounding petty.' },
  { id: 'fu06', category: 'feedback_upward', difficulty: 2,
    context_setup: 'Your director asks for your honest read on whether the reorg announced last week will hurt delivery — in front of two other directors.',
    scenario_text: 'Give your honest answer, live, in the room.' },
];

/* ── Rubric (fixed, 1-5 scale each dimension) ──────────────── */
const DRILL_RUBRIC = {
  clarity:       { label: 'Clarity',                     desc: 'The message is unambiguous and lands on first read.', invert: false },
  structure:     { label: 'Structure & Economy',         desc: 'Leads with the point; says more with less; no rambling.', invert: false },
  hedging:       { label: 'Hedging / Filler (lower = better)', desc: 'Qualifiers like "just", "I think", passive voice, unnecessary softening.', invert: true },
  presence:      { label: 'Executive Presence / Directness', desc: 'Speaks with ownership and confidence, not apologetically.', invert: false },
  actionability: { label: 'Actionability',               desc: 'Ends with a clear ask, decision, or next step.', invert: false },
};
const DRILL_RUBRIC_ORDER = ['clarity', 'structure', 'hedging', 'presence', 'actionability'];

/* ── Local state ────────────────────────────────────────────── */
let _drillPendingId  = null;   // Firestore doc id for today's in-progress response
let _drillTimerId    = null;   // setInterval handle
let _drillTimerLeft  = 0;      // seconds remaining
let _drillTimerTotal = 0;
let _drillRecognition = null;  // active SpeechRecognition instance, if recording

// Shape: { apiEnabled, provider: 'anthropic'|'deepseek', apiKeys: { anthropic, deepseek } }
// Provider grading logic lives in src/12-drill-providers.js (DRILL_PROVIDERS, drillAutoGrade).
function _drillSettings() {
  let s;
  try { s = JSON.parse(localStorage.getItem('cdx_drill_settings') || 'null'); } catch (e) { s = null; }
  if (!s) return { apiEnabled: false, provider: 'anthropic', apiKeys: { anthropic: '', deepseek: '' } };
  if (!s.apiKeys) s.apiKeys = { anthropic: s.apiKey || '', deepseek: '' }; // migrate old single-key shape
  if (!s.provider) s.provider = 'anthropic';
  return s;
}
function _saveDrillSettings(s) { localStorage.setItem('cdx_drill_settings', JSON.stringify(s)); }

/* ── Daily scenario selection: weighted rotation ───────────── */
function _drillCatLastShown() {
  try { return JSON.parse(localStorage.getItem('cdx_drill_cat_last_shown') || '{}'); } catch (e) { return {}; }
}
function _drillSeenIds() {
  try { return JSON.parse(localStorage.getItem('cdx_drill_seen_ids') || '{}'); } catch (e) { return {}; }
}
function _daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T00:00:00'), b = new Date(dateStrB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Composite score for trend/weighting: all dimensions oriented "higher = better" (hedging inverted).
function _drillComposite(scores) {
  const vals = DRILL_RUBRIC_ORDER.map(k => DRILL_RUBRIC[k].invert ? (6 - scores[k]) : scores[k]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function _drillCategoryWeight(catId, todayStr) {
  const lastShown = _drillCatLastShown()[catId];
  const daysSince = lastShown ? _daysBetween(lastShown, todayStr) : 999;
  let w = 1;
  if (daysSince >= 14) w *= 3;
  else if (daysSince <= 1) w *= 0.25;

  const recent = DRILL_RESPONSES.filter(r => r.category === catId && r.scores).slice(-5);
  if (recent.length) {
    const avg = recent.reduce((sum, r) => sum + _drillComposite(r.scores), 0) / recent.length;
    w *= (6 - avg); // lower recent score → higher weight
  }
  return Math.max(w, 0.05);
}

function _pickWeighted(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickTodayScenario() {
  const todayStr = localDateStr(new Date());
  const stored = JSON.parse(localStorage.getItem('cdx_drill_today') || 'null');
  if (stored && stored.date === todayStr) {
    return DRILL_PROMPT_BANK.find(p => p.id === stored.scenarioId) || DRILL_PROMPT_BANK[0];
  }

  const catIds = Object.keys(DRILL_CATEGORIES);
  const catId = _pickWeighted(catIds, c => _drillCategoryWeight(c, todayStr));

  const seen = _drillSeenIds();
  const catBank = DRILL_PROMPT_BANK.filter(p => p.category === catId);
  let seenForCat = seen[catId] || [];
  let available = catBank.filter(p => !seenForCat.includes(p.id));
  if (!available.length) { seenForCat = []; available = catBank; } // bank cycled — reset
  const scenario = available[Math.floor(Math.random() * available.length)];

  seenForCat.push(scenario.id);
  seen[catId] = seenForCat;
  localStorage.setItem('cdx_drill_seen_ids', JSON.stringify(seen));

  const lastShown = _drillCatLastShown();
  lastShown[catId] = todayStr;
  localStorage.setItem('cdx_drill_cat_last_shown', JSON.stringify(lastShown));

  localStorage.setItem('cdx_drill_today', JSON.stringify({ date: todayStr, scenarioId: scenario.id }));
  return scenario;
}

/* ── Firestore ──────────────────────────────────────────────── */
async function _drillSubmitResponse(scenario, responseText, timedSeconds) {
  const { addDoc, serverTimestamp } = window.CDX_FB;
  const todayStr = localDateStr(new Date());
  const docRef = await addDoc(_uc('drillResponses'), {
    date: todayStr,
    scenarioId: scenario.id,
    category: scenario.category,
    difficulty: scenario.difficulty,
    scenarioText: scenario.scenario_text,
    contextSetup: scenario.context_setup,
    responseText,
    timedSeconds: timedSeconds || null,
    graded: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

async function _drillSaveGrading(docId, parsed) {
  const { setDoc, serverTimestamp } = window.CDX_FB;
  await setDoc(_ud('drillResponses', docId), {
    scores: parsed.scores,
    reasons: parsed.reasons || {},
    modelAnswer: parsed.model_answer || '',
    notes: parsed.notes || '',
    graded: true,
    gradedAt: serverTimestamp(),
  }, { merge: true });
}

/* ── Grading workflow: Copy-to-Claude / Paste-Feedback ─────── */
function _drillBuildGradingBlock(scenario, responseText) {
  const rubricLines = DRILL_RUBRIC_ORDER.map(k => `- ${DRILL_RUBRIC[k].label}: ${DRILL_RUBRIC[k].desc}`).join('\n');
  return `You are grading a business-communication drill response for a Product Manager practicing executive presence. Score it on this fixed rubric, 1-5 each dimension:
${rubricLines}

SCENARIO (category: ${DRILL_CATEGORIES[scenario.category]?.label || scenario.category}, difficulty: ${scenario.difficulty}/3)
Context: ${scenario.context_setup}
Prompt: ${scenario.scenario_text}

MY RESPONSE:
${responseText}

Do the following:
(a) Score each rubric dimension 1-5 with a one-line reason.
(b) Rewrite my response as a strong "model answer" — same situation, executive-level communication.
(c) Return everything as clean JSON, and nothing else, in exactly this shape:
{"scores":{"clarity":n,"structure":n,"hedging":n,"presence":n,"actionability":n},"reasons":{"clarity":"...","structure":"...","hedging":"...","presence":"...","actionability":"..."},"model_answer":"...","notes":"..."}`;
}

async function copyDrillToClaude() {
  const scenario = DRILL_PROMPT_BANK.find(p => p.id === (window._drillActiveScenarioId));
  const textarea = document.getElementById('drill-response-input');
  if (!scenario || !textarea || !textarea.value.trim()) { showToast('Write a response first.', 'error'); return; }
  const block = _drillBuildGradingBlock(scenario, textarea.value.trim());
  try {
    await navigator.clipboard.writeText(block);
    showToast('Copied — paste into a Claude.ai chat, then paste the JSON reply back here.', 'success');
  } catch (e) {
    showToast('Clipboard write failed — select and copy manually.', 'error');
  }
}

function _drillParseFeedbackJson(raw) {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const parsed = JSON.parse(text);
  if (!parsed.scores) throw new Error('Missing "scores" object');
  for (const k of DRILL_RUBRIC_ORDER) {
    const v = parsed.scores[k];
    if (typeof v !== 'number' || v < 1 || v > 5) throw new Error(`Invalid score for "${k}"`);
  }
  return parsed;
}

async function parseAndSaveDrillFeedback() {
  const box = document.getElementById('drill-paste-feedback');
  if (!box || !box.value.trim()) { showToast('Paste the JSON reply first.', 'error'); return; }
  if (!_drillPendingId) { showToast('No response to attach this feedback to.', 'error'); return; }
  let parsed;
  try { parsed = _drillParseFeedbackJson(box.value); }
  catch (e) { showToast('Could not parse JSON: ' + e.message, 'error'); return; }
  try {
    await _drillSaveGrading(_drillPendingId, parsed);
    showToast('Graded and saved.', 'success');
    box.value = '';
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

// Optional direct-API auto-grading (off by default) lives in
// src/12-drill-providers.js — DRILL_PROVIDERS registry + drillAutoGrade().

/* ── Timer ──────────────────────────────────────────────────── */
function startDrillTimer(minutes) {
  stopDrillTimer();
  _drillTimerTotal = minutes * 60;
  _drillTimerLeft = _drillTimerTotal;
  _renderDrillTimerDisplay();
  _drillTimerId = setInterval(() => {
    _drillTimerLeft--;
    _renderDrillTimerDisplay();
    if (_drillTimerLeft <= 0) stopDrillTimer();
  }, 1000);
}
function stopDrillTimer() {
  if (_drillTimerId) { clearInterval(_drillTimerId); _drillTimerId = null; }
}
function _renderDrillTimerDisplay() {
  const el = document.getElementById('drill-timer-display');
  if (!el) return;
  const m = Math.floor(Math.max(_drillTimerLeft, 0) / 60), s = Math.max(_drillTimerLeft, 0) % 60;
  el.textContent = `${m}:${String(s).padStart(2, '0')}`;
  el.classList.toggle('drill-timer-critical', _drillTimerLeft <= 30 && _drillTimerLeft > 0);
  el.classList.toggle('drill-timer-done', _drillTimerLeft <= 0);
}

/* ── Voice-to-text ──────────────────────────────────────────── */
function _drillVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function toggleDrillVoiceInput() {
  const btn = document.getElementById('drill-voice-btn');
  const textarea = document.getElementById('drill-response-input');
  if (!textarea) return;
  if (_drillRecognition) {
    _drillRecognition.stop();
    _drillRecognition = null;
    if (btn) btn.classList.remove('active');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _drillRecognition = new SR();
  _drillRecognition.continuous = true;
  _drillRecognition.interimResults = false;
  _drillRecognition.onresult = (ev) => {
    let addition = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) addition += ev.results[i][0].transcript + ' ';
    }
    if (addition) textarea.value = (textarea.value + ' ' + addition).trim() + ' ';
  };
  _drillRecognition.onend = () => { _drillRecognition = null; if (btn) btn.classList.remove('active'); };
  _drillRecognition.start();
  if (btn) btn.classList.add('active');
}

/* ── Trend / tracking ───────────────────────────────────────── */
function computeDrillTrend() {
  const graded = DRILL_RESPONSES.filter(r => r.graded && r.scores).slice(-14);
  const rollingAvg = {};
  DRILL_RUBRIC_ORDER.forEach(k => {
    rollingAvg[k] = graded.length ? graded.reduce((sum, r) => sum + r.scores[k], 0) / graded.length : null;
  });

  const catAvg = {};
  Object.keys(DRILL_CATEGORIES).forEach(catId => {
    const inCat = DRILL_RESPONSES.filter(r => r.category === catId && r.graded && r.scores).slice(-8);
    catAvg[catId] = inCat.length ? inCat.reduce((sum, r) => sum + _drillComposite(r.scores), 0) / inCat.length : null;
  });
  const scoredCats = Object.entries(catAvg).filter(([, v]) => v != null);
  const weakest = scoredCats.length ? scoredCats.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

  // Streak: consecutive calendar days with at least one response (graded or not)
  const dates = [...new Set(DRILL_RESPONSES.map(r => r.date))].sort().reverse();
  let streak = 0;
  let cursor = localDateStr(new Date());
  for (const d of dates) {
    if (d === cursor) { streak++; const prev = new Date(cursor + 'T00:00:00'); prev.setDate(prev.getDate() - 1); cursor = localDateStr(prev); }
    else if (_daysBetween(d, cursor) === 0) continue;
    else break;
  }

  return { rollingAvg, catAvg, weakest, streak, gradedCount: graded.length };
}

/* ── Render ─────────────────────────────────────────────────── */
function renderDrill() {
  const panel = document.getElementById('panel-drill');
  if (!panel) return;
  const scenario = pickTodayScenario();
  window._drillActiveScenarioId = scenario.id;
  const todayStr = localDateStr(new Date());
  const todayResponse = DRILL_RESPONSES.find(r => r.date === todayStr && r.scenarioId === scenario.id);
  _drillPendingId = todayResponse ? todayResponse.id : null;
  const trend = computeDrillTrend();
  const settings = _drillSettings();
  const catLabel = DRILL_CATEGORIES[scenario.category]?.label || scenario.category;
  const diffDots = '●'.repeat(scenario.difficulty) + '○'.repeat(3 - scenario.difficulty);

  panel.innerHTML = `
    <div class="drill-page">
      <div class="drill-hero">
        <div>
          <div class="drill-hero-title">Daily Communication Drill</div>
          <div class="drill-hero-sub">Defend it. Translate it. Say it with less.</div>
        </div>
        <div class="drill-hero-stats">
          <div class="drill-stat"><span class="drill-stat-num">${trend.streak}</span><span class="drill-stat-label">day streak</span></div>
          ${trend.weakest ? `<div class="drill-stat drill-stat-alert"><span class="drill-stat-num">${trend.weakest[1].toFixed(1)}</span><span class="drill-stat-label">weakest: ${DRILL_CATEGORIES[trend.weakest[0]]?.label}</span></div>` : ''}
        </div>
      </div>

      <div class="drill-card">
        <div class="drill-scenario-meta">
          <span class="drill-badge">${escHtml(catLabel)}</span>
          <span class="drill-badge drill-badge-diff">${diffDots}</span>
          ${todayResponse ? `<span class="drill-badge drill-badge-done">${todayResponse.graded ? 'Graded' : 'Submitted — awaiting grade'}</span>` : ''}
        </div>
        <div class="drill-scenario-context">${escHtml(scenario.context_setup)}</div>
        <div class="drill-scenario-text">${escHtml(scenario.scenario_text)}</div>

        <div class="drill-timer-row">
          <span id="drill-timer-display" class="drill-timer">--:--</span>
          <button class="drill-btn-ghost" onclick="startDrillTimer(3)">3 min</button>
          <button class="drill-btn-ghost" onclick="startDrillTimer(5)">5 min</button>
          <button class="drill-btn-ghost" onclick="stopDrillTimer()">Stop</button>
        </div>

        <div class="drill-textarea-wrap">
          <textarea id="drill-response-input" class="drill-textarea" placeholder="Write — or dictate — your response here."
            ${todayResponse ? '' : ''}>${todayResponse ? escHtml(todayResponse.responseText) : ''}</textarea>
          ${_drillVoiceSupported() ? `<button id="drill-voice-btn" class="drill-voice-btn" onclick="toggleDrillVoiceInput()" title="Voice to text">◉</button>` : ''}
        </div>

        <div class="drill-btn-row">
          <button class="btn-primary" onclick="_drillHandleSubmit()">${todayResponse ? 'Update Response' : 'Submit Response'}</button>
          <button class="drill-btn-ghost" onclick="copyDrillToClaude()">Copy to Claude</button>
          ${settings.apiEnabled ? `<button id="drill-autograde-btn" class="drill-btn-ghost" onclick="drillAutoGrade()">Auto-Grade</button>` : ''}
        </div>

        <div class="drill-paste-section">
          <div class="drill-paste-label">Paste Claude's JSON reply here</div>
          <textarea id="drill-paste-feedback" class="drill-textarea drill-textarea-small" placeholder='{"scores": {...}, ...}'></textarea>
          <button class="drill-btn-ghost" onclick="parseAndSaveDrillFeedback()">Parse & Save</button>
        </div>

        ${todayResponse && todayResponse.graded ? _renderDrillScores(todayResponse) : ''}
      </div>

      ${_renderDrillTrendCard(trend)}
      ${_renderDrillSettingsCard(settings)}
    </div>
  `;
}

function _renderDrillScores(response) {
  const rows = DRILL_RUBRIC_ORDER.map(k => `
    <div class="drill-score-row">
      <span class="drill-score-label">${DRILL_RUBRIC[k].label}</span>
      <span class="drill-score-num">${response.scores[k]}/5</span>
      <span class="drill-score-reason">${escHtml(response.reasons?.[k] || '')}</span>
    </div>`).join('');
  return `
    <div class="drill-scored-block">
      <div class="drill-scored-title">Scored</div>
      ${rows}
      ${response.modelAnswer ? `<div class="drill-model-answer"><div class="drill-model-answer-label">Model answer</div>${escHtml(response.modelAnswer)}</div>` : ''}
      ${response.notes ? `<div class="drill-notes">${escHtml(response.notes)}</div>` : ''}
    </div>`;
}

function _renderDrillTrendCard(trend) {
  const bars = DRILL_RUBRIC_ORDER.map(k => {
    const v = trend.rollingAvg[k];
    const pct = v != null ? (v / 5) * 100 : 0;
    return `
      <div class="drill-trend-row">
        <span class="drill-trend-label">${DRILL_RUBRIC[k].label}</span>
        <div class="drill-trend-bar-track"><div class="drill-trend-bar-fill" style="width:${pct}%"></div></div>
        <span class="drill-trend-val">${v != null ? v.toFixed(1) : '—'}</span>
      </div>`;
  }).join('');
  return `
    <div class="drill-card">
      <div class="drill-card-title">Rolling Averages <span class="drill-card-sub">last ${trend.gradedCount} graded</span></div>
      ${bars}
    </div>`;
}

function _renderDrillSettingsCard(settings) {
  // DRILL_PROVIDERS is defined in src/12-drill-providers.js
  const provider = settings.provider || 'anthropic';
  const providerMeta = (typeof DRILL_PROVIDERS !== 'undefined' && DRILL_PROVIDERS[provider]) || { keyPlaceholder: 'api key', costNote: '' };
  const options = (typeof DRILL_PROVIDERS !== 'undefined' ? Object.entries(DRILL_PROVIDERS) : [])
    .map(([id, p]) => `<option value="${id}" ${id === provider ? 'selected' : ''}>${escHtml(p.label)}</option>`).join('');
  return `
    <div class="drill-card drill-settings-card">
      <div class="drill-card-title">Automate Grading (Optional)</div>
      <div class="drill-settings-note">Paste your own API key to skip the copy/paste round-trip. The key is stored only in this browser and is visible in devtools while enabled.</div>
      <label class="drill-settings-toggle">
        <input type="checkbox" id="drill-api-enabled" ${settings.apiEnabled ? 'checked' : ''} onchange="_drillToggleApiEnabled(this.checked)">
        Enable direct API auto-grading
      </label>
      <select id="drill-provider-select" class="drill-api-key-input" onchange="_drillSetProvider(this.value)">${options}</select>
      <div class="drill-settings-note">${providerMeta.costNote}</div>
      <input type="password" id="drill-api-key-input" class="drill-api-key-input" placeholder="${escAttr(providerMeta.keyPlaceholder)}" value="${escAttr((settings.apiKeys || {})[provider] || '')}" onblur="_drillSaveApiKey(this.value)">
    </div>`;
}

async function _drillHandleSubmit() {
  const scenario = DRILL_PROMPT_BANK.find(p => p.id === window._drillActiveScenarioId);
  const textarea = document.getElementById('drill-response-input');
  if (!scenario || !textarea || !textarea.value.trim()) { showToast('Write a response first.', 'error'); return; }
  const timedSeconds = _drillTimerTotal > 0 ? (_drillTimerTotal - Math.max(_drillTimerLeft, 0)) : null;
  try {
    if (_drillPendingId) {
      const { setDoc } = window.CDX_FB;
      await setDoc(_ud('drillResponses', _drillPendingId), { responseText: textarea.value.trim(), timedSeconds }, { merge: true });
    } else {
      _drillPendingId = await _drillSubmitResponse(scenario, textarea.value.trim(), timedSeconds);
    }
    showToast('Response saved.', 'success');
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

function _drillToggleApiEnabled(enabled) {
  const s = _drillSettings();
  s.apiEnabled = enabled;
  _saveDrillSettings(s);
  renderDrill();
}
function _drillSetProvider(provider) {
  const s = _drillSettings();
  s.provider = provider;
  _saveDrillSettings(s);
  renderDrill();
}
function _drillSaveApiKey(key) {
  const s = _drillSettings();
  if (!s.apiKeys) s.apiKeys = { anthropic: '', deepseek: '' };
  s.apiKeys[s.provider || 'anthropic'] = key.trim();
  _saveDrillSettings(s);
}

/* ══ KINETIC: scrub the drill timer — drag the digits to trade seconds ══ */
let _drillScrub = null;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest?.('#drill-timer-display');
  if (!el) return;
  // If a countdown is live, pause it while scrubbing so the interval can't tick
  // against the drag (the old code left it running, producing jumpy/2x countdowns).
  const wasRunning = !!_drillTimerId;
  if (_drillTimerId) { clearInterval(_drillTimerId); _drillTimerId = null; }
  _drillScrub = { x: e.clientX, left: Math.max(0, _drillTimerLeft), wasRunning };
  el.classList.add('scrubbing');
});
document.addEventListener('pointermove', e => {
  if (!_drillScrub) return;
  const dx = e.clientX - _drillScrub.x;
  _drillTimerLeft = Math.max(0, Math.min(30 * 60, _drillScrub.left + Math.round(dx / 4) * 5));
  _renderDrillTimerDisplay();
});
document.addEventListener('pointerup', () => {
  if (!_drillScrub) return;
  document.getElementById('drill-timer-display')?.classList.remove('scrubbing');
  // Resume the countdown if one was running before the scrub, or start one when the
  // user scrubbed up from zero. The !_drillTimerId guard prevents a duplicate interval.
  if (_drillTimerLeft > 0 && !_drillTimerId) {
    _drillTimerTotal = Math.max(_drillTimerTotal || 0, _drillTimerLeft);
    _drillTimerId = setInterval(() => {
      _drillTimerLeft--;
      _renderDrillTimerDisplay();
      if (_drillTimerLeft <= 0) stopDrillTimer();
    }, 1000);
  }
  _drillScrub = null;
});
/* ══ COMM DRILL — GRADING PROVIDERS (optional auto-grade automation) ══ */
// → future file: cosmodex-drill-providers.js
// Off-by-default direct-API grading for the Communication Drill (src/11-comm-drill.js).
// Keys live in localStorage only and are visible in devtools while enabled —
// that tradeoff is why this whole feature defaults off; the safe path is
// still Copy-to-Claude / Paste-Feedback.
//
// DeepSeek CORS note: DeepSeek's docs (api-docs.deepseek.com) only show
// server-side examples (curl/Python/Node) and never mention CORS or a
// browser-access opt-in header, unlike Anthropic's explicit
// `anthropic-dangerous-direct-browser-access` flag. That's a signal, not a
// confirmation — the only way to know for sure is to try it in your browser.
// If it fails, the fetch will throw (usually a generic "Failed to fetch" from
// a blocked CORS preflight) and you'd need a small server-side relay (e.g. a
// Firebase Cloud Function) to forward the request — the API key would live
// there instead of in the browser, which is also just better practice.

const DRILL_GRADE_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: Object.fromEntries(DRILL_RUBRIC_ORDER.map(k => [k, { type: 'integer' }])),
      required: DRILL_RUBRIC_ORDER,
      additionalProperties: false,
    },
    reasons: {
      type: 'object',
      properties: Object.fromEntries(DRILL_RUBRIC_ORDER.map(k => [k, { type: 'string' }])),
      required: DRILL_RUBRIC_ORDER,
      additionalProperties: false,
    },
    model_answer: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['scores', 'reasons', 'model_answer', 'notes'],
  additionalProperties: false,
};

const DRILL_PROVIDERS = {
  anthropic: {
    label: 'Claude (Opus 4.8)',
    keyPlaceholder: 'sk-ant-...',
    costNote: 'Roughly 1–2¢ per grading call, separate from Claude Pro.',
    async grade(promptText, apiKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true', // required or the CORS preflight is rejected
        },
        // Structured output via tool use — the Messages API has no `output_config`
        // json_schema param; forcing a tool call is the supported way to get JSON
        // matching a schema back.
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 1024,
          tools: [{ name: 'submit_grade', description: 'Return the drill grade.', input_schema: DRILL_GRADE_SCHEMA }],
          tool_choice: { type: 'tool', name: 'submit_grade' },
          messages: [{ role: 'user', content: promptText }],
        }),
      });
      if (!res.ok) throw new Error(`Claude API returned ${res.status}`);
      const data = await res.json();
      const toolUse = (data.content || []).find(b => b.type === 'tool_use');
      if (!toolUse) throw new Error('Claude response had no tool_use block');
      return toolUse.input;
    },
  },
  deepseek: {
    label: 'DeepSeek (deepseek-chat)',
    keyPlaceholder: 'sk-...',
    costNote: 'Roughly 0.02–0.05¢ per grading call — far cheaper than Claude, but direct browser access is unconfirmed; this may fail with a CORS error (see console).',
    async grade(promptText, apiKey) {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: promptText }],
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) throw new Error(`DeepSeek API returned ${res.status}`);
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    },
  },
};

function _drillValidateParsedGrade(parsed) {
  if (!parsed || !parsed.scores) throw new Error('Response missing "scores" object');
  for (const k of DRILL_RUBRIC_ORDER) {
    const v = parsed.scores[k];
    if (typeof v !== 'number' || v < 1 || v > 5) throw new Error(`Invalid score for "${k}"`);
  }
}

async function drillAutoGrade() {
  const settings = _drillSettings();
  const provider = DRILL_PROVIDERS[settings.provider || 'anthropic'];
  const apiKey = (settings.apiKeys || {})[settings.provider || 'anthropic'];
  const scenario = DRILL_PROMPT_BANK.find(p => p.id === window._drillActiveScenarioId);
  const textarea = document.getElementById('drill-response-input');
  if (!settings.apiEnabled || !apiKey) { showToast('Enable and save an API key in Drill settings first.', 'error'); return; }
  if (!scenario || !textarea || !textarea.value.trim()) { showToast('Write a response first.', 'error'); return; }
  if (!_drillPendingId) { showToast('Submit your response first, then auto-grade.', 'error'); return; }

  const btn = document.getElementById('drill-autograde-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Grading…'; }
  try {
    const parsed = await provider.grade(_drillBuildGradingBlock(scenario, textarea.value.trim()), apiKey);
    _drillValidateParsedGrade(parsed);
    await _drillSaveGrading(_drillPendingId, parsed);
    showToast('Auto-graded and saved.', 'success');
  } catch (e) {
    showToast(`Auto-grade failed (${provider.label}): ${e.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Auto-Grade'; }
  }
}
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
  const focusSecs = doneToday.reduce((s, t) => s + taskEffortSecs(t), 0);
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
/* ═══════════════════════════════════════════════════════════════════════════
   HABITS · design-system rebuild (Today / Builder / Progress / Reflect /
   Behaviours). Renders into #panel-habits, wired to the REAL data model
   (_habits, _habitLogs, habitToggle, habitUpdate, _todayStreakDays). Replaces
   the legacy habits UI at runtime; the Firestore subscriptions in 03-habits.js
   still feed the data. Exposed: window.initHabitsX / window.renderHabitsX.
   ═══════════════════════════════════════════════════════════════════════════ */
let _hxTab = 'today';
let _hxBuilderStep = 1;
let _hxBuilder = { identity: '', name: '', anchor: '', cue: '', reward: '', minimum: '', cat: 'Craft', cadence: 'daily', dow: [] };
let _hxReflectDraft = { open: false, habit: '', body: '' };
let _hxModal = null;          // { type:'habit', id } | { type:'routines' }
let _hxHabitEdit = null;      // working copy of the habit being edited

const HX_CADENCES = [['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['custom', 'Pick days']];
// JS getDay() order: 0=Sun … 6=Sat. Labels for the weekday picker.
const HX_DOW = [['1', 'M'], ['2', 'T'], ['3', 'W'], ['4', 'T'], ['5', 'F'], ['6', 'S'], ['0', 'S']];

// Is this habit scheduled on the given date? Rituals only appear on their due
// days. `schedule.days` is the cadence; for 'custom', `schedule.dow` is an array
// of getDay() indices (0=Sun..6=Sat).
function _hxIsDue(h, date) {
  const sch = (h && h.schedule) || {};
  const days = sch.days || 'daily';
  const dow = date.getDay();
  if (days === 'weekdays') return dow >= 1 && dow <= 5;
  if (days === 'weekends') return dow === 0 || dow === 6;
  if (days === 'custom') {
    const list = Array.isArray(sch.dow) ? sch.dow.map(Number) : [];
    return list.length ? list.includes(dow) : true; // none picked → behave as daily
  }
  return true; // daily
}

// Row of 7 weekday toggles. `sel` is an array of getDay() indices; `attr` is the
// data-attribute the click wiring listens on.
function _hxDowPicker(sel, attr) {
  const set = new Set((sel || []).map(Number));
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
    ${HX_DOW.map(([v, l]) => `<button class="hx-chip${set.has(Number(v)) ? ' active' : ''}" ${attr}="${v}" style="min-width:34px;text-align:center">${l}</button>`).join('')}
  </div>`;
}

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
  // Rituals only surface on the days they're scheduled for (daily / weekdays /
  // weekends / picked days). The heatmap below stays on the full set.
  const dueActive = active.filter(h => _hxIsDue(h, new Date()));
  const kept = dueActive.filter(h => _hxDone(h, ds)).length;
  const dateLbl = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  const identity = _hxIdentity();

  const rows = dueActive.length ? dueActive.map(h => {
    const done = _hxDone(h, ds), color = _hxColor(h);
    return `<div class="hx-hrow${done ? ' done' : ''}">
      <div class="hx-check${done ? ' on' : ''}" data-hx-toggle="${escAttr(h.id)}"></div>
      <div>
        <div class="hx-hname">${escHtml(_hxName(h))}</div>
        <div class="hx-hanchor">↳ ${escHtml(_hxAnchor(h))}</div>
      </div>
      ${_hxDot(color)}
      <span class="hx-tel" style="font-size:11px;color:rgba(255,255,255,.65)">${_hxStreak(h.id)}d</span>
      <button class="hx-row-manage" data-hx-edit="${escAttr(h.id)}" title="Edit / delete / graduate" aria-label="Manage habit">⋯</button>
    </div>`;
  }).join('')
    : (active.length ? `<div class="hx-empty">Nothing scheduled for today — enjoy the rest day.</div>`
                     : `<div class="hx-empty">No habits yet — design one in the Builder tab.</div>`);

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
      `<div style="display:flex;gap:8px"><button class="hx-liquid" data-hx-routines>◷ Routines</button><button class="hx-liquid" data-hx-gotab="builder">＋ Design a habit</button></div>`)}
    <div class="hx-grid-15">
      <div class="hx-card" style="padding:22px">
        <div class="hx-ritual-head"><span class="hx-ritual-title">Daily ritual</span>
          <span class="hx-eyebrow">${kept} / ${dueActive.length} KEPT</span></div>
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
      </div></div>
    <div style="margin-top:14px"><div class="hx-eyebrow" style="margin-bottom:8px">CADENCE</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${HX_CADENCES.map(([v, l]) => `<button class="hx-chip${f.cadence === v ? ' active' : ''}" data-hx-cadence="${v}">${l}</button>`).join('')}
      </div>
      ${f.cadence === 'custom' ? _hxDowPicker(f.dow, 'data-hx-dow') : ''}</div>`;
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
        <div class="hx-rail-tel" style="margin-top:3px">${escHtml((h.category || 'Uncategorised').toUpperCase())} · ${_hxStreak(h.id)}D STREAK</div></div>
      <div class="hx-p28">${hist.map(v => `<span style="background:${v ? color + 'cc' : 'rgba(255,255,255,.04)'};border:1px solid ${v ? color : 'rgba(255,255,255,.06)'}${v ? ';box-shadow:0 0 6px ' + color + '66' : ''}"></span>`).join('')}</div>
      <span class="hx-tel" style="font-size:11px;color:rgba(255,255,255,.75)">${kept}/28</span>
      <span class="hx-tel" style="font-size:11px;color:#fff;text-shadow:0 0 8px rgba(255,255,255,.3)">${Math.round(kept / 28 * 100)}%</span>
    </div>`;
  }).join('') : `<div class="hx-empty">No habits to chart yet.</div>`;

  // category mix over 28d
  const catTotals = {}; let catSum = 0;
  perHabit.forEach(({ h, hist }) => { const k = h.category || 'Uncategorised'; const n = hist.filter(Boolean).length; catTotals[k] = (catTotals[k] || 0) + n; catSum += n; });
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

/* ═══ MODALS: habit edit/delete/graduate (B1) + routine editor (B2) ═══════ */
function _hxHabitModalHtml() {
  const h = _hxHabitEdit; if (!h) return '';
  const graduated = h.status === 'graduated';
  const cadence = (h.schedule && h.schedule.days) || 'daily';
  return `<div class="hx-modal-backdrop" data-hx-modal-close>
    <div class="hx-modal" role="dialog">
      <div class="hx-modal-head"><span class="hx-modal-title">${graduated ? 'Graduated habit' : 'Edit habit'}</span>
        <button class="hx-modal-x" data-hx-modal-close>×</button></div>
      <div class="hx-modal-body">
        <div class="hx-eyebrow" style="margin-bottom:6px">TINY BEHAVIOUR</div>
        <input class="hx-input" id="hx-e-name" value="${escAttr(h.tinyBehavior || h.name || '')}" placeholder="Read 15 pages">
        <div class="hx-eyebrow" style="margin:14px 0 6px">IDENTITY</div>
        <input class="hx-input italic" id="hx-e-identity" value="${escAttr(h.identityTag || '')}" placeholder="a curious learner">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">
          <div><div class="hx-eyebrow" style="margin-bottom:6px">AFTER (ANCHOR)</div>
            <input class="hx-input body" id="hx-e-anchor" value="${escAttr(h.anchor && h.anchor.value || '')}" placeholder="I pour coffee"></div>
          <div><div class="hx-eyebrow" style="margin-bottom:6px">SENSORY CUE</div>
            <input class="hx-input body" id="hx-e-cue" value="${escAttr(h.cue || '')}" placeholder="Coffee maker beep"></div>
        </div>
        <div class="hx-eyebrow" style="margin:14px 0 6px">CELEBRATION</div>
        <input class="hx-input body" id="hx-e-reward" value="${escAttr(h.reward || '')}" placeholder='Say "good" out loud'>
        <div class="hx-eyebrow" style="margin:14px 0 8px">CATEGORY</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${HX_CATS.map(c => `<button class="hx-chip${h.category === c.name ? ' active' : ''}" data-hx-e-cat="${escAttr(c.name)}">${_hxDot(c.color, 7)} ${c.name}</button>`).join('')}
        </div>
        <div class="hx-eyebrow" style="margin:14px 0 8px">CADENCE</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${HX_CADENCES.map(([v, l]) => `<button class="hx-chip${cadence === v ? ' active' : ''}" data-hx-e-cadence="${v}">${l}</button>`).join('')}
        </div>
        ${cadence === 'custom' ? _hxDowPicker((h.schedule && h.schedule.dow) || [], 'data-hx-e-dow') : ''}
      </div>
      <div class="hx-modal-foot">
        <button class="hx-btn-danger" data-hx-delete>Delete</button>
        <button class="hx-btn-ghost" data-hx-graduate>${graduated ? 'Reactivate' : 'Graduate'}</button>
        <div style="flex:1"></div>
        <button class="hx-btn-ghost" data-hx-modal-close>Cancel</button>
        <button class="hx-liquid" data-hx-save>Save changes</button>
      </div>
    </div></div>`;
}

function _hxRoutinesModalHtml() {
  const morning = (typeof _routines !== 'undefined' ? _routines.morning : []) || [];
  const evening = (typeof _routines !== 'undefined' ? _routines.evening : []) || [];
  const block = (slot, steps) => `
    <div class="hx-eyebrow" style="margin:14px 0 8px">${slot.toUpperCase()} ROUTINE</div>
    <div class="hx-rt-list">
      ${steps.length ? steps.map((s, i) => `<div class="hx-rt-row">
        <input class="hx-input mono" style="width:70px;text-align:center" data-hx-rt-time="${slot}:${i}" value="${escAttr(s.time || '')}" placeholder="07:00">
        <input class="hx-input body" data-hx-rt-text="${slot}:${i}" value="${escAttr(s.text || '')}" placeholder="Step…">
        <button class="hx-btn-danger" style="padding:6px 10px" data-hx-rt-del="${slot}:${i}">✕</button>
      </div>`).join('') : `<div class="hx-empty">No ${slot} steps yet.</div>`}
      <div class="hx-rt-row">
        <input class="hx-input mono" style="width:70px;text-align:center" id="hx-rt-newtime-${slot}" placeholder="07:00">
        <input class="hx-input body" id="hx-rt-newtext-${slot}" placeholder="Add a step…">
        <button class="hx-liquid" data-hx-rt-add="${slot}">＋</button>
      </div>
    </div>`;
  return `<div class="hx-modal-backdrop" data-hx-modal-close>
    <div class="hx-modal" role="dialog">
      <div class="hx-modal-head"><span class="hx-modal-title">Routines</span>
        <button class="hx-modal-x" data-hx-modal-close>×</button></div>
      <div class="hx-modal-body">
        <span class="hx-sechead-italic" style="display:block;margin-bottom:4px">Morning &amp; evening steps. They appear on your dashboard to check off.</span>
        ${block('morning', morning)}
        ${block('evening', evening)}
      </div>
      <div class="hx-modal-foot"><div style="flex:1"></div><button class="hx-liquid" data-hx-modal-close>Done</button></div>
    </div></div>`;
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

  let modal = '';
  if (_hxModal && _hxModal.type === 'habit') modal = _hxHabitModalHtml();
  else if (_hxModal && _hxModal.type === 'routines') modal = _hxRoutinesModalHtml();

  panel.innerHTML = `<div class="hx-root">
    <div class="hx-topbar">
      <div><div class="hx-eyebrow">HABITS</div><div class="hx-h1">Ritual engine</div></div>
      <div class="hx-spacer"></div>
      <div class="hx-tabs">${_HX_TABS.map(t => `<button class="hx-tab${_hxTab === t ? ' active' : ''}" data-hx-tab="${t}">${t}</button>`).join('')}</div>
    </div>
    <div class="hx-pane" id="hx-pane">${body}</div>${modal}`;
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
  const _schedule = { days: f.cadence || 'daily', frequency: 1 };
  if (f.cadence === 'custom') _schedule.dow = (f.dow || []).map(Number);
  doc0.schedule = _schedule;
  doc0.status = 'active';
  _habits.push(doc0);
  if (uid && window.CDX_FB && window.CDX_DB) {
    const { doc, setDoc, serverTimestamp } = window.CDX_FB;
    try {
      await setDoc(doc(window.CDX_DB, 'users', uid, 'habits', id), {
        id, name: f.name.trim(), order: _habits.length - 1,
        identityTag: f.identity.trim(), valueTags: [], tinyBehavior: f.name.trim(), fullBehavior: f.minimum.trim(),
        anchor: doc0.anchor, cue: f.cue.trim(), reward: f.reward.trim(), category: f.cat,
        schedule: _schedule, stackId: null,
        frictionTags: [], frictionFallbacks: {}, restDaysPlanned: [],
        status: 'active', graduatedAt: null, createdAt: serverTimestamp(), archivedAt: null,
      });
      showToast('Habit added to your daily ritual', 'success');
    } catch (e) { console.warn('hx create habit error:', e); _habits = _habits.filter(h => h.id !== id); showToast('Could not save habit', 'error'); }
  }
  _hxBuilder = { identity: '', name: '', anchor: '', cue: '', reward: '', minimum: '', cat: 'Craft', cadence: 'daily', dow: [] };
  _hxBuilderStep = 1; _hxTab = 'today';
  renderHabitsX();
  window.renderDashboardBoard && window.renderDashboardBoard();
}

/* Capture the habit-edit modal inputs into the working copy before a re-render/save */
function _hxSyncHabitEdit() {
  if (!_hxHabitEdit) return;
  const g = id => document.getElementById(id);
  const nm = g('hx-e-name'); if (nm) { _hxHabitEdit.tinyBehavior = nm.value; if (!_hxHabitEdit.name) _hxHabitEdit.name = nm.value; }
  const idn = g('hx-e-identity'); if (idn) _hxHabitEdit.identityTag = idn.value;
  const an = g('hx-e-anchor'); if (an) { const v = an.value.trim(); _hxHabitEdit.anchor = { type: v ? 'after' : 'anytime', value: v, linkedHabitId: (_hxHabitEdit.anchor && _hxHabitEdit.anchor.linkedHabitId) || null }; }
  const cu = g('hx-e-cue'); if (cu) _hxHabitEdit.cue = cu.value;
  const rw = g('hx-e-reward'); if (rw) _hxHabitEdit.reward = rw.value;
}
function _hxOpenHabitModal(id) {
  const h = _habits.find(x => x.id === id); if (!h) return;
  _hxHabitEdit = JSON.parse(JSON.stringify(h));  // working copy
  _hxModal = { type: 'habit', id };
  renderHabitsX();
}
function _hxCloseModal() { _hxModal = null; _hxHabitEdit = null; renderHabitsX(); }
async function _hxSaveHabit() {
  _hxSyncHabitEdit();
  const h = _hxHabitEdit; if (!h) return;
  const patch = {
    tinyBehavior: (h.tinyBehavior || '').trim(),
    identityTag: (h.identityTag || '').trim(),
    anchor: h.anchor || { type: 'anytime', value: '', linkedHabitId: null },
    cue: (h.cue || '').trim(),
    reward: (h.reward || '').trim(),
    category: h.category || '',
    schedule: h.schedule || { days: 'daily', frequency: 1 },
  };
  // reflect locally right away
  const live = _habits.find(x => x.id === h.id); if (live) Object.assign(live, patch);
  if (typeof habitUpdate === 'function') await habitUpdate(h.id, patch);
  showToast('Habit updated', 'success');
  _hxModal = null; _hxHabitEdit = null;
  renderHabitsX();
  window.renderDashboardBoard && window.renderDashboardBoard();
}
async function _hxDeleteHabit() {
  const h = _hxHabitEdit; if (!h) return;
  const ok = (typeof cdxConfirm === 'function')
    ? await cdxConfirm(`Delete "${_hxName(h)}"? This can't be undone.`, { okLabel: 'Delete', okColor: '#e05555', okBg: 'rgba(224,85,85,0.18)', okBorder: 'rgba(224,85,85,0.4)' })
    : window.confirm('Delete this habit?');
  if (!ok) return;
  if (typeof habitDelete === 'function') await habitDelete(h.id);
  _hxModal = null; _hxHabitEdit = null;
  renderHabitsX();
  window.renderDashboardBoard && window.renderDashboardBoard();
}
async function _hxGraduateHabit() {
  const h = _hxHabitEdit; if (!h) return;
  const graduated = h.status === 'graduated';
  if (graduated) { if (typeof habitReactivate === 'function') await habitReactivate(h.id); }
  else { if (typeof habitGraduate === 'function') await habitGraduate(h.id); }
  _hxModal = null; _hxHabitEdit = null;
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
  panel.querySelectorAll('[data-hx-cadence]').forEach(el => el.onclick = () => { _hxSyncBuilder(); _hxBuilder.cadence = el.dataset.hxCadence; renderHabitsX(); });
  panel.querySelectorAll('[data-hx-dow]').forEach(el => el.onclick = () => {
    _hxSyncBuilder();
    const d = Number(el.dataset.hxDow);
    const cur = Array.isArray(_hxBuilder.dow) ? _hxBuilder.dow.map(Number) : [];
    _hxBuilder.dow = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
    renderHabitsX();
  });
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

  // ── Habit manage (B1) ──
  panel.querySelectorAll('[data-hx-edit]').forEach(el => el.onclick = e => { e.stopPropagation(); _hxOpenHabitModal(el.dataset.hxEdit); });
  panel.querySelector('[data-hx-routines]') && (panel.querySelector('[data-hx-routines]').onclick = () => { _hxModal = { type: 'routines' }; renderHabitsX(); });
  panel.querySelectorAll('[data-hx-modal-close]').forEach(el => el.onclick = e => { if (e.target !== el) return; _hxCloseModal(); });
  panel.querySelector('[data-hx-save]') && (panel.querySelector('[data-hx-save]').onclick = _hxSaveHabit);
  panel.querySelector('[data-hx-delete]') && (panel.querySelector('[data-hx-delete]').onclick = _hxDeleteHabit);
  panel.querySelector('[data-hx-graduate]') && (panel.querySelector('[data-hx-graduate]').onclick = _hxGraduateHabit);
  panel.querySelectorAll('[data-hx-e-cat]').forEach(el => el.onclick = () => { _hxSyncHabitEdit(); if (_hxHabitEdit) _hxHabitEdit.category = el.dataset.hxECat; renderHabitsX(); });
  panel.querySelectorAll('[data-hx-e-cadence]').forEach(el => el.onclick = () => { _hxSyncHabitEdit(); if (_hxHabitEdit) { const days = el.dataset.hxECadence; const sc = { ...(_hxHabitEdit.schedule || {}), days, frequency: 1 }; if (days !== 'custom') delete sc.dow; _hxHabitEdit.schedule = sc; } renderHabitsX(); });
  panel.querySelectorAll('[data-hx-e-dow]').forEach(el => el.onclick = () => {
    _hxSyncHabitEdit();
    if (!_hxHabitEdit) return;
    const sc = { ...(_hxHabitEdit.schedule || {}), days: 'custom', frequency: 1 };
    const d = Number(el.dataset.hxEDow);
    const cur = Array.isArray(sc.dow) ? sc.dow.map(Number) : [];
    sc.dow = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
    _hxHabitEdit.schedule = sc;
    renderHabitsX();
  });

  // ── Routine editor (B2) — reuses routineAdd/routineUpdate/routineDelete (Firestore) ──
  panel.querySelectorAll('[data-hx-rt-del]').forEach(el => el.onclick = () => { const [slot, i] = el.dataset.hxRtDel.split(':'); if (typeof routineDelete === 'function') routineDelete(slot, +i); renderHabitsX(); });
  panel.querySelectorAll('[data-hx-rt-add]').forEach(el => el.onclick = () => {
    const slot = el.dataset.hxRtAdd;
    const text = (document.getElementById('hx-rt-newtext-' + slot)?.value || '').trim();
    const time = (document.getElementById('hx-rt-newtime-' + slot)?.value || '').trim();
    if (!text) { showToast('Add step text first', 'error'); return; }
    (_routines[slot] = _routines[slot] || []).push({ time, text });
    if (typeof routinesSave === 'function') routinesSave(_routines);
    renderHabitsX();
  });
  panel.querySelectorAll('[data-hx-rt-text]').forEach(el => el.onchange = () => { const [slot, i] = el.dataset.hxRtText.split(':'); if (typeof routineUpdate === 'function') routineUpdate(slot, +i, 'text', el.value); });
  panel.querySelectorAll('[data-hx-rt-time]').forEach(el => el.onchange = () => { const [slot, i] = el.dataset.hxRtTime.split(':'); if (typeof routineUpdate === 'function') routineUpdate(slot, +i, 'time', el.value); });
}
/* ═══════════════════════════════════════════════════════════════════════
   CALENDAR — design-system calendar page (day / week / month)
   Wired to the app's real data: CAL_EVENTS (Firestore calEvents) + tasks with
   a dueDate. Creating a slot reuses openQuickCalModal(); clicking an event
   jumps to its linked task. Rendered into #panel-calendarx by showMainPanel().
   ═══════════════════════════════════════════════════════════════════════ */

let _calxView = 'week';          // 'day' | 'week' | 'month'
let _calxRef  = new Date();      // anchor date the current view is built around
let _calxDrag = null;            // { kind:'task'|'event', id } while dragging

const CALX_HR_START = 7;
const CALX_HR_END   = 22;        // grid spans 07:00–22:00

const CALX_DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const CALX_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// "HH:MM" → fractional hours (e.g. "09:30" → 9.5). null for all-day.
function _calxParseH(t) {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}
function _calxFmtH(h) {
  const hh = Math.floor(h), mm = Math.round((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function _calxEventColor(e) {
  return e.color || (e.category ? getCatColor(e.category) : null) || 'rgba(255,255,255,.55)';
}
// Timed events on a date, sorted by start.
function _calxTimed(ds) {
  return CAL_EVENTS
    .filter(e => e.date === ds && !e.allDay && e.startTime)
    .map(e => {
      const sH = _calxParseH(e.startTime);
      const eH = e.endTime ? _calxParseH(e.endTime) : sH + ((e.duration || 60) / 60);
      return { ...e, _sH: sH, _eH: Math.max(eH, sH + 0.25) };
    })
    .sort((a, b) => a._sH - b._sH);
}
// All-day items on a date: all-day calEvents + incomplete tasks due that day.
function _calxAllDay(ds) {
  const items = CAL_EVENTS.filter(e => e.date === ds && (e.allDay || !e.startTime))
    .map(e => ({ id: e.id, title: e.title, color: _calxEventColor(e), taskId: e.taskId }));
  (TASKS || []).forEach(t => {
    if (!t.done && t.dueDate === ds && !CAL_EVENTS.some(e => e.taskId === t.id && e.date === ds)) {
      items.push({ id: 'task-' + t.id, title: t.title, color: getCatColor(t.category), taskId: t.id, isTask: true });
    }
  });
  return items;
}

// Monday-anchored start of the ref week.
function _calxWeekStart(d) {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - wd);
  x.setHours(0, 0, 0, 0);
  return x;
}

function _calxHeading() {
  if (_calxView === 'month') return `${CALX_MONTHS[_calxRef.getMonth()]} ${_calxRef.getFullYear()}`;
  if (_calxView === 'day')   return _calxRef.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const ws = _calxWeekStart(_calxRef), we = new Date(ws); we.setDate(ws.getDate() + 6);
  const sameMonth = ws.getMonth() === we.getMonth();
  return `${ws.getDate()} ${sameMonth ? '' : CALX_MONTHS[ws.getMonth()].slice(0,3) + ' '}— ${we.getDate()} ${CALX_MONTHS[we.getMonth()].slice(0,3)} ${we.getFullYear()}`;
}

/* ── Header (toolbar + legend + stat rail) ─────────────────────────────── */
function _calxHeaderHtml() {
  const views = ['day', 'week', 'month'].map(v =>
    `<button class="calx-vtog${_calxView === v ? ' active' : ''}" data-calx-view="${v}">${v}</button>`).join('');
  return `
    <div class="calx-toolbar">
      <div>
        <div class="calx-eyebrow">CALENDAR · ${_calxView.toUpperCase()}</div>
        <div class="calx-heading">${escHtml(_calxHeading())}</div>
      </div>
      <div style="flex:1"></div>
      <div class="calx-navarrows">
        <button class="calx-arrow" data-calx-nav="-1">‹</button>
        <button class="calx-arrow" data-calx-nav="1">›</button>
      </div>
      <div class="calx-vtog-wrap">${views}</div>
      <button class="calx-liquid" data-calx-today>◈ Today</button>
      <button class="calx-liquid" data-calx-new>＋ New event</button>
    </div>
    <div class="calx-italic">One focus that cannot slip. Click any empty slot to capture.</div>`;
}

/* ── Time-grid column (shared by day & week) ───────────────────────────── */
// Assign side-by-side lanes to overlapping events so they tile instead of
// stacking. Mutates each event with _lane (0-based) and _lanes (cluster width).
function _calxAssignLanes(events) {
  let i = 0;
  while (i < events.length) {
    let clusterEnd = events[i]._eH;
    const cluster = [events[i]];
    let j = i + 1;
    while (j < events.length && events[j]._sH < clusterEnd) {
      cluster.push(events[j]);
      clusterEnd = Math.max(clusterEnd, events[j]._eH);
      j++;
    }
    const laneEnds = [];
    cluster.forEach(e => {
      let lane = 0;
      while (lane < laneEnds.length && e._sH < laneEnds[lane]) lane++;
      e._lane = lane;
      laneEnds[lane] = e._eH;
    });
    cluster.forEach(e => { e._lanes = laneEnds.length; });
    i = j;
  }
}

function _calxColumnHtml(ds, rowH, isToday, nowH) {
  const timed = _calxTimed(ds);
  _calxAssignLanes(timed);
  let html = '';
  for (let h = CALX_HR_START; h < CALX_HR_END; h++) {
    html += `<div class="calx-slot" data-calx-slot="${ds}|${String(h).padStart(2,'0')}:00" style="height:${rowH}px"></div>`;
  }
  if (isToday && nowH >= CALX_HR_START && nowH <= CALX_HR_END) {
    const top = (nowH - CALX_HR_START) * rowH;
    html += `<div class="calx-now" style="top:${top}px"><span class="calx-now-dot"></span></div>`;
  }
  timed.forEach(e => {
    const top = (e._sH - CALX_HR_START) * rowH;
    const hgt = Math.max((e._eH - e._sH) * rowH - 3, 22);
    const clr = _calxEventColor(e);
    const lanes = e._lanes || 1, lane = e._lane || 0;
    const wPct = 100 / lanes;
    const pos = `left:calc(${lane * wPct}% + 4px);width:calc(${wPct}% - 8px);right:auto;`;
    html += `<div class="calx-ev" draggable="true" data-calx-ev="${escAttr(e.taskId || '')}" data-ev-move="${escAttr(e.id)}" title="${escAttr(e.title)} — drag to reschedule"
      style="top:${top}px;height:${hgt}px;${pos}--ec:${clr};background:linear-gradient(135deg, ${clr}22, rgba(255,255,255,.03) 70%);border-left-color:${clr}">
      <div class="calx-ev-title">${escHtml(e.title)}</div>
      <div class="calx-ev-meta">${_calxFmtH(e._sH)}<span class="calx-ev-dot" style="background:${clr}"></span></div>
    </div>`;
  });
  return html;
}

/* ── DAY ────────────────────────────────────────────────────────────────── */
function _calxDayHtml() {
  const rowH = 60;
  const ds = localDateStr(_calxRef);
  const now = new Date();
  const isToday = ds === localDateStr(now);
  const nowH = now.getHours() + now.getMinutes() / 60;
  let rail = '';
  for (let h = CALX_HR_START; h < CALX_HR_END; h++)
    rail += `<div class="calx-hr" style="height:${rowH}px">${String(h).padStart(2,'0')}:00</div>`;
  return `
    <div class="calx-glass">
      <div class="calx-daygrid">
        <div class="calx-railcol">${rail}</div>
        <div class="calx-col" data-calx-col="${ds}" data-rowh="${rowH}">${_calxColumnHtml(ds, rowH, isToday, nowH)}</div>
      </div>
    </div>`;
}

/* ── WEEK ───────────────────────────────────────────────────────────────── */
function _calxWeekHtml() {
  const rowH = 46;
  const ws = _calxWeekStart(_calxRef);
  const now = new Date(), todayDs = localDateStr(now);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });

  const header = days.map((d, i) => {
    const isToday = localDateStr(d) === todayDs;
    return `<div class="calx-whead${isToday ? ' today' : ''}">
      <div class="calx-whead-dow">${CALX_DOW[i]}</div>
      <div class="calx-whead-dd">${d.getDate()}</div>
    </div>`;
  }).join('');

  let rail = '';
  for (let h = CALX_HR_START; h < CALX_HR_END; h++)
    rail += `<div class="calx-hr sm" style="height:${rowH}px">${String(h).padStart(2,'0')}</div>`;

  const cols = days.map(d => {
    const ds = localDateStr(d);
    const isToday = ds === todayDs;
    return `<div class="calx-col${isToday ? ' today' : ''}" data-calx-col="${ds}" data-rowh="${rowH}">${_calxColumnHtml(ds, rowH, isToday, nowH)}</div>`;
  }).join('');

  return `
    <div class="calx-glass">
      <div class="calx-whead-row"><div class="calx-railcol-h"></div>${header}</div>
      <div class="calx-weekgrid"><div class="calx-railcol">${rail}</div>${cols}</div>
    </div>`;
}

/* ── MONTH ──────────────────────────────────────────────────────────────── */
function _calxMonthHtml() {
  const first = new Date(_calxRef.getFullYear(), _calxRef.getMonth(), 1);
  const start = _calxWeekStart(first);
  const todayDs = localDateStr(new Date());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push(d);
  }
  const headers = CALX_DOW.map(d => `<div class="calx-mhead">${d}</div>`).join('');
  const grid = cells.map(d => {
    const ds = localDateStr(d);
    const inMonth = d.getMonth() === _calxRef.getMonth();
    const isToday = ds === todayDs;
    const items = [..._calxAllDay(ds), ..._calxTimed(ds).map(e => ({ title: e.title, color: _calxEventColor(e), taskId: e.taskId }))];
    const chips = items.slice(0, 3).map(a =>
      `<div class="calx-mchip" style="border-left-color:${a.color};background:linear-gradient(90deg, ${a.color}1a, rgba(255,255,255,.02))">${escHtml(a.title)}</div>`).join('');
    return `<div class="calx-mcell${inMonth ? '' : ' out'}${isToday ? ' today' : ''}" data-calx-slot="${ds}|09:00">
      <div class="calx-mcell-h">
        <span class="calx-mcell-dd">${d.getDate()}</span>
        ${isToday ? '<span class="calx-mcell-today">TODAY</span>' : ''}
        ${items.length ? `<span class="calx-mcell-count">·${items.length}</span>` : ''}
      </div>
      <div class="calx-mcell-body">${chips}${items.length > 3 ? `<div class="calx-mmore">+${items.length - 3} more</div>` : ''}</div>
    </div>`;
  }).join('');
  return `<div class="calx-glass"><div class="calx-mhead-row">${headers}</div><div class="calx-monthgrid">${grid}</div></div>`;
}

function _calxChip(a) {
  // Unscheduled task → drag onto a slot to schedule; all-day event → drag to time.
  const dragAttr = a.isTask
    ? `draggable="true" data-task-drag="${escAttr(a.taskId)}"`
    : (a.id ? `draggable="true" data-ev-move="${escAttr(a.id)}"` : '');
  return `<div class="calx-chip" ${dragAttr} data-calx-ev="${escAttr(a.taskId || '')}" style="border-left-color:${a.color}" title="${escAttr(a.title)}${a.isTask ? ' — drag onto a time to schedule' : ''}">
    <span class="calx-ev-dot" style="background:${a.color}"></span>${escHtml(a.title)}${a.isTask ? '<span class="calx-chip-tag">DUE</span>' : ''}</div>`;
}

/* ── Legend ─────────────────────────────────────────────────────────────── */
function _calxLegendHtml() {
  const cats = Object.keys(CATEGORIES).slice(0, 8);
  if (!cats.length) return '';
  return `<div class="calx-legend"><span class="calx-eyebrow">LEGEND</span>${cats.map(id =>
    `<span class="calx-leg"><span class="calx-ev-dot" style="background:${getCatColor(id)}"></span>${escHtml(CATEGORIES[id].label)}</span>`).join('')}</div>`;
}

/* ── Top band: milestones + all-day / unscheduled (day & week) ──────────
   Milestones are pinned here (⚑, not draggable). Unscheduled tasks due in the
   range and all-day events sit alongside as draggable chips → drop onto a slot
   to give them a time. */
function _calxVisibleDates() {
  if (_calxView === 'day') return [localDateStr(_calxRef)];
  if (_calxView === 'week') {
    const ws = _calxWeekStart(_calxRef);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return localDateStr(d); });
  }
  return []; // month view carries its own per-cell chips
}
function _calxMilestoneChips(dates) {
  const set = new Set(dates);
  return (typeof MILESTONE_EVENTS !== 'undefined' ? MILESTONE_EVENTS : [])
    .filter(e => set.has(String(e.date || '').slice(0, 10)))
    .map(e => {
      const c = (typeof _pcalProjColor === 'function') ? _pcalProjColor(e.projectId) : 'rgb(53,249,47)';
      return `<div class="calx-ms" data-ms-id="${escAttr(e.id)}" data-ms-proj="${escAttr(e.projectId || '')}" style="--c:${c}" title="◆ ${escAttr(e.title || 'Milestone')}">
        <span class="calx-ms-ico">⚑</span>${escHtml(e.title || 'Milestone')}</div>`;
    }).join('');
}
function _calxTopBandHtml() {
  const dates = _calxVisibleDates();
  if (!dates.length) return '';
  const ms = _calxMilestoneChips(dates);
  const allDay = dates.flatMap(ds => _calxAllDay(ds));
  if (!ms && !allDay.length) return '';
  return `<div class="calx-band">
    <span class="calx-band-label">ON TOP</span>
    ${ms}
    ${allDay.map(a => _calxChip(a)).join('')}
  </div>`;
}

/* ── Main render + wiring ──────────────────────────────────────────────── */
function renderCalendarX() {
  const panel = document.getElementById('panel-calendarx');
  if (!panel) return;
  const body = _calxView === 'day' ? _calxDayHtml() : _calxView === 'week' ? _calxWeekHtml() : _calxMonthHtml();
  panel.innerHTML = `<div class="calx-root">${_calxHeaderHtml()}${_calxLegendHtml()}${_calxTopBandHtml()}${body}</div>`;
  _calxWire(panel);
}
window.renderCalendarX = renderCalendarX;
window._calxAutoRefresh = () => { if (_mainPanel === 'calendarx') renderCalendarX(); };

function _calxShift(dir) {
  const d = new Date(_calxRef);
  if (_calxView === 'day')   d.setDate(d.getDate() + dir);
  if (_calxView === 'week')  d.setDate(d.getDate() + dir * 7);
  if (_calxView === 'month') d.setMonth(d.getMonth() + dir);
  _calxRef = d;
  renderCalendarX();
}

function _calxWire(panel) {
  panel.querySelectorAll('[data-calx-view]').forEach(b =>
    b.addEventListener('click', () => { _calxView = b.dataset.calxView; renderCalendarX(); }));
  panel.querySelectorAll('[data-calx-nav]').forEach(b =>
    b.addEventListener('click', () => _calxShift(+b.dataset.calxNav)));
  panel.querySelector('[data-calx-today]')?.addEventListener('click', () => { _calxRef = new Date(); renderCalendarX(); });
  panel.querySelector('[data-calx-new]')?.addEventListener('click', () =>
    openQuickCalModal(localDateStr(_calxRef), '09:00'));

  // Click an empty slot / month cell → create an event there
  panel.querySelectorAll('[data-calx-slot]').forEach(s =>
    s.addEventListener('click', () => {
      const [ds, time] = s.dataset.calxSlot.split('|');
      openQuickCalModal(ds, time || '09:00');
    }));

  // Click a placed event → open the event modal (edit time / complete / delete);
  // an unscheduled task chip (no event id) still jumps to its task.
  panel.querySelectorAll('[data-calx-ev]').forEach(ev =>
    ev.addEventListener('click', e => {
      e.stopPropagation();
      const evId = ev.dataset.evMove;
      if (evId && typeof showEventModal === 'function') {
        const evObj = (CAL_EVENTS || []).find(x => x.id === evId);
        if (evObj) { showEventModal(evObj, e.clientX, e.clientY); return; }
      }
      const taskId = ev.dataset.calxEv;
      if (!taskId) return;
      if (typeof _atkSelectedId !== 'undefined') _atkSelectedId = taskId;
      showMainPanel('alltasks');
      document.getElementById('nav-alltasks')?.classList.add('active');
      document.getElementById('nav-calendarx')?.classList.remove('active');
    }));

  // Milestone chips in the top band → open the milestone editor
  panel.querySelectorAll('.calx-ms[data-ms-id]').forEach(el =>
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof openMsEventModal === 'function') openMsEventModal(el.dataset.msProj || null, el.dataset.msId);
    }));

  _calxWireDnd(panel);
}

/* ── Drag-to-schedule / drag-to-move on the Calendar ────────────────────── */
function _calxWireDnd(panel) {
  const startDrag = (el, kind, id) => {
    el.addEventListener('dragstart', e => {
      _calxDrag = { kind, id };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', kind + ':' + id);
      el.classList.add('calx-dragging');
    });
    el.addEventListener('dragend', () => { _calxDrag = null; el.classList.remove('calx-dragging'); _calxClearMarks(panel); });
  };
  panel.querySelectorAll('[data-task-drag]').forEach(el => startDrag(el, 'task', el.dataset.taskDrag));
  panel.querySelectorAll('[data-ev-move]').forEach(el => startDrag(el, 'event', el.dataset.evMove));

  // Time-grid columns (day & week): drop at the pointed 30-min mark
  panel.querySelectorAll('.calx-col[data-calx-col]').forEach(col => {
    const rowH = +col.dataset.rowh || 46;
    const timeAt = clientY => {
      const r = col.getBoundingClientRect();
      let mins = CALX_HR_START * 60 + ((clientY - r.top) / rowH) * 60;
      mins = Math.round(mins / 30) * 30;
      mins = Math.max(CALX_HR_START * 60, Math.min(CALX_HR_END * 60 - 30, mins));
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    };
    col.addEventListener('dragover', e => {
      if (!_calxDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      let mark = col.querySelector('.calx-drop-line');
      if (!mark) { mark = document.createElement('div'); mark.className = 'calx-drop-line'; col.appendChild(mark); }
      const r = col.getBoundingClientRect();
      const t = timeAt(e.clientY);
      const [hh, mm] = t.split(':').map(Number);
      mark.style.top = ((hh * 60 + mm - CALX_HR_START * 60) / 60 * rowH) + 'px';
    });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.querySelector('.calx-drop-line')?.remove(); });
    col.addEventListener('drop', e => {
      e.preventDefault();
      const ds = col.dataset.calxCol;
      const time = timeAt(e.clientY);
      const p = _calxDrag; _calxDrag = null; _calxClearMarks(panel);
      if (!p) return;
      if (p.kind === 'task') scheduleTaskAt(p.id, ds, time, 30);
      else moveCalEventTo(p.id, ds, time);
    });
  });

  // Month cells: drop schedules/moves to that date at 09:00
  panel.querySelectorAll('.calx-mcell[data-calx-slot]').forEach(cell => {
    cell.addEventListener('dragover', e => { if (_calxDrag) { e.preventDefault(); cell.classList.add('calx-drop-cell'); } });
    cell.addEventListener('dragleave', () => cell.classList.remove('calx-drop-cell'));
    cell.addEventListener('drop', e => {
      e.preventDefault(); cell.classList.remove('calx-drop-cell');
      const ds = cell.dataset.calxSlot.split('|')[0];
      const p = _calxDrag; _calxDrag = null;
      if (!p) return;
      if (p.kind === 'task') scheduleTaskAt(p.id, ds, '09:00', 30);
      else moveCalEventTo(p.id, ds, '09:00');
    });
  });
}
function _calxClearMarks(panel) { panel.querySelectorAll('.calx-drop-line').forEach(m => m.remove()); panel.querySelectorAll('.calx-drop-cell').forEach(c => c.classList.remove('calx-drop-cell')); }
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
  // Rescheduled = still-open tasks placed on the calendar 2+ times. Each extra
  // placement is an attempt that didn't land — a friction / productivity signal.
  const rescheduled = TASKS.filter(t => !t.done && !t.someday && (t.scheduleCount || 0) >= 2).length;

  const rail = _insxStatRail([
    { label: 'FOCUS HOURS', value: _insxFmtHrs(focusSecs), delta: _insxDelta(focusSecs, prevFocus) },
    { label: 'HABITS KEPT', value: habitAvg + '%', delta: _insxDelta(habitAvg, prevHabitAvg) },
    { label: 'DEEP WORK', value: Math.round(deepRatio * 100) + '%' },
    { label: 'TASKS SHIPPED', value: String(shipped), delta: _insxDelta(shipped, prevShipped) },
    { label: 'OVERDUE', value: String(overdue) },
    { label: 'RESCHEDULED', value: String(rescheduled) },
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
  // most-rescheduled open task — repeated placements that never landed
  const mostResched = TASKS.filter(t => !t.done && !t.someday && (t.scheduleCount || 0) >= 2)
    .sort((a, b) => (b.scheduleCount || 0) - (a.scheduleCount || 0))[0];
  if (mostResched) patterns.push({ icon: '↻', color: _INSX_WARN, title: `"${(mostResched.title || 'A task').slice(0, 40)}" keeps sliding`, body: `Scheduled ${mostResched.scheduleCount}× and still open. When a task resists this many attempts, the fix is usually to shrink it, not reschedule it again.` });
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
