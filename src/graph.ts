import { getDistanceAlongPath, getPathLength, unimplemented } from "./math";
import {
    Edge,
    EdgeId,
    EdgePoint,
    Location,
    Node,
    NodeId,
    SimpleEdge,
    SimpleNode,
} from "./types";

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
            if (!start) {
                throw new Error(`Edge with ID ${id} referenced nonexistent start node ID ${startNodeId}`);
            }
            const end = nodesById.get(endNodeId);
            if (!end) {
                throw new Error(`Edge with ID ${id} referenced nonexistent end node ID ${endNodeId}`);
            }
            const startLocation = start.location;
            const endLocation = end.location;
            const path = [startLocation, ...innerLocations, endLocation];
            const length = getPathLength(path);
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
        return this.getNodeOrThrow(nodeId).edgeIds.map((edgeId) => this.getEdgeOrThrow(edgeId));
    }

    public getEndpointsOfEdge(edgeId: EdgeId): [Node, Node] {
        const { startNodeId, endNodeId } = this.getEdgeOrThrow(edgeId);
        return [this.getNodeOrThrow(startNodeId), this.getNodeOrThrow(endNodeId)];
    }

    public getOtherEndpoint(edgeId: EdgeId, nodeId: NodeId): Node {
        const edge = this.getEdgeOrThrow(edgeId);
        if (edge.startNodeId === nodeId) {
            return this.getNodeOrThrow(edge.endNodeId);
        } else if (edge.endNodeId === nodeId) {
            return this.getNodeOrThrow(edge.startNodeId);
        } else {
            throw new Error(`Node ${nodeId} is not an endpoint of edge ${edgeId}`);
        }
    }

    public getNeighbors(nodeId: NodeId): Node[] {
        return this.getNodeOrThrow(nodeId).edgeIds
            .map((edgeId) => this.getOtherEndpoint(edgeId, nodeId));
    }

    public getLocation(edgePoint: EdgePoint): Location {
        const { edgeId, distance } = edgePoint;
        const { length, innerLocations } = this.getEdgeOrThrow(edgeId);
        const [startNode, endNode] = this.getEndpointsOfEdge(edgeId);
        if (distance >= length) {
            return endNode.location;
        }
        const path = [startNode.location, ...innerLocations, endNode.location];
        return getDistanceAlongPath(path, distance);
    }

    private getNodeOrThrow(nodeId: NodeId): Node {
        const node = this.nodesById.get(nodeId);
        if (!node) {
            throw new Error(`Node ID ${nodeId} does not exist`);
        }
        return node;
    }

    private getEdgeOrThrow(edgeId: EdgeId): Edge {
        const edge = this.edgesById.get(edgeId);
        if (!edge) {
            throw new Error(`Edge ID ${edgeId} does not exist`);
        }
        return edge;
    }
}
