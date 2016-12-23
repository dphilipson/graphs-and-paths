export type NodeId = string | number;
export type EdgeId = string | number;

export interface SimpleNode {
    id: NodeId;
    location: Location;
}

export interface SimpleEdge {
    id: EdgeId;
    startNodeId: NodeId;
    endNodeId: NodeId;
    innerLocations?: Location[];
}

export interface Node extends SimpleNode {
    edgeIds: EdgeId[];
}

export interface Edge extends SimpleEdge {
    length: number;
    innerLocations: Location[];
}

export interface Location {
    x: number;
    y: number;
}

export interface EdgePoint {
    edgeId: EdgeId;
    distance: number;
}

export interface OrientedEdge {
    edge: Edge;
    isForward: boolean;
}

export interface Path {
    start: EdgePoint;
    end: EdgePoint;
    orientedEdges: OrientedEdge[];
    nodes: Node[];
    length: number;
}
