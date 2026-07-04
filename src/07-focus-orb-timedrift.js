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


