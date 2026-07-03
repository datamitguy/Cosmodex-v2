# Cosmodex v2 — Design Review
*Reviewed 3 Jul 2026 · live app (GitHub Pages) + local source audit*

## Verdict

Cosmodex has a genuinely distinctive design language — a "cosmic instrument panel": black void, glass blur, Fraunces serif against DM Mono, and two showpiece screens (Timedrift's orbital dials, Bubble's 24-hour radial clock) that most commercial productivity apps would kill for. The problem is **distribution**: all the personality lives in the Tools ghetto (Timedrift, Bubble, dice, spinning wheel), while the screens you actually live in — Dashboard, tasks, Planning — are the flattest and most conventional. The second problem is that the design system is *so* restrained (the accent token `--gold` is literally `#ffffff`) that hierarchy, feedback, and motivation signals all collapse into the same grey.

The path to "design excellence tool" is: keep the void, redistribute the quirk, and let research-backed motivation mechanics ride on the metaphors you already built.

---

## What's already excellent (protect these)

1. **Timedrift** — concentric year/month/day/hour/minute dials + horizon arc with "nothing in next 30m". The single best screen. Its voice (lowercase, calm, wry) is the app's voice.
2. **Bubble** — the 24h radial day clock with the red now-hand. Beautiful, instantly legible time-remaining visualization.
3. **Identity votes on habits** — `_todayFireCelebration` fires a burst + *"+1 for the builder"* + 10ms haptic. This is Atomic Habits' identity-based habit theory implemented correctly, and it's the emotional high point of the app.
4. **Glass depth system** — the 7-level blur scale (`--glass-blur-overlay` → `--glass-blur-deep`) is a real elevation system, better thought out than most design systems' shadow scales.
5. **Hidden toys** — dice roll (picks a random shallow/admin task) and the canvas spinning wheel. Great instincts, wrong location (buried in the orb).
6. **Today's Non-Negotiable** — one-focus-that-cannot-slip is textbook MIT (Most Important Task) methodology.

---

## Part 1 — Foundation fixes (do these first, everything else builds on them)

### 1.1 Give the monochrome one heartbeat color
`--gold: #ffffff` and `--gold-hover: #ffffff` mean "highlight" and "body text" are the same color. You defined `--sage`, `--rust`, `--amber`, `--blue` and barely use them. Meanwhile the one strong color in the UI today is `--drill-alert: #39ff14` neon green — currently applied to an *overdue* task ("File my tax"), which reads as "success" and inverts the semantics.

**Recommendation:** pick ONE warm accent (a real gold, e.g. `#d4a24e`, fits the cosmic brand — starlight against void) and use it *only* for: the current/next actionable thing, the now-line, the active focus session. Then apply semantic color quietly: `--rust` for overdue, `--sage` for done/streaks, `--amber` for warnings. Everything else stays monochrome. One color used sparingly on black has enormous salience (pre-attentive processing — Healey & Enns: color singletons are detected in <250ms before conscious attention). Right now nothing pops, so *everything* costs attention.

### 1.2 Type scale is below the floor
Font-size census from styles.css: **129 declarations at 9px, 104 at 10px, 34 at 8px** — over 260 uses at or below 10px, in a low-contrast mono uppercase style with `--muted` at 50% white. This is the single biggest usability tax in the app.
- Raise the floor: nothing interactive below 11px; labels 10px minimum.
- Promote `--muted-readable` (0.65) to the default secondary color; reserve 0.50 for true decoration.

### 1.3 Accessibility is currently zero-cost to fix, expensive to retrofit
- `aria-*` count in the HTML: **0**. The icon-only sidebar, checkboxes, and canvas dials are invisible to assistive tech.
- `prefers-reduced-motion`: **0** handling, with 15 keyframe animations (breathing boxes, pulsing orbs).
- `:focus-visible` styles: 2 in 7,335 lines. Keyboard users can't see where they are.
- Add all three as a one-day pass. A "design excellence" tool that fails WCAG AA can't claim the title.

### 1.4 Unify the token sets
There are two design-token blocks (`:root` at line 5 and a second scheme around line 5456 with `--elev2`, `--border2`, `--r-sm/md/lg/xl`, its own `--ease`). Merge to one; adopt the radius scale globally — it's good.

---

## Part 2 — Interactivity (the "make it feel alive" layer)

