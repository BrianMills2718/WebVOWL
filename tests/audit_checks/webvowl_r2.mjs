// Independent check for the round-2 parser.js audit findings.
// Run from the repo root with plain node (no node_modules needed):
//   node tests/audit_checks/webvowl_r2.mjs
// Exits 0 when every check passes, 1 otherwise.
//
// Deliberately self-contained: it does not reuse tests/helpers, so a bug in
// the unit-test harness cannot mask a regression here.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const parserPath = path.resolve(process.cwd(), "src/webvowl/js/parser.js");

// Minimal d3 v3 surface the parser's module tree needs in node.
const inert = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : inert),
  apply: () => inert,
});
function makeMap(values, keyFn) {
  const m = new Map();
  const api = {
    get: (k) => m.get(String(k)),
    set: (k, v) => (m.set(String(k), v), v),
    has: (k) => m.has(String(k)),
    remove: (k) => m.delete(String(k)),
    keys: () => [...m.keys()],
    values: () => [...m.values()],
    entries: () => [...m].map(([key, value]) => ({ key, value })),
    forEach: (f) => m.forEach((v, k) => f(k, v)),
    size: () => m.size,
    empty: () => m.size === 0,
  };
  (values || []).forEach((v, i) => api.set(keyFn ? keyFn(v, i) : i, v));
  return api;
}
function makeSet(values) {
  const m = makeMap();
  (values || []).forEach((v) => m.set(v, true));
  return { add: (v) => m.set(v, true), has: m.has, remove: m.remove, values: m.keys,
    forEach: (f) => m.keys().forEach((k) => f(k)), size: m.size, empty: m.empty };
}
globalThis.d3 = new Proxy({ map: makeMap, set: makeSet }, { get: (t, k) => (k in t ? t[k] : inert) });

const createParser = require(parserPath);
const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail });
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
  }
}
function expectEqual(actual, expected, what) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
function parse(ontology) { const p = createParser(inert); quiet(() => p.parse(ontology)); return p; }

// Finding 1: id 0 is a real id, not a missing one.
check("F1 property with domain 0 and a property with inverse 0 are kept and linked", () => {
  const p = parse({
    namespace: [],
    class: [{ id: 0, type: "owl:Class" }, { id: 1, type: "owl:Class" }],
    classAttribute: [{ id: 0, iri: "http://example.org/A" }, { id: 1, iri: "http://example.org/B" }],
    property: [{ id: 0, type: "owl:objectProperty" }, { id: 2, type: "owl:objectProperty" }],
    propertyAttribute: [
      { id: 0, iri: "http://example.org/p", domain: 0, range: 1 },
      { id: 2, iri: "http://example.org/q", inverse: 0 },
    ],
  });
  const summary = [];
  const seen = new Set();
  for (const prop of p.properties()) {
    for (const x of [prop, prop.inverse()]) {
      if (!x || seen.has(x.id())) continue;
      seen.add(x.id());
      summary.push(`${x.id()}:${x.domain() && x.domain().id()}->${x.range() && x.range().id()} inv=${x.inverse() ? x.inverse().id() : "none"}`);
    }
  }
  summary.sort();
  expectEqual(summary, ["0:0->1 inv=2", "2:1->0 inv=0"], "properties");
  return summary.join("; ");
});

// Finding 2: O2A relation types sharing a label keep their own role spokes.
check("F2 O2A role spokes resolve by relation id, not by shared label", () => {
  const base = "https://o2a.local/";
  const rels = [{ id: "ex:Access", label: "Shared" }, { id: "ex:Custody", label: "Shared" }];
  const p = parse({
    namespace: [{ name: "o2a", iri: base }],
    class: rels.map((r, i) => ({ id: i + 1, type: "owl:Class" })),
    classAttribute: rels.map((r, i) => ({ id: i + 1, label: { undefined: r.label }, iri: base + encodeURIComponent(r.id) })),
    property: [], propertyAttribute: [],
    o2a: {
      relationTypes: rels,
      roleSpokes: [
        { id: "ex:Access:viewer", relation: "ex:Access", role: "viewer", label: "viewer" },
        { id: "ex:Custody:holder", relation: "ex:Custody", role: "holder", label: "holder" },
      ],
    },
  });
  const domains = Object.fromEntries(p.properties()
    .filter((x) => String(x.id()).startsWith("o2a-spoke:"))
    .map((x) => [x.id(), x.domain().id()]));
  expectEqual(domains, { "o2a-spoke:ex:Access:viewer": 1, "o2a-spoke:ex:Custody:holder": 2 }, "spoke domains (class ids)");
  return `spoke domains ${JSON.stringify(domains)}`;
});

for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name} -- ${r.detail}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} of ${results.length} checks failed` : `all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
