const test = require("node:test");
const assert = require("node:assert");
const generateActivityVisualization = require("./visualization");
const { buildWeekGrid } = require("./visualization");

test("grid is Sunday-anchored: Jan 1 (Wed) in col 0 row 3; Jan 5 (Sun) in col 1 row 0", () => {
  const commits = [new Date(2025, 0, 1, 12, 0), new Date(2025, 0, 5, 9, 0)];
  const { grid } = buildWeekGrid(
    commits,
    new Date(2025, 0, 1),
    new Date(2025, 11, 31)
  );
  assert.equal(grid[3][0], 4, "Jan 1 Wed -> col 0, darkest"); // 1 commit == max -> level 4
  assert.equal(grid[0][1], 4, "Jan 5 Sun -> col 1, darkest");
  assert.equal(
    grid[0][0],
    0,
    "col 0 Sunday is 2024-12-29, no commit (proves anchoring)"
  );
});

test("preview note appears only when preview=true", () => {
  const commits = [new Date(2025, 0, 1, 12, 0)];
  const start = new Date(2025, 0, 1);
  const end = new Date(2025, 11, 31);
  const out = generateActivityVisualization(commits, start, end, {
    preview: true,
    modeLabel: "text: HI"
  });
  assert.match(out, /Note: This is a preview/);
  assert.match(out, /text: HI/);
  const noPreview = generateActivityVisualization(commits, start, end, {
    preview: false
  });
  assert.doesNotMatch(noPreview, /Note: This is a preview/);
});

test("cells before startDate are not rendered (staircase start)", () => {
  // Single-day range [Jan 1, Jan 1] (Wed). Only Jan 1 should be a square;
  // the Sun/Mon/Tue cells of column 0 (Dec 29-31 2024) must be blank.
  const start = new Date(2025, 0, 1);
  const end = new Date(2025, 0, 1);
  const out = generateActivityVisualization(
    [new Date(2025, 0, 1, 12, 0)],
    start,
    end,
    {}
  );
  // Layout: [0]=title, [1]="", [2]=month row, [3..9]=Sun..Sat. The square glyph
  // is color-independent, so count it directly without stripping ANSI.
  const rows = out.split("\n");
  const sunRow = rows[3]; // Sun - column 0 Sunday is Dec 29 2024 (before the range)
  const wedRow = rows[6]; // Wed - Jan 1 2025 (in range)
  assert.equal(
    (sunRow.match(/■/g) || []).length,
    0,
    "Sun (Dec 29 2024) before range -> no square"
  );
  assert.equal(
    (wedRow.match(/■/g) || []).length,
    1,
    "Wed (Jan 1) in range -> one square"
  );
});
