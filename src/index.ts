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

export default class Graph {
    private readonly nodesById: Map<NodeId, Node>;
    private readonly edgesById: Map<EdgeId, Edge>;

    public constructor(nodes: SimpleNode[], edges: SimpleEdge[]) {
        const nodesById = new Map<NodeId, Node>();
        const edgesById = new Map<EdgeId, Edge>();
        nodes.forEach((node) => {
            const { id, location } = node;
            if (nodesById.has(id)) {
                throw new Error(`Multiple nodes with ID ${id}`);
            }
            nodesById.set(id, { id, location, edgeIds: [] });
        });
        edges.forEach((edge) => {
            const { id, startNodeId, endNodeId, innerLocations: maybeInnerLocations } = edge;
            if (edgesById.has(id)) {
                throw new Error(`Multiple edges with ID ${id}`);
            }
            const innerLocations = maybeInnerLocations || [];
            const start = nodesById.get(startNodeId);
            if (start == null) {
                throw new Error(`Edge with ID ${id} referenced nonexistent start node ID ${startNodeId}`);
            }
            const end = nodesById.get(endNodeId);
            if (end == null) {
                throw new Error(`Edge with ID ${id} referenced nonexistent end node ID ${endNodeId}`);
            }
            const startLocation = start.location;
            const endLocation = end.location;
            const path = [startLocation, ...innerLocations, endLocation];
            const length = pathLength(path);
            start.edgeIds.push(id);
            end.edgeIds.push(id);
            edgesById.set(id, { id, startNodeId, endNodeId, length, innerLocations });
        });
        this.nodesById = nodesById;
        this.edgesById = edgesById;
    }

    public getAllNodes(): Node[] {
        return Array.from(this.nodesById.values());
    }

    public getAllEdges(): Edge[] {
        return Array.from(this.edgesById.values());
    }

    public getNode(nodeId: NodeId): Node {
        return this.nodesById.get(nodeId);
    }

    public getEdge(edgeId: EdgeId): Edge {
        return this.edgesById.get(edgeId);
    }

    public getEdgesOfNode(nodeId: NodeId): Edge[] {
        return unimplemented();
    }

    public getEndpointsOfEdge(edgeId: EdgeId): [Node, Node] {
        return unimplemented();
    }

    public getOtherEndpoint(edgeId: EdgeId, nodeId: NodeId): Node {
        return unimplemented();
    }

    public getNeighbors(nodeId: NodeId): Node[] {
        return unimplemented();
    }
    public getLocation(edgePoint: EdgePoint): Location {
        return unimplemented();
    }
}

function distance(location1: Location, location2: Location): number {
    const dx = location2.x - location1.x;
    const dy = location2.y - location1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function pathLength(path: Location[]): number {
    if (path.length === 0) {
        return 0;
    } else {
        let sum = 0;
        for (let i = 0, limit = path.length - 1; i < limit; i++) {
            sum += distance(path[i], path[i + 1]);
        }
        return sum;
    }
}

function unimplemented(): never {
    throw new Error("Not yet implemented");
}
