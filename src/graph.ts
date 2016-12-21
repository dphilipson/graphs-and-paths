import { compareIds, getLocationAlongPath, getPathLength, unimplemented } from "./math";
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
        const nodes = this.getAllNodes();
        const newNodes = new Set(this.nodesById.values());
        const newEdges = new Set<SimpleEdge>(this.edgesById.values());
        const clearIntermediateNode = (node: Node) => {
            newNodes.delete(node);
            newEdges.delete(this.getEdge(node.edgeIds[0]));
            newEdges.delete(this.getEdge(node.edgeIds[1]));
        };
        newNodes.forEach((node) => {
            if (node.edgeIds.length === 2) {
                // It is permitted to delete elements of a Map while iterating over it.
                clearIntermediateNode(node);
                let minEdgeId = node.edgeIds[0];
                const refineMinEdgeId = (edgeId: EdgeId) => {
                    if (compareIds(edgeId, minEdgeId) < 0) {
                        minEdgeId = edgeId;
                    }
                };
                const followDownPath = (firstNode: Node) => {
                    let currentNode = firstNode;
                    let lastNode = node;
                    const nodesAlongPath = [currentNode];
                    while (currentNode.edgeIds.length === 2) {
                        const [edgeId1, edgeId2] = currentNode.edgeIds;
                        refineMinEdgeId(edgeId1);
                        refineMinEdgeId(edgeId2);
                        clearIntermediateNode(currentNode);
                        const edge1Endpoint = this.getOtherEndpoint(edgeId1, currentNode.id);
                        const nextNode = edge1Endpoint === lastNode
                            ? this.getOtherEndpoint(edgeId2, currentNode.id)
                            : edge1Endpoint;
                        nodesAlongPath.push(nextNode);
                        lastNode = currentNode;
                        currentNode = nextNode;
                    }
                    return nodesAlongPath;
                };
                const path1 = followDownPath(this.getOtherEndpoint(node.edgeIds[0], node.id));
                const path2 = followDownPath(this.getOtherEndpoint(node.edgeIds[1], node.id));
                const isPath1First = compareIds(path1[path1.length - 1].id, path2[path2.length - 1].id) < 0;
                const startPath = isPath1First ? path1 : path2;
                const endPath = isPath1First ? path2 : path1;
                const startNodeId = startPath[startPath.length - 1].id;
                const endNodeId = endPath[endPath.length - 1].id;
                const innerLocations = [
                    ...startPath.reverse().slice(1),
                    node,
                    ...endPath.slice(0, endPath.length - 1),
                ].map((n) => n.location);
                const coalescedEdge: SimpleEdge = {
                    id: minEdgeId,
                    startNodeId,
                    endNodeId,
                    innerLocations,
                };
                newEdges.add(coalescedEdge);
            }
        });
        return Graph.create(Array.from(newNodes), Array.from(newEdges));
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
