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
  const firstSunday = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() - start.getDay()
  );

  const counts = {};
  commitDateList.forEach(d => {
    const k = key(midnight(d));
    counts[k] = (counts[k] || 0) + 1;
  });
  const maxCommitsInDay = Object.values(counts).reduce(
    (m, c) => Math.max(m, c),
    0
  );

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
    grid[row][week] =
      maxCommitsInDay > 0
        ? Math.min(Math.ceil((c / maxCommitsInDay) * 4), 4)
        : 0;
  }
  return { grid, totalWeeks, firstSunday, maxCommitsInDay };
}

function generateActivityVisualization(
  commitDateList,
  startDate,
  endDate,
  { preview = false, modeLabel } = {}
) {
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
  result.push(
    chalk.bold.green("This is what you will see on your GitHub profile:")
  );
  result.push("");

  let monthRow = "     ";
  for (let i = 0; i < monthLabelPositions.length; i++) {
    const { month, week } = monthLabelPositions[i];
    monthRow += month;
    if (i < monthLabelPositions.length - 1) {
      const nextMonthWeek =
        monthLabelPositions.find(m => m.week > week)?.week || totalWeeks;
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
    chalk.hex("#116329")("■")
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
  result.push(
    `• Date range: ${format(startDate, "YYYY-MM-DD")} to ${format(
      endDate,
      "YYYY-MM-DD"
    )}`
  );
  result.push(`• Mode: ${modeLabel || "uniform"}`);
  result.push(`• Max commits in a day: ${maxCommitsInDay}`);

  if (preview) {
    result.push("");
    result.push(
      chalk.italic("Note: This is a preview only. No commits were created.")
    );
    result.push(
      chalk.italic(
        "To generate actual commits, run the command without the --preview flag."
      )
    );
  }
  return result.join("\n");
}

module.exports = generateActivityVisualization;
module.exports.buildWeekGrid = buildWeekGrid;
