import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fieldText, indexAt, kpAt, linePath, timeAt } from "../web/model.mjs";
const edition = JSON.parse(
  readFileSync(new URL("../web/data/storm.json", import.meta.url)),
);
test("Kp values belong to the three hours before each DONKI observation", () => {
  const bins = edition.storm.kp;
  assert.equal(kpAt(bins, Date.parse("2024-05-10T20:59:00Z")).value, 8.67);
  assert.equal(kpAt(bins, Date.parse("2024-05-10T21:00:00Z")).value, 9);
  assert.equal(kpAt(bins, Date.parse(edition.start)), undefined);
});
test("both traces use the UTC interval containing the selected timestamp", () => {
  const index = indexAt(edition, "2024-05-10T16:36:00Z");
  assert.equal(
    new Date(timeAt(edition, index)).toISOString(),
    "2024-05-10T16:35:00.000Z",
  );
  assert.equal(indexAt(edition, edition.end), edition.bin_count - 1);
  assert.ok(
    edition.stations.every((s) => s.delta_nT.length === edition.bin_count),
  );
});
test("gaps break segments and print an explicit gap", () => {
  assert.equal(
    linePath(
      [1, null, 2, 3],
      (i) => i,
      (v) => v,
    ),
    "M0.00,1.00 M2.00,2.00 L3.00,3.00",
  );
  assert.equal(fieldText(null), "Gap");
  assert.equal(fieldText(-0.46), "0 nT");
});