### 2.1 Drag-to-timebox is your missing killer interaction
The Dashboard's day grid and the task rail sit side by side, but tasks can't be dragged onto time slots (drag exists only within the task list). This is THE research-backed move: **implementation intentions** (Gollwitzer, 1999 meta-analysis, d ≈ .65) — converting "I'll do X" into "I'll do X at 2pm" roughly doubles follow-through. Timeboxing was also ranked the #1 productivity technique in Harvard Business Review's 2018 survey of 100 techniques.
- Drag a task from the rail → calendar slot: ghost preview snaps to 15-min increments, drop creates a scheduled block, task shows a small clock glyph.
- Drag the block's edge to resize; drag back to the rail to unschedule.
- On drop, a Timedrift-voice toast: *"2pm claimed. future you says thanks."*

### 2.2 Undo everywhere, delete confirmations nowhere
Grep shows no undo system; feedback is dominated by "Failed to…" error toasts. Norman's error-forgiveness principle: safe reversal encourages exploration and speed. Add a 5-second undo toast for complete/delete/move (*"task banished — undo"*), and you can then remove friction elsewhere (no confirm dialogs).

### 2.3 Keyboard depth to match the terminal aesthetic
The UI cosplays a terminal but only binds `n` (new task), `Cmd+Space` (palette), and `Esc`. For an app styled in DM Mono, keyboard-first is brand-coherent:
- `j/k` move selection in the task rail, `x` complete, `s` schedule (opens date), `1–7` jump to nav sections, `t` today, `[`/`]` prev/next day, `g` then `t` → Timedrift (vim chords fit the aesthetic).
- Also bind **Cmd+K** to the palette — it's the universal muscle memory now; keep Cmd+Space as an alias.
- Show shortcuts in a `?` overlay styled like a star chart.

