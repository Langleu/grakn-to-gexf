const fs = require('fs');
const util = require('./util');

// args options
const args = process.argv.slice(2);

// default options
const options = {
  'output': 'graph',
  'author': 'grakn',
  'keyspace': 'grakn',
  'schema': 'schema.gql',
  'host': 'localhost',
  'port': '48555',
  'username': undefined,
  'password': undefined
}

createOptions = () => {
  let rgx = /(^--)/;

  for (let i = 0; i < args.length; i++) {
    if (args[i].match(rgx)) {
      options[args[i].slice(2)] = args[i + 1] || "<no-value>";
    }
  }
};

const entities = {};
const relations = {};

const callFunc = async (obj) => {
  for await (const entry of obj.all) {
    await util.runBasicQueries(entry.name, entry.query, entry.type.toUpperCase(), options, entities, relations);
  }

  let id = 0; // counter for attributes
  let add = {
    edge: [],
    node: []
  };
  
  const wstream = fs.createWriteStream(`${options.output}.gexf`);
  // metadata
  wstream.write('<?xml version="1.0" encoding="UTF-8"?>');
  wstream.write('<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">');
  wstream.write('<meta lastmodifieddate="2009-03-20">');
  wstream.write(`<creator>${options.author}</creator>`);
  wstream.write(`<description>${options.output} graph</description>`);
  wstream.write('</meta>');
  wstream.write('<graph mode="static" defaultedgetype="directed">');
  wstream.write('<attributes class="edge" mode="static">');
  add.edge.push({
    id,
    attr: '_type'
  });
  wstream.write(`<attribute id="${id++}" title="_type" type="string" />`);
  obj.combined.edge.forEach(e => {
    add.edge.push({
      id,
      attr: e
    });
    wstream.write(`<attribute id="${id++}" title="${e}" type="string" />`);
  });
  wstream.write('<attribute id="3" title="relation" type="string" />');
  wstream.write('</attributes>');
  wstream.write('<attributes class="node" mode="static">');
  add.node.push({
    id,
    attr: '_type'
  });
  wstream.write(`<attribute id="${id++}" title="_type" type="string" />`);
  obj.combined.node.forEach(e => {
    add.node.push({
      id,
      attr: e
    });
    wstream.write(`<attribute id="${id++}" title="${e}" type="string" />`);
  });
  wstream.write('</attributes>');

  // add all nodes
  wstream.write('<nodes>');
  for (let entity of Object.keys(entities)) {
    entities[entity].forEach(e => {
      wstream.write(`<node id="${e.id}" label="${e.name}">`);
      wstream.write(`<attvalues>`);
      add.node.forEach(f => {
        if (f.attr == '_type')
          wstream.write(`<attvalue for="${f.id}" value="${entity}" />`);
        else {
          let attr = '';
          if (e[f.attr])
            attr = e[f.attr].toString().replace(/&/g, 'and');
          wstream.write(`<attvalue for="${f.id}" value="${attr}" />`);
        }
      });
      wstream.write(`</attvalues>`);
      wstream.write('</node>');
    });
  };
  wstream.write('</nodes>');

  // add all edges
  wstream.write('<edges>');

  for (let entity of Object.keys(relations)) {
    let relation = obj.all.find(e => e.type == 'relation' && e.name == entity);
    let source = obj.all.find(e => e.type == 'entity' && e.plays.includes(relation.source)).name;
    let target = obj.all.find(e => e.type == 'entity' && e.plays.includes(relation.target)).name;
    obj.all.find(e => e.type == 'relation' && e.name == entity).source;
    relations[entity].forEach(e => {
      wstream.write(`<edge id="${e.id}" source="${e[source]}" target="${e[target]}">`);
      wstream.write(`<attvalues>`);
      add.edge.forEach(f => {
        if (f.attr == '_type')
          wstream.write(`<attvalue for="${f.id}" value="${entity}" />`);
        else {
          let attr = '';
          if (e[f.attr])
            attr = e[f.attr].toString().replace(/&/g, 'and');
          wstream.write(`<attvalue for="${f.id}" value="${attr}" />`);
        }
      });
      wstream.write(`</attvalues>`);
      wstream.write('</edge>');
    })
  };
  wstream.write('</edges>');

  wstream.write('</graph>');
  wstream.write('</gexf>');
  wstream.end();
};

createOptions();
callFunc(util.parseSchema(options.schema));
