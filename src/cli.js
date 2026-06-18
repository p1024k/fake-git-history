#!/usr/bin/env node

const { pathToFileURL } = require("url");
const meow = require("meow").default || require("meow");
const fgh = require("./index");

const cli = meow(
  `
    Usage
      $ fake-git-history [options]
 
    Options
      --commitsPerDay, -c Customize the number of commits per day.
      --frequency, -f   Chance (0-100%) of generating commits for a day (default: 80).
      --startDate, -s Start date in yyyy/MM/dd format.
      --endDate, -e End date yyyy/MM/dd format.
      --distribution, -d Distribution pattern for commits:
                         - uniform (default): Evenly distributed random commits
                         - workHours: More commits during work hours (9am-5pm) and on weekdays
                         - afterWork: More commits during evenings and weekends
      --preview, -p Preview the activity graph.
      --text, -t      Text to render (A-Z, 0-9, space). Auto-uppercased.
      --draw          Icon to render: cat, heart, mouse, smiley, star.
      --year, -y      Target calendar year (default: last year). 2000..last year.

    Examples
      $ fake-git-history --commitsPerDay "0,3"
      $ fake-git-history --frequency 80
      $ fake-git-history --startDate yyyy/MM/dd --endDate yyyy/MM/dd
      $ fake-git-history --distribution workHours
      $ fake-git-history --preview
`,
  {
    importMeta: { url: pathToFileURL(__filename).href },
    flags: {
      startDate: {
        type: "string",
        shortFlag: "s"
      },
      endDate: {
        type: "string",
        shortFlag: "e"
      },
      commitsPerDay: {
        type: "string",
        shortFlag: "c",
        default: "0,4"
      },
      frequency: {
        type: "number",
        shortFlag: "f",
        default: 80
      },
      distribution: {
        type: "string",
        shortFlag: "d",
        default: "uniform"
      },
      preview: {
        type: "boolean",
        shortFlag: "p",
        default: false
      },
      text: {
        type: "string",
        shortFlag: "t"
      },
      draw: {
        type: "string"
      },
      year: {
        type: "number",
        shortFlag: "y"
      }
    }
  }
);

fgh(cli.flags);
