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

/**
 * Items stored in the RBush tree for quick closest-point retrieval.
 */
interface MeshPoint {
    x: number;
    y: number;
    edgeId: EdgeId;
    locationIndex: number;
}

/**
 * A graph composed of [[Node]]s and [[Edge]]s, representing 2-D spatial points and links between
 * them. Provides methods for reading and analyzing its data.
 *
 * The graph and all its data are immutable. No method will modify the `Graph` instance on which it
 * is called, although some will return new instances.
 *
 * New `Graph` instances are created using [[Graph.create]], which takes [[SimpleNode]]s and
 * [[SimpleEdge]]s as arguments. Upon construction, the graph creates corresponding [[Node]] and
 * [[Edge]] instances which contain additional information. All `Graph` methods will return these
 * `Node`s rather than the original `SimpleNode`s, and likewise for edges.
 *
 * Example usage:
 * ``` javascript
 * import Graph from "graphs-and-paths";
 *
 * const nodes = [
 *     { id: "A", location: { x: 0, y: 0 } },
 *     { id: "B", location: { x: 3, y: 0 } },
 *     { id: "C", location: { x: 0, y: 4 } }
 * ];
 * const edges = [
 *     { id: "AB", startNodeId: "A", endNodeId: "B" },
 *     { id: "BC", startNodeId: "B", endNodeId: "C" },
 *     { id: "CA", startNodeId: "C", endNodeId: "A" }
 * ];
 * const graph = Graph.create(nodes, edges);
 *
 * graph.getNode("A");
 * // { id: "A", location: { x: 0, y: 0 }, edgeIds: ["AB", "CA"] }
 *
 * graph.getLocation("AB", 2);
 * // { x: 2, y: 0 }
 *
 * graph.getShortestPath(
 *     { edgeId: "CA", distance: 3 },
 *     { edgeId: "BC", distance: 1 }
 * ).locations;
 * // [
 * //     { x: 0, y: 1 },
 * //     { x: 0, y: 0 },
 * //     { x: 3, y: 0 },
 * //     { x: 2.4, y: 0.8 }
 * // ]
 * ```
 */
