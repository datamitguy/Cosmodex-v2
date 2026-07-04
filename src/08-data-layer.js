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
    if (_mainPanel === 'insights') renderInsights();
    window._refreshPlanTaskViews?.();
  });

  _calEventsUnsub = onSnapshot(query(_uc('calEvents'), orderBy('date', 'asc')), snap => {
    CAL_EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTasks(); renderCalendar(); updateDashboardHero();
    drawCosmodex(); // immediate orb sync on calendar change
    if (_mainPanel === 'insights') renderInsights();
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

