import Graph from "../src/graph";
import { SimpleEdge, SimpleNode } from "../src/types";

export function getSingleNode(): Graph {
    const node = { id: 0, location: { x: 0, y: 0 } };
    return Graph.create([node], []);
}

export function getTwoNodes(): Graph {
    const nodeA = { id: "A", location: { x: 0, y: 0 } };
    const nodeB = { id: "B", location: { x: 1, y: 0 } };
    const edgeAB = { id: "AB", startNodeId: "A", endNodeId: "B" };
    return Graph.create([nodeA, nodeB], [edgeAB]);
};

export function getTriangle(): Graph {
    const nodes: SimpleNode[] = [
        { id: "A", location: { x: 0, y: 0 } },
        { id: "B", location: { x: 1, y: 0 } },
        { id: "C", location: { x: 0, y: 1 } },
    ];
    const edges: SimpleEdge[] = [
        { id: "AB", startNodeId: "A", endNodeId: "B" },
        { id: "BC", startNodeId: "B", endNodeId: "C" },
        { id: "CA", startNodeId: "C", endNodeId: "A" },
    ];
    return Graph.create(nodes, edges);
}

export function getFourNodes(): Graph {
    const nodes: SimpleNode[] = [
        { id: "A", location: { x: 0, y: 0 } },
        { id: "B", location: { x: 1, y: 0 } },
        { id: "C", location: { x: 2, y: 0 } },
        { id: "D", location: { x: 3, y: 0 } },
    ];
    const edges: SimpleEdge[] = [
        { id: "AB", startNodeId: "A", endNodeId: "B" },
        { id: "BC", startNodeId: "B", endNodeId: "C" },
        { id: "CD", startNodeId: "C", endNodeId: "D" },
    ];
    return Graph.create(nodes, edges);
}
