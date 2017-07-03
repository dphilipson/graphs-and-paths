# Graphs and Paths

Tools for graphs representing 2-D spatial points and links between them.

[![Build
Status](https://travis-ci.org/dphilipson/graphs-and-paths.svg?branch=develop)](https://travis-ci.org/dphilipson/graphs-and-paths)

## Demo

[View the demo](https://dphilipson.github.io/graphs-and-paths-demo).

## Installation

With Yarn:
```
yarn add graphs-and-paths
```
With NPM:
```
npm install --save graphs-and-paths
```

## API

[View full documentation](https://dphilipson.github.io/graphs-and-paths).

## Sample Usage
``` javascript
import Graph from "graphs-and-paths";

const nodes = [
    { id: "A", location: { x: 0, y: 0 } },
    { id: "B", location: { x: 3, y: 0 } },
    { id: "C", location: { x: 0, y: 4 } }
];
const edges = [
    { id: "AB", startNodeId: "A", endNodeId: "B" },
    { id: "BC", startNodeId: "B", endNodeId: "C" },
    { id: "CA", startNodeId: "C", endNodeId: "A" }
];
const graph = Graph.create(nodes, edges);

graph.getNode("A");
// { id: "A", location: { x: 0, y: 0 }, edgeIds: ["AB", "CA"] }

graph.getLocation("AB", 2);
// { x: 2, y: 0 }

graph.getShortestPath(
    { edgeId: "CA", distance: 3 },
    { edgeId: "BC", distance: 1 }
).locations;
// [
//     { x: 0, y: 1 },
//     { x: 0, y: 0 },
//     { x: 3, y: 0 },
//     { x: 2.4, y: 0.8 }
// ]
```
Many more methods are available. [View full
documentation](https://dphilipson.github.io/graphs-and-paths) for details.

Copyright © 2016 David Philipson
