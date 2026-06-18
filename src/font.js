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
  9: [".###.", "#...#", ".####", "....#", ".###."]
};

function glyphToColumns(glyph) {
  const cols = [];
  for (let x = 0; x < GLYPH_WIDTH; x++) {
    const col = [];
    for (let y = 0; y < GLYPH_HEIGHT; y++)
      col.push(glyph[y][x] === "#" ? 1 : 0);
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
  const width =
    chars.reduce((s, c) => s + c.width, 0) + Math.max(0, glyphCount - 1) * GAP;
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
      `Text too long: "${String(
        str
      ).toUpperCase()}" has ${glyphCount} characters. ` +
        `Maximum is ${MAX_TEXT_CHARS} characters. Shorten the text.`
    );
  }
  if (width > yearColumns) {
    throw new Error(
      `Text too long: "${String(
        str
      ).toUpperCase()}" renders to ${width} week-columns, ` +
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
  GAP
};
