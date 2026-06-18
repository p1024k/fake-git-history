const test = require("node:test");
const assert = require("node:assert");
const {
  FONT,
  renderText,
  measureText,
  validateText,
  MAX_TEXT_CHARS,
  GLYPH_WIDTH,
  GLYPH_HEIGHT
} = require("./font");

test("every FONT glyph is 5x5 of only # or .", () => {
  for (const [ch, glyph] of Object.entries(FONT)) {
    assert.equal(glyph.length, GLYPH_HEIGHT, `${ch} has ${GLYPH_HEIGHT} rows`);
    glyph.forEach((row, i) => {
      assert.equal(
        row.length,
        GLYPH_WIDTH,
        `${ch} row ${i} is ${GLYPH_WIDTH} chars`
      );
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
