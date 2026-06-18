# Design: Render Text & Icons on the Contribution Grid

**Date:** 2026-06-17
**Status:** Approved (spec review applied 2026-06-18)
**Approach:** A — pattern as a boolean grid + shared renderer

## Revision notes (spec review 2026-06-18)

- **P0 — `visualization.js` is NOT GitHub-anchored.** The renderer keys grid
  columns to `floor((date − startDate) / 7)` (`visualization.js:98`), i.e. the
  **start-date index**, not a Sunday-start calendar week. It only equals
  GitHub's grid when `startDate` is a Sunday. In draw mode `startDate = Jan 1`;
  e.g. `2025-01-01` is a Wednesday (`getDay=3`), so on-pixels in rows above row 3
  shift one column left in `--preview` and the letters shear. `draw.js`'s
  `yearStartSunday` math is correct for GitHub — the **local preview is what
  lies**. **Fix:** re-anchor the whole grid (cells + month labels) to
  Sunday-start weeks (`yearStartSunday`). Applied **globally** (random path
  benefits too — its preview becomes calendar-accurate, a bug fix). See §8.
- **P1 — nailed down in §6:** `maxCommits` parsing; the concrete hour rule for
  the `maxCommits` commits on a day; the `yearColumns` formula shared with the
  re-anchored `visualization.js`.
- **§11 relaxation:** with no flags, commit-generation behavior is identical to
  today; `--preview` rendering changes (becomes calendar-accurate) for both
  modes.
- **Verified-correct claims from the review:** `commitsPerDay` default `"0,4"`
  → `[0,4]`; §8's two `process.env` bugs at `:149`/`:152`; §5 width math
  (8 glyphs = 47 ≤ 53; `"HELLO WORLD"` = 62); §6 row centering (H=5 → rows
  1–5); repo has no tests today.

## 1. Goal

Add a **draw mode** to `fake-git-history` that renders a pixel pattern — a short
string of text or a named icon — onto a GitHub/GitLab-style contribution graph
for one complete past calendar year. Text is the primary use case; a small icon
gallery is included.

The contribution graph is exactly **7 rows tall** (Sun–Sat). Every pattern must
fit in ≤ 7 rows. A year provides ~52–53 week-columns, which is very little
horizontal room, so text length is hard-capped (see §5).

## 2. Non-goals (YAGNI)

- No multi-year spanning. One target year at a time.
- No user-supplied custom pattern files (built-in font + gallery only).
- No external font libraries (figlet fonts are too tall to fit 7 rows).
- No new runtime dependencies.
- Does not change existing random **commit-generation** behavior (the
  `--preview` rendering becomes calendar-accurate — see §8/§11; that is a
  preview-only bug fix, not a commit change).

## 3. Architecture & file layout

Follows the project's existing one-file-per-concern style (`index.js`,
`cli.js`, `visualization.js`).

| File | Responsibility |
|---|---|
| `src/font.js` (new) | Hand-authored bitmap font (A–Z, 0–9, space), 5 wide × 5 tall. Exports `renderText(str) → booleanGrid`. |
| `src/icons.js` (new) | Built-in icon gallery: `cat`, `mouse`, `heart`, `star`, `smiley`. Each is a boolean grid ≤ 7 rows. Exports `ICONS` map and an `availableIcons()` helper. |
| `src/draw.js` (new) | `patternToCommitDates(grid, year, maxCommits) → Date[]`. Converts any boolean grid + target year into commit dates (grid column → week-of-year, grid row → day-of-week). Pure, no I/O. |
| `src/index.js` (edit) | Wire draw mode: when `--text` or `--draw` is set, build the pattern grid, validate, produce the date list, then reuse the existing commit loop. In draw mode set the start/end dates to the target year's Jan 1 / Dec 31. |
| `src/cli.js` (edit) | Add flags `--text/-t`, `--draw`, `--year/-y`. |
| `src/visualization.js` (fix — see §8) | **Re-anchor the grid to Sunday-start weeks** (it is currently start-date-index-anchored, not GitHub-style), and thread the real `preview` boolean + a mode label through instead of reading `process.env.DISTRIBUTION` / `process.env.PREVIEW` (both currently always-wrong). |

**Reuse (after the §8 fix):** once `visualization.js` is re-anchored to
Sunday-start weeks it accepts any `Date[]` and draws a true GitHub-style grid,
and draw mode simply feeds it a deterministic date list + target-year bounds.
The re-anchoring is a **prerequisite** for draw mode (the renderer is not
GitHub-anchored today), not optional polish.

