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
        const minuteOfDay =
          9 * 60 + Math.floor((i * (14 * 60)) / Math.max(maxCommits, 1));
        dates.push(
          new Date(
            year,
            0,
            dayIndex,
            Math.floor(minuteOfDay / 60),
            minuteOfDay % 60,
            0
          )
        );
      }
    }
  }
  return dates;
}

module.exports = {
  patternToCommitDates,
  yearColumns,
  yearStartSunday,
  yearBounds,
  midnight
};
