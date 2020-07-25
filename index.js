const grakn = require('grakn-client');
const fs = require('fs');
const util = require('./util');

const fileName = 'docker';
const keyspace = 'docker';
const author = 'Langleu';

const entities = {};
const relations = {};

async function runBasicQueries (arr, query, type) {
	const client = new grakn("localhost:48555");
  const session = await client.session(keyspace);
  
  const readTransaction = await session.transaction().read();

  if (type == 'ENTITY')
    entities[arr] = [];
  else
    relations[arr] = [];

	let answerIterator = await readTransaction.query(query);
	let aConceptMapAnswer = await answerIterator.next();
	while (aConceptMapAnswer != null) {
    let ob = {};

    aConceptMapAnswer.map().forEach(e => {
      if (e.baseType == 'ENTITY')
        ob[e._type._label] = e.id;
      else
        ob[e._type._label] = e._value;
    });

    ob.id = aConceptMapAnswer.map().get('id').id;
    if (type == 'ENTITY')
      entities[arr].push(ob);
    else
      relations[arr].push(ob);
		aConceptMapAnswer = await answerIterator.next();
  }
  
	await readTransaction.close();
	await session.close();
	client.close();
}

const callFunc = async (obj) => {
  for await (const entry of obj.all) {
    await runBasicQueries(entry.name, entry.query, entry.type.toUpperCase());
  }

  let id = 0; // counter for attributes
  let add = {
    edge: [],
    node: []
  };
  const wstream = fs.createWriteStream(`${fileName}.gexf`);
  // metadata
  wstream.write('<?xml version="1.0" encoding="UTF-8"?>');
  wstream.write('<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">');
  wstream.write('<meta lastmodifieddate="2009-03-20">');
  wstream.write(`<creator>${author}</creator>`);
  wstream.write(`<description>${fileName} graph</description>`);
  wstream.write('</meta>');
  wstream.write('<graph mode="static" defaultedgetype="directed">');
  wstream.write('<attributes class="edge" mode="static">');
  add.edge.push({ id, attr: '_type'});
  wstream.write(`<attribute id="${id++}" title="_type" type="string" />`);
  obj.combined.edge.forEach(e => {
    add.edge.push({ id, attr: e});
    wstream.write(`<attribute id="${id++}" title="${e}" type="string" />`);
  });
  wstream.write('<attribute id="3" title="relation" type="string" />');
  wstream.write('</attributes>');
  wstream.write('<attributes class="node" mode="static">');
  add.node.push({ id, attr: '_type'});
  wstream.write(`<attribute id="${id++}" title="_type" type="string" />`);
  obj.combined.node.forEach(e => {
    add.node.push({ id, attr: e});
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
        else 
          wstream.write(`<attvalue for="${f.id}" value="${encodeURIComponent(e[f.attr])}" />`);
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
        else 
          wstream.write(`<attvalue for="${f.id}" value="${encodeURIComponent(e[f.attr])}" />`);
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

callFunc(util('schema.gql'));
