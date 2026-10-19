# Dimension UI — brief for coding agents

You are generating a dashboard with Dimension UI. Follow these rules; `lint(card)` checks most of them.

## Cards
- One card answers one question. `label` is that question in 2–3 words; qualifiers go in `foot`.
- Every label has a `tip`: the metric's definition, including its denominator.
- A card has one value (`value`) or one pair (`values`, length 2). Never more.
- Pick the variant by the shape of the data:
  - `single`: one number.
  - `dual`: two sides of one question with independent signs (maker/taker, realized/unrealized, mean/tail).
  - `split`: two parts that sum to 100%.
  - `state`: a status or latency with no meaningful time windows; use `facts` instead of `windows`.
- Every non-state card carries `windows` (10M / 1H / 24H by default). Each row gives the window's value `v`, its diff `d`, a bar magnitude `w` in [0, 1] and a sign `dir`. The last window is the baseline (`dir: 0`).
- For costs, latencies and anything else where a rise is bad, set `better: 'down'` on the card or on the value.
- `tinted: true` only when the card's identity *is* a side or a state, and then also give it a `tag`.

## Colour
- Use tones, never hex: `favorable` (good result, buy/long), `adverse` (bad result, sell/short), `watch` (near a threshold, degraded feed), `flow` (magnitude without a verdict), `neutral` (reference/structure).
- Never use `watch` just because a number is negative. Negative and bad is `adverse`.
- Instrument brand colours appear only inside `badges.instrument` discs.

## Marks
Choose a mark by question, and attach it with `marks: raw(...)` or a mark function's output:
- rate or price over time → `marks.trend(values)`
- distribution with a losing tail → `marks.histogram(bins, { split, mode })`
- quantiles against a budget → `marks.bullet({ p50, p90, target, max })`
- progress to a target → `marks.meter({ value, target })`
- parts of a whole → `marks.split({ parts })`
- a signed pair on one axis → `marks.pairedAxis({ rows, min, max })`

## Interaction
- Add `series: 'key'` to a value and `register({ key: { label, unit, lines, rows, query } })` to make it open the enlarged chart.
- Don't wire per-card handlers; the interaction layer is global.

## Before you finish
Run `lint()` on every card config and fix each message it returns.
