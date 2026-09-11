import test from "node:test";
import assert from "node:assert/strict";
import { metrics } from "./metrics.js";
test("extra units of one item cannot offset another item shortage", () => {
  const p = {
    createdAt: "2026-09-07T10:00:00Z",
    finalReceivedAt: "2026-09-08T10:00:00Z",
    expectedAt: "2026-09-08T12:00:00Z",
    items: [
      { itemId: "a", approvedQty: 10 },
      { itemId: "b", approvedQty: 10 },
    ],
    finalReceived: { a: 12, b: 8 },
  };
  assert.equal(metrics([p]).inFull, 0);
  assert.equal(metrics([p]).onTime, 100);
  assert.equal(metrics([p]).leadHours, 24);
});
test("no final receipt is not a completed delivery", () => {
  assert.equal(
    metrics([{ items: [], createdAt: "2026-09-07", warehouseReceived: {} }])
      .onTime,
    null,
  );
  assert.equal(metrics([]).inFull, null);
});
