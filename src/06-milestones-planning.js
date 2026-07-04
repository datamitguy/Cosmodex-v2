/* ══ MILESTONES — FIRESTORE CRUD ══ */
// → future file: cosmodex-planning.js
async function addMilestoneProject(title, startDate, endDate, color, category='', notes='', missionBrief='', antiGoals='') {
  const { addDoc, serverTimestamp } = window.CDX_FB;
  const ref = await addDoc(_uc('milestoneProjects'),
    { title, startDate, endDate, color, category: category||null, notes: notes||'',
      missionBrief: missionBrief||null, antiGoals: antiGoals||null,
      isArchived: false,
      createdAt: serverTimestamp() });
  return ref;
}

async function updateMilestoneProject(id, data) {
  const { updateDoc } = window.CDX_FB;
  await updateDoc(_ud('milestoneProjects', id), data);
}

async function deleteMilestoneProject(id) {
  const { deleteDoc, getDocs, query, where } = window.CDX_FB;
  const [evSnap, listSnap] = await Promise.all([
    getDocs(query(_uc('milestoneEvents'), where('projectId', '==', id))),
    getDocs(query(_uc('milestone_lists'), where('projectId', '==', id))),
  ]);
  // Cascade-delete tasks linked via milestone event activities
  const taskIds = [];
  evSnap.docs.forEach(d => {
    (d.data().activities || []).forEach(a => { if (a.taskId) taskIds.push(a.taskId); });
  });
  // Collect calEventIds from linked tasks (and their subtasks) to avoid orphans
  const calEventIds = [];
  taskIds.forEach(tid => {
    const t = TASKS.find(t => t.id === tid);
    if (t?.calEventId) calEventIds.push(t.calEventId);
    (t?.subtasks || []).forEach(s => { if (s.calEventId) calEventIds.push(s.calEventId); });
  });
  CAL_EVENTS.filter(e => taskIds.includes(e.taskId)).forEach(e => {
    if (!calEventIds.includes(e.id)) calEventIds.push(e.id);
  });
  await Promise.all([
    ...evSnap.docs.map(d => deleteDoc(d.ref)),
    ...listSnap.docs.map(d => deleteDoc(d.ref)),
    ...taskIds.map(tid => deleteDoc(_ud('tasks', tid))),
    ...calEventIds.map(cid => deleteDoc(_ud('calEvents', cid))),
  ]);
  await deleteDoc(_ud('milestoneProjects', id));
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
  const { deleteDoc } = window.CDX_FB;
  const ev = MILESTONE_EVENTS.find(e => e.id === id);
  const taskIds = (ev?.activities || []).filter(a => a.taskId).map(a => a.taskId);
  // Collect calEvents linked to those tasks (and their subtasks) so they aren't orphaned
  const calEventIds = [];
  taskIds.forEach(tid => {
    const t = TASKS.find(t => t.id === tid);
    if (t?.calEventId) calEventIds.push(t.calEventId);
    (t?.subtasks || []).forEach(s => { if (s.calEventId) calEventIds.push(s.calEventId); });
  });
  CAL_EVENTS.filter(e => taskIds.includes(e.taskId)).forEach(e => {
    if (!calEventIds.includes(e.id)) calEventIds.push(e.id);
  });
  await Promise.all([
    deleteDoc(_ud('milestoneEvents', id)),
    ...taskIds.map(tid => deleteDoc(_ud('tasks', tid))),
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
    body.innerHTML = `<div style="color:var(--muted);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-align:center;margin-top:60px">No initiatives yet.<br><br>Click "+ Initiative" to start.</div>`;
    return;
  }

  body.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'ms-dash-grid';

  activeProjs.forEach(proj => {
    const events = MILESTONE_EVENTS.filter(e => e.projectId === proj.id);
    const allActs = events.flatMap(e => e.activities || []);
    const doneActs = allActs.filter(a => a.done).length;
    const totalActs = allActs.length;
    const pct = totalActs > 0 ? Math.round(doneActs / totalActs * 100) : 0;
    const isComplete = pct === 100;
    const cat = proj.category ? CATEGORIES[proj.category] : null;

    const outer = document.createElement('div');
    outer.className = 'ms-dash-card-outer';
    outer.dataset.msDashCard = proj.id;
    // Build milestone + task detail section
    const visibleEvents = events.sort((a,b) => a.date.localeCompare(b.date)).slice(0, 4);
    const msListHtml = visibleEvents.length ? `
      <div class="ms-card-milestones">
        ${visibleEvents.map(ev => {
          const evDone = (ev.activities||[]).length > 0 && (ev.activities||[]).every(a => a.done);
          const dotColor = evDone ? 'rgb(57,255,20)' : (new Date(ev.date) < new Date() ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)');
          const linkedTasks = (ev.activities||[]).filter(a => a.taskId).slice(0,3)
            .map(a => { const t = TASKS.find(t => t.id === a.taskId); return t ? { title: t.title, done: t.done } : { title: a.text, done: a.done }; });
          return `<div>
            <div class="ms-card-milestone-item">
              <div class="ms-card-milestone-dot" style="background:${dotColor}"></div>
              <span class="ms-card-milestone-name" style="${evDone ? 'text-decoration:line-through;opacity:0.5' : ''}">${escHtml(ev.title)}</span>
              <span class="ms-card-milestone-date">${escHtml(fmtDate(ev.date))}</span>
            </div>
            ${linkedTasks.length ? `<div class="ms-card-tasks" style="margin-left:11px">
              ${linkedTasks.map(t => `<span class="ms-card-task-chip${t.done?' done':''}" title="${escAttr(t.title)}">${escHtml(t.title)}</span>`).join('')}
            </div>` : ''}
          </div>`;
        }).join('')}
        ${events.length > 4 ? `<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.08em;padding-left:11px">+${events.length-4} more</div>` : ''}
      </div>` : `<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:0.06em;opacity:0.6">no milestones charted yet</div>`;

    outer.innerHTML = `
      <div class="ms-dash-card-inner">
        <div class="ms-dash-card-title">${escHtml(proj.title)}</div>
        <div class="ms-dash-card-meta">
          ${cat ? `<span style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44;padding:1px 7px;border-radius:100px;font-family:var(--font-mono);font-size:10px;letter-spacing:0.05em">${cat.label}</span>` : ''}
          <span>${escHtml(fmtDate(proj.startDate))} – ${escHtml(fmtDate(proj.endDate))}</span>
        </div>
        ${msListHtml}
        <div class="ms-dash-card-footer">
          <div>
            <div class="ms-dash-pct-label" style="color:${isComplete ? 'rgb(57,255,20)' : 'rgba(255,255,255,0.75)'}">${pct}%</div>
            <div class="ms-dash-acts-label">${doneActs}/${totalActs} done</div>
          </div>
          <div style="text-align:right;display:flex;align-items:center;gap:8px">
            <div class="ms-dash-milestones-count">${events.length} ms</div>
            <button class="btn-ghost ms-archive-btn" data-ms-archive="${proj.id}" style="font-size:10px;padding:3px 8px;color:var(--muted);border-color:var(--border)" title="Mark as done & archive">✓ Done</button>
          </div>
        </div>
      </div>`;
    grid.appendChild(outer);
  });

  if (activeProjs.length) body.appendChild(grid);
  else body.innerHTML = `<div style="color:var(--muted);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-align:center;margin-top:40px">All initiatives archived.</div>`;

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
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);flex:1">Archived Initiatives</span>
        <button id="ms-arch-overlay-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;line-height:1;padding:2px 6px">×</button>
      </div>
      <div style="overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px">
        ${archivedProjs.length === 0
          ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--muted);text-align:center;padding:24px">No archived initiatives</div>`
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
    body.innerHTML = `<div style="font-family:var(--font-mono);font-size:11px;color:var(--muted);text-align:center;padding:64px">No archived initiatives</div>`;
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
  body.innerHTML = `
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

  body.querySelectorAll('[data-ms-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteMilestoneItem(projId, btn.dataset.msDel));
  });
}

/* ── Timeline: single-project alternating view ────────── */
function renderMilestoneTimeline(projId) {
  // Render into right panel timeline body (new two-panel layout)
  const body = document.getElementById('plan-tl-body');
  if (!body) return;
  const proj = MILESTONE_PROJECTS.find(p => p.id === projId);
  if (!proj) { _msView = 'dashboard'; renderMilestoneDashboard(); return; }

  const events = MILESTONE_EVENTS.filter(e => e.projectId === projId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const allActs = events.flatMap(e => e.activities || []);
  const doneActs = allActs.filter(a => a.done).length;
  const totalActs = allActs.length;
  const pct = totalActs > 0 ? Math.round(doneActs / totalActs * 100) : 0;

  const now = new Date();
  const start = new Date(proj.startDate);
  const end   = new Date(proj.endDate);
  const totalMs = end - start;
  const elapsedPct = totalMs > 0 ? Math.max(0, Math.min(100, ((now - start) / totalMs) * 100)) : 0;

  // Alternating milestone rows
  const rowsHtml = events.map((ev, idx) => {
    const acts = ev.activities || [];
    const doneCount = acts.filter(a => a.done).length;
    const isPast = new Date(ev.date) < new Date();
    const dotColor = doneCount === acts.length && acts.length > 0
      ? 'rgb(57,255,20)' : (isPast ? proj.color : 'rgba(255,255,255,0.38)');

    const actItems = acts.map(a => {
      const task = a.taskId ? TASKS.find(t => t.id === a.taskId) : null;
      const cat = task?.category ? CATEGORIES[task.category] : null;
      const actCatClr = getCatColor(task?.category);
      const catBadge = cat
        ? `<span style="font-size:10px;padding:1px 5px;border-radius:100px;background:${actCatClr}22;color:${actCatClr};border:1px solid ${actCatClr}44;font-family:var(--font-mono)">${cat.label}</span>`
        : '';
      return `<div class="ms-action-item">
        <div class="ms-action-check ${a.done?'done':''}" data-toggle-act="${escAttr(a.id)}" data-ev-id="${escAttr(ev.id)}">${a.done?'✓':''}</div>
        <span style="flex:1;font-family:var(--font-body);font-size:12px;color:${a.done?'var(--muted)':'var(--cream)'};${a.done?'text-decoration:line-through':''}">${escHtml(a.text||a.title||'')}</span>
        ${catBadge}
        <button class="task-action-btn danger" style="opacity:0" data-rm-act="${escAttr(a.id)}" data-ev-id="${escAttr(ev.id)}">✕</button>
      </div>`;
    }).join('');

    const card = `
      <div class="ms-alt-milestone-card" style="animation-delay:${idx * 60}ms">
        <div class="ms-alt-card-title">${escHtml(ev.title)}</div>
        ${ev.description ? `<div class="ms-alt-card-desc">${escHtml(ev.description)}</div>` : ''}
        <div class="ms-action-items-list" data-ev-id="${escAttr(ev.id)}" style="margin-bottom:10px">
          ${actItems || '<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);padding:4px 0">No tasks yet.</div>'}
        </div>
        <div class="ms-add-task-row" data-ev-id="${escAttr(ev.id)}" style="border-top:1px solid var(--border);padding-top:8px">
          <div style="display:flex;gap:6px;margin-bottom:4px">
            <input class="ms-task-search-input form-input" placeholder="Search or add task…" data-ev-id="${escAttr(ev.id)}" style="flex:1;font-size:12px;padding:5px 9px" autocomplete="off">
            <button class="btn-primary" style="font-size:10px;padding:5px 10px;white-space:nowrap" data-add-task-ev="${escAttr(ev.id)}">Add</button>
          </div>
          <div class="ms-task-search-results" data-ev-id="${escAttr(ev.id)}" style="display:none;background:var(--elevated);border:1px solid var(--border);border-radius:8px;max-height:140px;overflow-y:auto"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px">
          <button class="ms-edit-proj-btn" data-ms-edit-ev="${escAttr(ev.id)}" style="font-size:11px;color:var(--muted)">✎ Edit</button>
          <button class="ms-edit-proj-btn" data-ms-del-ev="${escAttr(ev.id)}" style="font-size:11px;color:var(--gold)">✕ Delete</button>
        </div>
      </div>`;

    const dotCol = `
      <div class="ms-alt-dot-col">
        <div class="ms-alt-dot" style="background:${dotColor}${doneCount===acts.length&&acts.length>0?';box-shadow:0 0 8px rgba(57,255,20,0.9),0 0 20px rgba(57,255,20,0.5)':''}"></div>
        <div class="ms-alt-date-badge">${escHtml(fmtDate(ev.date))}</div>
        ${acts.length ? `<div style="font-family:var(--font-mono);font-size:10px;color:${doneCount===acts.length?'rgb(57,255,20)':'var(--muted)'};margin-top:2px">${doneCount}/${acts.length}</div>` : ''}
      </div>`;

    // Alternate: even idx → card on left, odd → card on right
    const isLeft = idx % 2 === 0;
    return `<div class="ms-alt-row" style="animation-delay:${idx*40}ms">
      ${isLeft ? `<div class="ms-alt-card-col">${card}</div>` : '<div></div>'}
      ${dotCol}
      ${isLeft ? '<div></div>' : `<div class="ms-alt-card-col">${card}</div>`}
    </div>`;
  }).join('');

  // Build initiative metadata section (notes, mission, anti-goals) — always editable inline
  const metaHtml = `
    <div style="padding:16px 24px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02)">
      <div style="margin-bottom:14px">
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Notes & Context</div>
        <textarea id="ms-inline-notes" rows="2" placeholder="Add notes or context…" style="width:100%;background:transparent;border:none;border-bottom:1px solid transparent;outline:none;font-family:var(--font-body);font-size:12px;color:var(--cream);line-height:1.6;resize:none;transition:border-color 0.2s"></textarea>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Mission Brief</div>
        <textarea id="ms-inline-mission" rows="2" placeholder="Why this matters…" style="width:100%;background:transparent;border:none;border-left:2px solid rgba(255,255,255,0.12);outline:none;font-family:var(--font-body);font-size:12px;color:var(--cream);line-height:1.6;resize:none;padding-left:10px;transition:border-color 0.2s"></textarea>
      </div>
      <div>
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Anti-Goals</div>
        <textarea id="ms-inline-antigoals" rows="2" placeholder="What we will NOT do…" style="width:100%;background:transparent;border:none;border-bottom:1px solid transparent;outline:none;font-family:var(--font-mono);font-size:10px;color:var(--gold);line-height:1.6;resize:none;transition:border-color 0.2s"></textarea>
      </div>
    </div>`;

  body.innerHTML = `
    <div class="ms-alt-timeline-wrap">
      <div class="ms-alt-project-header">
        <span class="ms-alt-project-title">${escHtml(proj.title)}</span>
        <span class="ms-alt-project-sub">${escHtml(fmtDate(proj.startDate))} — ${escHtml(fmtDate(proj.endDate))}</span>
      </div>
      <div class="ms-alt-progress-wrap">
        <div class="ms-alt-progress-bar" data-proj-bar="${escAttr(proj.id)}">
          <div class="ms-alt-progress-fill" style="width:${elapsedPct.toFixed(1)}%;background:rgb(57,255,20);opacity:0.25"></div>
          <div class="ms-alt-progress-fill" style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:rgb(57,255,20);opacity:0.85;transition:width 0.4s;border-radius:3px;box-shadow:0 0 8px rgba(57,255,20,0.7),0 0 20px rgba(57,255,20,0.3)"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:4px">
          <span>${pct}% complete · ${doneActs}/${totalActs} tasks</span>
          <span>${Math.round(elapsedPct)}% elapsed</span>
        </div>
      </div>
      ${metaHtml}
      ${events.length ? `
        <div class="ms-alt-entries">
          <div class="ms-alt-center-line"></div>
          <div class="ms-alt-center-elapsed" style="height:${elapsedPct.toFixed(1)}%;background:rgb(57,255,20)"></div>
          <div class="ms-alt-cap">
            <div class="ms-alt-cap-dot" style="border-color:${proj.color}"></div>
            <div class="ms-alt-cap-label">Start · ${escHtml(fmtDate(proj.startDate))}</div>
          </div>
          ${rowsHtml}
          <div class="ms-alt-cap">
            <div class="ms-alt-cap-dot" style="border-color:${proj.color}"></div>
            <div class="ms-alt-cap-label">End · ${escHtml(fmtDate(proj.endDate))}</div>
          </div>
        </div>`
      : `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:40px 0">
          no milestones on this trajectory yet. click "+ Milestone" above to plot one.
        </div>`}
    </div>`;

  // Set textarea values and wire up blur-to-save for inline notes fields
  const notesTA    = body.querySelector('#ms-inline-notes');
  const missionTA  = body.querySelector('#ms-inline-mission');
  const antiTA     = body.querySelector('#ms-inline-antigoals');
  if (notesTA)   notesTA.value   = proj.notes       || '';
  if (missionTA) missionTA.value = proj.missionBrief || '';
  if (antiTA)    antiTA.value    = proj.antiGoals    || '';

  const focusStyle = (el, isBorderLeft) => {
    if (!el) return;
    el.addEventListener('focus', () => {
      if (isBorderLeft) el.style.borderLeftColor = 'rgba(255,255,255,0.4)';
      else              el.style.borderBottomColor = 'rgba(255,255,255,0.25)';
    });
    el.addEventListener('blur', () => {
      if (isBorderLeft) el.style.borderLeftColor = 'rgba(255,255,255,0.12)';
      else              el.style.borderBottomColor = 'transparent';
    });
  };
  focusStyle(notesTA,   false);
  focusStyle(missionTA, true);
  focusStyle(antiTA,    false);

  const saveField = (el, field) => {
    if (!el) return;
    el.addEventListener('blur', () => {
      updateMilestoneProject(proj.id, { [field]: el.value.trim() || null });
    });
  };
  saveField(notesTA,   'notes');
  saveField(missionTA, 'missionBrief');
  saveField(antiTA,    'antiGoals');
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
  document.getElementById('ms-proj-modal-title').textContent = proj ? 'Edit Initiative' : 'New Initiative';
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
  const delBtn = document.getElementById('ms-proj-delete-btn');
  if (delBtn) delBtn.style.display = proj ? '' : 'none';
  openOverlay('ms-project-modal');
}

function openMsEventModal(projectId, eventId = null, prefilledDate = '') {
  const ev = eventId ? MILESTONE_EVENTS.find(e => e.id === eventId) : null;
  _msEventEdit = eventId || null;
  _msNewActivities = ev ? JSON.parse(JSON.stringify(ev.activities)) : [];
  document.getElementById('ms-event-modal-title').textContent = ev ? 'Edit Milestone' : 'New Milestone';
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
    const dot = `<div style="width:6px;height:6px;border-radius:50%;background:${t.priority==='high'?'var(--gold)':t.priority==='med'?'rgba(212,162,78,0.55)':'var(--muted)'};flex-shrink:0"></div>`;
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
    if (!title || !start || !end) { showToast('Title, Start Date, and End Date are required.', 'error'); return; }
    if (end < start) { showToast('End date must be on or after start date.', 'error'); return; }
    try {
      if (_msProjEdit) {
        await updateMilestoneProject(_msProjEdit, { title, startDate: start, endDate: end, color, category: category||null, notes, missionBrief: missionBrief||null, antiGoals: antiGoals||null });
        closeOverlay('ms-project-modal');
      } else {
        const newRef = await addMilestoneProject(title, start, end, color, category, notes, missionBrief, antiGoals);
        closeOverlay('ms-project-modal');
        if (newRef?.id) { _msView = 'timeline'; _msFocusProj = newRef.id; showPlanningTimeline(newRef.id); }
      }
    } catch (err) {
      console.error('Failed to save initiative:', err);
      showToast('Failed to save initiative', 'error');
    }
  });

  // Initiative delete button
  document.getElementById('ms-proj-delete-btn').addEventListener('click', async () => {
    if (!_msProjEdit) return;
    const proj = MILESTONE_PROJECTS.find(p => p.id === _msProjEdit);
    if (await cdxConfirm(`Delete initiative "${proj ? proj.title : ''}" and all its milestones?`)) {
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
          return `<div class="ms-task-search-result" data-modal-task-id="${escAttr(t.id)}" style="cursor:pointer"><div style="width:6px;height:6px;border-radius:50%;background:${t.priority==='high'?'var(--gold)':t.priority==='med'?'rgba(212,162,78,0.55)':'var(--muted)'};flex-shrink:0"></div><span style="flex:1">${escHtml(t.title)}</span>${catBadge}</div>`;
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
      document.getElementById('plan-ms-close')?.addEventListener('click', closeMilestoneDetail);
      // View switcher (Projects & Context  ↔  Week & Month)
      document.querySelectorAll('.plan-switcher-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.plan-switcher-btn').forEach(b => b.classList.toggle('active', b === this));
          const pill = document.getElementById('plan-switcher-pill');
          const isCalendar = this.dataset.pview === 'calendar';
          pill.style.transform = isCalendar ? 'translateX(100%)' : '';
          document.getElementById('plan-view-projects').style.display = isCalendar ? 'none' : 'flex';
          document.getElementById('plan-view-calendar').style.display = isCalendar ? 'flex' : 'none';
          if (isCalendar) switchPlanRightTab('focus');
          else renderMilestones();
        });
      });
      restorePlanPanelStates();
    }
    switchPlanRightTab('focus'); // default to Focus tab each time panel opens
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

  MILESTONE_EVENTS.forEach(ev => {
    if (projId && ev.projectId !== projId) return;
    const ds = String(ev.date || '').slice(0, 10);
    if (!ds) return;
    push(ds, { kind:'milestone', id: ev.id, projectId: ev.projectId,
      title: ev.title || 'Milestone', color: _pcalProjColor(ev.projectId), startTime: null });
  });

  (CAL_EVENTS || []).forEach(ev => {
    const pid = _pcalEventProj(ev);
    if (!pid) return;                     // planning calendar shows initiative work only
    if (projId && pid !== projId) return;
    const ds = String(ev.date || '').slice(0, 10);
    if (!ds) return;
    push(ds, { kind:'event', id: ev.id, projectId: pid,
      title: ev.title || 'Event', color: _pcalProjColor(pid),
      startTime: ev.allDay ? null : (ev.startTime || null), duration: ev.duration || 60 });
  });

  // Milestones first, then events by start time
  Object.values(byDate).forEach(arr => arr.sort((a, b) =>
    (a.kind === b.kind) ? String(a.startTime||'').localeCompare(String(b.startTime||'')) : (a.kind === 'milestone' ? -1 : 1)));
  return byDate;
}

function _pcalChip(it) {
  return `<div class="pcal-chip" data-pcal-open="${it.kind}" data-id="${escAttr(it.id)}" data-proj="${escAttr(it.projectId)}" style="--c:${it.color}" title="${escAttr(it.title)}">
      ${it.kind === 'milestone' ? '<span class="pcal-diamond">◆</span>' : '<span class="pcal-evdot"></span>'}
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
  const grid = cells.map(c => {
    const items = byDate[c.ds] || [];
    const chips = items.slice(0, 3).map(_pcalChip).join('');
    const more = items.length > 3 ? `<div class="pcal-more">+${items.length - 3} more</div>` : '';
    return `<div class="pcal-cell${c.inMonth ? '' : ' out'}${c.isToday ? ' today' : ''}${c.weekend ? ' wknd' : ''}" data-pcal-day="${c.ds}">
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

function _pcalToolbar() {
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
        <div class="pcal-viewtoggle">
          <button class="pcal-vt${_pcalView === 'week' ? ' active' : ''}" data-pcal-view="week">Week</button>
          <button class="pcal-vt${_pcalView === 'month' ? ' active' : ''}" data-pcal-view="month">Month</button>
        </div>
      </div>
    </div>`;
}

function renderPlanningCalendar(projId) {
  _pcalProj = projId || null;
  const body = document.getElementById('plan-tl-body');
  if (!body) return;
  const byDate = _pcalItems(_pcalProj);
  const anyItems = Object.keys(byDate).length > 0;
  const empty = anyItems ? '' :
    `<div class="pcal-empty">${_pcalProj ? 'No milestones or events for this initiative yet.' : 'No initiative milestones or events scheduled yet.'}</div>`;
  body.innerHTML = `<div class="pcal">${_pcalToolbar()}${_pcalView === 'week' ? _pcalRenderWeek(byDate) : _pcalRenderMonth(byDate)}${empty}</div>`;

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
}

// Default centre-panel state: calendar across every initiative
function showPlanningCalendarAll() {
  const empty   = document.getElementById('plan-ctx-empty');
  const content = document.getElementById('plan-ctx-content');
  if (empty)   empty.style.display   = 'none';
  if (content) content.style.display = 'flex';
  const titleEl = document.getElementById('plan-ctx-title');
  if (titleEl) titleEl.textContent = 'All Initiatives';
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