export default class Graph {
    /**
     * @param nodes A list of nodes.
     * @param edges A list of edges.
     * @returns A new `Graph` instance with the specified nodes and edges.
     */
    public static create(nodes: SimpleNode[], edges: SimpleEdge[]): Graph {
        const nodesById = new Map<NodeId, Node>();
        const edgesById = new Map<EdgeId, Edge>();
        nodes.forEach(node => {
            const { id, location } = node;
            if (nodesById.has(id)) {
                throw new Error(`Multiple nodes with ID ${id}`);
            }
            nodesById.set(id, { id, location, edgeIds: [] });
        });
        edges.forEach(edge => {
            const {
                id,
                startNodeId,
                endNodeId,
                innerLocations: maybeInnerLocations,
            } = edge;
            if (edgesById.has(id)) {
                throw new Error(`Multiple edges with ID ${id}`);
            }
            const innerLocations = maybeInnerLocations || [];
            const start = nodesById.get(startNodeId);
            if (!start) {
                throw new Error(
                    `Edge with ID ${id} referenced nonexistent start node ID ${startNodeId}`,
                );
            }
            const end = nodesById.get(endNodeId);
            if (!end) {
                throw new Error(
                    `Edge with ID ${id} referenced nonexistent end node ID ${endNodeId}`,
                );
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

    /**
     * @param location1 A location.
     * @param location2 Another location.
     * @returns The straight-line distance between `location1` and `location2`.
     */
    public static distance(location1: Location, location2: Location): number {
        return Utils.distanceBetween(location1, location2);
    }

    /**
     * Helper function for computing progress down a path after advancing along it for a given
     * distance. If the distance is greater than the total length of the path, then advances to
     * the end of the path. Throws on negative distances.
     *
     * @param locations A list of locations representing a path.
     * @param distance A distance down the path.
     * @returns A new list of locations representing the remaining part of `locations` after
     *          advancing `distance` along the path.
     */
    public static advanceAlongLocations(
        locations: Location[],
        distance: number,
    ): Location[] {
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
                const segmentLength = Utils.distanceBetween(
                    segmentStart,
                    segmentEnd,
                );
                if (remainingDistance < segmentLength) {
                    const newStartPoint = Utils.getIntermediateLocation(
                        segmentStart,
                        segmentEnd,
                        remainingDistance,
                    );
                    return [
                        newStartPoint,
                        ...locations.slice(locationIndex + 1),
                    ];
                }
                locationIndex++;
                remainingDistance -= segmentLength;
            }
            return [Utils.last(locations)];
        }
    }

    /**
     * Returns a new path obtained by truncating the given path by the provided distance. That is,
     * the start point of the path moves forward, and any nodes and edges that it passes are
     * dropped. Throws an error if distance is negative.
     *
     * @param path A path.
     * @param distance A distance to travel along the path.
     * @returns The remaining portion of `path` after traveling `distance` along it.
     */
    public static advanceAlongPath(path: Path, distance: number): Path {
        const { start, end, orientedEdges, nodes, locations, length } = path;
        if (distance === 0) {
            return path;
        } else if (distance >= length) {
            return Graph.getFinishedPath(path);
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
            while (distanceRemaining >= orientedEdges[edgeIndex].edge.length) {
                distanceRemaining -= orientedEdges[edgeIndex].edge.length;
                edgeIndex++;
                if (edgeIndex >= orientedEdges.length) {
                    // Only possible through floating-point imprecision because of earlier check
                    // against total distance. I'm not even sure this case is possible, but better
                    // safe than sorry.
                    return Graph.getFinishedPath(path);
                }
            }
            const newStartEdge = orientedEdges[edgeIndex];
            const distanceDownEdge = newStartEdge.isForward
                ? distanceRemaining
                : newStartEdge.edge.length - distanceRemaining;
            return {
                start: {
                    edgeId: newStartEdge.edge.id,
                    distance: distanceDownEdge,
                },
                end,
                orientedEdges: orientedEdges.slice(edgeIndex),
                nodes: nodes.slice(edgeIndex),
                locations: Graph.advanceAlongLocations(locations, distance),
                length: length - distance,
            };
        }
    }

    /**
     * Returns the path obtained when advancing the given path all the way to the end.
     */
    private static getFinishedPath(path: Path): Path {
        const { end, orientedEdges, locations } = path;
        return {
            start: end,
            end,
            orientedEdges: [Utils.last(orientedEdges)],
            nodes: [],
            locations: [Utils.last(locations)],
            length: 0,
        };
    }

    /**
     * Removes zero-length segments at the start and end of the path caused by the ambiguity of
     * representing a Node location with an EdgePoint.
     */
    private static canonicalizePath(path: Path): Path {
        const { start, end, orientedEdges, nodes } = path;
        if (path.orientedEdges.length === 1) {
            return path;
        }
        const firstEdge = orientedEdges[0];
        const lastEdge = Utils.last(orientedEdges);
        const firstEdgeIsTrivial =
            (firstEdge.isForward && start.distance >= firstEdge.edge.length) ||
            (!firstEdge.isForward && start.distance <= 0);
        const lastEdgeIsTrivial =
            (lastEdge.isForward && end.distance <= 0) ||
            (!lastEdge.isForward && end.distance >= lastEdge.edge.length);
        if (firstEdgeIsTrivial && lastEdgeIsTrivial && nodes.length === 1) {
            return {
                ...path,
                start: end,
                end,
                nodes: [],
                orientedEdges: [Utils.last(orientedEdges)],
            };
        } else if (firstEdgeIsTrivial || lastEdgeIsTrivial) {
            const newStart: EdgePoint = (() => {
                if (firstEdgeIsTrivial) {
                    const secondEdge = orientedEdges[1];
                    return {
                        edgeId: secondEdge.edge.id,
                        distance: secondEdge.isForward
                            ? 0
                            : secondEdge.edge.length,
                    };
                } else {
                    return start;
                }
            })();
            const newEnd: EdgePoint = (() => {
                if (lastEdgeIsTrivial) {
                    const secondLastEdge =
                        orientedEdges[orientedEdges.length - 2];
                    return {
                        edgeId: secondLastEdge.edge.id,
                        distance: secondLastEdge.isForward
                            ? secondLastEdge.edge.length
                            : 0,
                    };
                } else {
                    return end;
                }
            })();
            const slice = <T>(xs: T[]): T[] =>
                xs.slice(
                    firstEdgeIsTrivial ? 1 : 0,
                    lastEdgeIsTrivial ? xs.length - 1 : xs.length,
                );
            return {
                ...path,
                start: newStart,
                end: newEnd,
                orientedEdges: slice(orientedEdges),
                nodes: slice(nodes),
            };
        } else {
            return path;
        }
    }

    private constructor(
        private readonly nodesById: Map<NodeId, Node>,
        private readonly edgesById: Map<EdgeId, Edge>,
        private readonly mesh?: rbush.RBush<MeshPoint>,
    ) {}

    /**
     * @returns All the nodes present in this graph, in the order that they were originally provided
     *          to [[Graph.create]].
     */
    public getAllNodes(): Node[] {
        return Array.from(this.nodesById.values());
    }

    /**
     * @returns All the edges present in this graph, in the order that they were originally provided
     *          to [[Graph.create]].
     */
    public getAllEdges(): Edge[] {
        return Array.from(this.edgesById.values());
    }

    /**
     * @param nodeId A node ID.
     * @returns The `Node` associated with the given ID, or `undefined` if none exists. Note that
     *          the type signature is a lie (it does not claim to be nullable), but this is
     *          consistent with other lookup methods such as keyed-indexing.
     */
    public getNode(nodeId: NodeId): Node {
        return this.nodesById.get(nodeId);
    }

    /**
     * @param edgeId An edge ID.
     * @returns The `Edge` associated with the given ID, or `undefined` if none exists. Note that
     *          the type signature is a lie (it does not claim to be nullable), but this is
     *          consistent with other lookup methods such as keyed-indexing.
     */
    public getEdge(edgeId: EdgeId): Edge {
        return this.edgesById.get(edgeId);
    }

    /**
     * @param nodeId A node ID.
     * @returns All edges which have the node with the given ID as an endpoint.
     */
    public getEdgesOfNode(nodeId: NodeId): Edge[] {
        return this.getNodeOrThrow(nodeId).edgeIds.map(edgeId =>
            this.getEdgeOrThrow(edgeId),
        );
    }

    /**
     * @param edgeId An edge ID.
     * @returns The two nodes which are endpoints of the edge with the given ID.
     */
    public getEndpointsOfEdge(edgeId: EdgeId): [Node, Node] {
        const { startNodeId, endNodeId } = this.getEdgeOrThrow(edgeId);
        return [
            this.getNodeOrThrow(startNodeId),
            this.getNodeOrThrow(endNodeId),
        ];
    }

    /**
     * Given an edge and one of its endpoints, return the other endpoint. Throws if either of the
     * IDs is nonexistent, or if the node is not an endpoint of the edge.
     *
     * @param edgeId An edge ID.
     * @param nodeId A node ID, referencing one of the endpoints of the edge.
     * @returns The node which is the other endpoint of the edge with the given ID.
     */
    public getOtherEndpoint(edgeId: EdgeId, nodeId: NodeId): Node {
        const edge = this.getEdgeOrThrow(edgeId);
        if (edge.startNodeId === nodeId) {
            return this.getNodeOrThrow(edge.endNodeId);
        } else if (edge.endNodeId === nodeId) {
            return this.getNodeOrThrow(edge.startNodeId);
        } else {
            throw new Error(
                `Node ${nodeId} is not an endpoint of edge ${edgeId}`,
            );
        }
    }

    /**
     * @param nodeId A node ID.
     * @return All nodes which are connected to the node with the given ID by an edge.
     */
    public getNeighbors(nodeId: NodeId): Node[] {
        return this.getNodeOrThrow(nodeId).edgeIds.map(edgeId =>
            this.getOtherEndpoint(edgeId, nodeId),
        );
    }

    /**
     * Returns the Cartesian coordinates of the point a certain distance along an edge. Does not
     * throw on out-of-bounds distances. Instead negative distances return the start of the edge
     * and distances greater than the length return the end of the edge. This is to avoid unexpected
     * behavior due to floating-point imprecision issues.
     *
     * @param edgePoint A point specified as a certain distance along an edge.
     * @return The Cartesian coordinates of the given point.
     */
    public getLocation(edgePoint: EdgePoint): Location {
        const { edgeId, distance } = edgePoint;
        const { length, locations, locationDistances } = this.getEdgeOrThrow(
            edgeId,
        );
        const [startNode, endNode] = this.getEndpointsOfEdge(edgeId);
        if (distance < 0) {
            return startNode.location;
        } else if (distance >= length) {
            return endNode.location;
        } else {
            const i = Utils.findFloorIndex(locationDistances, distance);
            return Utils.getIntermediateLocation(
                locations[i],
                locations[i + 1],
                distance - locationDistances[i],
            );
        }
    }

    /**
     * Creates a new `Graph` instance with the same shape but with a reduced number of nodes and
     * edges. Each instance of multiple nodes and edges in a chain with no forks is converted into a
     * single edge, where the removed nodes are converted into inner locations of the new edge. In
     * particular, the new graph will have no nodes of degree 2 except for nodes with only one edge
     * connecting to themselves. This may significantly increase the speed of certain calculations,
     * such as [[getShortestPath]].
     *
     * A newly created edge will have the lowest ID of the edges which were combined to form it,
     * where numbers are considered lower than strings.
     *
     * @returns A new coalesced `Graph` instance.
     */
    public coalesced(): Graph {
        const remainingEdgesById = new Map(this.edgesById.entries());
        const newNodesById = new Map(this.nodesById.entries());
        const newEdges: SimpleEdge[] = [];
        remainingEdgesById.forEach(edge => {
            const path = this.getOnlyPath(edge);
            if (path.length === 1) {
                newEdges.push(edge);
            } else {
                const firstEdge = path[0];
                const lastEdge = Utils.last(path);
                const startNodeId = firstEdge.isForward
                    ? firstEdge.edge.startNodeId
                    : firstEdge.edge.endNodeId;
                const endNodeId = lastEdge.isForward
                    ? lastEdge.edge.endNodeId
                    : lastEdge.edge.startNodeId;
                const minEdgeId = Utils.min(
                    path.map(pathEdge => pathEdge.edge.id),
                    Utils.compareIds,
                );
                const allLocations = Utils.dedupeLocations(
                    Utils.flatMap(path, pathEdge => {
                        const { edge: { locations }, isForward } = pathEdge;
                        return isForward
                            ? locations
                            : locations.slice().reverse();
                    }),
                );
                const innerLocations = allLocations.slice(
                    1,
                    allLocations.length - 1,
                );
                const newEdge: SimpleEdge = {
                    id: minEdgeId,
                    startNodeId,
                    endNodeId,
                    innerLocations,
                };
                const nodeIdsToDelete = Utils.flatMap(path, pathEdge => [
                    pathEdge.edge.startNodeId,
                    pathEdge.edge.endNodeId,
                ]).filter(
                    nodeId => nodeId !== startNodeId && nodeId !== endNodeId,
                );
                const edgesSeen = path.map(pathEdge => pathEdge.edge);
                // Maps allow deletion during iteration. Deleted entries are not iterated over,
                // which is what we want.
                nodeIdsToDelete.forEach(nodeId => newNodesById.delete(nodeId));
                edgesSeen.forEach(seenEdge =>
                    remainingEdgesById.delete(seenEdge.id),
                );
                newEdges.push(newEdge);
            }
        });
        return Graph.create(Array.from(newNodesById.values()), newEdges);
    }

    /**
     * @returns A list of new `Graph` instances, each representing a single connected component of
     *          this instance.
     */
    public getConnectedComponents(): Graph[] {
        const nodesIdsSeen = new Set<NodeId>();
        const components: Graph[] = [];
        this.getAllNodes().forEach(node => {
            if (!nodesIdsSeen.has(node.id)) {
                const component = this.getConnectedComponentOfNode(node.id);
                component.getAllNodes().forEach(n => nodesIdsSeen.add(n.id));
                components.push(component);
            }
        });
        return components;
    }

    /**
     * @param nodeId A node ID.
     * @returns A new `Graph` instance representing the connected component containing the node with
     *          the given ID.
     */
    public getConnectedComponentOfNode(nodeId: NodeId): Graph {
        const startNode = this.getNodeOrThrow(nodeId);
        const nodesIdsSeen = new Set([startNode.id]);
        const edgeIds = new Set<EdgeId>();
        const pending = [startNode];
        while (pending.length > 0) {
            const currentNode = pending.pop() as Node; // Not undefined because we just checked the length.
            currentNode.edgeIds.forEach(edgeId => edgeIds.add(edgeId));
            this.getNeighbors(currentNode.id).forEach(neighbor => {
                if (!nodesIdsSeen.has(neighbor.id)) {
                    nodesIdsSeen.add(neighbor.id);
                    pending.push(neighbor);
                }
            });
        }
        // Filter from original nodes/edges to preserve their order.
        const nodes = this.getAllNodes().filter(n => nodesIdsSeen.has(n.id));
        const edges = this.getAllEdges().filter(e => edgeIds.has(e.id));
        return Graph.create(nodes, edges);
    }

    /**
     * Returns the shortest path between two points on the graph. Throws if no such path exists.
     *
     * @param start A point along the graph.
     * @param end Another point along the graph.
     * @returns The shortest path from the first point to the second.
     */
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
        distancesFromStart.set(
            startEdge.endNodeId,
            startEdge.length - start.distance,
        );
        const pendingNodes = new Heap<NodeIdWithCost>(
            (node1, node2) => node1.cost - node2.cost,
        );
        const endLocation = this.getLocation(end);
        const addNodeToPending = (node: Node) =>
            pendingNodes.push({
                nodeId: node.id,
                cost:
                    distancesFromStart.get(node.id) +
                        Utils.distanceBetween(node.location, endLocation),
            });
        const cameFrom = new Map<NodeId, Edge>();
        let endEdgeIsForward = true;
        let endDistanceFromStart = Number.POSITIVE_INFINITY;
        addNodeToPending(this.getNodeOrThrow(startEdge.startNodeId));
        addNodeToPending(this.getNodeOrThrow(startEdge.endNodeId));
        while (!pendingNodes.empty()) {
            const currentNodeId = pendingNodes.pop().nodeId;
            if (currentNodeId == null) {
                return Graph.canonicalizePath(
                    this.reconstructPath(
                        start,
                        end,
                        cameFrom,
                        endEdgeIsForward,
                        endDistanceFromStart,
                    ),
                );
            } else {
                doneNodeIds.add(currentNodeId);
                const currentNodeDistance = distancesFromStart.get(
                    currentNodeId,
                );
                this.getEdgesOfNode(currentNodeId).forEach(edge => {
                    const neighbor = this.getOtherEndpoint(
                        edge.id,
                        currentNodeId,
                    );
                    if (!doneNodeIds.has(neighbor.id)) {
                        const currentDistance = distancesFromStart.get(
                            neighbor.id,
                        );
                        const newDistance = currentNodeDistance + edge.length;
                        if (
                            currentDistance == null ||
                            newDistance < currentDistance
                        ) {
                            distancesFromStart.set(neighbor.id, newDistance);
                            cameFrom.set(neighbor.id, edge);
                            addNodeToPending(neighbor);
                        }
                    }
                });
                const handleEndpointOfGoal = (isGoalStartNode: boolean) => {
                    const addedDistance = isGoalStartNode
                        ? end.distance
                        : endEdge.length - end.distance;
                    const newDistance = currentNodeDistance + addedDistance;
                    if (newDistance < endDistanceFromStart) {
                        endDistanceFromStart = newDistance;
                        endEdgeIsForward = isGoalStartNode;
                        pendingNodes.push({
                            nodeId: null,
                            cost: endDistanceFromStart,
                        });
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
        throw new Error(
            `No path from starting edge ${start.edgeId} to ending edge ${end.edgeId}`,
        );
    }

    /**
     * Does preprocessing to enable [[getClosestPoint]] by creating a spatial index for mesh of
     * points along the graph.
     *
     * @param precision How fine the mesh should be. Lower precision is more accurate but takes
     *        more time to precompute and more memory. As a rule-of-thumb, [[getClosestPoint]] will
     *        be accurate to within `precision` distance.
     * @returns A new `Graph` instance with a spatial index enabled.
     */
    public withClosestPointMesh(precision: number): Graph {
        const meshPoints: MeshPoint[] = [];
        // For each node, choose an arbitrary edge to hold the mesh point.
        this.getAllNodes().forEach(node => {
            const { edgeIds, location: { x, y } } = node;
            if (edgeIds.length > 0) {
                const { id: edgeId, startNodeId, locations } = this.getEdge(
                    edgeIds[0],
                );
                const locationIndex = startNodeId === node.id
                    ? 0
                    : locations.length - 2;
                meshPoints.push({ x, y, edgeId, locationIndex });
            }
        });
        this.getAllEdges().forEach(edge => {
            const { id: edgeId, length, locationDistances } = edge;
            const numSegments = Math.ceil(length / precision);
            const stepDistance = length / numSegments;
            for (let i = 1; i < numSegments; i++) {
                const distance = i * stepDistance;
                const { x, y } = this.getLocation({ edgeId, distance });
                const locationIndex = Utils.findFloorIndex(
                    locationDistances,
                    distance,
                );
                meshPoints.push({ x, y, edgeId, locationIndex });
            }
        });
        const tree = rbush<MeshPoint>(9, [".x", ".y", ".x", ".y"]).load(
            meshPoints,
        );
        return new Graph(this.nodesById, this.edgesById, tree);
    }

    /**
     * Returns the closest point on the graph to a given location. This requires the graph to have
     * a spatial index. To enable this, first use [[withClosestPointMesh]] to obtain a new graph
     * instance with an index enabled. Calling this method on a graph with no index will throw.
     *
     * @param location A location.
     * @returns The point on the graph closest to the given location, up to a precision determined
     *          by the graph's mesh.
     */
    public getClosestPoint(location: Location): EdgePoint {
        if (this.mesh) {
            return this.getClosestPointWithMesh(location, this.mesh);
        } else {
            console.warn(
                "getClosestPoint() called on Graph without precomputed mesh. For improved performance, call" +
                    " .withClosestPointMesh() to get a new optimized graph.",
            );
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
        const forwardPath = this.getOnlyPathInDirection({
            edge,
            isForward: true,
        });
        if (
            forwardPath.length > 1 &&
            forwardPath[0] === Utils.last(forwardPath)
        ) {
            // We are in a loop.
            return forwardPath.slice(0, forwardPath.length - 1);
        } else {
            const backwardsPath = this.getOnlyPathInDirection({
                edge,
                isForward: false,
            });
            return [
                ...Utils.reversePath(backwardsPath.slice(1)),
                ...forwardPath,
            ];
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
            const nextNodeId = currentEdge.isForward
                ? currentEdge.edge.endNodeId
                : currentEdge.edge.startNodeId;
            const nextNode = this.getNodeOrThrow(nextNodeId);
            if (nextNode.edgeIds.length !== 2) {
                return path;
            } else {
                const [edgeId1, edgeId2] = nextNode.edgeIds;
                const nextEdgeId = currentEdge.edge.id === edgeId1
                    ? edgeId2
                    : edgeId1;
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
        if (
            start.edgeId === end.edgeId &&
            Math.abs(start.distance - end.distance) <= length
        ) {
            // Handle special case of start and end on same edge.
            return this.getShortestPathOnSameEdge(start, end);
        } else {
            const endEdge = this.getEdgeOrThrow(end.edgeId);
            // Build nodes, oriented edge, and location lists starting from end, then reverse.
            const orientedEdges: OrientedEdge[] = [
                {
                    edge: endEdge,
                    isForward: endEdgeIsForward,
                },
            ];
            const nodes: Node[] = [];
            const locations: Location[] = this.getLocationsOnEdgeInterval(
                end.edgeId,
                end.distance,
                endEdgeIsForward ? 0 : this.getEdgeOrThrow(end.edgeId).length,
            );
            let currentNodeId = endEdgeIsForward
                ? endEdge.startNodeId
                : endEdge.endNodeId;
            while (true) {
                nodes.push(this.getNodeOrThrow(currentNodeId));
                const currentEdge = cameFrom.get(currentNodeId);
                if (currentEdge == null) {
                    break;
                } else {
                    const isForward = currentEdge.endNodeId === currentNodeId;
                    orientedEdges.push({ edge: currentEdge, isForward });
                    const newLocations = isForward
                        ? currentEdge.locations.slice().reverse()
                        : currentEdge.locations;
                    Utils.pushAll(locations, newLocations);
                    currentNodeId = this.getOtherEndpoint(
                        currentEdge.id,
                        currentNodeId,
                    ).id;
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
            orientedEdges.push({
                edge: startEdge,
                isForward: startEdgeIsForward,
            });
            Utils.pushAll(
                locations,
                this.getLocationsOnEdgeInterval(
                    start.edgeId,
                    startEdgeIsForward
                        ? this.getEdgeOrThrow(start.edgeId).length
                        : 0,
                    start.distance,
                ),
            );
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
            locations: this.getLocationsOnEdgeInterval(
                start.edgeId,
                start.distance,
                end.distance,
            ),
            length: Math.abs(start.distance - end.distance),
        };
    }

    private getLocationsOnEdgeInterval(
        edgeId: EdgeId,
        startDistance: number,
        endDistance: number,
    ): Location[] {
        if (startDistance === endDistance) {
            return [this.getLocation({ edgeId, distance: startDistance })];
        } else {
            const { locations, locationDistances } = this.getEdgeOrThrow(
                edgeId,
            );
            const minDistance = Math.min(startDistance, endDistance);
            const maxDistance = Math.max(startDistance, endDistance);
            const minLocationIndex = Utils.findFloorIndex(
                locationDistances,
                minDistance,
            );
            const maxLocationIndex = Utils.findFloorIndex(
                locationDistances,
                maxDistance,
            );
            const startLocation = this.getLocation({
                edgeId,
                distance: startDistance,
            });
            const endLocation = this.getLocation({
                edgeId,
                distance: endDistance,
            });
            const intermediateLocations = locations.slice(
                minLocationIndex + 1,
                maxLocationIndex + 1,
            );
            if (endDistance < startDistance) {
                intermediateLocations.reverse();
            }
            return Utils.dedupeLocations([
                startLocation,
                ...intermediateLocations,
                endLocation,
            ]);
        }
    }

    private getClosestPointWithMesh(
        location: Location,
        mesh: rbush.RBush<MeshPoint>,
    ): EdgePoint {
        const { x, y } = location;
        const [{ edgeId, locationIndex }] = knn(mesh, x, y, 1);
        const { locations, locationDistances } = this.getEdgeOrThrow(edgeId);
        const { distanceDownSegment } = Utils.closestPointOnSegment(
            location,
            locations[locationIndex],
            locations[locationIndex + 1],
        );
        return {
            edgeId,
            distance: locationDistances[locationIndex] + distanceDownSegment,
        };
    }

    private getClosestPointWithoutMesh(location: Location): EdgePoint {
        let bestPoint: EdgePoint | null = null;
        let bestDistance: number = Number.POSITIVE_INFINITY;
        this.getAllEdges().forEach(edge => {
            const { locations, locationDistances } = edge;
            for (let i = 0, limit = locations.length - 1; i < limit; i++) {
                const {
                    distanceDownSegment,
                    distanceFromLocation,
                } = Utils.closestPointOnSegment(
                    location,
                    locations[i],
                    locations[i + 1],
                );
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
            throw new Error(
                "Cannot find closest edge point on graph with no edges",
            );
        }
        return bestPoint;
    }
}
