const process = require("process");
const { exec } = require("child_process");
const util = require("util");
const { existsSync } = require("fs");
const execAsync = util.promisify(exec);
const {
  parse,
  addDays,
  addYears,
  setHours,
  setMinutes,
  setSeconds,
  getDay
} = require("date-fns");
const chalk = require("chalk");
const ora = require("ora");
// Import visualization function
const generateActivityVisualization = require("./visualization");
const { renderText, validateText } = require("./font");
const { ICONS, availableIcons } = require("./icons");
const { patternToCommitDates, yearColumns, yearBounds } = require("./draw");

module.exports = function({
  commitsPerDay,
  frequency,
  startDate,
  endDate,
  distribution,
  preview,
  text,
  draw,
  year,
  userName,
  userEmail
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

  // If preview mode is enabled, just show the visualization and exit
  if (preview) {
    console.log(
      generateActivityVisualization(commitDateList, startDateObj, endDateObj, {
        preview: true,
        modeLabel
      })
    );
    return;
  }

  // Git author identity for the generated repo. Both or neither — providing
  // only one would still leave commits unable to be authored.
  if ((userName && !userEmail) || (userEmail && !userName)) {
    throw new Error("Provide both --user-name and --user-email, or neither.");
  }

  (async function() {
    const spinner = ora("Generating your GitHub activity\n").start();

    const historyFolder = "my-history";

    // Remove git history folder in case if it already exists.
    if (existsSync(`./${historyFolder}`)) {
      await execAsync(
        `${
          process.platform === "win32" ? "rmdir /s /q" : "rm -rf"
        } ${historyFolder}`
      );
    }

    // Create git history folder.
    await execAsync(`mkdir ${historyFolder}`);
    process.chdir(historyFolder);
    await execAsync(`git init`);

    // Set git author identity locally (my-history/ only) when provided, so the
    // user's global git config is never touched.
    if (userName && userEmail) {
      await execAsync(`git config --local user.name "${userName}"`);
      await execAsync(`git config --local user.email "${userEmail}"`);
    }

    // Create commits. runStep retries transient git failures (e.g. a momentarily
    // unreadable object during rapid commits) so the run recovers. --allow-empty
    // guarantees a commit even if the index stat-cache missed a same-second,
    // same-size foo.txt change.
    try {
      for (const date of commitDateList) {
        const dateFormatted = new Intl.DateTimeFormat("en", {
          day: "numeric",
          month: "long",
          year: "numeric"
        }).format(date);
        spinner.text = `Generating your Github activity... (${dateFormatted})\n`;

        await runStep(`echo "${date}" > foo.txt`);
        await runStep(`git add -A`);
        await runStep(
          `git commit --quiet --allow-empty --date "${date}" -m "fake commit"`
        );
      }
    } catch (err) {
      spinner.fail();
      console.error(`\nFailed to generate history: ${err.message}`);
      process.exitCode = 1;
      return;
    }

    spinner.succeed();

    // Show visualization of the created commits
    console.log(chalk.bold("\nActivity Graph:\n"));
    console.log(
      generateActivityVisualization(commitDateList, startDateObj, endDateObj, {
        preview: false,
        modeLabel
      })
    );
  })();
};

module.exports.prepareDrawMode = prepareDrawMode;
module.exports.runStep = runStep;

// Run a shell command, retrying transient failures (default 3 attempts with
// linear backoff). execFn is injectable for testing.
async function runStep(cmd, execFn, retries = 3) {
  const exec = execFn || execAsync;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await exec(cmd);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 150 * attempt));
      }
    }
  }
  const detail = (lastErr && (lastErr.stderr || lastErr.message)) || "";
  throw new Error(
    `Command failed after ${retries} attempts: ${cmd}\n${detail}`.trim()
  );
}

