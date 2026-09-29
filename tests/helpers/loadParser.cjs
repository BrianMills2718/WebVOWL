/*
 * Loads src/webvowl/js/parser.js in plain node, without node_modules.
 *
 * The parser's dependency tree uses the global `d3` for d3.map / d3.set
 * (prototype lookup, equivalent-property merging, attribute dedup) and for
 * rendering helpers built at module load (d3.svg.line in util/math.js).
 * d3.map and d3.set get small working implementations of the d3 v3 API;
 * everything else is an inert chainable stub, which is safe because nothing
 * rendered is asserted on. An inert d3.set would silently hide every node
 * (its has() returns a truthy stub), so both collections must be real.
 */
var path = require("path");

function D3Map(){ this._ = Object.create(null); }
D3Map.prototype = {
  get: function ( k ){ return this._["$" + k]; },
  set: function ( k, v ){ this._["$" + k] = v; return v; },
  has: function ( k ){ return ("$" + k) in this._; },
  remove: function ( k ){ var had = this.has(k); delete this._["$" + k]; return had; },
  keys: function (){ return Object.keys(this._).map(function ( k ){ return k.slice(1); }); },
  values: function (){ var s = this; return Object.keys(s._).map(function ( k ){ return s._[k]; }); },
  entries: function (){ var s = this; return Object.keys(s._).map(function ( k ){ return { key: k.slice(1), value: s._[k] }; }); },
  forEach: function ( f ){ var s = this; Object.keys(s._).forEach(function ( k ){ f.call(s, k.slice(1), s._[k]); }); },
  size: function (){ return Object.keys(this._).length; },
  empty: function (){ return this.size() === 0; }
};

function D3Set(){ this.m = new D3Map(); }
D3Set.prototype = {
  add: function ( v ){ this.m.set(v, true); return v; },
  has: function ( v ){ return this.m.has(v); },
  remove: function ( v ){ return this.m.remove(v); },
  values: function (){ return this.m.keys(); },
  forEach: function ( f ){ this.m.keys().forEach(function ( k ){ f(k); }); },
  size: function (){ return this.m.size(); },
  empty: function (){ return this.m.empty(); }
};

var inert = new Proxy(function (){}, {
  get: function ( t, k ){ return k === Symbol.toPrimitive ? function (){ return 0; } : inert; },
  apply: function (){ return inert; }
});

function installD3(){
  if ( globalThis.d3 && globalThis.d3.__webvowlTestStub ) return;
  globalThis.d3 = new Proxy({
    __webvowlTestStub: true,
    map: function ( values, keyFn ){
      var m = new D3Map();
      (values || []).forEach(function ( v, i ){ m.set(keyFn ? keyFn(v, i) : i, v); });
      return m;
    },
    set: function ( values ){
      var s = new D3Set();
      (values || []).forEach(function ( v ){ s.add(v); });
      return s;
    }
  }, {
    get: function ( t, k ){ return k in t ? t[k] : inert; }
  });
}

function loadParser( repoRoot ){
  installD3();
  return require(path.join(repoRoot, "src/webvowl/js/parser.js"));
}

// exportMenu builds its TTL helper from the global `webvowl` bundle; the JSON
// export under test never calls into it.
function loadExportMenu( repoRoot ){
  installD3();
  if ( !globalThis.webvowl ) globalThis.webvowl = inert;
  return require(path.join(repoRoot, "src/app/js/menu/exportMenu.js"));
}

module.exports = { loadParser: loadParser, loadExportMenu: loadExportMenu, inert: inert };
