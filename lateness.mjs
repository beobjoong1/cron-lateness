#!/usr/bin/env node
// Usage: node lateness.mjs heartbeat.jsonl [slotSeconds=300]
// Input lines: {"scheduled":"ISO","started":"ISO"}
// Output: runs, median/p90/max lateness (seconds), missed slots, longest gap.
import { readFileSync } from "node:fs";

const [file, slotArg] = process.argv.slice(2);
if (!file) {
  console.error("usage: node lateness.mjs heartbeat.jsonl [slotSeconds]");
  process.exit(2);
}
const slot = Number(slotArg ?? 300);
const rows = readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .map((r) => ({ s: Date.parse(r.scheduled), a: Date.parse(r.started) }))
  .filter((r) => Number.isFinite(r.s) && Number.isFinite(r.a))
  .sort((x, y) => x.a - y.a);

if (rows.length === 0) {
  console.log("no rows");
  process.exit(0);
}

const lateness = rows.map((r) => Math.max(0, (r.a - r.s) / 1000)).sort((x, y) => x - y);
const q = (p) => lateness[Math.min(lateness.length - 1, Math.floor(p * (lateness.length - 1)))];

// gaps between consecutive starts
let longestGap = 0;
for (let i = 1; i < rows.length; i++) longestGap = Math.max(longestGap, (rows[i].a - rows[i - 1].a) / 1000);

// missed slots: expected slots between first and last start vs runs observed
const spanSlots = Math.floor((rows[rows.length - 1].a - rows[0].a) / 1000 / slot) + 1;
const missed = Math.max(0, spanSlots - rows.length);

const fmt = (sec) => (sec >= 3600 ? `${(sec / 3600).toFixed(1)}h` : sec >= 60 ? `${(sec / 60).toFixed(1)}m` : `${sec.toFixed(0)}s`);

console.log(`runs            ${rows.length}`);
console.log(`span            ${fmt((rows[rows.length - 1].a - rows[0].a) / 1000)} (${spanSlots} expected slots of ${slot}s)`);
console.log(`lateness median ${fmt(q(0.5))}`);
console.log(`lateness p90    ${fmt(q(0.9))}`);
console.log(`lateness max    ${fmt(q(1))}`);
console.log(`longest gap     ${fmt(longestGap)} between consecutive runs`);
console.log(`missed slots    ${missed} (${((missed / spanSlots) * 100).toFixed(1)}% of expected)`);
