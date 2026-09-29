// Independent check for the round-1 parser.js audit findings.
// Run from the repo root with plain node (no node_modules needed):
//   node tests/audit_checks/webvowl_r1.mjs
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

// Finding 1: settings values that are present but falsy must still be applied.
check("F1 parseSettings applies paused:false and numeric 0 values", () => {
  const calls = {};
  const rec = (name) => (v) => { calls[name] = v; };
  const graph = {
    setZoom: rec("zoom"),
    setTranslation: rec("translation"),
    updateStyle() {},
    options: () => ({
      pausedMenu: () => ({ setPauseValue: rec("paused") }),
      classDistance: rec("classDistance"),
      datatypeDistance: rec("datatypeDistance"),
      gravityMenu: () => ({ reset() {} }),
      filterMenu: () => ({ setCheckBoxValue() {}, setDegreeSliderValue: rec("degreeSliderValue"), updateSettings() {} }),
      modeMenu: () => ({ setCheckBoxValue() {}, setColorSwitchState() {}, updateSettings() {} }),
    }),
  };
  const parser = createParser(graph);
  parser.parse({
    namespace: [],
    settings: {
      global: { zoom: 0, translation: [0, 0], paused: false },
      gravity: { classDistance: 0, datatypeDistance: 0 },
      filter: { degreeSliderValue: 0 },
    },
  });
  parser.parseSettings();
  expectEqual(calls, {
    zoom: 0, translation: [0, 0], paused: false,
    classDistance: 0, datatypeDistance: 0, degreeSliderValue: 0,
  }, "setter calls");
  return `setters received ${JSON.stringify(calls)}`;
});

// Finding 2: an ontology without a top-level namespace field must parse and
// leave prefixed IRIs unchanged.
check("F2 parse tolerates a missing namespace field", () => {
  const parser = createParser(inert);
  parser.parse({
    class: [{ id: "c1", type: "owl:Class" }],
    classAttribute: [{ id: "c1", iri: "ex:Thing" }],
  });
  const iris = parser.nodes().map((n) => n.iri());
  expectEqual(iris, ["ex:Thing"], "node IRIs");
  return `node IRIs ${JSON.stringify(iris)}`;
});

for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name} -- ${r.detail}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} of ${results.length} checks failed` : `all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