### 2.4 Symmetric celebration
Habits get burst + identity vote + haptic; completing a *task* gets a plain checkbox tick. Extend the same reward grammar: task checkbox fires a small particle burst, and if the task is linked to a project, the vote line reads *"+1 for Learning Credit"*. Completing the last task of a milestone should be the biggest moment in the app (see 4.3). Behavioral basis: immediate reward tightens the habit loop (Skinner; Eyal's Hooked model) — but keep it deterministic and quiet, not slot-machine.

### 2.5 Micro-physics
200 `transition` rules but almost all are opacity/color fades. The glass language begs for tactility:
- Cards: `transform: scale(0.985)` on `:active` (press-in), subtle glow on hover-lift.
- Timedrift rings: **make them draggable** — scrub the day ring to time-travel the calendar (view any date), release to spring back to "now" with inertia. This turns your most beautiful screen into your most *useful* navigation, and it's the quirkiest possible interaction: literally drifting time.
- Bubble: drag the red hand to preview "what's my day look like at 4pm".
- Respect `prefers-reduced-motion` throughout (1.3).

---

## Part 3 — Productivity science (features that earn the "solves productivity issues" claim)

### 3.1 Reframe Momentum (it's currently demotivating)
Insights hero shows **Momentum 0** with `overdue −15` in a penalty ledger. Loss-framed scores are exactly what the research says *not* to show a struggling user (learned helplessness; Kahneman & Tversky loss aversion — losses loom ~2× larger). Fixes:
- Score never displays negative components as the lead story; lead with what builds it.
- Add **goal-gradient** nudges (Hull; Kivetz's café-card study — effort accelerates near a goal): "2 completions from a 7-day streak", ring visibly almost-closed.
- Overdue framing in the Timedrift voice: *"3 tasks slipped their orbit. re-entry is one click."* with a "reschedule all → tomorrow morning" action (fresh-start, one click, no shame).

### 3.2 Fresh Start moments
Dai, Milkman & Riis (2014): temporal landmarks (Mondays, month starts, birthdays) measurably boost goal initiation. Timedrift already *knows* every landmark — the rings literally show them. On Monday mornings / 1st of month, Dashboard greets with a one-line ritual: *"new orbit begins. carry forward or let go?"* → triage of last week's leftovers (reschedule / delete). This converts your calendar aesthetic into an actual behavior mechanism.

### 3.3 Energy-aware scheduling (close the loop you already opened)
Tasks already carry energy tags (Deep/Shallow/Quick/Meeting) and Insights has a "Day Rhythm" tab and Energy×Priority matrix — but nothing *acts* on them. Research: circadian performance troughs (Pink's *When*; Wieth & Zacks) — deep work in your peak window can be worth 20%+ output.
- When dragging a Deep task to a post-lunch trough slot, tint the slot amber: *"2pm is your shallow zone — morning?"*
- "Auto-drift" button: proposes a day plan slotting deep→peak, shallow→trough, from your logged mood/energy chips (you're already collecting mood+energy on the Habits Today screen — this is the payoff for that data).

### 3.4 Attention residue capture in Focus
Sophie Leroy (2009): unfinished intruding thoughts wreck the next task's performance. During a running focus session, a single keystroke (`c`) opens a one-line "parking orbit" capture that files to the inbox without leaving the session. Show parked thoughts at session end.

### 3.5 Planning fallacy mirror
You track estimated durations and actuals (pomo/commit). Insights should show "estimate vs. actual" per energy type — Kahneman's planning fallacy is best corrected by *reference-class* feedback: "your deep tasks run 1.6× estimate. auto-pad?"

### 3.6 Promote the Non-Negotiable to the Dashboard
It's currently buried in Habits→Today. The MIT should be the first thing on the Dashboard and on Timedrift's horizon arc: the one lit star. Zeigarnik effect works for you here — one visible open loop, not thirty.

---

## Part 4 — Quirk redistribution (Timedrift-izing the rest)

### 4.1 A voice guide (one line of copy per surface)
Timedrift's "nothing in next 30m" is the brand voice: lowercase, dry, unhurried. Codify it and apply to every empty/system state:
- Empty day grid: *"a perfectly empty orbit. suspicious."*
- No habits: *"no rituals yet. even stars have routines."*
- All tasks done: *"inbox zero. the void approves."*
- Error toast: *"that didn't save. the cosmos is flaky — try again."*
Keep errors honest, never cute about data loss. One quip per screen max — quirk is seasoning.

### 4.2 Promote the toys: an "Entropy" button
The dice and wheel solve a real problem — **choice overload / decision paralysis** (Iyengar & Lepper; randomization is a legitimate procrastination-breaker) — but they're hidden inside the orb. Put a small die glyph on the task rail header: click = 3 quick dice frames → picks a shallow task → *"the universe has spoken: Pay my tax."* Same code, hundred× the discovery.

### 4.3 Constellations (completed work becomes sky)
Your vault already calls indexes "Constellations" — bring that into the app. Each completed task = a faint star pinned to where it was completed on the day arc; a finished milestone *connects its stars into a constellation* with a slow line-draw animation and the project's name. Insights gains a "Sky" tab: your month as a starfield. This is (a) on-brand, (b) a peak-end memory anchor (Kahneman's peak-end rule — end-of-week recap of the sky you built beats any bar chart for motivation), (c) genuinely unlike every other productivity app.

### 4.4 Orbit-complete: end-of-day recap
At day's end (or `g d`), a 5-second animation: Bubble's clock sweeps the day, filled blocks glow, stars pop where tasks completed, one line: *"11 tasks. 2 deep hours. orbit complete."* Optional single soft chime (sound off by default).

### 4.5 Overdue gravity
Instead of a green "overdue" badge (see 1.1): overdue tasks slowly gain *visual mass* — a faint rust halo that grows with days overdue, as if collapsing into a small red dwarf. Quirky, semantic, glanceable — and the fix action (reschedule) releases them with a little escape-velocity float animation.

---

## Prioritized punch list

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 1 | Real accent gold + semantic rust/sage; kill green-overdue | S | Hierarchy, everything |
| 2 | Type floor 11px, muted→0.65 | S | Legibility everywhere |
| 3 | Undo toasts; drop confirms | M | Trust & speed |
| 4 | Drag-to-timebox task→calendar | L | Core behavior change |
| 5 | Keyboard layer (j/k/x/s, Cmd+K) | M | Power-user delight |
| 6 | Momentum reframe + goal-gradient nudges | M | Motivation |
| 7 | Task completion celebration (identity votes) | S | Reward symmetry |
| 8 | Voice-guide micro-copy pass | S | Quirk, cheap |
| 9 | Entropy (dice) button on task rail | S | Quirk, already built |
| 10 | Draggable Timedrift rings (time scrub) | L | Signature interaction |
| 11 | Constellations / orbit-complete recap | L | Signature motivation |
| 12 | ARIA + reduced-motion + focus-visible pass | M | Table stakes |

**Research index:** Gollwitzer 1999 (implementation intentions) · Dai/Milkman/Riis 2014 (fresh start effect) · Hull/Kivetz (goal gradient) · Leroy 2009 (attention residue) · Iyengar & Lepper 2000 (choice overload) · Kahneman & Tversky (loss aversion, planning fallacy, peak-end) · Pink, *When* (circadian troughs) · Clear, *Atomic Habits* (identity votes — already implemented) · Healey & Enns (pre-attentive salience).
