# Smarter item matching: shortlist by rules, decide with AI

## The problem

Today the match from a bill line to a Just product is decided purely by word
overlap rules. Those rules have to be right on the first try, so every wrong
pairing needs a new hand-written exception, and worse, the hard filters throw
away products that *are* in the catalog before they ever get considered.

## The new approach

Split the job into two stages, each doing what it is good at:

1. **Rules find the shortlist (recall).** The existing scoring stays, but it
   stops making the final call. It returns the best ~12 candidate products per
   bill line, with the hard reject filters relaxed to soft scoring. Only truly
   out-of-scope lines (containers, apparel, air-freshener blocks) are dropped.
2. **A cheap AI picks the winner (precision).** One call sends all bill lines
   with their shortlists and asks the model to pick the right product for each,
   or say "not available", with a short reason and confidence. This is the
   stage that understands that "GODREJ N1 LEM" is a lemon soap and that a
   detergent bar is not a detergent powder — without a hand-written rule.

Locked pairings you already approved are applied first and the AI cannot
override them, so nothing validated can ever regress.

## Keeping results identical across scans

- The AI matcher runs at temperature 0 with a fixed seed.
- Every decision is cached in the backend keyed by the bill line plus the
  shortlist, so re-scanning the same bill reuses the same answer and costs
  nothing.
- If the AI call fails, the app falls back to the rules-only pick, so a scan
  never breaks.

## Self-checking with an eval set

A test file holds every pairing approved so far (Wada Kolam rice, Chakki atta,
hing, Saffola oil, Lijjat papad, Godrej N1 soap, ginger-garlic paste, detergent
bar vs powder, Odonil excluded, Ezee Lock excluded, and the rest), plus the
"must not match" cases. Running it reports a pass rate against the live
catalog. I will run it after the change, tune the shortlist size and prompt
until everything passes, and re-run it after any future matching change.

## Technical details

- `src/lib/compare.ts`: add `shortlist(item, catalog, n)` returning ranked
  candidates; relax `findMatch`'s hard `continue` filters into score penalties;
  keep `findMatch` as the deterministic fallback.
- `src/lib/match.functions.ts` (new): `resolveMatches` server function —
  batches lines + shortlists to `google/gemini-3.8-flash` via the Lovable AI
  Gateway with a strict JSON schema (`{ line_index, product_id | null,
  confidence, reason }`), temperature 0, seed fixed. Reads/writes a
  `match_cache` table (line key + shortlist hash → product id).
- Backend: new `match_cache` table with RLS (anon read/insert, authenticated
  full) and grants.
- `src/routes/index.tsx`: after scanning, call `resolveMatches`, pass the
  resolved ids into `compare(items, catalog, overrides)`; the savings page keeps
  its current layout, ordering and Hinglish labels.
- `src/lib/match.eval.test.ts` (new): the approved-pairs eval, run with
  `bunx vitest run`.

## Cost

One extra small-model call per scan, roughly a tenth of the cost of the bill
reading itself, and skipped entirely for lines already cached.
