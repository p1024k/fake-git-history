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
    ".#...#."
  ]),
  heart: parse([".#.#.", "#####", "#####", ".###.", "..#.."]),
  mouse: parse([
    ".#...#.",
    "#######",
    "#.###.#",
    "#######",
    ".#.#.#.",
    "..###..",
    "......."
  ]),
  smiley: parse([
    ".#####.",
    "#.....#",
    "#.#.#.#",
    "#.....#",
    "#.#.#.#",
    "#..#..#",
    ".#####."
  ]),
  star: parse(["..#..", ".###.", "#####", ".#.#.", ".#.#.", "#...#", "#...#"])
};

function availableIcons() {
  return Object.keys(ICONS).sort();
}

module.exports = { ICONS, availableIcons };
