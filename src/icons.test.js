const test = require("node:test");
const assert = require("node:assert");
const { ICONS, availableIcons } = require("./icons");

test("gallery has the five named icons", () => {
  assert.deepStrictEqual(availableIcons(), [
    "cat",
    "heart",
    "mouse",
    "smiley",
    "star"
  ]);
});

test("every icon is rectangular and <= 7 rows of 0/1", () => {
  for (const [name, grid] of Object.entries(ICONS)) {
    assert.ok(grid.length <= 7, `${name} has > 7 rows`);
    const w = grid[0].length;
    grid.forEach((row, i) => {
      assert.equal(row.length, w, `${name} row ${i} width mismatch`);
      row.forEach(v =>
        assert.ok(v === 0 || v === 1, `${name} has non-binary cell`)
      );
    });
  }
});

test("icons are binary grids (art parses to 0/1)", () => {
  for (const grid of Object.values(ICONS)) {
    grid.forEach(row => row.forEach(v => assert.ok(typeof v === "number")));
  }
});
