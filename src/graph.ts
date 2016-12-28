import Heap = require("heap");
import rbush = require("rbush");
import knn = require("rbush-knn");
import {
    Edge,
    EdgeId,
    EdgePoint,
    Location,
    Node,
    NodeId,
    OrientedEdge,
    Path,
    SimpleEdge,
    SimpleNode,
} from "./types";
import * as Utils from "./utils";

interface MeshPoint {
    x: number;
    y: number;
    edgeId: EdgeId;
    locationIndex: number;
}

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
            const locations = [startLocation, ...innerLocations, endLocation];
            const locationDistances = Utils.getCumulativeDistances(locations);
            const length = Utils.last(locationDistances);
            start.edgeIds.push(id);
            end.edgeIds.push(id);
            edgesById.set(id, {
                id,
                startNodeId,
                endNodeId,
                innerLocations,
                length,
                locations,
                locationDistances,
            });
        });
        return new Graph(nodesById, edgesById);
    }

    public static distance(location1: Location, location2: Location): number {
        return Utils.distanceBetween(location1, location2);
    }

    public static advanceAlongLocations(locations: Location[], distance: number): Location[] {
        if (distance < 0) {
            throw new Error("Cannot advance path by negative distance");
        } else if (distance === 0) {
            return locations;
        } else {
            let remainingDistance = distance;
            let locationIndex = 0;
            while (locationIndex < locations.length - 1) {
                const segmentStart = locations[locationIndex];
                const segmentEnd = locations[locationIndex + 1];
                const segmentLength = Utils.distanceBetween(segmentStart, segmentEnd);
                if (remainingDistance < segmentLength) {
                    const newStartPoint = Utils.getIntermediateLocation(segmentStart, segmentEnd, remainingDistance);
                    return [newStartPoint, ...locations.slice(locationIndex + 1)];
                }
                locationIndex++;
                remainingDistance -= segmentLength;
            }
            return [Utils.last(locations)];
        }
    }

    private constructor(
        private readonly nodesById: Map<NodeId, Node>,
        private readonly edgesById: Map<EdgeId, Edge>,
        private readonly mesh?: rbush.RBush<MeshPoint>,
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
        const { length, locations, locationDistances } = this.getEdgeOrThrow(edgeId);
        const [startNode, endNode] = this.getEndpointsOfEdge(edgeId);
        if (distance < 0) {
            return startNode.location;
        } else if (distance >= length) {
            return endNode.location;
        } else {
            const i = Utils.findFloorIndex(locationDistances, distance);
            return Utils.getIntermediateLocation(locations[i], locations[i + 1], distance - locationDistances[i]);
        }
    }

    public coalesced(): Graph {
        const remainingEdgesById = new Map(this.edgesById.entries());
        const newNodesById = new Map(this.nodesById.entries());
        const newEdges: SimpleEdge[] = [];
        remainingEdgesById.forEach((edge) => {
            const path = this.getOnlyPath(edge);
            if (path.length === 1) {
                newEdges.push(edge);
            } else {
                const firstEdge = path[0];
                const lastEdge = Utils.last(path);
                const startNodeId = firstEdge.isForward ? firstEdge.edge.startNodeId : firstEdge.edge.endNodeId;
                const endNodeId = lastEdge.isForward ? lastEdge.edge.endNodeId : lastEdge.edge.startNodeId;
                const minEdgeId = Utils.min(path.map((pathEdge) => pathEdge.edge.id), Utils.compareIds);
                const allLocations = Utils.dedupeLocations(Utils.flatMap(path, (pathEdge) => {
                    const { edge: { locations }, isForward } = pathEdge;
                    return isForward ? locations : locations.slice().reverse();
                }));
                const innerLocations = allLocations.slice(1, allLocations.length - 1);
                const newEdge: SimpleEdge = {
                    id: minEdgeId,
                    startNodeId,
                    endNodeId,
                    innerLocations,
                };
                const nodeIdsToDelete = Utils.flatMap(
                    path,
                    (pathEdge) => [pathEdge.edge.startNodeId, pathEdge.edge.endNodeId],
                ).filter((nodeId) => nodeId !== startNodeId && nodeId !== endNodeId);
                const edgesSeen = path.map((pathEdge) => pathEdge.edge);
                // Maps allow deletion during iteration. Deleted entries are not iterated over,
                // which is what we want.
                nodeIdsToDelete.forEach((nodeId) => newNodesById.delete(nodeId));
                edgesSeen.forEach((seenEdge) => remainingEdgesById.delete(seenEdge.id));
                newEdges.push(newEdge);
            }
        });
        return Graph.create(Array.from(newNodesById.values()), newEdges);
    }

    public getConnectedComponents(): Graph[] {
        const nodesIdsSeen = new Set<NodeId>();
        const components: Graph[] = [];
        this.getAllNodes().forEach((node) => {
            if (!nodesIdsSeen.has(node.id)) {
                const component = this.getConnectedComponentOfNode(node.id);
                component.getAllNodes().forEach((n) => nodesIdsSeen.add(n.id));
                components.push(component);
            }
        });
        return components;
    }

    public getConnectedComponentOfNode(nodeId: NodeId): Graph {
        const startNode = this.getNodeOrThrow(nodeId);
        const nodesIdsSeen = new Set([startNode.id]);
        const edgeIds = new Set<EdgeId>();
        const pending = [startNode];
        while (pending.length > 0) {
            const currentNode = pending.pop() as Node; // Not undefined because we just checked the length.
            currentNode.edgeIds.forEach((edgeId) => edgeIds.add(edgeId));
            this.getNeighbors(currentNode.id).forEach((neighbor) => {
                if (!nodesIdsSeen.has(neighbor.id)) {
                    nodesIdsSeen.add(neighbor.id);
                    pending.push(neighbor);
                }
            });
        }
        // Filter from original nodes/edges to preserve their order.
        const nodes = this.getAllNodes().filter((n) => nodesIdsSeen.has(n.id));
        const edges = this.getAllEdges().filter((e) => edgeIds.has(e.id));
        return Graph.create(nodes, edges);
    }

    public getShortestPath(start: EdgePoint, end: EdgePoint): Path {
        // This is A*, modified to have two start nodes and two end nodes (the endpoints of the
        // respective edges).
        interface NodeIdWithCost {
            nodeId: NodeId | null; // null node ID represents the synthetic "goal" node.
            cost: number;
        }
        const startEdge = this.getEdgeOrThrow(start.edgeId);
        const endEdge = this.getEdgeOrThrow(end.edgeId);
        const doneNodeIds = new Set<NodeId>();
        const distancesFromStart = new Map<NodeId | null, number>();
        distancesFromStart.set(startEdge.startNodeId, start.distance);
        distancesFromStart.set(startEdge.endNodeId, startEdge.length - start.distance);
        const pendingNodes = new Heap<NodeIdWithCost>((node1, node2) => node1.cost - node2.cost);
        const endLocation = this.getLocation(end);
        const addNodeToPending = (node: Node) => pendingNodes.push({
            nodeId: node.id,
            cost: distancesFromStart.get(node.id) + Utils.distanceBetween(node.location, endLocation),
        });
        const cameFrom = new Map<NodeId, Edge>();
        let endEdgeIsForward = true;
        let endDistanceFromStart = Number.POSITIVE_INFINITY;
        addNodeToPending(this.getNodeOrThrow(startEdge.startNodeId));
        addNodeToPending(this.getNodeOrThrow(startEdge.endNodeId));
        while (!pendingNodes.empty()) {
            const currentNodeId = pendingNodes.pop().nodeId;
            if (currentNodeId == null) {
                return this.reconstructPath(start, end, cameFrom, endEdgeIsForward, endDistanceFromStart);
            } else {
                doneNodeIds.add(currentNodeId);
                const currentNodeDistance = distancesFromStart.get(currentNodeId);
                this.getEdgesOfNode(currentNodeId).forEach((edge) => {
                    const neighbor = this.getOtherEndpoint(edge.id, currentNodeId);
                    if (!doneNodeIds.has(neighbor.id)) {
                        const currentDistance = distancesFromStart.get(neighbor.id);
                        const newDistance = currentNodeDistance + edge.length;
                        if (currentDistance == null || newDistance < currentDistance) {
                            distancesFromStart.set(neighbor.id, newDistance);
                            cameFrom.set(neighbor.id, edge);
                            addNodeToPending(neighbor);
                        }
                    }
                });
                const handleEndpointOfGoal = (isGoalStartNode: boolean) => {
                    const addedDistance = isGoalStartNode ? end.distance : endEdge.length - end.distance;
                    const newDistance = currentNodeDistance + addedDistance;
                    if (newDistance < endDistanceFromStart) {
                        endDistanceFromStart = newDistance;
                        endEdgeIsForward = isGoalStartNode;
                        pendingNodes.push({ nodeId: null, cost: endDistanceFromStart });
                    }
                };
                if (currentNodeId === endEdge.startNodeId) {
                    handleEndpointOfGoal(true);
                }
                if (currentNodeId === endEdge.endNodeId) {
                    handleEndpointOfGoal(false);
                }
            }
        }
        throw new Error(`No path from starting edge ${start.edgeId} to ending edge ${end.edgeId}`);
    }

    /**
     * Returns a new path obtained by truncating the given path by the provided distance. That is,
     * the start point of the path moves forward, and any nodes and edges that it passes are
     * dropped.
     * 
     * Throws an error if distance is negative.
     */
    public advanceAlongPath(path: Path, distance: number): Path {
        const { start, end, orientedEdges, nodes, locations, length } = path;
        if (distance === 0) {
            return path;
        } else if (distance >= path.length) {
            return {
                start: end,
                end,
                orientedEdges: [Utils.last(orientedEdges)],
                nodes: [],
                locations: [Utils.last(path.locations)],
                length: 0,
            };
        } else if (distance < 0) {
            throw new Error("Cannot advance path by a negative distance");
        } else {
            const {
                edge: startEdge,
                isForward: isStartEdgeForward,
            } = orientedEdges[0];
            const orientedStartDistance = isStartEdgeForward
                ? start.distance
                : startEdge.length - start.distance;
            let distanceRemaining = distance + orientedStartDistance;
            let edgeIndex = 0;
            while (distanceRemaining > orientedEdges[edgeIndex].edge.length) {
                distanceRemaining -= orientedEdges[edgeIndex].edge.length;
                edgeIndex++;
            }
            const newStartEdge = orientedEdges[edgeIndex];
            const distanceDownEdge = newStartEdge.isForward
                ? distanceRemaining
                : newStartEdge.edge.length - distanceRemaining;
            return {
                start: { edgeId: newStartEdge.edge.id, distance: distanceDownEdge },
                end,
                orientedEdges: orientedEdges.slice(edgeIndex),
                nodes: nodes.slice(edgeIndex),
                locations: Graph.advanceAlongLocations(locations, distance),
                length: length - distance,
            };
        }
    }

    public withClosestPointMesh(precision: number): Graph {
        const meshPoints: MeshPoint[] = [];
        // For each node, choose an arbitrary edge to hold the mesh point.
        this.getAllNodes().forEach((node) => {
            const { edgeIds, location: { x, y } } = node;
            if (edgeIds.length > 0) {
                const {id: edgeId, startNodeId, locations} = this.getEdge(edgeIds[0]);
                const locationIndex = startNodeId === node.id ? 0 : locations.length - 2;
                meshPoints.push({ x, y, edgeId, locationIndex });
            }
        });
        this.getAllEdges().forEach((edge) => {
            const { id: edgeId, length, locationDistances } = edge;
            const numSegments = Math.ceil(length / precision);
            const stepDistance = length / numSegments;
            for (let i = 1; i < numSegments; i++) {
                const distance = i * stepDistance;
                const { x, y } = this.getLocation({ edgeId, distance });
                const locationIndex = Utils.findFloorIndex(locationDistances, distance);
                meshPoints.push({ x, y, edgeId, locationIndex });
            }
        });
        const tree = rbush<MeshPoint>(9, [".x", ".y", ".x", ".y"])
            .load(meshPoints);
        return new Graph(this.nodesById, this.edgesById, tree);
    }

    public getClosestPoint(location: Location): EdgePoint {
        if (this.mesh) {
            return this.getClosestPointWithMesh(location, this.mesh);
        } else {
            console.warn(
                "getClosestPoint() called on Graph without precomputed mesh. For improved performance, call"
                + " .withClosestPointMesh() to get a new optimized graph.");
            return this.getClosestPointWithoutMesh(location);
        }
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
     * Starting from a given edge, follow along consecutive edges in both
     * directions as long as there is only one way to do so, i.e. until
     * reaching a fork. Returns an array of the edges seen, oriented so that
     * the start edge is oriented forward.
     * 
     * In the case of an isolated loop, the returned path will begin and end at
     * the start node of the provided edge.
     */
    private getOnlyPath(edge: Edge): OrientedEdge[] {
        const forwardPath = this.getOnlyPathInDirection({ edge, isForward: true });
        if (forwardPath.length > 1 && forwardPath[0] === Utils.last(forwardPath)) {
            // We are in a loop.
            return forwardPath.slice(0, forwardPath.length - 1);
        } else {
            const backwardsPath = this.getOnlyPathInDirection({ edge, isForward: false });
            return [...Utils.reversePath(backwardsPath.slice(1)), ...forwardPath];
        }
    }

    /**
     * Like getOnlyPath(), but only in one direction. The returned path will
     * start with the provided edge in and proceed in the direction specified.
     * 
     * If the edge is part of an isolated loop (so no fork is found), then the
     * last element of the returned array will be the same as the first one.
     */
    private getOnlyPathInDirection(startEdge: OrientedEdge): OrientedEdge[] {
        const path: OrientedEdge[] = [];
        let currentEdge = startEdge;
        while (true) {
            path.push(currentEdge);
            const nextNodeId =
                currentEdge.isForward ? currentEdge.edge.endNodeId : currentEdge.edge.startNodeId;
            const nextNode = this.getNodeOrThrow(nextNodeId);
            if (nextNode.edgeIds.length !== 2) {
                return path;
            } else {
                const [edgeId1, edgeId2] = nextNode.edgeIds;
                const nextEdgeId = currentEdge.edge.id === edgeId1 ? edgeId2 : edgeId1;
                if (nextEdgeId === startEdge.edge.id) {
                    path.push(startEdge);
                    return path;
                }
                const nextEdge = this.getEdgeOrThrow(nextEdgeId);
                const isForward = nextEdge.startNodeId === nextNodeId;
                currentEdge = { edge: nextEdge, isForward };
            }
        }
    }

    private reconstructPath(
        start: EdgePoint,
        end: EdgePoint,
        cameFrom: Map<NodeId, Edge>,
        endEdgeIsForward: boolean,
        length: number,
    ): Path {
        if (start.edgeId === end.edgeId && Math.abs(start.distance - end.distance) <= length) {
            // Handle special case of start and end on same edge.
            return this.getShortestPathOnSameEdge(start, end);
        } else {
            const endEdge = this.getEdgeOrThrow(end.edgeId);
            // Build nodes, oriented edge, and location lists starting from end, then reverse.
            const orientedEdges: OrientedEdge[] = [{
                edge: endEdge,
                isForward: endEdgeIsForward,
            }];
            const nodes: Node[] = [];
            const locations: Location[] = this.getLocationsOnEdgeInterval(
                end.edgeId,
                end.distance,
                endEdgeIsForward ? 0 : this.getEdgeOrThrow(end.edgeId).length,
            );
            let currentNodeId = endEdgeIsForward ? endEdge.startNodeId : endEdge.endNodeId;
            while (true) {
                nodes.push(this.getNodeOrThrow(currentNodeId));
                const currentEdge = cameFrom.get(currentNodeId);
                if (currentEdge == null) {
                    break;
                } else {
                    const isForward = currentEdge.endNodeId === currentNodeId;
                    orientedEdges.push({ edge: currentEdge, isForward });
                    const newLocations = isForward ? currentEdge.locations.slice().reverse() : currentEdge.locations;
                    Utils.pushAll(locations, newLocations);
                    currentNodeId = this.getOtherEndpoint(currentEdge.id, currentNodeId).id;
                }
            }
            const startEdge = this.getEdgeOrThrow(start.edgeId);
            const startEdgeIsForward = (() => {
                if (startEdge.startNodeId === startEdge.endNodeId) {
                    return start.distance < startEdge.length / 2;
                } else {
                    return currentNodeId === startEdge.endNodeId;
                }
            })();
            orientedEdges.push({ edge: startEdge, isForward: startEdgeIsForward });
            Utils.pushAll(locations, this.getLocationsOnEdgeInterval(
                start.edgeId,
                startEdgeIsForward ? this.getEdgeOrThrow(start.edgeId).length : 0,
                start.distance,
            ));
            return {
                start,
                end,
                orientedEdges: orientedEdges.reverse(),
                nodes: nodes.reverse(),
                locations: Utils.dedupeLocations(locations).reverse(),
                length,
            };
        }
    }

    private getShortestPathOnSameEdge(start: EdgePoint, end: EdgePoint): Path {
        const orientedEdge: OrientedEdge = {
            edge: this.getEdgeOrThrow(start.edgeId),
            isForward: start.distance <= end.distance,
        };
        return {
            start,
            end,
            orientedEdges: [orientedEdge],
            nodes: [],
            locations: this.getLocationsOnEdgeInterval(start.edgeId, start.distance, end.distance),
            length: Math.abs(start.distance - end.distance),
        };
    }

    private getLocationsOnEdgeInterval(edgeId: EdgeId, startDistance: number, endDistance: number): Location[] {
        if (startDistance === endDistance) {
            return [this.getLocation({ edgeId, distance: startDistance })];
        } else {
            const { locations, locationDistances } = this.getEdgeOrThrow(edgeId);
            const minDistance = Math.min(startDistance, endDistance);
            const maxDistance = Math.max(startDistance, endDistance);
            const minLocationIndex = Utils.findFloorIndex(locationDistances, minDistance);
            const maxLocationIndex = Utils.findFloorIndex(locationDistances, maxDistance);
            const startLocation = this.getLocation({ edgeId, distance: startDistance });
            const endLocation = this.getLocation({ edgeId, distance: endDistance });
            const intermediateLocations = locations.slice(minLocationIndex + 1, maxLocationIndex + 1);
            if (endDistance < startDistance) {
                intermediateLocations.reverse();
            }
            return Utils.dedupeLocations([startLocation, ...intermediateLocations, endLocation]);
        }
    }

    private getClosestPointWithMesh(location: Location, mesh: rbush.RBush<MeshPoint>): EdgePoint {
        const { x, y } = location;
        const [{ edgeId, locationIndex }] = knn(mesh, x, y, 1);
        const { locations, locationDistances } = this.getEdgeOrThrow(edgeId);
        const { distanceDownSegment } =
            Utils.closestPointOnSegment(location, locations[locationIndex], locations[locationIndex + 1]);
        return { edgeId, distance: locationDistances[locationIndex] + distanceDownSegment };
    }

    private getClosestPointWithoutMesh(location: Location): EdgePoint {
        let bestPoint: EdgePoint | null = null;
        let bestDistance: number = Number.POSITIVE_INFINITY;
        this.getAllEdges().forEach((edge) => {
            const { locations, locationDistances } = edge;
            for (let i = 0, limit = locations.length - 1; i < limit; i++) {
                const {
                    distanceDownSegment,
                    distanceFromLocation,
                } = Utils.closestPointOnSegment(location, locations[i], locations[i + 1]);
                if (distanceFromLocation < bestDistance) {
                    bestDistance = distanceFromLocation;
                    bestPoint = {
                        edgeId: edge.id,
                        distance: locationDistances[i] + distanceDownSegment,
                    };
                }
            }
        });
        if (bestPoint == null) {
            throw new Error("Cannot find closest edge point on graph with no edges");
        }
        return bestPoint;
    }
}
