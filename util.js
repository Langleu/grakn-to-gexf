const fs = require('fs');
const _ = require('lodash');
const grakn = require('grakn-client');

const getAttributes = (entry) => {
  let attributes = [];
  entry.forEach(e => {
    if (e.includes('key') || e.includes('has'))
      attributes.push(e.replace(/key |has /, ''));
  });

  return attributes;
}

const getPlays = (entry) => {
  let plays = [];
  entry.forEach(e => {
    if (e.includes('plays'))
      plays.push(e.replace('plays ', ''));
  });

  return plays;
}

const returnTypeWithAttributes = (entry) => {
  if (entry[0].includes('relation')) {
    return {
        name: entry[0].replace(' sub relation', ''),
        type: 'relation',
        attributes: getAttributes(entry),
        source: entry.find(e => e.includes('relates')).replace('relates ', ''),
        target: entry.slice().reverse().find(e => e.includes('relates')).replace('relates ', '')
      }
  } else if (entry[0].includes('entity')) {
    return {
        name: entry[0].replace(' sub entity', ''),
        type: 'entity',
        attributes: getAttributes(entry),
        plays: getPlays(entry)
      }
  } else {
    return;
  }
};

const getQuery = (entry) => {
  let query = '';
  if (entry.type == 'entity') {
    query = `match $id isa ${entry.name}`;
    entry.attributes.forEach(e => {
      query += `, has ${e} $${e}`;
    });
    query += '; get;'
  }
  
  if (entry.type == 'relation') {
    query = `match $id (${entry.source}: $${entry.source}, ${entry.target}: $${entry.target}) isa ${entry.name}`;
    entry.attributes.forEach(e => {
      query += `, has ${e} $${e}`;
    });
    query += '; get;';
  }

  return query;
};

function parseSchema(path) {
  let text = fs.readFileSync(path, 'utf8')
  text = text.replace('define', '');
  text = text.replace(/(\r\n|\n|\r)/gm, '');
  let arr = text.split(';');
  arr = arr.map(e => {
    e = e.split(',');
    return e = e.map(f => {
      return f.replace(/^\s+|\s+$/g, "");
    });
  });
  
  let edgeAttr = [];
  let nodeAttr = [];
  arr = arr.map(e => {
    e = returnTypeWithAttributes(e);
    if (!e) return;
      if (e.type == 'relation')
        edgeAttr.push(e.attributes);
      if (e.type == 'entity')
        nodeAttr.push(e.attributes);
    return e;
  });

  arr = arr.filter(function( element ) {
    return element !== undefined;
  });
  
  arr = arr.map(e => {
    e.query = getQuery(e);
    return e;
  });

  return { all: arr, combined: { edge: _.union(...edgeAttr), node: _.union(...nodeAttr) } };
};

async function runBasicQueries(arr, query, type, options, entities, relations) {
  let client = new grakn(`${options.host}:${options.port}`);
  if (options.username && options.password)
    client = new grakn(`${options.host}:${options.port}`, { 'username': options.username, 'password': options.password });
  const session = await client.session(options.keyspace);

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

module.exports = {parseSchema, runBasicQueries};
