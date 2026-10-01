// Builds public/psgc/ from the PSA PSGC API (https://psgc.gitlab.io/api), which browsers can't call
// directly (no CORS). Refresh: in a scratch folder, download provinces/, cities-municipalities/ and
// barangays/ from that API as provinces.json, cities-municipalities.json and barangays.json, then from
// that folder run: node <repo>/scripts/psgc-generate.cjs <repo>/public/psgc

const fs = require("fs");
const out = process.argv[2];
const provinces = require(process.cwd() + "/provinces.json");
const cities = require(process.cwd() + "/cities-municipalities.json");
const brgys = require(process.cwd() + "/barangays.json");
const NCR = { code: "130000000", name: "Metro Manila" };
const sort = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });
const byCity = new Map();
for (const b of brgys) {
  const c = b.cityCode || b.municipalityCode;
  if (!c) continue;
  if (!byCity.has(c)) byCity.set(c, new Set());
  byCity.get(c).add(b.name);
}
const groups = new Map();
for (const c of cities) {
  const independent = { "City of Isabela": "Basilan", "City of Cotabato": "Maguindanao" };
  const p = c.provinceCode || (c.regionCode === "130000000" ? NCR.code : provinces.find((x) => x.name === independent[c.name])?.code);
  if (!p) { console.error("no province", c.name); continue; }
  if (!groups.has(p)) groups.set(p, []);
  groups.get(p).push({ name: c.name, barangays: [...(byCity.get(c.code) ?? [])].sort(sort) });
}
const list = [...provinces.map((p) => ({ code: p.code, name: p.name })), NCR].filter((p) => groups.has(p.code)).sort((a, b) => sort(a.name, b.name));
fs.writeFileSync(`${out}/provinces.json`, JSON.stringify(list));
let total = 0;
for (const p of list) {
  const data = JSON.stringify(groups.get(p.code).sort((a, b) => sort(a.name, b.name)));
  total += data.length;
  fs.writeFileSync(`${out}/p/${p.code}.json`, data);
}
console.log(list.length, "provinces;", (total / 1e6).toFixed(2), "MB total;", "Cebu cities:", groups.get("072200000").length);
