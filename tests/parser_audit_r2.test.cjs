/*
 * Regression tests for the round-2 parser.js audit:
 *  1. Falsy-as-absent on ids: an element id of 0 was treated as missing.
 *  2. expandO2ARoleSpokes resolved relation types to classes by label, so two
 *     relation types sharing a label attached their spokes to the first match.
 *
 * Run from the repo root: node --test tests/*.test.cjs
 */
var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("fs");
var path = require("path");
var helpers = require("./helpers/loadParser.cjs");

var repoRoot = path.resolve(__dirname, "..");
var createParser = helpers.loadParser(repoRoot);
var dataDir = path.join(repoRoot, "src/app/data");

function parse( ontology ){
  var parser = createParser(helpers.inert);
  var warn = console.warn;
  console.warn = function (){};
  try {
    parser.parse(ontology);
  } finally {
    console.warn = warn;
  }
  return parser;
}

/* ---------------------------------------------------------------- ids ---- */

// Every field of an OWL2VOWL attribute record that refers to another element.
var SINGLE_REFS = ["domain", "range", "inverse"];
var LIST_REFS = ["subproperty", "superproperty", "equivalent", "union", "intersection", "complement", "disjointUnion"];
var ALL_REF_FIELDS = SINGLE_REFS.concat(LIST_REFS);
var ID_LISTS = ["class", "classAttribute", "datatype", "datatypeAttribute", "property", "propertyAttribute"];

function elementIds( ontology ){
  var ids = [];
  ["class", "datatype", "property"].forEach(function ( key ){
    (ontology[key] || []).forEach(function ( element ){
      if ( ids.indexOf(element.id) === -1 ) ids.push(element.id);
    });
  });
  return ids;
}

// Rewrites every id and id reference through `map`.
function renumber( ontology, map ){
  var copy = JSON.parse(JSON.stringify(ontology));
  function mapId( id ){
    return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : id;
  }
  ID_LISTS.forEach(function ( key ){
    (copy[key] || []).forEach(function ( record ){
      record.id = mapId(record.id);
      SINGLE_REFS.forEach(function ( field ){
        if ( record[field] !== undefined ) record[field] = mapId(record[field]);
      });
      LIST_REFS.forEach(function ( field ){
        if ( Array.isArray(record[field]) ) record[field] = record[field].map(mapId);
      });
    });
  });
  return copy;
}

// Ids that occur in each reference role, so each role can be given id 0.
function idsByRole( ontology ){
  var byRole = { element: elementIds(ontology)[0] };
  ["classAttribute", "datatypeAttribute", "propertyAttribute"].forEach(function ( key ){
    (ontology[key] || []).forEach(function ( record ){
      ALL_REF_FIELDS.forEach(function ( field ){
        var value = record[field];
        if ( Array.isArray(value) ) value = value[0];
        if ( value !== undefined && byRole[field] === undefined ) byRole[field] = value;
      });
    });
  });
  return byRole;
}

// The parsed graph expressed in original ids, so two numberings can be compared
// element by element rather than by count alone.
function structure( parser, back ){
  function orig( element ){ return element === undefined ? "<none>" : back[element.id()]; }
  return {
    nodes: parser.nodes().map(orig).sort(),
    properties: parser.properties().map(function ( p ){
      function refs( list ){
        return (list || []).map(function ( r ){
          return typeof r === "object" ? orig(r) : "unresolved:" + r;
        }).sort().join(",");
      }
      return [orig(p), orig(p.domain()), orig(p.range()), "inverse=" + orig(p.inverse()),
        "sub=" + refs(p.subproperties()), "super=" + refs(p.superproperties())].join(" ");
    }).sort()
  };
}

function compareNumberings( ontology, zeroId ){
  var ids = elementIds(ontology);
  var order = [zeroId].concat(ids.filter(function ( id ){ return id !== zeroId; }));
  var fromZero = {}, fromOne = {}, backZero = {}, backOne = {};
  order.forEach(function ( id, index ){
    fromZero[id] = index;
    fromOne[id] = index + 1;
    backZero[index] = id;
    backOne[index + 1] = id;
  });
  var zero = structure(parse(renumber(ontology, fromZero)), backZero);
  var one = structure(parse(renumber(ontology, fromOne)), backOne);
  return { zero: zero, one: one };
}

fs.readdirSync(dataDir).filter(function ( f ){ return /\.json$/.test(f); }).forEach(function ( file ){
  var ontology = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  var roles = idsByRole(ontology);
  Object.keys(roles).forEach(function ( role ){
    if ( roles[role] === undefined ) return;
    test(file + ": id 0 in the " + role + " role parses the same as ids starting at 1", function (){
      var result = compareNumberings(ontology, roles[role]);
      assert.ok(result.one.nodes.length > 0 || file === "new_ontology.json" || file === "template.json");
      assert.deepEqual(result.zero.nodes, result.one.nodes);
      assert.deepEqual(result.zero.properties, result.one.properties);
    });
  });
});

