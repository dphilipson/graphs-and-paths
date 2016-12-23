import {
    Edge,
    EdgeId,
    EdgePoint,
    Location,
    Node,
    NodeId,
    OrientedEdge,
    SimpleEdge,
    SimpleNode,
} from "./types";
import {
    compareIds,
    flatMap,
    getLocationAlongPath,
    getPathLength,
    min,
    reversePath,
    unimplemented,
} from "./utils";

export default class Graph {
    public static create(nodes: SimpleNode[], edges: SimpleEdge[]): Graph {
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
        return new Graph(nodesById, edgesById);
    }

    private constructor(
        private readonly nodesById: Map<NodeId, Node>,
        private readonly edgesById: Map<EdgeId, Edge>,
    ) { }

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
        return getLocationAlongPath(path, distance);
    }

    public coalesced(): Graph {
        const remainingEdges = new Set(this.edgesById.values());
        const newNodesById = new Map(this.nodesById.entries());
        const newEdges: SimpleEdge[] = [];
        remainingEdges.forEach((edge) => {
            const forwardPath = this.getOnlyPath({ edge, isForward: true });
            const backwardsPath = this.getOnlyPath({ edge, isForward: false });
            const fullPath = [...reversePath(backwardsPath.slice(1)), ...forwardPath];
            if (fullPath.length === 1) {
                newEdges.push(edge);
            } else {
                const firstEdge = fullPath[0];
                const lastEdge = fullPath[fullPath.length - 1];
                const startNodeId = firstEdge.isForward ? firstEdge.edge.startNodeId : firstEdge.edge.endNodeId;
                const endNodeId = lastEdge.isForward ? lastEdge.edge.endNodeId : lastEdge.edge.startNodeId;
                const minEdgeId = min(fullPath.map((orientedEdge) => orientedEdge.edge.id), compareIds);
                const innerLocations = flatMap(fullPath, (pathEdge) => {
                    // Take the start node and inner locations from each edge,
                    // then slice off the first node after concatenating.
                    const {
                        edge: { startNodeId, endNodeId, innerLocations },
                        isForward,
                    } = pathEdge;
                    const firstNodeId = isForward ? startNodeId : endNodeId;
                    const orientedInnerLocations = isForward ? innerLocations : innerLocations.slice().reverse();
                    return [this.getNode(firstNodeId).location, ...orientedInnerLocations];
                }).slice(1);
                const newEdge: SimpleEdge = {
                    id: minEdgeId,
                    startNodeId,
                    endNodeId,
                    innerLocations,
                };
                const nodeIdsToDelete = flatMap(fullPath, (orientedEdge) => {
                    const { startNodeId, endNodeId } = orientedEdge.edge;
                    return [startNodeId, endNodeId];
                }).filter((nodeId) => nodeId !== startNodeId && nodeId !== endNodeId);
                const edgesSeen = fullPath.map((pathEdge) => pathEdge.edge);
                nodeIdsToDelete.forEach((nodeId) => newNodesById.delete(nodeId));
                edgesSeen.forEach((seenEdge) => remainingEdges.delete(seenEdge));
                newEdges.push(newEdge);
            }
        });
        return Graph.create(Array.from(newNodesById.values()), newEdges);
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

    /**
     * Starting from a given edge and direction, follows along consecutive
     * edges as long as there is only one way to do so, i.e. until reaching a
     * fork. Returns an array of the oriented edges seen, including the start
     * edge.
     * 
     * If the edge is part of an isolated loop (so no fork is found), then the
     * last element of the returned array will be the same as the first one.
     */
    private getOnlyPath(startEdge: OrientedEdge): OrientedEdge[] {
        const path: OrientedEdge[] = [];
        let currentEdge = startEdge;
        while (true) {
            path.push(currentEdge);
            const nextNodeId =
                currentEdge.isForward ? currentEdge.edge.endNodeId : currentEdge.edge.startNodeId;
            const nextNode = this.getNode(nextNodeId);
            if (nextNode.edgeIds.length !== 2) {
                return path;
            } else {
                const [edgeId1, edgeId2] = nextNode.edgeIds;
                const nextEdgeId = currentEdge.edge.id === edgeId1 ? edgeId2 : edgeId1;
                if (nextEdgeId === startEdge.edge.id) {
                    path.push(startEdge);
                    return path;
                }
                const nextEdge = this.getEdge(nextEdgeId);
                const isForward = nextEdge.startNodeId === nextNodeId;
                currentEdge = { edge: nextEdge, isForward };
            }
        }
    }
}