## 4. The pattern model

A pattern is a 2D boolean grid: an array of `H` rows, each an array of `W`
values (`1` = on-pixel, `0` = off-pixel). Constraint: `H ≤ 7`.

**Font glyph format:** each glyph is an array of 5 strings, each 5 characters,
using `#` for on and `.` for off.

Example (heart icon, shown to illustrate format only — actual art authored in
`icons.js`):

```
.#.#.
#####
#####
.###.
..#..
```

- **Text mode** (`renderText`): uppercase the input; map each supported
  character to its glyph; concatenate glyph columns left-to-right with a
  **1-column blank gap** between adjacent glyphs. The space character is a
  2-column-wide blank glyph. Unsupported characters (punctuation, non-ASCII)
  are dropped with a `console.warn` — the run continues.
- **Icon mode:** `ICONS[name]` is the grid directly.

## 5. Text length limit (key requirement)

A year has ~52–53 week-columns; with a 5-wide font + 1-col gap a letter costs
~6 columns. Hard rule:

- `MAX_TEXT_CHARS = 8` — count of glyphs (after uppercasing and dropping
  unsupported chars). More than 8 → hard error.
- Safety net (defends against future font widening): rendered width
  (`sum(glyphWidth) + (numGlyphs - 1)` gaps) must be `≤ yearColumns`. Under the
  8-cap this always holds (8 letters = 8·5 + 7 = 47 ≤ 53); the check exists so
  a later wider font fails loudly instead of overflowing the year.

Error message format:

```
Text too long: "HELLO WORLD" renders to 62 week-columns, but a year has 53.
Maximum is 8 characters. Shorten the text.
```

## 6. Grid → commit dates (`draw.js`)

Given target year `Y` and pattern grid (`H` rows × `W` cols, `H ≤ 7`):

1. **Year bounds:** `jan1 = new Date(Y, 0, 1)`, `dec31 = new Date(Y, 11, 31)`.
2. **First week column:** `yearStartSunday = jan1 - jan1.getDay() days`
   (the Sunday of the week containing Jan 1).
3. **Year column count:** `yearColumns = floor((dec31 − yearStartSunday) / 7 days) + 1`
   (52 or 53). **Must use the same formula the re-anchored `visualization.js`
   uses to count rendered columns**, so draw's centering baseline equals what
   preview/GitHub actually show (extract a shared helper if convenient).
4. **Horizontal placement:** center the `W` pattern columns within the year's
   columns → `startCol = floor((yearColumns - W) / 2)`.
5. **Vertical placement:** center `H` rows within 7 →
   `startRow = floor((7 - H) / 2)` (5-tall text lands in rows 1–5).
6. **Emit dates:** for each on-pixel `(r, c)`:
   - `weekCol = startCol + c`
   - `dayOfWeek = startRow + r` (0 = Sunday)
   - `date = yearStartSunday + (7 * weekCol + dayOfWeek) days`
   - Only keep `date` if its calendar day is within `[jan1, dec31]`
     (compare midnights; clip out-of-year edges).
   - Emit `maxCommits` distinct commits on that date, evenly spaced across
     `[09:00, 23:00)`: for `i` in `0..maxCommits−1`,
     `minuteOfDay = 9·60 + floor(i · (14·60) / maxCommits)`, then set hour /
     minute (seconds fixed at `00`). Distinct timestamps by construction and
     in-window for any `maxCommits`. If `maxCommits < 1`, the on-day gets no
     commits (pattern invisible) — warn the user and abort draw mode.
7. Return the flat `Date[]`.

**Intensity guarantee:** every on-day gets `maxCommits` commits; every off-day
gets 0. The global max is therefore `maxCommits`, so on-days render as the
darkest green level in `visualization.js` and the letters read uniformly.

`maxCommits = Number(commitsPerDay.split(",").pop())` — the upper bound of the
existing `--commitsPerDay` flag (default `"0,4"` → 4). Parsed once; the random
path keeps its own `[min, max]` parsing unchanged.

## 7. CLI & validation

New flags in `cli.js`:

| Flag | Type | Default | Notes |
|---|---|---|---|
| `--text`, `-t` | string | — | Text to render. Auto-uppercased. |
| `--draw` | string | — | Icon name (`cat`, `mouse`, `heart`, `star`, `smiley`). |
| `--year`, `-y` | number | `currentYear - 1` | Target calendar year. |

**Rules:**
- `--text` and `--draw` are mutually exclusive (error if both given).
- Exactly one of them enables draw mode; if neither is given, existing random
  behavior runs unchanged (full backward compatibility).
