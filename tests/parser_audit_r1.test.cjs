/*
 * Regression tests for the round-1 parser.js audit:
 *  1. parseSettings treated falsy settings values (paused:false, 0) as absent.
 *  2. replaceNamespace dereferenced a missing top-level `namespace` field.
 *
 * Run from the repo root: node --test tests/
 * No node_modules are needed; see tests/helpers/loadParser.cjs.
 */
var test = require("node:test");
var assert = require("node:assert/strict");
var path = require("path");
var helpers = require("./helpers/loadParser.cjs");

var repoRoot = path.resolve(__dirname, "..");
var createParser = helpers.loadParser(repoRoot);
var createExportMenu = helpers.loadExportMenu(repoRoot);

/*
 * A stand-in for graph + its menus that holds the settings state which
 * exportMenu reads and parser.parseSettings writes. Coercions mirror the real
 * widgets: d3's zoom.scale coerces to a number, and the degree slider is an
 * <input> whose value property is always a string.
 */
function fakeGraph( state ){
  function each( fn ){ this.forEach(fn); }
  var nodeElements = [];
  nodeElements.each = each;
  var labelElements = [];
  labelElements.each = each;

  var filterMenu = {
    getCheckBoxContainer: function (){
      return Object.keys(state.filterCheckBoxes).map(function ( id ){
        return {
          checkbox: {
            attr: function (){ return id; },
            property: function (){ return state.filterCheckBoxes[id]; }
          }
        };
      });
    },
    getDegreeSliderValue: function (){ return String(state.degreeSliderValue); },
    setCheckBoxValue: function ( id, checked ){ state.filterCheckBoxes[id] = checked; },
    setDegreeSliderValue: function ( v ){ state.degreeSliderValue = String(v); },
    updateSettings: function (){}
  };
  var modeMenu = {
    getCheckBoxContainer: function (){
      return Object.keys(state.modeCheckBoxes).map(function ( id ){
        return {
          attr: function (){ return id; },
          property: function (){ return state.modeCheckBoxes[id]; }
        };
      });
    },
    colorModeState: function (){ return state.colorSwitchState; },
    setCheckBoxValue: function ( id, checked ){ state.modeCheckBoxes[id] = checked; },
    setColorSwitchState: function ( v ){ state.colorSwitchState = v; },
    updateSettings: function (){}
  };
  var options = {
    data: function (){ return { _comment: "test", header: {}, namespace: [] }; },
    getGeneralMetaObject: function (){ return {}; },
    classDistance: function ( v ){
      if ( !arguments.length ) return state.classDistance;
      state.classDistance = v;
    },
    datatypeDistance: function ( v ){
      if ( !arguments.length ) return state.datatypeDistance;
      state.datatypeDistance = v;
    },
    pausedMenu: function (){ return { setPauseValue: function ( v ){ state.paused = v; } }; },
    gravityMenu: function (){ return { reset: function (){} }; },
    filterMenu: function (){ return filterMenu; },
    modeMenu: function (){ return modeMenu; },
    pickAndPinModule: function (){ return helpers.inert; }
  };
  return {
    state: state,
    options: function (){ return options; },
    getUnfilteredData: function (){ return { nodes: [], properties: [] }; },
    graphNodeElements: function (){ return nodeElements; },
    graphLabelElements: function (){ return labelElements; },
    scaleFactor: function (){ return state.zoom; },
    translation: function (){ return state.translation; },
    paused: function (){ return state.paused; },
    setZoom: function ( v ){ state.zoom = Number(v); },
    setTranslation: function ( t ){ state.translation = [t[0], t[1]]; },
    updateStyle: function (){}
  };
}

function importSettings( graph, settings ){
  var parser = createParser(graph);
  parser.parse({ namespace: [], settings: settings });
  parser.parseSettings();
  return parser;
}

function busyState(){
  return {
    zoom: 3,
    translation: [120, -40],
    paused: true,
    classDistance: 400,
    datatypeDistance: 300,
    degreeSliderValue: "5",
    colorSwitchState: true,
    filterCheckBoxes: { datatypeFilterCheckbox: true, subclassFilterCheckbox: true },
    modeCheckBoxes: { pickandpinModuleCheckbox: true, compactnotationModuleCheckbox: true }
  };
}

test("parseSettings applies paused:false from imported settings", function (){
  var graph = fakeGraph(busyState());
  importSettings(graph, { global: { paused: false } });
  assert.equal(graph.state.paused, false);
});

test("parseSettings applies numeric zero values and still flags zoom/translation import", function (){
  var graph = fakeGraph(busyState());
  var parser = importSettings(graph, {
    global: { zoom: 0, translation: [0, 0] },
    gravity: { classDistance: 0, datatypeDistance: 0 },
    filter: { degreeSliderValue: 0 }
  });
  assert.equal(graph.state.zoom, 0);
  assert.deepEqual(graph.state.translation, [0, 0]);
  assert.equal(graph.state.classDistance, 0);
  assert.equal(graph.state.datatypeDistance, 0);
  assert.equal(graph.state.degreeSliderValue, "0");
  assert.equal(parser.settingsImportGraphZoomAndTranslation(), true);
});

test("parseSettings leaves absent and null settings untouched", function (){
  var graph = fakeGraph(busyState());
  var parser = importSettings(graph, {
    global: { zoom: null },
    gravity: {},
    filter: {},
    modes: {}
  });
  assert.deepEqual(graph.state, busyState());
  assert.equal(parser.settingsImportGraphZoomAndTranslation(), false);
});

test("exported settings round-trip exactly through JSON and parseSettings, including false and 0", function (){
  var source = fakeGraph({
    zoom: 0.5,
    translation: [0, 0],
    paused: false,
    classDistance: 0,
    datatypeDistance: 0,
    degreeSliderValue: "0",
    colorSwitchState: false,
    filterCheckBoxes: { datatypeFilterCheckbox: false, subclassFilterCheckbox: true },
    modeCheckBoxes: { pickandpinModuleCheckbox: false, compactnotationModuleCheckbox: true }
  });
  var exported = JSON.parse(JSON.stringify(createExportMenu(source).createJSON_exportObject()));

  var target = fakeGraph(busyState());
  importSettings(target, exported.settings);

  assert.deepEqual(target.state, source.state);
  var reExported = JSON.parse(JSON.stringify(createExportMenu(target).createJSON_exportObject()));
  assert.deepEqual(reExported.settings, exported.settings);
});

test("parse leaves prefixed IRIs unchanged when the ontology has no namespace field", function (){
  var parser = createParser(helpers.inert);
  parser.parse({
    class: [{ id: "c1", type: "owl:Class" }],
    classAttribute: [{ id: "c1", iri: "ex:Thing" }],
    property: [{ id: "p1", type: "owl:objectProperty" }],
    propertyAttribute: [{ id: "p1", iri: "ex:rel", domain: "c1", range: "c1" }]
  });
  assert.deepEqual(parser.nodes().map(function ( n ){ return n.iri(); }), ["ex:Thing"]);
  assert.deepEqual(parser.properties().map(function ( p ){ return p.iri(); }), ["ex:rel"]);
});

test("parse still expands prefixes when namespaces are present", function (){
  var parser = createParser(helpers.inert);
  parser.parse({
    namespace: [{ name: "ex", iri: "http://example.org/" }],
    class: [{ id: "c1", type: "owl:Class" }],
    classAttribute: [{ id: "c1", iri: "ex:Thing" }]
  });
  assert.deepEqual(parser.nodes().map(function ( n ){ return n.iri(); }), ["http://example.org/Thing"]);
});
