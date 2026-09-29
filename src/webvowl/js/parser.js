var OwlDisjointWith = require("./elements/properties/implementations/OwlDisjointWith");
var attributeParser = require("./parsing/attributeParser")();
var equivalentPropertyMerger = require("./parsing/equivalentPropertyMerger")();
var nodePrototypeMap = require("./elements/nodes/nodeMap")();
var propertyPrototypeMap = require("./elements/properties/propertyMap")();

/**
 * Encapsulates the parsing and preparation logic of the input data.
 * @param graph the graph object that will be passed to the elements
 * @returns {{}}
 */
module.exports = function ( graph ){
  var parser = {},
    nodes,
    properties,
    classMap,
    settingsData,
    settingsImported = false,
    settingsImportGraphZoomAndTranslation = false,
    dictionary = [],
    propertyMap;
  
  parser.getDictionary = function (){
    return dictionary;
  };
  
  parser.setDictionary = function ( d ){
    dictionary = d;
  };
  
  parser.settingsImported = function (){
    return settingsImported;
  };
  parser.settingsImportGraphZoomAndTranslation = function (){
    return settingsImportGraphZoomAndTranslation;
  };
  
  /*
   * A value is present when the key carries a value. Truthiness is not
   * presence: ids and indexes can be 0, and exported settings legitimately
   * contain false (paused) and 0 (distances, degree slider, translation
   * components). null is treated as absent, as it was before, so a null never
   * reaches a graph setter or an id lookup.
   */
  function isPresent( value ){
    return value !== undefined && value !== null;
  }

  parser.parseSettings = function (){
    settingsImported = true;
    settingsImportGraphZoomAndTranslation = false;
    
    if ( !settingsData ) {
      settingsImported = false;
      return;
    }
    /** global settings **********************************************************/
    if ( settingsData.global ) {
      if ( isPresent(settingsData.global.zoom) ) {
        var zoomFactor = settingsData.global.zoom;
        graph.setZoom(zoomFactor);
        settingsImportGraphZoomAndTranslation = true;
      }
      
      if ( isPresent(settingsData.global.translation) ) {
        var translation = settingsData.global.translation;
        graph.setTranslation(translation);
        settingsImportGraphZoomAndTranslation = true;
      }
      
      if ( isPresent(settingsData.global.paused) ) {
        var paused = settingsData.global.paused;
        graph.options().pausedMenu().setPauseValue(paused);
      }
    }
    /** Gravity Settings  **********************************************************/
    if ( settingsData.gravity ) {
      if ( isPresent(settingsData.gravity.classDistance) ) {
        var classDistance = settingsData.gravity.classDistance;
        graph.options().classDistance(classDistance);
      }
      if ( isPresent(settingsData.gravity.datatypeDistance) ) {
        var datatypeDistance = settingsData.gravity.datatypeDistance;
        graph.options().datatypeDistance(datatypeDistance);
      }
      graph.options().gravityMenu().reset(); // reads the options values and sets the gui values
    }
    
    
    // shared variable declaration
    
    var i;
    var id;
    var checked;
    /** Filter Settings **********************************************************/
    if ( settingsData.filter ) {
      // checkbox settings
      if ( settingsData.filter.checkBox ) {
        var filter_cb = settingsData.filter.checkBox;
        for ( i = 0; i < filter_cb.length; i++ ) {
          id = filter_cb[i].id;
          checked = filter_cb[i].checked;
          graph.options().filterMenu().setCheckBoxValue(id, checked);
        }
      }
      // node degree filter settings
      if ( isPresent(settingsData.filter.degreeSliderValue) ) {
        var degreeSliderValue = settingsData.filter.degreeSliderValue;
        graph.options().filterMenu().setDegreeSliderValue(degreeSliderValue);
      }
      graph.options().filterMenu().updateSettings();
    }
    
    /** Modes Setting **********************************************************/
    if ( settingsData.modes ) {
      // checkbox settings
      if ( settingsData.modes.checkBox ) {
        var modes_cb = settingsData.modes.checkBox;
        for ( i = 0; i < modes_cb.length; i++ ) {
          id = modes_cb[i].id;
          checked = modes_cb[i].checked;
          graph.options().modeMenu().setCheckBoxValue(id, checked);
        }
      }
      // color switch settings
      var state = settingsData.modes.colorSwitchState;
      // state could be undefined
      if ( state === true || state === false ) {
        graph.options().modeMenu().setColorSwitchState(state);
      }
      graph.options().modeMenu().updateSettings();
    }
    graph.updateStyle(); // updates graph representation(setting charges and distances)
  };

  /*
   * O→A's relation model has typed role slots. A role is not a second relation
   * endpoint, so stock WebVOWL drops it when no OWL range exists. The fork
   * expands each o2a.roleSpoke into a visible, explicitly labelled role node
   * and a relation-to-role property before the normal parser runs. The source
   * object is copied, which also prevents the normal set-operator expansion
   * from mutating a cached O→A download on repeated loads.
   */
  function expandO2ARoleSpokes(ontologyData){
    if ( !ontologyData.o2a || !Array.isArray(ontologyData.o2a.roleSpokes) ) {
      return ontologyData;
    }

    var expanded = {}, key;
    for ( key in ontologyData ) {
      if ( ontologyData.hasOwnProperty(key) ) {
        expanded[key] = ontologyData[key];
      }
    }
    expanded.class = (ontologyData.class || []).slice();
    expanded.classAttribute = (ontologyData.classAttribute || []).slice();
    expanded.property = (ontologyData.property || []).slice();
    expanded.propertyAttribute = (ontologyData.propertyAttribute || []).slice();

    /*
     * Resolve each relation type to its class by relation id, never by label:
     * labels need not be unique. relationTypes carry only {id, label, ...}; the
     * stable link is the class IRI, which the O→A exporter
     * (observation-to-action-metamodel explorer/model.mjs,
     * createWebVowlProjection) writes as the o2a namespace IRI +
     * encodeURIComponent(relation.id). A relation with no class, or with more
     * than one class, at that IRI gets no spokes and a warning.
     */
    var relationIds = {}, attributes = expanded.classAttribute;
    var o2aNamespace = (ontologyData.namespace || []).filter(function ( namespace ){
      return namespace && namespace.name === "o2a";
    })[0];
    (ontologyData.o2a.relationTypes || []).forEach(function ( relation ){
      if ( !o2aNamespace ) {
        console.warn("No o2a namespace, so O→A relation " + relation.id + " cannot be resolved to a class");
        return;
      }
      var relationIri = o2aNamespace.iri + encodeURIComponent(relation.id);
      var matchingAttributes = attributes.filter(function ( attribute ){
        return attribute.iri === relationIri;
      });
      if ( matchingAttributes.length === 1 ) {
        relationIds[relation.id] = String(matchingAttributes[0].id);
      } else {
        console.warn(matchingAttributes.length + " classes have the IRI of O→A relation " + relation.id +
          " (" + relationIri + "); its role spokes are not drawn");
      }
    });

    ontologyData.o2a.roleSpokes.forEach(function ( spoke ){
      var relationId = relationIds[spoke.relation];
      if ( typeof relationId === "undefined" ) {
        console.warn("No O→A relation class was found for role spoke: " + spoke.id);
        return;
      }
      var roleNodeId = "o2a-role:" + spoke.id;
      var rolePropertyId = "o2a-spoke:" + spoke.id;
      var constraintIds = (spoke.bindingConstraints || []).map(function ( constraint ){
        return constraint.id;
      });
      var comment = "Typed role of " + spoke.relation + ". " + (spoke.comment || "");
      if ( constraintIds.length ) {
        comment += " Binding constraints: " + constraintIds.join(", ") + ".";
      }
      expanded.class.push({ id: roleNodeId, type: "owl:Class" });
      expanded.classAttribute.push({
        id: roleNodeId,
        label: { undefined: "role · " + spoke.label },
        iri: "https://o2a.local/role/" + encodeURIComponent(spoke.id),
        comment: comment,
        attributes: []
      });
      expanded.property.push({ id: rolePropertyId, type: "owl:ObjectProperty" });
      expanded.propertyAttribute.push({
        id: rolePropertyId,
        domain: relationId,
        range: roleNodeId,
        label: { undefined: spoke.label },
        comment: "O→A role spoke; this is a typed role slot, not a binary relation target.",
        attributes: []
      });
    });
    return expanded;
  }
  
  
  /**
   * Parses the ontology data and preprocesses it (e.g. connecting inverse properties and so on).
   * @param ontologyData the loaded ontology json file
   */
  parser.parse = function ( ontologyData ){
    if ( !ontologyData ) {
      nodes = [];
      properties = [];
      dictionary = [];
      return;
    }
    ontologyData = expandO2ARoleSpokes(ontologyData);
    dictionary = [];
    if ( ontologyData.settings ) settingsData = ontologyData.settings;
    else settingsData = undefined;
    
    var classes = combineClasses(ontologyData.class, ontologyData.classAttribute),
      datatypes = combineClasses(ontologyData.datatype, ontologyData.datatypeAttribute),
      combinedClassesAndDatatypes = classes.concat(datatypes),
      unparsedProperties = ontologyData.property || [],
      combinedProperties;
    
    // Inject properties for unions, intersections, ...
    addSetOperatorProperties(combinedClassesAndDatatypes, unparsedProperties);
    combinedProperties = combineProperties(unparsedProperties, ontologyData.propertyAttribute);
    classMap = mapElements(combinedClassesAndDatatypes);
    propertyMap = mapElements(combinedProperties);
    mergeRangesOfEquivalentProperties(combinedProperties, combinedClassesAndDatatypes);
    
    // Process the graph data
    convertTypesToIris(combinedClassesAndDatatypes, ontologyData.namespace);
    convertTypesToIris(combinedProperties, ontologyData.namespace);
    nodes = createNodeStructure(combinedClassesAndDatatypes, classMap);
    properties = createPropertyStructure(combinedProperties, classMap, propertyMap);
  };
  
  /**
   * @return {Array} the preprocessed nodes
   */
  parser.nodes = function (){
    return nodes;
  };
  
  /**
   * @returns {Array} the preprocessed properties
   */
  parser.properties = function (){
    return properties;
  };
  
  /**
   * Combines the passed objects with its attributes and prototypes. This also applies
   * attributes defined in the base of the prototype.
   */
  function combineClasses( baseObjects, attributes ){
    var combinations = [];
    var prototypeMap = createLowerCasePrototypeMap(nodePrototypeMap);
    
    if ( baseObjects ) {
      baseObjects.forEach(function ( element ){
        var matchingAttribute;
        
        if ( attributes ) {
          // Look for an attribute with the same id and merge them
          for ( var i = 0; i < attributes.length; i++ ) {
            var attribute = attributes[i];
            if ( element.id === attribute.id ) {
              matchingAttribute = attribute;
              break;
            }
          }
          addAdditionalAttributes(element, matchingAttribute);
        }
        
        // Then look for a prototype to add its properties
        var Prototype = prototypeMap.get(element.type.toLowerCase());
        
        if ( Prototype ) {
          addAdditionalAttributes(element, Prototype); // TODO might be unnecessary
          
          var node = new Prototype(graph);
          node.annotations(element.annotations)
            .baseIri(element.baseIri)
            .comment(element.comment)
            .complement(element.complement)
            .disjointUnion(element.disjointUnion)
            .description(element.description)
            .equivalents(element.equivalent)
            .id(element.id)
            .intersection(element.intersection)
            .label(element.label)
            // .type(element.type) Ignore, because we predefined it
            .union(element.union)
            .iri(element.iri);
          if ( element.pos ) {
            node.x = element.pos[0];
            node.y = element.pos[1];
            node.px = node.x;
            node.py = node.y;
          }
          //class element pin
          var elementPinned = element.pinned;
          if ( elementPinned === true ) {
            node.pinned(true);
            graph.options().pickAndPinModule().addPinnedElement(node);
          }
          // Create node objects for all individuals
          if ( element.individuals ) {
            element.individuals.forEach(function ( individual ){
              var individualNode = new Prototype(graph);
              individualNode.label(individual.labels)
                .iri(individual.iri);
              
              node.individuals().push(individualNode);
            });
          }
          
          if ( element.attributes ) {
            var deduplicatedAttributes = d3.set(element.attributes.concat(node.attributes()));
            node.attributes(deduplicatedAttributes.values());
          }
          combinations.push(node);
        } else {
          console.error("Unknown element type: " + element.type);
        }
      });
    }
    
    return combinations;
  }
  
  function combineProperties( baseObjects, attributes ){
    var combinations = [];
    var prototypeMap = createLowerCasePrototypeMap(propertyPrototypeMap);
    
    if ( baseObjects ) {
      baseObjects.forEach(function ( element ){
        var matchingAttribute;
        
        if ( attributes ) {
          // Look for an attribute with the same id and merge them
          for ( var i = 0; i < attributes.length; i++ ) {
            var attribute = attributes[i];
            if ( element.id === attribute.id ) {
              matchingAttribute = attribute;
              break;
            }
          }
          addAdditionalAttributes(element, matchingAttribute);
        }
        
        // Then look for a prototype to add its properties
        var Prototype = prototypeMap.get(element.type.toLowerCase());
        
        if ( Prototype ) {
          // Create the matching object and set the properties
          var property = new Prototype(graph);
          property.annotations(element.annotations)
            .baseIri(element.baseIri)
            .cardinality(element.cardinality)
            .comment(element.comment)
            .domain(element.domain)
            .description(element.description)
            .equivalents(element.equivalent)
            .id(element.id)
            .inverse(element.inverse)
            .label(element.label)
            .minCardinality(element.minCardinality)
            .maxCardinality(element.maxCardinality)
            .range(element.range)
            .subproperties(element.subproperty)
            .superproperties(element.superproperty)
            // .type(element.type) Ignore, because we predefined it
            .iri(element.iri);
          
          // adding property position
          if ( element.pos ) {
            property.x = element.pos[0];
            property.y = element.pos[1];
            property.px = element.pos[0];
            property.py = element.pos[1];
          }
          var elementPinned = element.pinned;
          if ( elementPinned === true ) {
            property.pinned(true);
            graph.options().pickAndPinModule().addPinnedElement(property);
          }
          
          
          if ( element.attributes ) {
            var deduplicatedAttributes = d3.set(element.attributes.concat(property.attributes()));
            property.attributes(deduplicatedAttributes.values());
          }
          combinations.push(property);
        } else {
          console.error("Unknown element type: " + element.type);
        }
        
      });
    }
    
    return combinations;
  }
  
  function createLowerCasePrototypeMap( prototypeMap ){
    return d3.map(prototypeMap.values(), function ( Prototype ){
      return new Prototype().type().toLowerCase();
    });
  }
  
  function mergeRangesOfEquivalentProperties( properties, nodes ){
    // pass clones of arrays into the merger to keep the current functionality of this module
    var newNodes = equivalentPropertyMerger.merge(properties.slice(), nodes.slice(), propertyMap, classMap, graph);
    
    // replace all the existing nodes and map the nodes again
    nodes.length = 0;
    Array.prototype.push.apply(nodes, newNodes);
    classMap = mapElements(nodes);
  }
  
  /**
   * Checks all attributes which have to be rewritten.
   * For example:
   * <b>equivalent</b> is filled with only ID's of the corresponding nodes. It would be better to used the
   * object instead of the ID so we swap the ID's with the correct object reference and can delete it from drawing
   * because it is not necessary.
   */
  function createNodeStructure( rawNodes, classMap ){
    var nodes = [];
    
    // Set the default values
    var maxIndividualCount = 0;
    rawNodes.forEach(function ( node ){
      maxIndividualCount = Math.max(maxIndividualCount, node.individuals().length);
      node.visible(true);
    });
    
    rawNodes.forEach(function ( node ){
      // Merge and connect the equivalent nodes
      processEquivalentIds(node, classMap);
      
      attributeParser.parseClassAttributes(node);
      
      node.maxIndividualCount(maxIndividualCount);
    });
    
    // Collect all nodes that should be displayed
    rawNodes.forEach(function ( node ){
      if ( node.visible() ) {
        nodes.push(node);
      }
    });
    
    return nodes;
  }
  
  /**
   * Sets the disjoint attribute of the nodes if a disjoint label is found.
   * @param property
   */
  function processDisjoints( property ){
    if ( property instanceof OwlDisjointWith === false ) {
      return;
    }
    
    var domain = property.domain(),
      range = property.range();
    
    // Check the domain.
    if ( !domain.disjointWith() ) {
      domain.disjointWith([]);
    }
    
    // Check the range.
    if ( !range.disjointWith() ) {
      range.disjointWith([]);
    }
    
    domain.disjointWith().push(property.range());
    range.disjointWith().push(property.domain());
  }
  
  /**
   * Connect all properties and also their sub- and superproperties.
   * We iterate over the rawProperties array because it is way faster than iterating
   * over an object and its attributes.
   *
   * @param rawProperties the properties
   * @param classMap a map of all classes
   * @param propertyMap the properties in a map
   */
  function createPropertyStructure( rawProperties, classMap, propertyMap ){
    var properties = [];
    // Set default values
    rawProperties.forEach(function ( property ){
      property.visible(true);
    });
    
    // Connect properties
    rawProperties.forEach(function ( property ){
      var domain,
        range,
        domainObject,
        rangeObject,
        inverse;
      
      /* Skip properties that have no information about their domain and range, like
       inverse properties with optional inverse and optional domain and range attributes */
      if ( (isPresent(property.domain()) && isPresent(property.range())) || isPresent(property.inverse()) ) {
        
        var inversePropertyId = findId(property.inverse());
        // Look if an inverse property exists
        if ( inversePropertyId !== undefined ) {
          inverse = propertyMap[inversePropertyId];
          if ( !inverse ) {
            console.warn("No inverse property was found for id: " + inversePropertyId);
            property.inverse(undefined);
          }
        }
        
        // Either domain and range are set on this property or at the inverse
        if ( typeof property.domain() !== "undefined" && typeof property.range() !== "undefined" ) {
          domain = findId(property.domain());
          range = findId(property.range());
          
          domainObject = classMap[domain];
          rangeObject = classMap[range];
        } else if ( inverse ) {
          // Domain and range need to be switched
          domain = findId(inverse.range());
          range = findId(inverse.domain());
          
          domainObject = classMap[domain];
          rangeObject = classMap[range];
        } else {
          console.warn("Domain and range not found for property: " + property.id());
        }
        
        // Set the references on this property
        property.domain(domainObject);
        property.range(rangeObject);
        
        // Also set the attributes of the inverse property
        if ( inverse ) {
          property.inverse(inverse);
          inverse.inverse(property);
          
          // Switch domain and range
          inverse.domain(rangeObject);
          inverse.range(domainObject);
        }
      }
      // Reference sub- and superproperties
      referenceSubOrSuperProperties(property.subproperties());
      referenceSubOrSuperProperties(property.superproperties());
    });
    
    // Merge equivalent properties and process disjoints.
    rawProperties.forEach(function ( property ){
      processEquivalentIds(property, propertyMap);
      processDisjoints(property);
      
      attributeParser.parsePropertyAttributes(property);
    });
    // Add additional information to the properties
    rawProperties.forEach(function ( property ){
      // Properties of merged classes should point to/from the visible equivalent class
      var propertyWasRerouted = false;
      
      if ( property.domain() === undefined ) {
        console.warn("No Domain was found for id:" + property.id());
        return;
      }
      
      if ( wasNodeMerged(property.domain()) ) {
        property.domain(property.domain().equivalentBase());
        propertyWasRerouted = true;
      }
      if ( property.range() === undefined ) {
        console.warn("No range was found for id:" + property.id());
        return;
      }
      if ( wasNodeMerged(property.range()) ) {
        property.range(property.range().equivalentBase());
        propertyWasRerouted = true;
      }
      // But there should not be two equal properties between the same domain and range
      var equalProperty = getOtherEqualProperty(rawProperties, property);
      
      if ( propertyWasRerouted && equalProperty ) {
        property.visible(false);
        
        equalProperty.redundantProperties().push(property);
      }
      
      // Hide property if source or target node is hidden
      if ( !property.domain().visible() || !property.range().visible() ) {
        property.visible(false);
      }
      
      // Collect all properties that should be displayed
      if ( property.visible() ) {
        properties.push(property);
      }
    });
    return properties;
  }
  
  function referenceSubOrSuperProperties( subOrSuperPropertiesArray ){
    var i, l;
    
    if ( !subOrSuperPropertiesArray ) {
      return;
    }
    
    for ( i = 0, l = subOrSuperPropertiesArray.length; i < l; ++i ) {
      var subOrSuperPropertyId = findId(subOrSuperPropertiesArray[i]);
      var subOrSuperProperty = propertyMap[subOrSuperPropertyId];
      
      if ( subOrSuperProperty ) {
        // Replace id with object
        subOrSuperPropertiesArray[i] = subOrSuperProperty;
      } else {
        console.warn("No sub-/superproperty was found for id: " + subOrSuperPropertyId);
      }
    }
  }
  
  function wasNodeMerged( node ){
    return !node.visible() && node.equivalentBase();
  }
  
  function getOtherEqualProperty( properties, referenceProperty ){
    var i, l, property;
    
    for ( i = 0, l = properties.length; i < l; i++ ) {
      property = properties[i];
      
      if ( referenceProperty === property ) {
        continue;
      }
      if ( referenceProperty.domain() !== property.domain() ||
        referenceProperty.range() !== property.range() ) {
        continue;
      }
      
      // Check for an equal IRI, if non existent compare label and type
      if ( referenceProperty.iri() && property.iri() ) {
        if ( referenceProperty.iri() === property.iri() ) {
          return property;
        }
      } else if ( referenceProperty.type() === property.type() &&
        referenceProperty.defaultLabel() === property.defaultLabel() ) {
        return property;
      }
    }
    
    return undefined;
  }
  
  /**
   * Generates and adds properties for links to set operators.
   * @param classes unprocessed classes
   * @param properties unprocessed properties
   */
  function addSetOperatorProperties( classes, properties ){
    function addProperties( domainId, rangeIds, operatorType ){
      if ( !rangeIds ) {
        return;
      }
      
      rangeIds.forEach(function ( rangeId, index ){
        var property = {
          id: "GENERATED-" + operatorType + "-" + domainId + "-" + rangeId + "-" + index,
          type: "setOperatorProperty",
          domain: domainId,
          range: rangeId
        };
        
        properties.push(property);
      });
    }
    
    classes.forEach(function ( clss ){
      addProperties(clss.id(), clss.complement(), "COMPLEMENT");
      addProperties(clss.id(), clss.intersection(), "INTERSECTION");
      addProperties(clss.id(), clss.union(), "UNION");
      addProperties(clss.id(), clss.disjointUnion(), "DISJOINTUNION");
    });
  }
  
  /**
   * Replaces the ids of equivalent nodes/properties with the matching objects, cross references them
   * and tags them as processed.
   * @param element a node or a property
   * @param elementMap a map where nodes/properties can be looked up
   */
  function processEquivalentIds( element, elementMap ){
    var eqIds = element.equivalents();
    
    if ( !eqIds || element.equivalentBase() ) {
      return;
    }
    
    // Replace ids with the corresponding objects
    for ( var i = 0, l = eqIds.length; i < l; ++i ) {
      var eqId = findId(eqIds[i]);
      var eqObject = elementMap[eqId];
      
      if ( eqObject ) {
        // Cross reference both objects
        eqObject.equivalents(eqObject.equivalents());
        eqObject.equivalents().push(element);
        eqObject.equivalentBase(element);
        eqIds[i] = eqObject;
        
        // Hide other equivalent nodes
        eqObject.visible(false);
      } else {
        console.warn("No class/property was found for equivalent id: " + eqId);
      }
    }
  }
  
  /**
   * Tries to convert the type to an iri and sets it.
   * @param elements classes or properties
   * @param namespaces an array of namespaces
   */
  function convertTypesToIris( elements, namespaces ){
    elements.forEach(function ( element ){
      if ( typeof element.iri() === "string" ) {
        element.iri(replaceNamespace(element.iri(), namespaces));
      }
    });
  }
  
  /**
   * Creates a map by mapping the array with the passed function.
   * @param array the array
   * @returns {{}}
   */
  function mapElements( array ){
    var map = {};
    for ( var i = 0, length = array.length; i < length; i++ ) {
      var element = array[i];
      map[element.id()] = element;
    }
    return map;
  }
  
  /**
   * Adds the attributes of the additional object to the base object, but doesn't
   * overwrite existing ones.
   *
   * @param base the base object
   * @param addition the object with additional data
   * @returns the combination is also returned
   */
  function addAdditionalAttributes( base, addition ){
    // Check for an undefined value
    addition = addition || {};
    
    for ( var addAttribute in addition ) {
      // Add the attribute if it doesn't exist
      if ( !(addAttribute in base) && addition.hasOwnProperty(addAttribute) ) {
        base[addAttribute] = addition[addAttribute];
      }
    }
    return base;
  }
  
  /**
   * Replaces the namespace (and the separator) if one exists and returns the new value.
   * @param address the address with a namespace in it
   * @param namespaces an array of namespaces; absent when the ontology JSON has
   *        no top-level namespace field, which leaves the address unchanged
   * @returns {string} the processed address with the (possibly) replaced namespace
   */
  function replaceNamespace( address, namespaces ){
    var separatorIndex = address.indexOf(":");
    if ( separatorIndex === -1 || !namespaces ) {
      return address;
    }
    var namespaceName = address.substring(0, separatorIndex);
    
    for ( var i = 0, length = namespaces.length; i < length; ++i ) {
      var namespace = namespaces[i];
      if ( namespaceName === namespace.name ) {
        return namespace.iri + address.substring(separatorIndex + 1);
      }
    }
    
    return address;
  }
  
  /**
   * Looks whether the passed object is already the id or if it was replaced
   * with the object that belongs to the id.
   * @param object an id, a class or a property
   * @returns {string} the id of the passed object or undefined
   */
  function findId( object ){
    if ( !isPresent(object) ) {
      return undefined;
    } else if ( typeof object === "string" || typeof object === "number" ) {
      // OWL2VOWL historically serializes identifiers as strings, but a JSON
      // producer may reasonably use numeric IDs. Normalize both forms at the
      // parser boundary so domain/range lookup remains stable.
      return String(object);
    } else if ( "id" in object ) {
      return object.id();
    } else {
      console.warn("No Id was found for this object: " + object);
      return undefined;
    }
  }
  
  return parser;
};
