const test = require("node:test");
const assert = require("node:assert");
const {
  patternToCommitDates,
  yearColumns,
  yearStartSunday
} = require("./draw");

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
  assert.ok(
    dates.every(
      d => d.getDate() === day.getDate() && d.getMonth() === day.getMonth()
    )
  );
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
  assert.ok(
    dates.every(d => d >= jan1 && d <= dec31),
    "every date within the year"
  );
  assert.ok(
    dates.every(d => d.getFullYear() === 2025),
    "no out-of-year dates"
  );
  assert.ok(
    dates.some(d => d.getMonth() === 0 && d.getDate() === 1),
    "leading edge Jan 1 kept"
  );
  assert.ok(
    dates.some(d => d.getMonth() === 11 && d.getDate() === 31),
    "trailing edge Dec 31 kept"
  );
});

test("off-pixels emit nothing; on-pixels get exactly maxCommits", () => {
  const grid = [
    [1, 0],
    [0, 1]
  ];
  const dates = patternToCommitDates(grid, 2025, 3);
  // 2 on-pixels * 3 = 6 dates
  assert.equal(dates.length, 6);
});