test("a property whose domain is class 0 is kept and connected", function (){
  var parser = parse({
    namespace: [],
    class: [{ id: 0, type: "owl:Class" }, { id: 1, type: "owl:Class" }],
    classAttribute: [{ id: 0, iri: "http://example.org/A" }, { id: 1, iri: "http://example.org/B" }],
    property: [{ id: 2, type: "owl:objectProperty" }],
    propertyAttribute: [{ id: 2, iri: "http://example.org/p", domain: 0, range: 1 }]
  });
  assert.equal(parser.properties().length, 1);
  assert.equal(parser.properties()[0].domain().id(), 0);
  assert.equal(parser.properties()[0].range().id(), 1);
});

test("a property whose inverse is property 0 is linked to it", function (){
  var parser = parse({
    namespace: [],
    class: [{ id: 1, type: "owl:Class" }, { id: 2, type: "owl:Class" }],
    classAttribute: [{ id: 1, iri: "http://example.org/A" }, { id: 2, iri: "http://example.org/B" }],
    property: [{ id: 0, type: "owl:objectProperty" }, { id: 3, type: "owl:objectProperty" }],
    propertyAttribute: [
      { id: 0, iri: "http://example.org/p", domain: 1, range: 2 },
      { id: 3, iri: "http://example.org/q", inverse: 0 }
    ]
  });
  var q = parser.properties().filter(function ( p ){ return p.id() === 3; })[0] ||
    parser.properties().filter(function ( p ){ return p.id() === 0; })[0].inverse();
  assert.ok(q, "property 3 exists");
  assert.equal(q.inverse().id(), 0);
  assert.equal(q.domain().id(), 2);
  assert.equal(q.range().id(), 1);
});

/* ---------------------------------------------------------------- o2a ---- */

var O2A_BASE = "https://o2a.local/";

// Shaped like observation-to-action-metamodel explorer/model.mjs
// createWebVowlProjection: numeric class ids from 1, class IRI = base +
// encodeURIComponent(relation id), relationTypes carry {id, label} only.
function o2aProjection( relations, spokes ){
  return {
    namespace: [{ name: "o2a", iri: O2A_BASE }],
    class: relations.map(function ( r, i ){ return { id: i + 1, type: "owl:Class" }; }),
    classAttribute: relations.map(function ( r, i ){
      return { id: i + 1, label: { undefined: r.label }, iri: O2A_BASE + encodeURIComponent(r.id), attributes: [] };
    }),
    datatype: [],
    datatypeAttribute: [],
    property: [],
    propertyAttribute: [],
    o2a: {
      relationTypes: relations.map(function ( r ){ return { id: r.id, label: r.label }; }),
      roleSpokes: spokes.map(function ( s ){
        return { id: s.relation + ":" + s.role, relation: s.relation, role: s.role, label: s.role, bindingConstraints: [] };
      })
    }
  };
}

function spokeDomains( parser ){
  var out = {};
  parser.properties().forEach(function ( p ){
    if ( String(p.id()).indexOf("o2a-spoke:") === 0 ) out[p.id()] = p.domain().iri();
  });
  return out;
}

test("role spokes of two relation types with the same label attach to their own relation", function (){
  var parser = parse(o2aProjection(
    [{ id: "ex:Access", label: "Shared" }, { id: "ex:Custody", label: "Shared" }],
    [{ relation: "ex:Access", role: "viewer" }, { relation: "ex:Custody", role: "holder" }]
  ));
  assert.deepEqual(spokeDomains(parser), {
    "o2a-spoke:ex:Access:viewer": O2A_BASE + encodeURIComponent("ex:Access"),
    "o2a-spoke:ex:Custody:holder": O2A_BASE + encodeURIComponent("ex:Custody")
  });
});

test("role spokes resolve by relation id even when the class label differs from the relation label", function (){
  var ontology = o2aProjection([{ id: "ex:Access", label: "Access" }], [{ relation: "ex:Access", role: "viewer" }]);
  ontology.classAttribute[0].label = { undefined: "Renamed" };
  assert.deepEqual(spokeDomains(parse(ontology)), {
    "o2a-spoke:ex:Access:viewer": O2A_BASE + encodeURIComponent("ex:Access")
  });
});

test("a relation type with no class of its IRI gets no spokes instead of a label guess", function (){
  var ontology = o2aProjection([{ id: "ex:Access", label: "Shared" }], [{ relation: "ex:Access", role: "viewer" }]);
  ontology.classAttribute[0].iri = "https://elsewhere.example/Access";
  assert.deepEqual(spokeDomains(parse(ontology)), {});
});
