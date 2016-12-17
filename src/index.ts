export type NodeId = number | string;


export interface Graph {
    nodes: Node[];
    edges: Edge[];
}

export interface Node {
    id: NodeId;
    location: Point;
}

export interface Edge {
    startNode: NodeId;
    endNode: NodeId;
    innerPoints?: Point[];
}

export interface Point {
    x: number;
    y: number;
}

export interface Destination {
    edgeIndex: number;
    distance: number;
}

export default function shortestPath(graph: Graph, start: Destination, end: Destination): NodeId[] {
    return [];
}