function prepareDrawMode({ text, draw, year, commitsPerDay }) {
  const currentYear = new Date().getFullYear();
  if (text && draw) {
    throw new Error("Flags --text and --draw are mutually exclusive. Use one.");
  }
  if (year === undefined || year === null) year = currentYear - 1;
  if (!Number.isInteger(year) || year < 2000 || year >= currentYear) {
    throw new Error(
      `Invalid year ${year}. Must satisfy 2000 <= year < ${currentYear}.`
    );
  }
  const maxCommits = Number(
    String(commitsPerDay)
      .split(",")
      .pop()
  );
  if (!(maxCommits >= 1)) {
    throw new Error(
      `--commitsPerDay upper bound must be >= 1 for draw mode (got ${maxCommits}).`
    );
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
      throw new Error(
        `Unknown icon "${draw}". Available: ${availableIcons().join(", ")}.`
      );
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

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Normal distribution (Bell curve) using Box-Muller transform
function normalRandom(mean, stdDev) {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // Transform to the desired mean and standard deviation
  return Math.round(z * stdDev + mean);
}

// Work hours pattern - more commits on weekdays (especially Tue-Thu) during work hours
function workHoursPattern(date, minCommits, maxCommits) {
  const day = getDay(date); // 0 is Sunday, 1 is Monday, etc.

  // Weekday multipliers - Tuesday(2), Wednesday(3), Thursday(4) have higher activity
  // Weekend days have very low activity
  const dayMultipliers = [0.1, 0.8, 1.2, 1.3, 1.2, 0.7, 0.1]; // Sun-Sat

  // Calculate a base number of commits based on the day of the week
  const avgCommits = (parseInt(minCommits) + parseInt(maxCommits)) / 2;
  const adjustedMean = avgCommits * dayMultipliers[day];

  // Use normal distribution around the adjusted mean
  const stdDev = (maxCommits - minCommits) / 4; // Reasonable standard deviation
  let commits = normalRandom(adjustedMean, stdDev);

  // Ensure commits are within the specified range
  commits = Math.max(
    parseInt(minCommits),
    Math.min(parseInt(maxCommits), commits)
  );
  return commits;
}

// After work pattern - more commits on evenings and weekends
function afterWorkPattern(date, minCommits, maxCommits) {
  const day = getDay(date); // 0 is Sunday, 1 is Monday, etc.

  // Weekday multipliers - weekends have higher activity
  const dayMultipliers = [1.3, 0.6, 0.5, 0.5, 0.7, 0.9, 1.4]; // Sun-Sat

  // Calculate a base number of commits based on the day of the week
  const avgCommits = (parseInt(minCommits) + parseInt(maxCommits)) / 2;
  const adjustedMean = avgCommits * dayMultipliers[day];

  // Use normal distribution around the adjusted mean
  const stdDev = (maxCommits - minCommits) / 4; // Reasonable standard deviation
  let commits = normalRandom(adjustedMean, stdDev);

  // Ensure commits are within the specified range
  commits = Math.max(
    parseInt(minCommits),
    Math.min(parseInt(maxCommits), commits)
  );
  return commits;
}

// Get number of commits based on the selected distribution
function getCommitsForDay(date, commitsPerDay, distribution) {
  const [min, max] = commitsPerDay.map(Number);

  switch (distribution) {
    case "workHours":
      return workHoursPattern(date, min, max);

    case "afterWork":
      return afterWorkPattern(date, min, max);

    case "uniform":
    default:
      return getRandomIntInclusive(min, max);
  }
}

function createCommitDateList({
  commitsPerDay,
  frequency = 100,
  startDate,
  endDate,
  distribution
}) {
  const commitDateList = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    // Apply frequency - randomly skip some days based on the frequency percentage
    if (Math.random() * 100 <= frequency) {
      // Get number of commits for this day based on the selected distribution
      let n = getCommitsForDay(currentDate, commitsPerDay, distribution);

      for (let i = 0; i < n; i++) {
        // Create a time distribution based on the selected pattern
        let hour;

        if (distribution === "workHours") {
          // Work hours distribution: more commits during 9am-5pm
          const hourDistribution = [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            3,
            8,
            12,
            15, // 0-11
            15,
            14,
            12,
            10,
            8,
            5,
            2,
            1,
            0,
            0,
            0,
            0 // 12-23
          ];

          // Weighted random selection of hour
          const totalWeight = hourDistribution.reduce(
            (sum, weight) => sum + weight,
            0
          );
          let random = Math.random() * totalWeight;

          for (hour = 0; hour < 24; hour++) {
            random -= hourDistribution[hour];
            if (random <= 0) break;
          }
        } else if (distribution === "afterWork") {
          // After work hours distribution: more commits in evenings and early morning
          const hourDistribution = [
            3,
            2,
            1,
            0,
            0,
            0,
            1,
            2,
            2,
            2,
            1,
            1, // 0-11
            1,
            1,
            1,
            2,
            3,
            5,
            10,
            15,
            18,
            15,
            10,
            5 // 12-23
          ];

          // Weighted random selection of hour
          const totalWeight = hourDistribution.reduce(
            (sum, weight) => sum + weight,
            0
          );
          let random = Math.random() * totalWeight;

          for (hour = 0; hour < 24; hour++) {
            random -= hourDistribution[hour];
            if (random <= 0) break;
          }
        } else {
          // More realistic hour distribution: more commits during work hours
          const hourDistribution = [
            1,
            1,
            0,
            0,
            0,
            0,
            1,
            2,
            5,
            8,
            10,
            12, // 0-11
            10,
            15,
            18,
            16,
            12,
            8,
            5,
            3,
            2,
            2,
            1,
            1 // 12-23
          ];

          // Weighted random selection of hour
          const totalWeight = hourDistribution.reduce(
            (sum, weight) => sum + weight,
            0
          );
          let random = Math.random() * totalWeight;

          for (hour = 0; hour < 24; hour++) {
            random -= hourDistribution[hour];
            if (random <= 0) break;
          }
        }

        const dateWithHours = setHours(currentDate, hour);
        const dateWithHoursAndMinutes = setMinutes(
          dateWithHours,
          getRandomIntInclusive(0, 59)
        );
        const commitDate = setSeconds(
          dateWithHoursAndMinutes,
          getRandomIntInclusive(0, 59)
        );

        commitDateList.push(commitDate);
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  return commitDateList;
}
