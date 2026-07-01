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

function _drillSettings() {
  try { return JSON.parse(localStorage.getItem('cdx_drill_settings') || 'null') || { apiEnabled: false, apiKey: '' }; }
  catch (e) { return { apiEnabled: false, apiKey: '' }; }
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

/* ── Optional: direct API automation (off by default) ──────── */
// Model claude-opus-4-8, direct browser fetch. Requires the
// anthropic-dangerous-direct-browser-access header — without it the browser's
// CORS preflight is rejected. The key lives in localStorage only and never
// leaves the browser except in this request; it is visible in devtools while
// this feature is on, which is why it defaults off.
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

async function drillAutoGrade() {
  const settings = _drillSettings();
  const scenario = DRILL_PROMPT_BANK.find(p => p.id === window._drillActiveScenarioId);
  const textarea = document.getElementById('drill-response-input');
  if (!settings.apiEnabled || !settings.apiKey) { showToast('Enable and save an API key in Drill settings first.', 'error'); return; }
  if (!scenario || !textarea || !textarea.value.trim()) { showToast('Write a response first.', 'error'); return; }
  const btn = document.getElementById('drill-autograde-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Grading…'; }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        output_config: { format: { type: 'json_schema', schema: DRILL_GRADE_SCHEMA } },
        messages: [{ role: 'user', content: _drillBuildGradingBlock(scenario, textarea.value.trim()) }],
      }),
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.content[0].text);
    if (!_drillPendingId) throw new Error('No response to attach this feedback to.');
    await _drillSaveGrading(_drillPendingId, parsed);
    showToast('Auto-graded and saved.', 'success');
  } catch (e) {
    showToast('Auto-grade failed: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Auto-Grade'; }
  }
}

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
  return `
    <div class="drill-card drill-settings-card">
      <div class="drill-card-title">Automate Grading (Optional)</div>
      <div class="drill-settings-note">Paste your own Anthropic API key to skip the copy/paste round-trip. This incurs small per-use API costs (roughly 1–2¢ per grading call), separate from Claude Pro. The key is stored only in this browser and is visible in devtools while enabled.</div>
      <label class="drill-settings-toggle">
        <input type="checkbox" id="drill-api-enabled" ${settings.apiEnabled ? 'checked' : ''} onchange="_drillToggleApiEnabled(this.checked)">
        Enable direct API auto-grading
      </label>
      <input type="password" id="drill-api-key-input" class="drill-api-key-input" placeholder="sk-ant-..." value="${escAttr(settings.apiKey || '')}" onblur="_drillSaveApiKey(this.value)">
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
function _drillSaveApiKey(key) {
  const s = _drillSettings();
  s.apiKey = key.trim();
  _saveDrillSettings(s);
}
