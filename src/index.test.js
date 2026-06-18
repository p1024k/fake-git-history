const test = require("node:test");
const assert = require("node:assert");
const fgh = require("./index");
const { prepareDrawMode, runStep } = fgh;

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

test("runStep retries and succeeds on transient failures", async () => {
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls < 3) throw Object.assign(new Error("boom"), { stderr: "boom" });
    return "ok";
  };
  const res = await runStep("git commit", flaky, 3);
  assert.equal(res, "ok");
  assert.equal(calls, 3);
});

test("runStep throws a clear error after exhausting retries", async () => {
  const alwaysFail = async () => {
    throw Object.assign(new Error("nope"), { stderr: "nope" });
  };
  await assert.rejects(
    () => runStep("git commit", alwaysFail, 2),
    /after 2 attempts/
  );
});
