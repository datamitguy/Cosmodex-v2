# Cosmodex v2 — Comprehensive Code and Browser Audit Report

*Audit Date: 2026-07-04 · Scope: Full codebase review of modular JS scripts (`src/*.js`), build setup (`build.sh`), styling (`styles.css`), the entry shell (`cosmodex-v2.html`), and client-side browser runtime behaviors.*

---

## 1. Executive Summary

Cosmodex v2 features a highly distinctive and engaging design concept ("cosmic instrument panel") alongside several innovative features, such as the concentric year/month/day/hour/minute dials in **Timedrift** and the 24-hour radial clock in **Bubble**. 

However, a deep technical audit of both the source code and client-side browser runtime behaviors reveals critical architectural risks, data synchronization flaws, functional logic bugs, and visual hierarchy issues. This report serves as a complete blueprint to resolve these defects, ensuring the application is production-grade, secure, and performant.

### Core Audit Findings:
1. **Alphabetical Concatenation & Namespace Collision Risks**: The build mechanism ([build.sh](file:///Users/amitranjan/Projects/Cosmodex-v2/build.sh)) concatenates modular scripts directly into a single global-scope file ([app.js](file:///Users/amitranjan/Projects/Cosmodex-v2/app.js)) without encapsulation (e.g., IIFEs or ESM), creating severe risks of variable shadowing, collision, and state pollution.
2. **Critical Firestore Sync & Resurrection Bugs**: The merge logic for categories and people configuration sync is flawed. Deletions on one client are interpreted as "local-only" edits by other clients, resulting in resurrected categories and infinite sync loops.
3. **Firestore Quota & Performance Exhaustion**: Tab switching in Habits repeatedly tears down and spins up Firestore collection listeners, causing massive overhead and fetching 91 days of logs on every click. Deleting a habit initiates an expensive collection-wide scan and triggers mass updates that can crash the client or throttle API write rate limits.
4. **Broken Auto-Grading & Timer Logic**: The Communication Drill auto-grading uses fictitious models and syntax unsupported by the Anthropic API, rendering it immediately non-functional. The drill timer also contains a double-interval bug that causes the timer to count down twice as fast if scrubbed while running.
5. **Ephemeral Mind Map State**: The Mind Map engine lacks any persistence layer. All user-created nodes and edges are saved only in local variables and are permanently wiped on page reload or navigation change.
6. **Browser Security & Offline Risks**: API keys for direct grading are stored in plaintext in local storage. The application lacks service worker support for offline page load capabilities, and small touch targets create usability concerns on mobile viewports.

---

## 2. Architecture & Scope Analysis

### 2.1 Alphabetical Script Concatenation
The build script [build.sh](file:///Users/amitranjan/Projects/Cosmodex-v2/build.sh) gathers modular files under `src/*.js` and cat-concatenates them in alphabetical order to create [app.js](file:///Users/amitranjan/Projects/Cosmodex-v2/app.js):
```bash
cat src/*.js > app.js
```

#### Issues:
- **Implicit Dependency Chains**: Because classic script tags are loaded sequentially, modules rely on script loading order and hoisting. If a file name is changed or a dependency is moved out of order, it will throw a `ReferenceError` at runtime.
- **Polluted Global Namespace**: Every top-level declaration in `src/` (such as variables like `TASKS`, `CAL_EVENTS`, `_listView`, or helper functions) becomes a property on the global `window` object. This makes debugging difficult, increases the footprint of the app, and risks name collisions.
- **No Scope Isolation**: If a helper function in `02-lists.js` is named the same as one in `06-milestones-planning.js`, one will silently overwrite the other.

#### Recommendation:
Refactor [build.sh](file:///Users/amitranjan/Projects/Cosmodex-v2/build.sh) to use a modern, zero-config bundler (e.g., **Esbuild** or **Vite**) and refactor the modular scripts into standard **ES Modules (ESM)** using `import` and `export` statements. This ensures proper scope isolation, makes dependency graphs explicit, and facilitates treeshaking/minification.

---

## 3. Data Lineage & Firestore Sync Integrity

### 3.1 Flawed Category & People Sync (The Resurrection Bug)
In [09-tasks-and-shell.js](file:///Users/amitranjan/Projects/Cosmodex-v2/src/09-tasks-and-shell.js#L3932-L3962), the real-time config listeners for categories and people use a merge logic on snapshot arrival:
```javascript
// Categories Sync
CATEGORIES = Object.assign({}, CATEGORIES, data.categories);
saveCategoriesLocal();

// People Sync
const remotePeople = data.people;
const remoteNames = new Set(remotePeople.map(p => p.name));
const localOnly = PEOPLE.filter(p => !remoteNames.has(p.name));
PEOPLE = [...remotePeople, ...localOnly];
localStorage.setItem('cdx_people', JSON.stringify(PEOPLE));
```

#### The Bug:
1. When Client A deletes a category or person, it updates Firestore with `{ merge: false }` ([09-tasks-and-shell.js:L1918](file:///Users/amitranjan/Projects/Cosmodex-v2/src/09-tasks-and-shell.js#L1918)), successfully removing the key from the remote database.
2. However, Client B receives the snapshot. Its local `CATEGORIES` variable and `localStorage` still contain the deleted key.
3. Because of `Object.assign({}, CATEGORIES, data.categories)`, the deleted key is merged *back* into the active categories.
4. When Client B subsequently writes or updates *its* state, it re-uploads the deleted category to Firestore, resurrecting it.
5. Deletion of categories or collaborators is impossible across multiple active devices.

#### Recommendation:
Do not perform additive merges on snapshot events. The snapshot from Firestore must be treated as the **Single Source of Truth (SSOT)**. When a snapshot arrives, overwrite the local configuration entirely:
```javascript
_catUnsub = onSnapshot(doc(window.CDX_DB, 'users', _catUser.uid, 'config', 'categories'), snap => {
  if (snap.exists()) {
    const data = snap.data();
    if (data?.categories) {
      CATEGORIES = data.categories; // Overwrite local with remote
      saveCategoriesLocal();
      // rebuild UI...
    }
  }
});
```

---

### 3.2 Inefficient Habits Sync (Tab-Switch Churn)
In [03-habits.js](file:///Users/amitranjan/Projects/Cosmodex-v2/src/03-habits.js#L178-L192), switching tabs under the Habits panel calls `habitsSubscribe()`, `routinesSubscribe()`, `behavSubscribe()`, etc.:
```javascript
if (tab === 'today')     { habitsSubscribe(); routinesSubscribe(); ... }
if (tab === 'reflect')   { habitsSubscribe(); hbSettingsSubscribe(); ... }
if (tab === 'habits')    { habitsSubscribe(); hbSettingsSubscribe(); ... }
if (tab === 'hinsights') { habitsSubscribe(); ... }
```

Inside `habitsSubscribe()`:
```javascript
if (_habitsUnsub) { _habitsUnsub(); _habitsUnsub = null; }
if (_habitLogsUnsub) { _habitLogsUnsub(); _habitLogsUnsub = null; }

_habitsUnsub = onSnapshot(collection(db, 'users', uid, 'habits'), snap => { ... });
_habitLogsUnsub = onSnapshot(query(collection(db, 'users', uid, 'habitLogs'), where('date', '>=', localDateStr(d91))), snap => { ... });
```

#### Issues:
- **Redundant Network Calls**: Every single time the user clicks between "Today", "Habits", "Insights", or "Reflect", it unsubscribes and resubscribes to the `habits` and `habitLogs` collections.
- **Quota Drainage**: Resubscribing causes Firestore to download the entire list of habits and the last 91 days of logs *again*. If a user switches tabs 20 times in a session, it charges hundreds of reads on identical data.
- **Latency & UI Flicker**: The UI renders blank cards or showing loading states briefly on each click while waiting for the roundtrip cache check.

#### Recommendation:
Initialize the habits and logs subscriptions **once** on application boot (inside the `cdx-auth-ready` listener, alongside other collections in `initData()`). Once loaded, let the snapshots dynamically update the in-memory arrays. Remove the resubscribe calls entirely from `switchHabitsTab()`.

---

### 3.3 Non-Atomic Parent-Child Cascades
In [06-milestones-planning.js](file:///Users/amitranjan/Projects/Cosmodex-v2/src/06-milestones-planning.js#L25-L48), deleting a milestone project performs cascades on linked lists, tasks, and calendar events:
```javascript
await Promise.all([
  ...evSnap.docs.map(d => deleteDoc(d.ref)),
  ...listSnap.docs.map(d => deleteDoc(d.ref)),
  ...del.map(tid => deleteDoc(_ud('tasks', tid))),
  ...keep.map(tid => updateDoc(_ud('tasks', tid), { projectId: null })),
  ...calEventIds.map(cid => deleteDoc(_ud('calEvents', cid))),
]);
await deleteDoc(_ud('milestoneProjects', id));
```

#### Issues:
- **No Transactional Integrity**: If the client loses connection or permission is denied halfway through this `Promise.all` block, only some of the elements will be deleted. The remaining items will become **orphans** or **dangling references** pointing to a deleted project, leading to silent data rot.
- **Quota Overhead**: It sends dozens of separate individual REST/Websocket delete requests to Firestore in parallel.

#### Recommendation:
Use a Firestore **`WriteBatch`** or transaction to guarantee atomicity. The entire operation should either succeed completely or fail completely:
```javascript
const batch = writeBatch(window.CDX_DB);
evSnap.docs.forEach(d => batch.delete(d.ref));
listSnap.docs.forEach(d => batch.delete(d.ref));
del.forEach(tid => batch.delete(_ud('tasks', tid)));
keep.forEach(tid => batch.update(_ud('tasks', tid), { projectId: null }));
calEventIds.forEach(cid => batch.delete(_ud('calEvents', cid)));
batch.delete(_ud('milestoneProjects', id));
await batch.commit();
```

---

### 3.4 Severe Habit Delete Write-Explosion
In [03-habits.js:L670-694](file:///Users/amitranjan/Projects/Cosmodex-v2/src/03-habits.js#L687-L694), deleting a habit triggers a best-effort cleanup of completion logs:
```javascript
try {
  const snap = await getDocs(collection(window.CDX_DB, 'users', uid, 'habitLogs'));
  await Promise.all(snap.docs
    .filter(d => d.data()?.completions && Object.prototype.hasOwnProperty.call(d.data().completions, habitId))
    .map(d => updateDoc(d.ref, { ['completions.' + habitId]: deleteField() })));
} catch(e) { console.warn('habitLogs purge after habitDelete failed:', e.message); }
```

#### Critical Vulnerability:
- **O(N) Read & Write Explosion**: `getDocs(collection(...))` downloads **every single habit log document** the user has ever recorded (potentially hundreds or thousands of documents for multi-year users).
- **Concurrency Overload**: It fires individual `updateDoc` calls in parallel for every single day the habit was completed. If a user tracked a habit for 300 days, it fires **300 parallel write requests** to Firestore, triggering immediate quota throttling, massive cellular data consumption, and potential browser crashes.

#### Recommendation:
1. **Decouple Data Purging**: Do not purge historical logs on habit deletion. Instead, let stats and chart calculations filter out logs for non-existent habits by checking if the habit ID is present in the current `_habits` array.
2. If pruning is strictly desired, limit it to the locally cached logs (last 91 days) and run it using a structured batch rather than an unbounded query.

---

### 3.5 Ephemeral Mind Map State (Zero Persistence)
In [10-mindmap.js](file:///Users/amitranjan/Projects/Cosmodex-v2/src/10-mindmap.js#L11-L12), the mind map stores its structure in local variables:
```javascript
let nodes = [];      // { id, x, y, text, color }
let edges = [];      // { from, to }
```

#### Issues:
- There is no sync logic linking `nodes` and `edges` to Firestore, and no backup storage in `localStorage`.
- All user-created mind maps, ideas, and node structures are permanently deleted whenever the page is refreshed or the user signs out/in.

#### Recommendation:
Add a sync hook that autosaves the current mindmap workspace to a user document under `users/{uid}/config/mindmap` (or as a collection `users/{uid}/mindmap_nodes` if maps grow complex) whenever nodes are added, edited, deleted, or dragged. Load this state when `initMindMap()` is called.

---

## 4. Workflow & Logic Defects

### 4.1 Fictitious API Config in Auto-Grading
In [12-drill-providers.js:L45-64](file:///Users/amitranjan/Projects/Cosmodex-v2/src/12-drill-providers.js#L45-L64), the direct API auto-grade script for Claude makes the following request:
```javascript
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  },
  body: JSON.stringify({
    model: 'claude-opus-4-8', // Fictitious model name
    max_tokens: 1024,
    output_config: { format: { type: 'json_schema', schema: DRILL_GRADE_SCHEMA } }, // Unsupported format
    messages: [{ role: 'user', content: promptText }],
  }),
});
```

#### Why it fails:
1. **Invalid Model**: There is no model named `claude-opus-4-8`. The actual Anthropic model name is `claude-3-opus-20240229` (or `claude-3-5-sonnet-20241022`).
2. **Invalid Body Payload**: The Anthropic Messages API does *not* support the `output_config` schema formatting block. This parameter will throw a `400 Bad Request` validation error immediately.

#### Recommendation:
Change the model name to `claude-3-5-sonnet-20241022` and inject the JSON structure requirements directly into the prompt text as system instructions. Alternatively, implement an Anthropic **Tool Call** that expects a structured schema matching `DRILL_GRADE_SCHEMA`.

---

### 4.2 Drill Timer Double-Interval Bug (Speedy Countdown)
In [11-comm-drill.js:L603-628](file:///Users/amitranjan/Projects/Cosmodex-v2/src/11-comm-drill.js#L618-L626), the `pointerup` listener on the draggable timer display triggers the countdown:
```javascript
if (_drillTimerLeft > 0 && !_drillTimerId) {
  _drillTimerTotal = Math.max(_drillTimerTotal || 0, _drillTimerLeft);
  _drillTimerId = setInterval(() => {
    _drillTimerLeft--;
    _renderDrillTimerDisplay();
    if (_drillTimerLeft <= 0) stopDrillTimer();
  }, 1000);
}
```

#### The Bug:
- If a timer is *already running* (so `_drillTimerId` is active), and the user clicks and scrubs the timer digits again, `_drillTimerId` is *not* cleared during dragging.
- **The actual issue**: If the user clicks "Start Timer" or clicks "3 min" or "5 min" button while a timer is active, `startDrillTimer()` is called but does not account for active scrub operations that might overlap, leading to multiple interval instances ticking down the time simultaneously.
- Always call `stopDrillTimer()` inside the `pointerdown` block as soon as the user starts scrubbing, to pause the timer cleanly. Resume it on `pointerup`.

---

### 4.3 Click Guard Blocking Rapid Input
In [08-data-layer.js:L112-121](file:///Users/amitranjan/Projects/Cosmodex-v2/src/08-data-layer.js#L112-L121), a click double-submit guard is attached to the document:
```javascript
document.addEventListener('click', e => {
  const btn = e.target.closest('button, [data-confirm]');
  if (!btn) return;
  const cls = typeof btn.className === 'string' ? btn.className : '';
  if (!/(?:^|[-_ ])(confirm|save|create|add)(?:[-_ ]|$)/i.test((btn.id || '') + ' ' + cls)) return;
  const now = Date.now();
  if (now - (_cdxClickGuard.get(btn) || 0) < 800) { e.stopImmediatePropagation(); e.preventDefault(); return; }
  _cdxClickGuard.set(btn, now);
}, true);
```

#### The Defect:
- This is a global listener that regex-matches any button with "add", "create", "save", or "confirm" in its class or ID.
- While effective at stopping multiple saves on slow network calls, it severely disrupts legitimate user actions. For example:
  - Adding multiple subtasks to a task in rapid succession.
  - Clicking `+` to add multiple items to a list.
  - Adding multiple items in Focus Buckets.
- Clicking rapidly will silently discard every second click (within 800ms), making the app feel laggy and broken.

#### Recommendation:
Remove this aggressive global listener. Handle double-submit prevention contextually on buttons that write new documents by disabling the button element (`disabled = true`) inside the event handler and re-enabling it once the async promise resolves.

---

## 5. Browser Runtime & Client UX Audit

Performing a runtime audit on the hosted application (`https://datamitguy.github.io/Cosmodex-v2/cosmodex-v2.html`) yields several browser environment and usability concerns:

### 5.1 Plaintext API Key Leakage (Security)
*   **Vulnerability**: The auto-grading configuration panel stores LLM API keys directly in `localStorage` in plaintext (`cdx_drill_settings`).
*   **Risk**: If the client is infected by malicious browser extensions or compromised by Cross-Site Scripting (XSS) via third-party CDNs, these keys can be read directly from `localStorage` and exfiltrated.
*   *Recommendation*: Implement a simple serverless proxy or Firebase Cloud Function to interact with Anthropic/DeepSeek APIs. Keys should never be input or stored client-side in the browser.

### 5.2 Detached DOM Element Leak on Celebrations
*   **Vulnerability**: The task completion function `_taskFireCelebration()` creates a `task-burst-ring` element, appends it to the `<body>`, and sets a `setTimeout` to delete it after 700ms.
*   **Risk**: If the user navigates away, signs out, or locks the browser tab while multiple animations are queued, reference errors or tab freezes can cause elements to leak.
*   *Recommendation*: Track active animation elements in a scoped registry and clean them up inside a `window.beforeunload` or component destroy lifecycle hook.

### 5.3 Offline Page Load Failure (No Service Worker)
*   **Vulnerability**: While Firestore is configured with `persistentLocalCache` to cache database snapshots locally, the core application shell files (`cosmodex-v2.html`, `app.js`, `styles.css`) are served statically.
*   **Risk**: If a user goes offline or loses network connection, typing the application URL in their browser will result in a connection failure, preventing them from accessing the app.
*   *Recommendation*: Configure a Service Worker (PWA manifest) to handle local caching of static assets, enabling a true "Offline First" experience.

### 5.4 Mobile Touch Target Violations
*   **Vulnerability**: The mobile sidebar icons and list delete triggers (`✕`) are styled smaller than **32px x 32px**.
*   **Risk**: The Google Lighthouse accessibility guidelines recommend a minimum touch target size of **48px x 48px** to prevent fat-finger selection errors on touch devices.
*   *Recommendation*: Add padding/margins to mobile buttons to expand their click boundaries without affecting the surrounding layout.

---

## 6. Design System & Styling Inconsistencies

### 6.1 Legibility & WCAG AA Accessibility Failures
In [styles.css](file:///Users/amitranjan/Projects/Cosmodex-v2/styles.css), there are **more than 260 declarations** that set font sizes to **8px, 9px, or 10px**, usually styled with `font-family: var(--font-mono)`, uppercase text-transform, and light grey opacity (`rgba(255,255,255,0.50)`).
- **Legibility tax**: At standard display densities, 9px monospaced uppercase text requires active concentration to read and is completely illegible for users with mild visual impairments.
- **Contrast issues**: White text at 50% opacity against a pitch-black background has a contrast ratio of roughly **4.5:1**, which falls below WCAG AAA guidelines for small text. At 9px, it fails basic WCAG AA requirements.

#### Recommendation:
Enforce a typography scale floor.
- No interactive buttons or primary list items should fall below **11px**.
- Secondary labels and helper text should be kept at a minimum of **10px**.
- Change the default secondary label color from 50% white to **65% white** (`rgba(255,255,255,0.65)`) to improve contrast.

---

### 6.2 Monochrome Affordance Collapse
In [styles.css](file:///Users/amitranjan/Projects/Cosmodex-v2/styles.css), the accent color tokens `--gold` and `--gold-hover` are mapped directly to pure white `#ffffff`.
- Because primary buttons, highlights, current status markers, and normal body text all share the same color (white), there is no pre-attentive salience.
- **Pre-attentive processing** (Healey & Enns) shows that color singletons are processed in less than 250ms. With a purely monochrome design, the user has to read the text labels to figure out which tab is active or what action is highlighted, increasing cognitive friction.

#### Recommendation:
Map the `--gold` token to a warm accent color (such as a glowing cosmic starlight gold `#d4a24e`). Reserve this color strictly for active selections, the current hour indicator, and completed state celebration bursts.

---

### 6.3 Semantic Color Inversion
badge classes for overdue elements use the `--drill-alert` token which evaluates to a neon green `#39ff14`.
- In standard visual grammar, green denotes success, safety, or completions.
- Marking overdue tasks (such as late taxes or missed deadlines) in glowing green inverts this vocabulary, reading as completed/successful instead of requiring attention.

#### Recommendation:
Map overdue states to `--rust` or warning badges to `--amber` while saving the vibrant green/sage colors exclusively for task and habit completions.

---

## 7. Full Inventory of User Journeys

Every workflow path supported by the application shell has been mapped below:

### 7.1 Authentication & Session Life
*   **Journey 1: Initial Sign-In**: User visits the page, is presented with the "Signin Overlay" crystal particle Canvas background, and authenticates via Google Popup Sign-in ([09-tasks-and-shell.js:L3386](file:///Users/amitranjan/Projects/Cosmodex-v2/src/09-tasks-and-shell.js#L3386)).
*   **Journey 2: Session Restore**: Visitor returns; Firestore uses browser IndexedDB to restore their Google session silently, firing the `cdx-auth-ready` event to skip the login screen.
*   **Journey 3: Sign-Out**: User clicks settings, triggers sign-out, which tears down Firestore listeners and clears global arrays to prevent cross-account leaks ([09-tasks-and-shell.js:L3913](file:///Users/amitranjan/Projects/Cosmodex-v2/src/09-tasks-and-shell.js#L3913)).

### 7.2 Dashboard Overview (Daily Entry)
*   **Journey 4: The Daily Ritual Check-In**: User opens the dashboard in the morning. If not done today, the Daily Ritual modal launches. The user types their Non-Negotiable focus task, clicks their mood/energy chips, and reads the daily cosmic quote ([09-tasks-and-shell.js:L3501](file:///Users/amitranjan/Projects/Cosmodex-v2/src/09-tasks-and-shell.js#L3501)).
*   **Journey 5: Slipped Orbit Recovery**: User reviews overdue counts in the hero stats and clicks the "reschedule all → tomorrow" button to batch-forward slipped tasks.
*   **Journey 6: Next Event Alert**: User glances at the countdown widget to see how many minutes remain before their next scheduled event starts.

### 7.3 Task Management (The Capture Rail)
*   **Journey 7: Capture with Mentions**: User enters a task in the quick-add rail, typing `@` to trigger a dropdown of team collaborators, selecting contacts to link ([09-tasks-and-shell.js:L302](file:///Users/amitranjan/Projects/Cosmodex-v2/src/09-tasks-and-shell.js#L302)).
*   **Journey 8: Energy & Priority Sizing**: User selects task urgency (Low/Med/High) and circadian energy footprint (⚡ Quick, 🧠 Deep, 💬 Shallow, 📅 Meeting) before saving.
*   **Journey 9: Task Deconstruction**: User opens a task row, adds subtasks, and tracks granular completion.
*   **Journey 10: Task Recurrence**: User configures daily, weekday, or custom repeating intervals on a captured task.
*   **Journey 11: The Entropy Roll**: Overwhelmed by choice, the user clicks the dice button (`⚄` / key `e`), which runs a rapid frame animation picking a random shallow task to break procrastination ([09-tasks-and-shell.js:L3153](file:///Users/amitranjan/Projects/Cosmodex-v2/src/09-tasks-and-shell.js#L3153)).

### 7.4 Calendar Scheduling
*   **Journey 12: Grid Scheduling**: User drags a task from the right rail and drops it onto a specific hour zone in the Day view calendar.
*   **Journey 13: Time Navigation**: User clicks `[ ` and ` ]` or sweeps the calendar toolbar to look back at yesterday's completions or ahead to tomorrow's plan.
*   **Journey 14: View Switching**: User toggles the toolbar between Day, Week, and Month grids.

### 7.5 Lists Page (Not-a-Task Space)
*   **Journey 15: Simple Bullet Capture**: User creates a list for raw ideas, adds text items, and drags rows to change order using the gold line indicator ([02-lists.js:L384](file:///Users/amitranjan/Projects/Cosmodex-v2/src/02-lists.js#L384)).
*   **Journey 16: Checklist Audit**: User logs checklist items, watching a completed completion bar fill at the bottom of the card.
*   **Journey 17: Star Rating Reviews**: User creates a Rated list, logging movies, books, or reviews by clicking 5-star controls ([02-lists.js:L71](file:///Users/amitranjan/Projects/Cosmodex-v2/src/02-lists.js#L71)).
*   **Journey 18: Sub-list nesting**: User expands list rows to add nested sub-items.

### 7.6 Habits & Routines (Life OS)
*   **Journey 19: Anchored Routine Timeline**: User expands Morning Mode, checking off routine steps sequentially.
*   **Journey 20: Gold Ring Hold-to-Complete**: User clicks and holds a habit check box; a gold ring fills for 550ms. Upon release, a particle celebration fires, haptics trigger, and their character identity score increments.
*   **Journey 21: Habit Builder Wizard**: User launches the 6-step creation wizard to link new habits to values, stacks, anchors, friction tags, and fallback fallbacks ([03-habits.js:L732](file:///Users/amitranjan/Projects/Cosmodex-v2/src/03-habits.js#L732)).
*   **Journey 22: Habits Reflection**: At week's end, the user audits habit rates, reviews wins/needs-love indicators, and inspects value balance graphs ([03-habits.js:L744](file:///Users/amitranjan/Projects/Cosmodex-v2/src/03-habits.js#L744)).

### 7.7 Insights Workspace
*   **Journey 23: Streak & Heatmap Auditing**: User inspects their 14-day constellation trend and 84-day activity heatmap grid ([05-insights.js:L206](file:///Users/amitranjan/Projects/Cosmodex-v2/src/05-insights.js#L206)).
*   **Journey 24: Energy × Priority Inspection**: User audits their task distribution bubble matrix, identifying where deep work and busywork collide.
*   **Journey 25: Circadian Rhythm Check**: User audits their Day Rhythm dial chart to identify peak task completion hours.

### 7.8 Communication Drill
*   **Journey 26: Drill Response**: User selects today's communication scenario and drafts their response.
*   **Journey 27: Dictation Mode**: User clicks the voice button (`◉`) to dictate their answer using SpeechRecognition.
*   **Journey 28: Rubric Review**: User copies the prompt to Claude, grades it, and pastes back the scores for Clarity, Structure, Hedging, Presence, and Actionability ([11-comm-drill.js:L312](file:///Users/amitranjan/Projects/Cosmodex-v2/src/11-comm-drill.js#L312)).

### 7.9 Timedrift & Bubble
*   **Journey 29: Horizon Monitoring**: User toggles Timedrift to view orbital dials and watch the horizon arc for upcoming meetings.
*   **Journey 30: Inertial Time Scrub**: User drags the day ring to time-travel forward or backward, watching calendar events shift, then releases to let it snap back to "now".
*   **Journey 31: 24h Radial Sweep**: User opens Bubble to check their visual day block distribution on a circular clock face.

### 7.10 Orbit Recap
*   **Journey 32: Evening Sweep**: User triggers Orbit Recap; a dial sweeps from midnight to the current hour. Stars pop where tasks were finished and link together into a custom day constellation.

### 7.11 Mind Map
*   **Journey 33: Mind Map Sketching**: User double-clicks to add ideas, drags to link nodes, and pans the canvas to organize concepts ([10-mindmap.js:L283](file:///Users/amitranjan/Projects/Cosmodex-v2/src/10-mindmap.js#L283)).

---

## 8. Prioritized Remediation Roadmap

Below is the prioritized roadmap to resolve these issues:

| Rank | Issue / Bug | Component | Severity | Effort | Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Category & People Sync Resurrection** | Sync Layer | 🔴 Critical | Medium | High |
| **2** | **Mind Map Data Loss (No Save)** | Feature / Data | 🔴 Critical | Medium | High |
| **3** | **Broken Claude API model / payload** | Feature / API | 🔴 Critical | Low | Medium |
| **4** | **Habit Delete Firestore Write Explosion** | Performance | 🔴 Critical | Medium | High |
| **5** | **Plaintext API Key Storage** | Security | 🔴 Critical | Medium | High |
| **6** | **Habits Tab-Switch Listener Churn** | Performance | 🟡 Medium | Medium | Medium |
| **7** | **Non-Atomic Milestone/Project Deletes** | Sync Layer | 🟡 Medium | Medium | Medium |
| **8** | **Global Click Guard Discards Clicks** | Workflow/UX | 🟡 Medium | Low | High |
| **9** | **Drill Timer Double-Interval Bug** | Logic/UX | 🟡 Medium | Low | Low |
| **10** | **Font Size Floor & Low Contrast** | Design System | 🟡 Medium | Medium | High |
| **11** | **Monochrome Affordance Collapse** | Design System | 🟡 Medium | Low | Medium |
| **12** | **No Service Worker (Offline Fail)** | Hosting/UX | 🟡 Medium | Medium | High |
| **13** | **Alphabetical Build Concatenation** | Architecture | 🟢 Low | High | High |
