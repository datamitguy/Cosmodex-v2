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
    // GetAbstract → full page
    if (panel === 'getabstract') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('getabstract');
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
    // Trial → full page
    if (panel === 'trial') {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showMainPanel('trial');
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

