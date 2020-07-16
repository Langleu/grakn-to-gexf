const grakn = require('grakn-client');
const fs = require('fs');

const fileName = 'docker';
const keyspace = 'docker';
const author = 'Langleu';

const entities = {};
const relations = {};
// relations mapping
const relation = {
  own: {
    source: 'user',
    target: 'repository'
  },
  contain: {
    source: 'repository',
    target: 'deployment'
  },
  include: {
    source: 'deployment',
    target: 'service'
  },
  depend: {
    source: 'service',
    target: 'service'
  }
}

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

const callFunc = async () => {
  // entities
  await runBasicQueries('user', 'match $id isa user, has rid $rid, has name $name; get;', 'ENTITY');
  await runBasicQueries('repository', 'match $id isa repository, has rid $rid, has name $name, has fork $fork, has description $description; get;', 'ENTITY');
  await runBasicQueries('deployment', 'match $id isa deployment, has rid $rid, has rtype $rtype, has rawUrl $rawUrl, has version $version, has name $name; get;', 'ENTITY');
  await runBasicQueries('service', 'match $id isa service, has rtype $rtype, has name $name, has version $version, has image $image, has metadata $metadata; get;', 'ENTITY');

  // relations
  await runBasicQueries('own', 'match $id (ownee: $ownee, owner: $owner) isa own; get;', 'RELATION');
  await runBasicQueries('contain', 'match $id (containment: $containment, container: $container) isa contain; get;', 'RELATION');
  await runBasicQueries('depend', 'match $id (dependency: $dependency, dependant: $dependant) isa depend; get;', 'RELATION');
  await runBasicQueries('include', 'match $id (included: $included, inclusion: $inclusion) isa include; get;', 'RELATION');

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
  wstream.write('<attribute id="3" title="relation" type="string" />');
  wstream.write('</attributes>');
  wstream.write('<attributes class="node" mode="static">');
  wstream.write('<attribute id="0" title="type" type="string" />');
  wstream.write('<attribute id="1" title="name" type="string" />');
  wstream.write('<attribute id="2" title="rid" type="string" />');
  wstream.write('</attributes>');

  // add all nodes
  wstream.write('<nodes>');
  for (var entity of Object.keys(entities)) {
    entities[entity].forEach(e => {
      wstream.write(`<node id="${e.id}" label="${e.name}">`);
      wstream.write(`<attvalues>`);
      wstream.write(`<attvalue for="0" value="${entity}" />`);
      wstream.write(`<attvalue for="1" value="${e.name}" />`);
      wstream.write(`<attvalue for="2" value="${e.rid}" />`);
      wstream.write(`</attvalues>`);
      wstream.write('</node>');
    });
  };
  wstream.write('</nodes>');

  // add all edges
  wstream.write('<edges>');

  for (var entity of Object.keys(relations)) {
    relations[entity].forEach(e => {
      wstream.write(`<edge id="${e.id}" source="${e[relation[entity].source]}" target="${e[relation[entity].target]}">`);
      wstream.write(`<attvalues>`);
      wstream.write(`<attvalue for="3" value="${entity}" />`);
      wstream.write(`</attvalues>`);
      wstream.write('</edge>');
    })
  };
  wstream.write('</edges>');

  wstream.write('</graph>');
  wstream.write('</gexf>');
  wstream.end();
};

callFunc();
