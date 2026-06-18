# Render Text & Icons on the Contribution Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-06-17-text-and-icons-on-contribution-grid-design.md` (spec review applied 2026-06-18).

**Goal:** Add a draw mode to `fake-git-history` that renders text or a named icon onto a past year's GitHub-style contribution graph, with a preview that matches what GitHub renders.

**Architecture:** New pure modules produce a boolean grid → `Date[]`: `font.js` (text→grid), `icons.js` (named icons→grid), `draw.js` (grid→commit dates, DST-safe, Sunday-anchored). `visualization.js` is **re-anchored to Sunday-start weeks** (P0 fix from the spec review) so preview matches GitHub, and its signature gains `{ preview, modeLabel }`. `cli.js` adds `--text/-t`, `--draw`, `--year/-y`. `index.js` wires draw mode by delegating to a pure `prepareDrawMode` helper, then reuses the existing commit loop.

**Tech Stack:** Node.js (CommonJS), `date-fns` 1.x (existing), `node:test` (built-in — **zero new deps**), `meow` (existing CLI parser), `chalk` (existing).

## Global Constraints

- **No new runtime dependencies.** `date-fns` 1.x stays; tests use the built-in `node:test` (requires Node ≥ 18).
- **CommonJS** (`require` / `module.exports`), one-file-per-concern under `src/`.
- **No-flag runs stay byte-identical** for commit generation. `--preview` rendering changes (becomes calendar-accurate) for both modes — this is the sanctioned §11 relaxation.
- **Font glyphs are 5 wide × 5 tall**, `#` on / `.` off. Every pattern ≤ 7 rows.
- **`MAX_TEXT_CHARS = 8`** glyphs; rendered width must be ≤ `yearColumns`.
- **DST safety:** anchor days with the `Date` constructor from calendar fields (`new Date(Y, M, D, h, m)`), never with `addDays`/`setHours` chains for day placement. (`setHours` for the random path's existing code is untouched.)
- **`prettier`** is the project's formatter (`npm run lint`). Match existing 2-space style; do not reformat untouched code.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/font.js` | new | Bitmap font data (A–Z, 0–9; space=2-wide blank), `renderText`, `measureText`, `validateText`, `MAX_TEXT_CHARS`. Pure. |
| `src/icons.js` | new | `ICONS` map (cat/mouse/heart/star/smiley) + `availableIcons()`. Pure. |
| `src/draw.js` | new | `patternToCommitDates(grid, year, maxCommits)`, `yearColumns`, `yearStartSunday`, `yearBounds`. Pure, DST-safe, Sunday-anchored. |
| `src/visualization.js` | rewrite | Sunday-anchored grid + month labels; signature `(commitDateList, startDate, endDate, { preview, modeLabel })`. Exports `buildWeekGrid` for testing. |
| `src/cli.js` | edit | Add `--text/-t`, `--draw`, `--year/-y` flags. |
| `src/index.js` | edit | Add pure `prepareDrawMode` (validation + grid + dates + label); branch into it when `--text`/`--draw` set; reuse commit loop; update both viz call sites. |
| `src/*.test.js` | new | One test file per module, run via `node --test`. |
| `package.json` | edit | Add `"test": "node --test src"` and `"engines": { "node": ">=18" }`. |

**Refinement vs spec §3:** validation/orchestration lives in a pure `prepareDrawMode` exported from `index.js` (rather than inline) so it is unit-testable. `draw.js` stays pattern-agnostic. This is a plan-level decision; behavior matches §7/§9.

---

## Task 1: Test runner + `font.js`

**Files:**
- Create: `src/font.js`
- Create: `src/font.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `renderText(str) → number[][]` (rows of 0/1, height 5), `measureText(str) → { glyphCount, width }`, `validateText(str, yearColumns) → void` (throws on violation), `MAX_TEXT_CHARS = 8`, plus `FONT`, `GLYPH_WIDTH`, `GLYPH_HEIGHT`, `SPACE_WIDTH`, `GAP`. Consumed by `index.js` (Task 6).

- [ ] **Step 1: Wire the test runner**

Edit `package.json` — replace the `"scripts"` block:

```json
  "scripts": {
    "start": "node src/cli.js",
    "lint": "prettier --write 'src/**/*.js'",
    "test": "node --test"
  },
```

> Note: use bare `node --test` (no path arg). `node --test src` does not discover
> `*.test.js` on Node 21+ (it treats `src` as a single entry); bare `node --test`
> auto-discovers test files recursively and works on Node 18–26.

And add an `engines` field (after `"main"`):

```json
  "engines": {
    "node": ">=18"
  },
```

- [ ] **Step 2: Write the failing tests** (`src/font.test.js`)

```js
const test = require("node:test");
const assert = require("node:assert");
const {
  FONT,
  renderText,
  measureText,
  validateText,
  MAX_TEXT_CHARS,
  GLYPH_WIDTH,
  GLYPH_HEIGHT,
} = require("./font");

test("every FONT glyph is 5x5 of only # or .", () => {
  for (const [ch, glyph] of Object.entries(FONT)) {
    assert.equal(glyph.length, GLYPH_HEIGHT, `${ch} has ${GLYPH_HEIGHT} rows`);
    glyph.forEach((row, i) => {
      assert.equal(row.length, GLYPH_WIDTH, `${ch} row ${i} is ${GLYPH_WIDTH} chars`);
      assert.match(row, /^[#.]{5}$/, `${ch} row ${i} has only # or .`);
    });
  }
});

test("renderText uppercases input", () => {
  assert.deepEqual(renderText("a"), renderText("A"));
});

test("renderText empty string -> empty grid", () => {
  assert.deepEqual(renderText(""), []);
});

test("renderText single glyph is 5x5", () => {
  const g = renderText("A");
  assert.equal(g.length, 5);
  assert.equal(g[0].length, 5);
});

test("renderText two glyphs add a 1-col gap", () => {
  assert.equal(renderText("AB")[0].length, 5 + 1 + 5);
});

test("space is a 2-col blank glyph with gaps", () => {
  // A + gap + space(2) + gap + B = 5+1+2+1+5 = 14
  assert.equal(renderText("A B")[0].length, 14);
});

test("renderText 'I' has full top and bottom rows", () => {
  const g = renderText("I");
  assert.deepEqual(g[0], [1, 1, 1, 1, 1]);
  assert.deepEqual(g[4], [1, 1, 1, 1, 1]);
});

test("measureText drops unsupported chars without warning", () => {
  const m = measureText("A!B");
  assert.equal(m.glyphCount, 2);
  assert.equal(m.width, 5 + 1 + 5);
});

test("measureText 8 letters = 47 wide", () => {
  assert.equal(measureText("ABCDEFGH").width, 8 * 5 + 7);
});

test("validateText rejects more than MAX_TEXT_CHARS glyphs", () => {
  assert.equal(MAX_TEXT_CHARS, 8);
  assert.throws(() => validateText("ABCDEFGHI", 53), /Maximum is 8 characters/);
  assert.doesNotThrow(() => validateText("ABCDEFGH", 53));
});

test("validateText rejects too-wide text regardless of glyph count", () => {
  assert.throws(() => validateText("A", 0), /week-columns/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './font'`.

- [ ] **Step 4: Implement `src/font.js`**

```js
"use strict";

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 5;
const GAP = 1;
const SPACE_WIDTH = 2;
const MAX_TEXT_CHARS = 8;

// Each glyph: 5 strings of 5 chars, '#' = on, '.' = off. Baseline art — refine
// any weak glyph during the Task 7 visual review (G, Q, M, W are the hardest).
const FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#"],
  B: ["####.", "#...#", "####.", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", ".####"],
  D: ["###..", "#..#.", "#...#", "#..#.", "###.."],
  E: ["#####", "#....", "####.", "#....", "#####"],
  F: ["#####", "#....", "####.", "#....", "#...."],
  G: [".####", "#....", "#.###", "#...#", ".###."],
  H: ["#...#", "#...#", "#####", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#..#.", "#.#..", "##...", "#.#..", "#..#."],
  L: ["#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "####.", "#....", "#...."],
  Q: [".###.", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "####.", "#.#..", "#..#."],
  S: [".####", "#....", ".###.", "....#", "#####"],
  T: ["#####", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  Y: ["#...#", ".#.#.", "..#..", "..#..", "..#.."],
  Z: ["#####", "...#.", "..#..", ".#...", "#####"],
  0: [".###.", "#..##", "#.#.#", "##..#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "..#..", ".#...", "#####"],
  3: ["####.", "....#", ".###.", "....#", "####."],
  4: ["#..#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "####."],
  6: [".###.", "#....", "####.", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#..."],
  8: [".###.", "#...#", ".###.", "#...#", ".###."],
  9: [".###.", "#...#", ".####", "....#", ".###."],
};

function glyphToColumns(glyph) {
  const cols = [];
  for (let x = 0; x < GLYPH_WIDTH; x++) {
    const col = [];
    for (let y = 0; y < GLYPH_HEIGHT; y++) col.push(glyph[y][x] === "#" ? 1 : 0);
    cols.push(col);
  }
  return cols;
}

function blankColumns(width) {
  const cols = [];
  for (let x = 0; x < width; x++) cols.push(Array(GLYPH_HEIGHT).fill(0));
  return cols;
}

// Parse to an ordered list of { width, cols }; unsupported chars are dropped,
// warning only when `warn` is true (so validateText/measureText stay silent).
function parseChars(str, warn) {
  const out = [];
  for (const ch of String(str).toUpperCase()) {
    if (ch === " ") {
      out.push({ width: SPACE_WIDTH, cols: blankColumns(SPACE_WIDTH) });
    } else if (FONT[ch]) {
      out.push({ width: GLYPH_WIDTH, cols: glyphToColumns(FONT[ch]) });
    } else if (warn) {
      console.warn(`Unsupported character "${ch}" — skipping.`);
    }
  }
  return out;
}

function measureText(str) {
  const chars = parseChars(str, false);
  const glyphCount = chars.length;
  const width = chars.reduce((s, c) => s + c.width, 0) + Math.max(0, glyphCount - 1) * GAP;
  return { glyphCount, width };
}

function renderText(str) {
  const chars = parseChars(str, true);
  if (chars.length === 0) return [];
  const allCols = [];
  chars.forEach((c, i) => {
    if (i > 0) allCols.push(...blankColumns(GAP));
    allCols.push(...c.cols);
  });
  const grid = [];
  for (let y = 0; y < GLYPH_HEIGHT; y++) grid.push(allCols.map(col => col[y]));
  return grid;
}

function validateText(str, yearColumns) {
  const { glyphCount, width } = measureText(str);
  if (glyphCount > MAX_TEXT_CHARS) {
    throw new Error(
      `Text too long: "${String(str).toUpperCase()}" has ${glyphCount} characters. ` +
        `Maximum is ${MAX_TEXT_CHARS} characters. Shorten the text.`
    );
  }
  if (width > yearColumns) {
    throw new Error(
      `Text too long: "${String(str).toUpperCase()}" renders to ${width} week-columns, ` +
        `but a year has ${yearColumns}. Maximum is ${MAX_TEXT_CHARS} characters. Shorten the text.`
    );
  }
}

module.exports = {
  FONT,
  renderText,
  measureText,
  validateText,
  MAX_TEXT_CHARS,
  GLYPH_WIDTH,
  GLYPH_HEIGHT,
  SPACE_WIDTH,
  GAP,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `font.test.js` cases green.

- [ ] **Step 6: Commit**

```bash
git add src/font.js src/font.test.js package.json
git commit -m "feat(font): add 5x5 bitmap font with renderText/measureText/validateText"
```

---

## Task 2: `icons.js`

**Files:**
- Create: `src/icons.js`
- Create: `src/icons.test.js`

**Interfaces:**
- Produces: `ICONS` (map name → `number[][]`), `availableIcons() → string[]`. Consumed by `index.js` (Task 6). Each grid ≤ 7 rows, rectangular.

- [ ] **Step 1: Write the failing tests** (`src/icons.test.js`)

```js
const test = require("node:test");
const assert = require("node:assert");
const { ICONS, availableIcons } = require("./icons");

test("gallery has the five named icons", () => {
  assert.deepStrictEqual(availableIcons(), ["cat", "heart", "mouse", "smiley", "star"]);
});

test("every icon is rectangular and <= 7 rows of 0/1", () => {
  for (const [name, grid] of Object.entries(ICONS)) {
    assert.ok(grid.length <= 7, `${name} has > 7 rows`);
    const w = grid[0].length;
    grid.forEach((row, i) => {
      assert.equal(row.length, w, `${name} row ${i} width mismatch`);
      row.forEach(v => assert.ok(v === 0 || v === 1, `${name} has non-binary cell`));
    });
  }
});

test("icons are binary grids (art parses to 0/1)", () => {
  for (const grid of Object.values(ICONS)) {
    grid.forEach(row => row.forEach(v => assert.ok(typeof v === "number")));
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './icons'`.

- [ ] **Step 3: Implement `src/icons.js`**

```js
"use strict";

// Baseline art (<= 7 rows each). Refine in the Task 7 visual review.
function parse(art) {
  return art.map(row => row.split("").map(ch => (ch === "#" ? 1 : 0)));
}

const ICONS = {
  cat: parse([
    "#.....#",
    "##...##",
    "#######",
    "#.###.#",
    "#.....#",
    "##...##",
    ".#...#.",
  ]),
  heart: parse([
    ".#.#.",
    "#####",
    "#####",
    ".###.",
    "..#..",
  ]),
  mouse: parse([
    ".#...#.",
    "#######",
    "#.###.#",
    "#######",
    ".#.#.#.",
    "..###..",
    ".......",
  ]),
  smiley: parse([
    ".#####.",
    "#.....#",
    "#.#.#.#",
    "#.....#",
    "#.#.#.#",
    "#..#..#",
    ".#####.",
  ]),
  star: parse([
    "..#..",
    ".###.",
    "#####",
    ".#.#.",
    ".#.#.",
    "#...#",
    "#...#",
  ]),
};

function availableIcons() {
  return Object.keys(ICONS).sort();
}

module.exports = { ICONS, availableIcons };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — `font` + `icons` suites green.

- [ ] **Step 5: Commit**

```bash
git add src/icons.js src/icons.test.js
git commit -m "feat(icons): add cat/heart/mouse/smiley/star gallery"
```

---

## Task 3: `draw.js` (grid → commit dates)

**Files:**
- Create: `src/draw.js`
- Create: `src/draw.test.js`

**Interfaces:**
- Produces: `patternToCommitDates(grid, year, maxCommits) → Date[]`, `yearColumns(year) → number`, `yearStartSunday(year) → Date`, `yearBounds(year) → {jan1, dec31}`. Consumed by `index.js` (Task 6) and `visualization.js` (Task 4, same `yearColumns` formula). **DST-safe, Sunday-anchored.**

- [ ] **Step 1: Write the failing tests** (`src/draw.test.js`)

```js
const test = require("node:test");
const assert = require("node:assert");
const { patternToCommitDates, yearColumns, yearStartSunday } = require("./draw");

test("yearStartSunday is the Sunday of the week containing Jan 1", () => {
  // 2025-01-01 is a Wednesday -> Sunday is 2024-12-29
  const s = yearStartSunday(2025);
  assert.equal(s.getDay(), 0);
  assert.equal(s.getFullYear(), 2024);
  assert.equal(s.getMonth(), 11);
  assert.equal(s.getDate(), 29);
});

test("yearColumns matches Sunday-start weeks intersecting the year", () => {
  assert.equal(yearColumns(2025), 53);
});

test("single on-pixel lands on the centered weekday row, maxCommits dates", () => {
  const dates = patternToCommitDates([[1]], 2025, 4);
  assert.equal(dates.length, 4);
  // all four on the same calendar day
  const day = dates[0];
  assert.ok(dates.every(d => d.getDate() === day.getDate() && d.getMonth() === day.getMonth()));
  // startRow = floor((7-1)/2) = 3 -> Wednesday
  assert.equal(day.getDay(), 3);
  // distinct timestamps
  assert.equal(new Set(dates.map(d => d.getTime())).size, 4);
  // in year
  assert.ok(day >= new Date(2025, 0, 1) && day <= new Date(2025, 11, 31));
});

test("a wide pattern's two on-pixels are 2 weeks apart (centering)", () => {
  const dates = patternToCommitDates([[1, 0, 1]], 2025, 1);
  assert.equal(dates.length, 2);
  const ms = 24 * 60 * 60 * 1000;
  assert.equal(Math.round((dates[1] - dates[0]) / ms), 14);
  assert.equal(dates[0].getDay(), 3);
  assert.equal(dates[1].getDay(), 3);
});

test("edge clip: a full-width 7-tall grid drops out-of-year cells at both edges", () => {
  // 7 tall, full yearColumns wide -> startCol=0, startRow=0. Column 0's
  // Sun/Mon/Tue are 2024-12-29..31 (out of year); the last column's
  // Thu/Fri/Sat spill into 2026-01-01..03. Both must be clipped.
  const cols = yearColumns(2025); // 53
  const grid = Array.from({ length: 7 }, () => Array(cols).fill(1));
  const dates = patternToCommitDates(grid, 2025, 1);
  const jan1 = new Date(2025, 0, 1);
  const dec31 = new Date(2025, 11, 31, 23, 59, 59, 999);
  assert.ok(dates.length > 0);
  assert.ok(dates.every(d => d >= jan1 && d <= dec31), "every date within the year");
  assert.ok(dates.every(d => d.getFullYear() === 2025), "no out-of-year dates");
  assert.ok(dates.some(d => d.getMonth() === 0 && d.getDate() === 1), "leading edge Jan 1 kept");
  assert.ok(dates.some(d => d.getMonth() === 11 && d.getDate() === 31), "trailing edge Dec 31 kept");
});

test("off-pixels emit nothing; on-pixels get exactly maxCommits", () => {
  const grid = [
    [1, 0],
    [0, 1],
  ];
  const dates = patternToCommitDates(grid, 2025, 3);
  // 2 on-pixels * 3 = 6 dates
  assert.equal(dates.length, 6);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './draw'`.

- [ ] **Step 3: Implement `src/draw.js`**

```js
"use strict";

const DAY_MS = 24 * 60 * 60 * 1000;

function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function yearBounds(year) {
  return { jan1: new Date(year, 0, 1), dec31: new Date(year, 11, 31) };
}

function yearStartSunday(year) {
  const jan1 = new Date(year, 0, 1);
  // Date constructor normalizes across month/year/DST -> safe.
  return new Date(year, 0, 1 - jan1.getDay());
}

function yearColumns(year) {
  const { dec31 } = yearBounds(year);
  return Math.floor((midnight(dec31) - yearStartSunday(year)) / DAY_MS / 7) + 1;
}

function patternToCommitDates(grid, year, maxCommits) {
  const { jan1, dec31 } = yearBounds(year);
  const jan1Mid = midnight(jan1);
  const dec31Mid = midnight(dec31);
  const cols = yearColumns(year);

  const H = grid.length;
  const W = H > 0 ? grid[0].length : 0;
  const startCol = Math.floor((cols - W) / 2);
  const startRow = Math.floor((7 - H) / 2);
  const base = 1 - jan1.getDay(); // day-of-year index of yearStartSunday

  const dates = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (!grid[r][c]) continue;
      const dayIndex = base + (7 * (startCol + c) + (startRow + r));
      const dayMid = new Date(year, 0, dayIndex);
      if (dayMid < jan1Mid || dayMid > dec31Mid) continue; // clip out-of-year edges
      for (let i = 0; i < maxCommits; i++) {
        const minuteOfDay = 9 * 60 + Math.floor((i * (14 * 60)) / Math.max(maxCommits, 1));
        dates.push(
          new Date(year, 0, dayIndex, Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0)
        );
      }
    }
  }
  return dates;
}

module.exports = { patternToCommitDates, yearColumns, yearStartSunday, yearBounds, midnight };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — `font` + `icons` + `draw` suites green.

- [ ] **Step 5: Commit**

```bash
git add src/draw.js src/draw.test.js
git commit -m "feat(draw): patternToCommitDates, DST-safe Sunday-anchored grid->dates"
```

---

## Task 4: Re-anchor `visualization.js` (P0)

**Files:**
- Modify: `src/visualization.js` (rewrite)
- Create: `src/visualization.test.js`

**Interfaces:**
- Produces: `generateActivityVisualization(commitDateList, startDate, endDate, { preview = false, modeLabel } = {})` and named export `buildWeekGrid(commitDateList, startDate, endDate) → { grid, totalWeeks, firstSunday, maxCommitsInDay }`. Consumed by `index.js` (both call sites, Task 6). **This is the spec's P0 fix: the grid must be Sunday-anchored, not startDate-index-anchored.**

- [ ] **Step 1: Write the failing tests** (`src/visualization.test.js`)

```js
const test = require("node:test");
const assert = require("node:assert");
const generateActivityVisualization = require("./visualization");
const { buildWeekGrid } = require("./visualization");

test("grid is Sunday-anchored: Jan 1 (Wed) in col 0 row 3; Jan 5 (Sun) in col 1 row 0", () => {
  const commits = [new Date(2025, 0, 1, 12, 0), new Date(2025, 0, 5, 9, 0)];
  const { grid } = buildWeekGrid(commits, new Date(2025, 0, 1), new Date(2025, 11, 31));
  assert.equal(grid[3][0], 4, "Jan 1 Wed -> col 0, darkest"); // 1 commit == max -> level 4
  assert.equal(grid[0][1], 4, "Jan 5 Sun -> col 1, darkest");
  assert.equal(grid[0][0], 0, "col 0 Sunday is 2024-12-29, no commit (proves anchoring)");
});

test("preview note appears only when preview=true", () => {
  const commits = [new Date(2025, 0, 1, 12, 0)];
  const start = new Date(2025, 0, 1);
  const end = new Date(2025, 11, 31);
  const out = generateActivityVisualization(commits, start, end, {
    preview: true,
    modeLabel: "text: HI",
  });
  assert.match(out, /Note: This is a preview/);
  assert.match(out, /text: HI/);
  const noPreview = generateActivityVisualization(commits, start, end, { preview: false });
  assert.doesNotMatch(noPreview, /Note: This is a preview/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `buildWeekGrid` not exported; old anchoring puts Jan 5 in col 0.

- [ ] **Step 3: Replace `src/visualization.js` with the re-anchored version**

```js
const chalk = require("chalk");
const { format, getDay } = require("date-fns");

const DAY_MS = 24 * 60 * 60 * 1000;

function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function key(d) {
  return format(d, "YYYY-MM-DD");
}
function weekOf(day, firstSunday) {
  return Math.floor((midnight(day) - firstSunday) / DAY_MS / 7);
}

/**
 * Sunday-anchored intensity grid. grid[row][week] = intensity 0..4.
 * firstSunday is the Sunday on/before startDate (== yearStartSunday in draw mode).
 */
function buildWeekGrid(commitDateList, startDate, endDate) {
  const start = midnight(startDate);
  const end = midnight(endDate);
  const firstSunday = new Date(start.getFullYear(), start.getMonth(), start.getDate() - start.getDay());

  const counts = {};
  commitDateList.forEach(d => {
    const k = key(midnight(d));
    counts[k] = (counts[k] || 0) + 1;
  });
  const maxCommitsInDay = Object.values(counts).reduce((m, c) => Math.max(m, c), 0);

  const totalWeeks = Math.floor((end - firstSunday) / DAY_MS / 7) + 1;
  const grid = Array.from({ length: 7 }, () => Array(totalWeeks).fill(0));

  for (
    let day = new Date(firstSunday);
    day <= end;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    const week = weekOf(day, firstSunday);
    const row = day.getDay();
    const c = counts[key(day)] || 0;
    grid[row][week] = maxCommitsInDay > 0 ? Math.min(Math.ceil((c / maxCommitsInDay) * 4), 4) : 0;
  }
  return { grid, totalWeeks, firstSunday, maxCommitsInDay };
}

function generateActivityVisualization(commitDateList, startDate, endDate, { preview = false, modeLabel } = {}) {
  const end = midnight(endDate);
  const { grid, totalWeeks, firstSunday, maxCommitsInDay } = buildWeekGrid(
    commitDateList,
    startDate,
    endDate
  );

  // Month labels positioned by the same Sunday-anchored week index.
  const monthLabelPositions = [];
  let currentMonth = null;
  for (
    let day = new Date(firstSunday);
    day <= end;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    const month = format(day, "MMM");
    if (month !== currentMonth) {
      monthLabelPositions.push({ month, week: weekOf(day, firstSunday) });
      currentMonth = month;
    }
  }

  const result = [];
  result.push(chalk.bold.green("This is what you will see on your GitHub profile:"));
  result.push("");

  let monthRow = "     ";
  for (let i = 0; i < monthLabelPositions.length; i++) {
    const { month, week } = monthLabelPositions[i];
    monthRow += month;
    if (i < monthLabelPositions.length - 1) {
      const nextMonthWeek = monthLabelPositions.find(m => m.week > week)?.week || totalWeeks;
      monthRow += " ".repeat((nextMonthWeek - week - 1) * 1.7);
    }
  }
  result.push(monthRow);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const intensityBlocks = [
    chalk.hex("#fdfdfd")("■"),
    chalk.hex("#7feebb")("■"),
    chalk.hex("#4ac26b")("■"),
    chalk.hex("#2da44e")("■"),
    chalk.hex("#116329")("■"),
  ];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    let row = chalk.bold(dayLabels[dayOfWeek]) + " ";
    for (let week = 0; week < totalWeeks; week++) {
      const cellDate = new Date(
        firstSunday.getFullYear(),
        firstSunday.getMonth(),
        firstSunday.getDate() + (week * 7 + dayOfWeek)
      );
      if (cellDate > end) {
        row += "  "; // outside the date range
      } else {
        row += intensityBlocks[grid[dayOfWeek][week]] + " ";
      }
    }
    result.push(row);
  }

  result.push("");
  result.push(
    `Legend: ${intensityBlocks[0]} No commits  ${intensityBlocks[1]} Few  ${intensityBlocks[2]} Some  ${intensityBlocks[3]} Many  ${intensityBlocks[4]} Most`
  );
  result.push("");
  result.push("Statistics");
  result.push(`• Total commits: ${commitDateList.length}`);
  result.push(`• Date range: ${format(startDate, "YYYY-MM-DD")} to ${format(endDate, "YYYY-MM-DD")}`);
  result.push(`• Mode: ${modeLabel || "uniform"}`);
  result.push(`• Max commits in a day: ${maxCommitsInDay}`);

  if (preview) {
    result.push("");
    result.push(chalk.italic("Note: This is a preview only. No commits were created."));
    result.push(
      chalk.italic("To generate actual commits, run the command without the --preview flag.")
    );
  }
  return result.join("\n");
}

module.exports = generateActivityVisualization;
module.exports.buildWeekGrid = buildWeekGrid;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all four suites green.

- [ ] **Step 5: Commit**

```bash
git add src/visualization.js src/visualization.test.js
git commit -m "fix(visualization): re-anchor grid to Sunday-start weeks; thread preview/modeLabel"
```

---

## Task 5: CLI flags

**Files:**
- Modify: `src/cli.js`

**Interfaces:**
- Produces: three new flags on `cli.flags` (`text`, `draw`, `year`) consumed by `index.js` (Task 6).

- [ ] **Step 1: Add the flags.** Edit the meow `flags` object in `src/cli.js` (after `preview`) and the help text:

In the `Usage` help block, append within Options:

```
      --text, -t      Text to render (A-Z, 0-9, space). Auto-uppercased.
      --draw          Icon to render: cat, heart, mouse, smiley, star.
      --year, -y      Target calendar year (default: last year). 2000..last year.
```

Add to the `flags` object (after the `preview` entry):

```js
      text: {
        type: "string",
        alias: "t"
      },
      draw: {
        type: "string"
      },
      year: {
        type: "number",
        alias: "y"
      }
```

- [ ] **Step 2: Verify the flags are exposed**

Run: `node src/cli.js --help`
Expected: stdout contains `--text`, `--draw`, `--year`.

Run: `node -e "const f=require('./src/cli.js')"` — should not throw.

- [ ] **Step 3: Commit**

```bash
git add src/cli.js
git commit -m "feat(cli): add --text/--draw/--year flags"
```

---

## Task 6: Wire draw mode in `index.js`

**Files:**
- Modify: `src/index.js`
- Create: `src/index.test.js`

**Interfaces:**
- Consumes: `font` (`renderText`, `validateText`), `icons` (`ICONS`, `availableIcons`), `draw` (`patternToCommitDates`, `yearColumns`, `yearBounds`).
- Produces: a pure `prepareDrawMode({ text, draw, year, commitsPerDay }) → { commitDateList, startDate, endDate, modeLabel }` (throws on validation errors), exported as `module.exports.prepareDrawMode`. The default export branches into it when `text`/`draw` is set.

- [ ] **Step 1: Write the failing tests** (`src/index.test.js`)

```js
const test = require("node:test");
const assert = require("node:assert");
const fgh = require("./index");
const { prepareDrawMode } = fgh;

test("rejects --text and --draw together", () => {
  assert.throws(() => prepareDrawMode({ text: "HI", draw: "cat", commitsPerDay: "0,4" }), /mutually exclusive/);
});

test("rejects year out of range", () => {
  const y = new Date().getFullYear();
  assert.throws(() => prepareDrawMode({ text: "HI", year: y, commitsPerDay: "0,4" }), /Invalid year/);
  assert.throws(() => prepareDrawMode({ text: "HI", year: 1999, commitsPerDay: "0,4" }), /Invalid year/);
});

test("rejects unknown icon and lists available", () => {
  assert.throws(() => prepareDrawMode({ draw: "dragon", commitsPerDay: "0,4" }), /Available:.*cat.*star/s);
});

test("rejects text longer than 8 glyphs", () => {
  assert.throws(() => prepareDrawMode({ text: "ABCDEFGHI", commitsPerDay: "0,4" }), /Maximum is 8/);
});

test("valid text returns centered dates bounded to the year", () => {
  const r = prepareDrawMode({ text: "HI", year: 2025, commitsPerDay: "0,4" });
  assert.equal(r.modeLabel, "text: HI");
  assert.deepEqual([r.startDate.getMonth(), r.startDate.getDate()], [0, 1]);
  assert.deepEqual([r.endDate.getMonth(), r.endDate.getDate()], [11, 31]);
  assert.ok(r.commitDateList.length > 0);
  r.commitDateList.forEach(d => {
    assert.equal(d.getFullYear(), 2025);
  });
});

test("valid icon returns the icon label", () => {
  const r = prepareDrawMode({ draw: "cat", year: 2025, commitsPerDay: "0,4" });
  assert.equal(r.modeLabel, "icon: cat");
  assert.ok(r.commitDateList.length > 0);
});

test("default year is last year", () => {
  const r = prepareDrawMode({ text: "HI", commitsPerDay: "0,4" });
  assert.equal(r.startDate.getFullYear(), new Date().getFullYear() - 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `prepareDrawMode` is not a function.

- [ ] **Step 3: Edit `src/index.js`.** Add the requires near the top (after the existing `require("./visualization")` line) and add `prepareDrawMode`, then rewire the default export.

Add these requires:

```js
const { renderText, validateText } = require("./font");
const { ICONS, availableIcons } = require("./icons");
const { patternToCommitDates, yearColumns, yearBounds } = require("./draw");
```

Add (at module scope, before `module.exports`):

```js
function prepareDrawMode({ text, draw, year, commitsPerDay }) {
  const currentYear = new Date().getFullYear();
  if (text && draw) {
    throw new Error("Flags --text and --draw are mutually exclusive. Use one.");
  }
  if (year === undefined || year === null) year = currentYear - 1;
  if (!Number.isInteger(year) || year < 2000 || year >= currentYear) {
    throw new Error(`Invalid year ${year}. Must satisfy 2000 <= year < ${currentYear}.`);
  }
  const maxCommits = Number(String(commitsPerDay).split(",").pop());
  if (!(maxCommits >= 1)) {
    throw new Error(`--commitsPerDay upper bound must be >= 1 for draw mode (got ${maxCommits}).`);
  }

  const { jan1, dec31 } = yearBounds(year);
  const cols = yearColumns(year);

  let grid;
  let modeLabel;
  if (text) {
    validateText(text, cols); // throws on too-long / too-wide
    grid = renderText(text);
    modeLabel = `text: ${String(text).toUpperCase()}`;
  } else {
    if (!ICONS[draw]) {
      throw new Error(`Unknown icon "${draw}". Available: ${availableIcons().join(", ")}.`);
    }
    grid = ICONS[draw];
    modeLabel = `icon: ${draw}`;
  }

  const hasOnPixel = grid.some(row => row.some(v => v));
  if (!hasOnPixel) {
    throw new Error("Nothing to render: the text produced no drawable pixels.");
  }

  const commitDateList = patternToCommitDates(grid, year, maxCommits);
  return { commitDateList, startDate: jan1, endDate: dec31, modeLabel };
}
```

Replace the default export's signature and its body up to (and including) the `commitDateList` setup. The new top of the exported function:

```js
module.exports = function({
  commitsPerDay,
  frequency,
  startDate,
  endDate,
  distribution,
  preview,
  text,
  draw,
  year
}) {
  let commitDateList;
  let startDateObj;
  let endDateObj;
  let modeLabel;

  if (text || draw) {
    const r = prepareDrawMode({ text, draw, year, commitsPerDay });
    commitDateList = r.commitDateList;
    startDateObj = r.startDate;
    endDateObj = r.endDate;
    modeLabel = r.modeLabel;
  } else {
    startDateObj = startDate ? parse(startDate) : addYears(new Date(), -1);
    endDateObj = endDate ? parse(endDate) : new Date();
    commitDateList = createCommitDateList({
      commitsPerDay: commitsPerDay.split(","),
      frequency,
      startDate: startDateObj,
      endDate: endDateObj,
      distribution: distribution || "uniform"
    });
    modeLabel = distribution || "uniform";
  }

  if (preview) {
    console.log(
      generateActivityVisualization(commitDateList, startDateObj, endDateObj, {
        preview: true,
        modeLabel
      })
    );
    return;
  }
```

Leave the existing `(async function() { ... })()` commit loop **unchanged**, but update its visualization call (the one after `spinner.succeed()`) to pass options:

```js
    console.log(
      generateActivityVisualization(commitDateList, startDateObj, endDateObj, {
        preview: false,
        modeLabel
      })
    );
```

Finally, attach the helper to the export (after `module.exports = function(...) {...}`):

```js
module.exports.prepareDrawMode = prepareDrawMode;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all suites green (font, icons, draw, visualization, index).

- [ ] **Step 5: Commit**

```bash
git add src/index.js src/index.test.js
git commit -m "feat(index): wire draw mode via prepareDrawMode; thread modeLabel/preview"
```

---

## Task 7: Integration check + font/icon visual review

**Files:** none (manual verification + `npm run lint`).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: prettier reformats nothing unexpected (or only formatting). Re-run `npm test` after.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 3: Text preview**

Run: `node src/cli.js --preview --text "HI" --year 2025`
Expected: an ASCII grid where the letters **H** and **I** are legible and **horizontally centered** in 2025's columns, on weekday rows (Mon–Fri). The footer shows `• Mode: text: HI` and the "preview only" note.

- [ ] **Step 4: Icon preview**

Run: `node src/cli.js --preview --draw heart --year 2025`
Expected: a heart shape, centered; footer `• Mode: icon: heart`.

- [ ] **Step 5: Alignment spot-check (proves preview ≡ GitHub)**

Run: `node src/cli.js --preview --text "I" --year 2025`
Expected: the single letter's leftmost pixel (a full column) sits in the column whose Wednesday row is lit — i.e., Jan 1 2025 (Wed) is at column 0 row Wed, with the Sunday/Mon/Tue cells above it empty. Confirms Sunday-anchoring.

- [ ] **Step 6: Font/icon visual review (eyeball each glyph)**

Run this scratch one-liner and confirm every glyph is recognizable; **fix any dud directly in `src/font.js` / `src/icons.js`** (the `font.test.js` "every glyph is 5×5" test guards format as you edit):

```bash
node -e 'const {FONT,renderText}=require("./src/font");const g=r=>r.map(x=>x.map(v=>v?"#":".").join("")).join("\n");for(const ch of Object.keys(FONT)){console.log("== "+ch+" ==");console.log(g(renderText(ch)));}'
```

Then review icons:

```bash
node -e 'const{ICONS}=require("./src/icons");for(const[n,g]of Object.entries(ICONS)){console.log("== "+n+" ==");console.log(g.map(r=>r.map(v=>v?"#":".").join("")).join("\n"));}'
```

Expected: A–Z, 0–9 legible; cat/heart/mouse/smiley/star recognizable. If any glyph is broken, edit the art, re-run `npm test`, then re-run this step.

- [ ] **Step 7: Backward-compat regression**

Run: `node src/cli.js --preview --distribution workHours`
Expected: random-mode preview still renders; footer shows `• Mode: workHours`. (Random commit-generation path is untouched.)

- [ ] **Step 8: Commit any art fixes**

```bash
git add src/font.js src/icons.js
git commit -m "style(font,icons): refine glyph art after visual review"
```

(Skip if nothing changed.)

---

## Spec coverage (self-review)

| Spec section | Covered by |
|---|---|
| §3 file layout | Tasks 1–6 (note: `prepareDrawMode` lives in `index.js`, see File Structure refinement) |
| §4 pattern model / font format | Task 1 (FONT, renderText); Task 2 (icons) |
| §5 text length limit / error message | Task 1 (validateText, MAX_TEXT_CHARS) + Task 6 (prepareDrawMode calls it) |
| §6 grid→dates, centering, clip, hour rule, yearColumns | Task 3 (draw.js) |
| §7 CLI flags + validation rules | Task 5 (flags) + Task 6 (validation in prepareDrawMode) |
| §8 viz re-anchor + preview + modeLabel (P0) | Task 4 |
| §9 error handling matrix | Task 6 tests (mutual-exclusion, year range, unknown icon, text length, empty render) |
| §10 unit + integration tests | Tasks 1–4, 6 (unit) + Task 7 (integration/manual) |
| §11 backward compat | Task 7 Step 7 (random path unchanged) |

No placeholders remain. Signatures are consistent across tasks (`renderText`, `validateText`, `ICONS`/`availableIcons`, `patternToCommitDates`/`yearColumns`/`yearBounds`, `generateActivityVisualization(...,{preview,modeLabel})`, `buildWeekGrid`, `prepareDrawMode`).
