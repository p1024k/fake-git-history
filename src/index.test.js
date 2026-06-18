const test = require("node:test");
const assert = require("node:assert");
const fgh = require("./index");
const { prepareDrawMode } = fgh;

test("rejects --text and --draw together", () => {
  assert.throws(
    () => prepareDrawMode({ text: "HI", draw: "cat", commitsPerDay: "0,4" }),
    /mutually exclusive/
  );
});

test("rejects year out of range", () => {
  const y = new Date().getFullYear();
  assert.throws(
    () => prepareDrawMode({ text: "HI", year: y, commitsPerDay: "0,4" }),
    /Invalid year/
  );
  assert.throws(
    () => prepareDrawMode({ text: "HI", year: 1999, commitsPerDay: "0,4" }),
    /Invalid year/
  );
});

test("rejects unknown icon and lists available", () => {
  assert.throws(
    () => prepareDrawMode({ draw: "dragon", commitsPerDay: "0,4" }),
    /Available:.*cat.*star/s
  );
});

test("rejects text longer than 8 glyphs", () => {
  assert.throws(
    () => prepareDrawMode({ text: "ABCDEFGHI", commitsPerDay: "0,4" }),
    /Maximum is 8/
  );
});

test("valid text returns centered dates bounded to the year", () => {
  const r = prepareDrawMode({ text: "HI", year: 2025, commitsPerDay: "0,4" });
  assert.equal(r.modeLabel, "text: HI");
  assert.deepEqual([r.startDate.getMonth(), r.startDate.getDate()], [0, 1]);
  assert.deepEqual([r.endDate.getMonth(), r.endDate.getDate()], [11, 31]);
  assert.ok(r.commitDateList.length > 0);
  r.commitDateList.forEach(d => {
    assert.equal(d.getFullYear(), 2025);
  });
});

test("valid icon returns the icon label", () => {
  const r = prepareDrawMode({ draw: "cat", year: 2025, commitsPerDay: "0,4" });
  assert.equal(r.modeLabel, "icon: cat");
  assert.ok(r.commitDateList.length > 0);
});

test("default year is last year", () => {
  const r = prepareDrawMode({ text: "HI", commitsPerDay: "0,4" });
  assert.equal(r.startDate.getFullYear(), new Date().getFullYear() - 1);
});
