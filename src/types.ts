/**
 * The type of the identifier for a [[Node]].
 */
export type NodeId = string | number;

/**
 * The type of the identifier for an [[Edge]].
 */
export type EdgeId = string | number;

/**
 * Basic information about a node used to initially create a [[Graph]]. Once a graph is constructed,
 * all of its methods will return [[Node]]s instead, which contain additional useful information.
 */
export interface SimpleNode {
    /**
     * An identifier, unique across all nodes in a given [[Graph]].
     */
    id: NodeId;

    /**
     * The location of the node.
     */
    location: Location;
}

/**
 * Basic information about an edge used to initially create a [[Graph]]. Once a graph is
 * constructed, all of its methods will return [[Edge]]s instead, which contain additional useful
 * information.
 * 
 * An edge is specified by which nodes are its "start" and "end." The direction of an edge is
 * arbitrary, but once set will be handled consistently by the [[Graph]] methods.
 * 
 * The edge may also specify internal locations which it passes through on its way between its
 * endpoints. That is, an edge may curve and does not necessarily represent a physical straight
 * line.
 */
export interface SimpleEdge {
    /**
     * An identifier, unique across all edges in a given [[Graph]].
     */
    id: EdgeId;

    /**
     * ID of the [[Node]] at the start of this edge.
     */
    startNodeId: NodeId;

    /**
     * ID of the [[Node]] at the end of the edge.
     */
    endNodeId: NodeId;

    /**
     * Additional locations that the edge passes through which are not represented by [[Node]]s.
     */
    innerLocations?: Location[];
}

/**
 * A node in a [[Graph]]. Like a [[SimpleNode]], but with additional information for convenience
 * and efficiency.
 */
export interface Node extends SimpleNode {
    /**
     * The IDs of all [[Edge]]s for which this node is an endpoint.
     */
    edgeIds: EdgeId[];
}

/**
 * An edge in a [[Graph]]. Like a [[SimpleEdge]], but with additional information for convenience
 * and efficiency.
 * 
 * An edge is specified by which nodes are its "start" and "end." The direction of an edge is
 * arbitrary, but once set will be handled consistently by the `Graph` methods.
 * 
 * The edge may also specify internal locations which it passes through on its way between its
 * endpoints. That is, an edge may curve and does not necessarily represent a physical straight
 * line.
 */
export interface Edge extends SimpleEdge {
    /**
     * The total length of this edge.
     */
    length: number;

    /**
     * The locations which make up this edge from start to finish. Like [[innerLocations]], but
     * including the locations of the start and end [[Node]]s.
     */
    locations: Location[];

    /**
     * The cumulative distances of each location along the path. This array will always have the
     * same number of elements as [[locations]]. `locationDistances[i]` is the total distance one
     * must travel along the edge to arrive at `locations[i]`. In particular, this means that
     * `locationDistances[0]` is always `0` and `locationDistances[locations.length - 1]` is always
     * [[length]].
     */
    locationDistances: number[];
}

/**
 * A single point in a 2-d Cartesian coordinate system.
 */
export interface Location {
    /**
     * The x-coordinate.
     */
    x: number;

    /**
     * The y-coordinate.
     */
    y: number;
}

/**
 * A point which lies partway along an [[Edge]].
 */
export interface EdgePoint {
    /**
     * The ID of the [[Edge]] on which this point lies.
     */
    edgeId: EdgeId;

    /**
     * The distance along the edge from the start node at which this point lies.
     */
    distance: number;
}

/**
 * An [[Edge]] along with a direction (forwards or backwards). Useful for communicating directed
 * paths.
 */
export interface OrientedEdge {
    /**
     * The edge.
     */
    edge: Edge;

    /**
     * True if the desired orientation is in the direction from the edge's start node to its end.
     */
    isForward: boolean;
}

/**
 * A path along edges of the graph from one [[EdgePoint]] to another. Contains various pieces of
 * information used to describe this path.
 */
export interface Path {
    /**
     * The point at which this path starts.
     */
    start: EdgePoint;

    /**
     * The point at which this path ends.
     */
    end: EdgePoint;

    /**
     * The edges that make up this path, along with which direction the path travels across
     * each.
     */
    orientedEdges: OrientedEdge[];

    /**
     * The nodes which are crossed by this path in the order of crossing.
     */
    nodes: Node[];

    /**
     * The locations which make up this path. That is, the path can be drawn by connecting these
     * locations with line segments.
     */
    locations: Location[];

    /**
     * The total length of the path.
     */
    length: number;
}