- In draw mode, `--frequency` and `--distribution` are ignored (exact control
  required).
- `--preview` works in draw mode (renders the ASCII grid, writes no commits).
- `--year` must satisfy `2000 ≤ year < currentYear`. Else error.
  Default `currentYear - 1` is always a complete, safe past year.

**Validation errors (fail fast, clear message):**
- Text longer than 8 glyphs (see §5).
- Year ≥ current year, future year, or `< 2000`.
- Unknown icon name → list available icons.
- `--text` and `--draw` both set.
- Unsupported characters → **warn + skip** (not an error).

## 8. Fixes to `visualization.js`

Three changes, all **global** (random + draw paths benefit):

1. **Re-anchor the grid to Sunday-start weeks (P0).** Today the grid keys
   columns to `floor((date − startDate) / 7)` (`visualization.js:98`), the
   start-date index — wrong whenever `startDate` is not a Sunday. Switch to a
   Sunday-anchored grid: `firstSunday = startDate − getDay(startDate)` (for
   draw mode this equals `yearStartSunday`), and assign each day to
   `week = floor((date − firstSunday) / 7)`, `row = getDay(date)`. Recompute the
   month-label positions (`:41-50`, `:62-76`) from this same `week`. Build the
   day list from `firstSunday` to `endDate` so the partial leading week renders
   as empty cells (GitHub's look). This makes the preview match what GitHub
   renders, for both modes.
2. **Thread the real `preview` boolean.** `:152` reads `process.env.PREVIEW`,
   which is never set (`index.js` passes `preview` as a param), so the
   "preview only, no commits" note never shows. Pass `preview` into
   `generateActivityVisualization` instead.
3. **Thread a mode label.** `:149` reads `process.env.DISTRIBUTION` (never set →
   always prints `"uniform"`). Pass a label in: the distribution string for
   random mode, or `"text: <TEXT>"` / `"icon: <NAME>"` for draw mode.

Change `generateActivityVisualization(commitDateList, startDate, endDate)` →
`(commitDateList, startDate, endDate, { preview = false, modeLabel } = {})`.
Update both call sites in `index.js` (`:44` preview branch, `:88` commit branch).

## 9. Error handling summary

| Case | Behavior |
|---|---|
| Text > 8 glyphs / too wide | Error, exit non-zero, helpful message |
| Year out of range | Error |
| Unknown icon | Error + available list |
| `--text` + `--draw` both set | Error |
| Unsupported chars in text | Warn, skip char, continue |
| `git` not installed | Existing behavior (exec fails) — out of scope to improve |
| Pattern fits but clips at year edges | Silent clip (only in-year dates emitted) |

## 10. Testing

The project currently has **no tests**. The date math in `draw.js` is
error-prone, so add unit tests using Node's built-in `node:test` runner
(**zero new dependencies**) plus an `npm test` script. Cover the pure modules:

- `font.js`: `renderText` produces expected grids for known strings; uppercase
  normalization; unsupported-char skipping; 8-glyph boundary.
- `icons.js`: every icon is rectangular and ≤ 7 rows.
- `draw.js`: given a small known pattern + year, commit dates land on the
  correct days of week and inside `[jan1, dec31]`; centering math; edge
  clipping; on-days all carry `maxCommits`, off-days carry none; `MAX_TEXT_CHARS`
  and width validation reject oversized input.
- Integration (manual via `--preview`): `--preview --text "HI" --year 2025`
  prints a grid where the letters are visibly correct and **centered** in the
  year's columns. This passes only after the §8 re-anchoring — before it, the
  letters would shear because `2025-01-01` is a Wednesday.
- Alignment spot-check (manual): confirm a commit dated `2025-01-01` lands in
  the first column at the Wednesday row (Sunday-anchored), proving preview and
  GitHub now agree on week columns.

## 11. Backward compatibility

No flags → **commit generation identical to today**. The `--preview` rendering
changes slightly for both modes: it becomes calendar-accurate (Sunday-anchored)
— a bug fix, since the previous columns were keyed to the start date's index and
only matched GitHub when the start date was a Sunday. Existing flags
(`--commitsPerDay`, `--frequency`, `--distribution`, `--startDate`, `--endDate`,
`--preview`) keep working. Draw mode reuses `--commitsPerDay` (for `maxCommits`)
and `--preview`; it ignores `--frequency`/`--distribution` and overrides
`--startDate`/`--endDate` with the target year bounds.
