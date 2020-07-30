# grakn-to-gexf
> reads a grakn schema and converts it into a gexf file, compatible for gephi

## Requirements
`Node.JS >= 10`

## Installation
`git clone https://github.com/Langleu/grakn-to-gexf.git`

`cd grakn-to-gexf`

`npm i`

## Usage
`node index.js`

following parameters are available:
```
--output graph (path, output will automatically be .gexf)
--author grakn
--keyspace grakn
--schema schema.gql (path)
--host localhost
--port 48555
--username undefined (optional)
--password undefined (optional)
```

![docker](docker.svg)
