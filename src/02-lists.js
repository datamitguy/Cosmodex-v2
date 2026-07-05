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
  document.getElementById('panel-getabstract').style.display = name === 'getabstract' ? 'flex' : 'none';
  document.getElementById('panel-mindmap').style.display     = name === 'mindmap' ? 'flex' : 'none';
  document.getElementById('panel-trial').style.display       = name === 'trial' ? 'flex' : 'none';
  const titles = { default:'Today', milestones:'Planning', archived:'Archived', lists:'Lists', alltasks:'Tasks', calendarx:'Calendar', focus:'Focus', habits:'Habits & Routines', insights:'Insights', drill:'Drill', timedrift:'Timedrift', getabstract:'GetAbstract', mindmap:'Mind Map', trial:'Trial' };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || 'Today';
  if (name === 'default') { window._dashInvalidateAnchor?.(); window.renderDashboardBoard?.(); }
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
  if (name === 'insights') { habitsSubscribe(); requestAnimationFrame(() => { renderInsights(); loadDoneWall(); }); }
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
  const visible = q ? LISTS.filter(l => l.title.toLowerCase().includes(q)) : LISTS;
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
        <span class="list-sidebar-card-name">${escHtml(l.title)}</span>
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

