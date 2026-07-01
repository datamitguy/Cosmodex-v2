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
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 1024,
          output_config: { format: { type: 'json_schema', schema: DRILL_GRADE_SCHEMA } },
          messages: [{ role: 'user', content: promptText }],
        }),
      });
      if (!res.ok) throw new Error(`Claude API returned ${res.status}`);
      const data = await res.json();
      return JSON.parse(data.content[0].text);
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
