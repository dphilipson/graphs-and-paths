import Graph from "../src/graph";
import {
    Edge,
    EdgePoint,
    Location,
    Path,
    SimpleEdge,
    SimpleNode,
} from "../src/types";
import * as TestGraphs from "./testGraphs";

describe("constructor", () => {
    it("should fail if node ID is repeated", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 0, y: 0 } },
            { id: 0, location: { x: 0, y: 1 } },
        ];
        expect(() => Graph.create(nodes, [])).toThrowError(/0/);
    });

    it("should fail if edge ID is repeated", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 0, y: 0 } },
            { id: 1, location: { x: 0, y: 1 } },
            { id: 2, location: { x: 1, y: 0 } },
        ];
        const edges: SimpleEdge[] = [
            { id: 0, startNodeId: 0, endNodeId: 1 },
            { id: 0, startNodeId: 1, endNodeId: 2 },
        ];
        expect(() => Graph.create(nodes, edges)).toThrowError(/0/);
    });

    it("should fail if edge references nonexistent node", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 0, y: 0 } },
            { id: 1, location: { x: 0, y: 1 } },
        ];
        const edges: SimpleEdge[] = [{ id: 0, startNodeId: 0, endNodeId: 2 }];
        expect(() => Graph.create(nodes, edges)).toThrowError(/2/);
    });
});

describe("getAllNodes()", () => {
    it("should return nothing on an empty graph", () => {
        const graph = Graph.create([], []);
        expect(graph.getAllNodes()).toEqual([]);
    });

    it("should return a node with no edges if it is entire graph", () => {
        const node = TestGraphs.getSingleNode().getAllNodes()[0];
        expect(node.id).toEqual(0);
        expect(node.location).toEqual({ x: 0, y: 0 });
        expect(node.edgeIds).toEqual([]);
    });

    it("should return nodes with edge between them on such a graph", () => {
        const nodes = TestGraphs.getTwoNodes().getAllNodes();
        expect(nodes.length).toEqual(2);
        const [nodeA, nodeB] = nodes;
        expect(nodeA.id).toEqual("A");
        expect(nodeB.id).toEqual("B");
        expect(nodeA.edgeIds).toEqual(["AB"]);
        expect(nodeB.edgeIds).toEqual(["AB"]);
    });
});

describe("getNode()", () => {
    it("should return the requested node", () => {
        const node = TestGraphs.getSingleNode().getNode(0);
        expect(node.id).toEqual(0);
    });

    it("should return undefined if node does not exist", () => {
        expect(TestGraphs.getSingleNode().getNode(1)).toBeUndefined();
    });
});

describe("getAllEdges()", () => {
    it("should return nothing on an empty graph", () => {
        const graph = Graph.create([], []);
        expect(graph.getAllEdges()).toEqual([]);
    });

    it("should return the edge on a graph with a single edge", () => {
        const edges = TestGraphs.getTwoNodes().getAllEdges();
        const expected: Edge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "B",
                innerLocations: [],
                length: 1,
                locations: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
                locationDistances: [0, 1],
            },
        ];
        expect(edges).toEqual(expected);
    });
});

describe("getEdge()", () => {
    it("should return the requested edge", () => {
        const edge = TestGraphs.getTwoNodes().getEdge("AB");
        expect(edge.id).toEqual("AB");
    });

    it("should return undefined if edge does not exist", () => {
        expect(TestGraphs.getTwoNodes().getEdge(1)).toBeUndefined();
    });
});

describe("getEdgesOfNode()", () => {
    it("should return edges with node as their endpoint", () => {
        const edges = TestGraphs.getTriangle().getEdgesOfNode("A");
        const edgeIds = edges.map(edge => edge.id).sort();
        expect(edgeIds).toEqual(["AB", "CA"]);
    });

    it("should throw on nonexistent node ID", () => {
        expect(() => TestGraphs.getTriangle().getEdgesOfNode(-1)).toThrowError(
            /-1/,
        );
    });
});

describe("getEndpointsOfEdge()", () => {
    it("should return nodes at ends of edge", () => {
        const endpoints = TestGraphs.getTriangle().getEndpointsOfEdge("CA");
        expect(endpoints.map(node => node.id)).toEqual(["C", "A"]);
    });

    it("should throw on nonexistent edge ID", () => {
        expect(() =>
            TestGraphs.getTriangle().getEndpointsOfEdge(-1),
        ).toThrowError(/-1/);
    });
});

describe("getOtherEndpoint()", () => {
    it("should return the other endpoint of an edge", () => {
        const endpoint = TestGraphs.getTwoNodes().getOtherEndpoint("AB", "A");
        expect(endpoint.id).toEqual("B");
    });

    it("should throw on nonexistent edge ID", () => {
        expect(() =>
            TestGraphs.getTwoNodes().getOtherEndpoint("TD", "A"),
        ).toThrowError(/TD/);
    });

    it("should throw if node is not an endpoint of edge", () => {
        expect(() =>
            TestGraphs.getTriangle().getOtherEndpoint("AB", "C"),
        ).toThrowError(/endpoint/);
    });
});

describe("getNeighbors()", () => {
    it("should return the neighbors of a node", () => {
        const neighbors = TestGraphs.getTriangle().getNeighbors("A");
        expect(neighbors.map(node => node.id).sort()).toEqual(["B", "C"]);
    });

    it("should throw nonexistent node ID", () => {
        expect(() => TestGraphs.getTriangle().getNeighbors("TD")).toThrowError(
            /TD/,
        );
    });
});

describe("getLocation()", () => {
    it("should return the correct location on an edge with no inner points", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 10, y: 10 } },
            { id: "B", location: { x: 40, y: 50 } },
        ];
        const edges: SimpleEdge[] = [
            { id: "AB", startNodeId: "A", endNodeId: "B" },
        ];
        const graph = Graph.create(nodes, edges);
        const distances = [0, 10, 50];
        const expectedLocations: Location[] = [
            { x: 10, y: 10 },
            { x: 16, y: 18 },
            { x: 40, y: 50 },
        ];
        const actualLocations = distances.map(distance =>
            graph.getLocation({ edgeId: "AB", distance }),
        );
        expect(actualLocations).toEqual(expectedLocations);
    });

    it("should return the correct location on an edge with inner points", () => {
        // Path is a "stairwell" with two steps.
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 2, y: 2 } },
        ];
        const edges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "B",
                innerLocations: [
                    { x: 1, y: 0 },
                    { x: 1, y: 1 },
                    { x: 2, y: 1 },
                ],
            },
        ];
        const graph = Graph.create(nodes, edges);
        const distances = [0, 1, 2.5, 4];
        const expectedLocations: Location[] = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1.5, y: 1 },
            { x: 2, y: 2 },
        ];
        const actualLocations = distances.map(distance =>
            graph.getLocation({ edgeId: "AB", distance }),
        );
        expect(actualLocations).toEqual(expectedLocations);
    });

    it("should behave in double imprecision corner case", () => {
        // Fact: 2/3 + 1/3 === 1, but 1 - 2/3 - 1/3 !== 0 in floating point arithmatic.
        // This test checks that this does not cause trouble for us.
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 2 / 3, y: 1 / 3 } },
        ];
        const edges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "B",
                innerLocations: [{ x: 2 / 3, y: 0 }],
            },
        ];
        const graph = Graph.create(nodes, edges);
        const { length } = graph.getEdge("AB");
        expect(graph.getLocation({ edgeId: "AB", distance: length })).toEqual({
            x: 2 / 3,
            y: 1 / 3,
        });
    });

    it("should throw on nonexistent edgeId", () => {
        expect(() =>
            TestGraphs.getTriangle().getLocation({ edgeId: "TD", distance: 0 }),
        ).toThrowError(/TD/);
    });

    it("should return start on negative distance", () => {
        expect(
            TestGraphs.getTriangle().getLocation({
                edgeId: "AB",
                distance: -1,
            }),
        ).toEqual({ x: 0, y: 0 });
    });

    it("should return end on distance greater than edge length", () => {
        expect(
            TestGraphs.getTriangle().getLocation({
                edgeId: "AB",
                distance: 10,
            }),
        ).toEqual({ x: 1, y: 0 });
    });
});

describe("lengths and innerLocationDistances", () => {
    it("should be correct for edge with no inner locations", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 1, y: 1 } },
            { id: "B", location: { x: 4, y: -3 } },
        ];
        const edges: SimpleEdge[] = [
            { id: "AB", startNodeId: "A", endNodeId: "B" },
        ];
        const edge = Graph.create(nodes, edges).getEdge("AB");
        const expected: Edge = {
            id: "AB",
            startNodeId: "A",
            endNodeId: "B",
            innerLocations: [],
            length: 5,
            locations: [{ x: 1, y: 1 }, { x: 4, y: -3 }],
            locationDistances: [0, 5],
        };
        expect(edge).toEqual(expected);
    });

    it("should be correct for edge with inner locations", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 0, y: 6 } },
        ];
        const edges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "B",
                innerLocations: [{ x: 4, y: 3 }],
            },
        ];
        const edge = Graph.create(nodes, edges).getEdge("AB");
        const expected: Edge = {
            id: "AB",
            startNodeId: "A",
            endNodeId: "B",
            innerLocations: [{ x: 4, y: 3 }],
            length: 10,
            locations: [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 6 }],
            locationDistances: [0, 5, 10],
        };
        expect(edge).toEqual(expected);
    });
});

describe("coalesced()", () => {
    it("should return identical graph if nothing to coalesce", () => {
        const graph = TestGraphs.getTwoNodes();
        const coalesced = graph.coalesced();
        expectGraphsToBeEqual(coalesced, graph);
    });

    it("should coalesce segmented curve into single curve", () => {
        const graph = TestGraphs.getFourNodes().coalesced();
        const expectedNodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "D", location: { x: 3, y: 0 } },
        ];
        const expectedEdges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "D",
                innerLocations: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
            },
        ];
        const expectedGraph = Graph.create(expectedNodes, expectedEdges);
        expectGraphsToBeEqual(graph, expectedGraph);
    });

    it("should coalesce segmented arms of three-armed star", () => {
        const nodes: SimpleNode[] = [
            { id: "center", location: { x: 0, y: 0 } },
            { id: "rightArmJoint", location: { x: 1, y: 0 } },
            { id: "rightArmEnd", location: { x: 2, y: 0 } },
            { id: "topArmJoint", location: { x: 0, y: 1 } },
            { id: "topArmEnd", location: { x: 0, y: 2 } },
            { id: "leftArmJoint", location: { x: -1, y: 0 } },
            { id: "leftArmEnd", location: { x: -2, y: 0 } },
        ];
        const edges: SimpleEdge[] = [
            {
                id: "rightArm1",
                startNodeId: "center",
                endNodeId: "rightArmJoint",
            },
            {
                id: "rightArm2",
                startNodeId: "rightArmJoint",
                endNodeId: "rightArmEnd",
            },
            { id: "topArm1", startNodeId: "center", endNodeId: "topArmJoint" },
            {
                id: "topArm2",
                startNodeId: "topArmJoint",
                endNodeId: "topArmEnd",
            },
            {
                id: "leftArm1",
                startNodeId: "center",
                endNodeId: "leftArmJoint",
            },
            {
                id: "leftArm2",
                startNodeId: "leftArmJoint",
                endNodeId: "leftArmEnd",
            },
        ];
        const expectedNodes: SimpleNode[] = [
            { id: "center", location: { x: 0, y: 0 } },
            { id: "rightArmEnd", location: { x: 2, y: 0 } },
            { id: "topArmEnd", location: { x: 0, y: 2 } },
            { id: "leftArmEnd", location: { x: -2, y: 0 } },
        ];
        const expectedEdges: SimpleEdge[] = [
            {
                id: "rightArm1",
                startNodeId: "center",
                endNodeId: "rightArmEnd",
                innerLocations: [{ x: 1, y: 0 }],
            },
            {
                id: "topArm1",
                startNodeId: "center",
                endNodeId: "topArmEnd",
                innerLocations: [{ x: 0, y: 1 }],
            },
            {
                id: "leftArm1",
                startNodeId: "center",
                endNodeId: "leftArmEnd",
                innerLocations: [{ x: -1, y: 0 }],
            },
        ];
        const graph = Graph.create(nodes, edges).coalesced();
        const expectedGraph = Graph.create(expectedNodes, expectedEdges);
        expectGraphsToBeEqual(graph, expectedGraph);
    });

    it("should preserve inner locations in correct order", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 3, y: 0 } },
            { id: "C", location: { x: 3, y: 3 } },
        ];
        const edges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "B",
                innerLocations: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
            },
            {
                id: "CB",
                startNodeId: "C",
                endNodeId: "B",
                innerLocations: [{ x: 3, y: 2 }, { x: 3, y: 1 }],
            },
        ];
        const expectedNodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "C", location: { x: 3, y: 3 } },
        ];
        const expectedEdges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "C",
                innerLocations: [
                    { x: 1, y: 0 },
                    { x: 2, y: 0 },
                    { x: 3, y: 0 },
                    { x: 3, y: 1 },
                    { x: 3, y: 2 },
                ],
            },
        ];
        const graph = Graph.create(nodes, edges).coalesced();
        const expectedGraph = Graph.create(expectedNodes, expectedEdges);
        expectGraphsToBeEqual(graph, expectedGraph);
    });

    it("should handle an isolated cycle", () => {
        const expectedNodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
        ];
        const expectedEdges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "A",
                innerLocations: [{ x: 1, y: 0 }, { x: 0, y: 1 }],
            },
        ];
        const graph = TestGraphs.getTriangle().coalesced();
        const expectedGraph = Graph.create(expectedNodes, expectedEdges);
        expectGraphsToBeEqual(graph, expectedGraph);
    });
});

describe("getConnectedComponents()", () => {
    it("should return the original graph if connected", () => {
        const graph = TestGraphs.getTwoNodes();
        const components = graph.getConnectedComponents();
        expect(components.length).toEqual(1);
        expectGraphsToBeEqual(components[0], graph);
    });

    it("should return multiple components if not connected", () => {
        const nodeA = { id: "A", location: { x: 0, y: 0 } };
        const nodeB = { id: "B", location: { x: 1, y: 0 } };
        const nodeO = { id: "O", location: { x: 0, y: 1 } };
        const nodeX = { id: "X", location: { x: 2, y: 0 } };
        const nodeY = { id: "Y", location: { x: 2, y: 1 } };

        const edgeAB = { id: "AB", startNodeId: "A", endNodeId: "B" };
        const edgeXY = { id: "XY", startNodeId: "X", endNodeId: "Y" };

        const nodes: SimpleNode[] = [nodeA, nodeB, nodeO, nodeX, nodeY];
        const edges: SimpleEdge[] = [edgeAB, edgeXY];
        const expectedNodes: SimpleNode[][] = [
            [nodeA, nodeB],
            [nodeO],
            [nodeX, nodeY],
        ];
        const expectedEdges: SimpleEdge[][] = [[edgeAB], [], [edgeXY]];
        const components = Graph.create(nodes, edges).getConnectedComponents();
        expect(components.length).toEqual(3);
        for (let i = 0; i < 3; i++) {
            const expectedComponent = Graph.create(
                expectedNodes[i],
                expectedEdges[i],
            );
            expectGraphsToBeEqual(components[i], expectedComponent);
        }
    });

    it("should work if cycles are present", () => {
        const graph = TestGraphs.getTriangle();
        const components = graph.getConnectedComponents();
        expect(components.length).toEqual(1);
        expectGraphsToBeEqual(components[0], graph);
    });
});

describe("getConnectedComponentsForNode()", () => {
    it("should return the original graph if connected", () => {
        const graph = TestGraphs.getTwoNodes();
        const component = graph.getConnectedComponentOfNode("A");
        expectGraphsToBeEqual(component, graph);
    });

    it("should return a single componenet if disconnected", () => {
        const nodeA = { id: "A", location: { x: 0, y: 0 } };
        const nodeB = { id: "B", location: { x: 1, y: 0 } };
        const nodeO = { id: "O", location: { x: 0, y: 1 } };
        const nodeX = { id: "X", location: { x: 2, y: 0 } };
        const nodeY = { id: "Y", location: { x: 2, y: 1 } };

        const edgeAB = { id: "AB", startNodeId: "A", endNodeId: "B" };
        const edgeXY = { id: "XY", startNodeId: "X", endNodeId: "Y" };

        const nodes: SimpleNode[] = [nodeA, nodeB, nodeO, nodeX, nodeY];
        const edges: SimpleEdge[] = [edgeAB, edgeXY];
        const expectedNodes: SimpleNode[] = [nodeA, nodeB];
        const expectedEdges: SimpleEdge[] = [edgeAB];
        const component = Graph.create(
            nodes,
            edges,
        ).getConnectedComponentOfNode("A");
        const expectedComponent = Graph.create(expectedNodes, expectedEdges);
        expectGraphsToBeEqual(component, expectedComponent);
    });

    it("should work if cycles are present", () => {
        const graph = TestGraphs.getTriangle();
        const component = graph.getConnectedComponentOfNode("A");
        expectGraphsToBeEqual(component, graph);
    });
});

describe("getShortestPath()", () => {
    const originalCanonicalize = (Graph as any).canonicalizePath;
    const canonicalizeSpy = jest.fn(originalCanonicalize);
    (Graph as any).canonicalizePath = canonicalizeSpy;

    afterAll(() => {
        (Graph as any).canonicalizePath = originalCanonicalize;
    });

    beforeEach(canonicalizeSpy.mockClear);

    afterEach(() => {
        expect(canonicalizeSpy).toHaveBeenCalled();
    });

    it("should return a trivial path when start and end are the same", () => {
        const graph = TestGraphs.getTwoNodes();
        const start: EdgePoint = { edgeId: "AB", distance: 0 };
        const end: EdgePoint = { edgeId: "AB", distance: 0 };
        const expectedPath: Path = {
            start,
            end: start,
            orientedEdges: [{ edge: graph.getEdge("AB"), isForward: true }],
            nodes: [],
            locations: [{ x: 0, y: 0 }],
            length: 0,
        };
        const path = graph.getShortestPath(start, end);
        expect(path).toEqual(expectedPath);
    });

    it("should return a path crossing over nodes", () => {
        const graph = TestGraphs.getFourNodes();
        const start: EdgePoint = { edgeId: "AB", distance: 0.5 };
        const end: EdgePoint = { edgeId: "CD", distance: 0.5 };
        const expectedPath: Path = {
            start,
            end,
            orientedEdges: [
                { edge: graph.getEdge("AB"), isForward: true },
                { edge: graph.getEdge("BC"), isForward: true },
                { edge: graph.getEdge("CD"), isForward: true },
            ],
            nodes: [graph.getNode("B"), graph.getNode("C")],
            locations: [
                { x: 0.5, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 2.5, y: 0 },
            ],
            length: 2,
        };
        const path = graph.getShortestPath(start, end);
        expect(path).toEqual(expectedPath);
    });

    it("should return a path crossing over nodes in reverse", () => {
        const graph = TestGraphs.getFourNodes();
        const start: EdgePoint = { edgeId: "CD", distance: 0.5 };
        const end: EdgePoint = { edgeId: "AB", distance: 0.5 };
        const expectedPath: Path = {
            start,
            end,
            orientedEdges: [
                { edge: graph.getEdge("CD"), isForward: false },
                { edge: graph.getEdge("BC"), isForward: false },
                { edge: graph.getEdge("AB"), isForward: false },
            ],
            nodes: [graph.getNode("C"), graph.getNode("B")],
            locations: [
                { x: 2.5, y: 0 },
                { x: 2, y: 0 },
                { x: 1, y: 0 },
                { x: 0.5, y: 0 },
            ],
            length: 2,
        };
        const path = graph.getShortestPath(start, end);
        expect(path).toEqual(expectedPath);
    });

    it("should return the shortest path in a triangle", () => {
        // A 15-20-25 right triangle.
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 15, y: 0 } },
            { id: "C", location: { x: 0, y: 20 } },
        ];
        const edges: SimpleEdge[] = [
            { id: "AB", startNodeId: "A", endNodeId: "B" },
            { id: "BC", startNodeId: "B", endNodeId: "C" },
            { id: "CA", startNodeId: "C", endNodeId: "A" },
        ];
        const graph = Graph.create(nodes, edges);
        const start: EdgePoint = { edgeId: "CA", distance: 15 };
        const end: EdgePoint = { edgeId: "BC", distance: 5 };
        const expectedPath: Path = {
            start,
            end,
            orientedEdges: [
                { edge: graph.getEdge("CA"), isForward: true },
                { edge: graph.getEdge("AB"), isForward: true },
                { edge: graph.getEdge("BC"), isForward: true },
            ],
            nodes: [graph.getNode("A"), graph.getNode("B")],
            locations: [
                { x: 0, y: 5 },
                { x: 0, y: 0 },
                { x: 15, y: 0 },
                { x: 12, y: 4 },
            ],
            length: 25,
        };
        const path = graph.getShortestPath(start, end);
        expect(path).toEqual(expectedPath);
    });

    it("should return single edge path if start and end are on the same edge", () => {
        const graph = TestGraphs.getTwoNodes();
        const start: EdgePoint = { edgeId: "AB", distance: 0.25 };
        const end: EdgePoint = { edgeId: "AB", distance: 0.75 };
        const expectedPath: Path = {
            start,
            end,
            orientedEdges: [{ edge: graph.getEdge("AB"), isForward: true }],
            nodes: [],
            locations: [{ x: 0.25, y: 0 }, { x: 0.75, y: 0 }],
            length: 0.5,
        };
        const path = graph.getShortestPath(start, end);
        expect(path).toEqual(expectedPath);
    });

    it("should return single edge path if start and end are on the same edge in reverse", () => {
        // Same as last test but with start and end switched.
        const graph = TestGraphs.getTwoNodes();
        const start: EdgePoint = { edgeId: "AB", distance: 0.75 };
        const end: EdgePoint = { edgeId: "AB", distance: 0.25 };
        const expectedPath: Path = {
            start,
            end,
            orientedEdges: [{ edge: graph.getEdge("AB"), isForward: false }],
            nodes: [],
            locations: [{ x: 0.75, y: 0 }, { x: 0.25, y: 0 }],
            length: 0.5,
        };
        const path = graph.getShortestPath(start, end);
        expect(path).toEqual(expectedPath);
    });

    it("should work if start and end are on the same edge but shortest path goes through other edges", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 1, y: 0 } },
        ];
        const edges: SimpleEdge[] = [
            {
                id: "longEdge",
                startNodeId: "A",
                endNodeId: "B",
                innerLocations: [{ x: 0, y: 1 }, { x: 1, y: 1 }],
            },
            {
                id: "shortEdge",
                startNodeId: "A",
                endNodeId: "B",
            },
        ];
        const graph = Graph.create(nodes, edges);
        const start = { edgeId: "longEdge", distance: 0.25 };
        const end = { edgeId: "longEdge", distance: 2.75 };
        const expectedPath: Path = {
            start,
            end,
            orientedEdges: [
                { edge: graph.getEdge("longEdge"), isForward: false },
                { edge: graph.getEdge("shortEdge"), isForward: true },
                { edge: graph.getEdge("longEdge"), isForward: false },
            ],
            nodes: [graph.getNode("A"), graph.getNode("B")],
            locations: [
                { x: 0, y: 0.25 },
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 0.25 },
            ],
            length: 1.5,
        };
        const path = graph.getShortestPath(start, end);
        expect(path).toEqual(expectedPath);
    });
});

describe("advanceAlongLocations()", () => {
    const locations: Location[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
    ];

    it("should return same locations if distance is zero", () => {
        const newLocations = Graph.advanceAlongLocations(locations, 0);
        expect(newLocations).toEqual(locations);
    });

    it("should advance along locations, dropping passed points", () => {
        const newLocations = Graph.advanceAlongLocations(locations, 1.5);
        const expected: Location[] = [{ x: 1, y: 0.5 }, { x: 1, y: 1 }];
        expect(newLocations).toEqual(expected);
    });

    it("should return just the endpoint if distance greater than total length", () => {
        const newLocations = Graph.advanceAlongLocations(locations, 4);
        const expected: Location[] = [{ x: 1, y: 1 }];
        expect(newLocations).toEqual(expected);
    });

    it("should throw on negative distance", () => {
        expect(() => Graph.advanceAlongLocations(locations, -1)).toThrowError(
            /negative/,
        );
    });
});

describe("advancePath()", () => {
    const graph = TestGraphs.getFourNodes();
    const path: Path = {
        start: { edgeId: "AB", distance: 0.5 },
        end: { edgeId: "CD", distance: 0.5 },
        orientedEdges: [
            { edge: graph.getEdge("AB"), isForward: true },
            { edge: graph.getEdge("BC"), isForward: true },
            { edge: graph.getEdge("CD"), isForward: true },
        ],
        nodes: [graph.getNode("B"), graph.getNode("C")],
        locations: [
            { x: 0.5, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 2.5, y: 0 },
        ],
        length: 2,
    };

    it("should return the same path if distance is zero", () => {
        const advanced = Graph.advanceAlongPath(path, 0);
        expect(advanced).toEqual(path);
    });

    it("should advance path, dropping nodes and edges", () => {
        const advanced = Graph.advanceAlongPath(path, 1.75);
        const expected: Path = {
            start: { edgeId: "CD", distance: 0.25 },
            end: { edgeId: "CD", distance: 0.5 },
            orientedEdges: [{ edge: graph.getEdge("CD"), isForward: true }],
            nodes: [],
            locations: [{ x: 2.25, y: 0 }, { x: 2.5, y: 0 }],
            length: 0.25,
        };
        expect(advanced).toEqual(expected);
    });

    it("should return a single-point path if distance is greater than length", () => {
        const advanced = Graph.advanceAlongPath(path, 3);
        const expected: Path = {
            start: { edgeId: "CD", distance: 0.5 },
            end: { edgeId: "CD", distance: 0.5 },
            orientedEdges: [{ edge: graph.getEdge("CD"), isForward: true }],
            nodes: [],
            locations: [{ x: 2.5, y: 0 }],
            length: 0,
        };
        expect(advanced).toEqual(expected);
    });

    it("should advance to the next edge if landing exactly on a node", () => {
        const advanced = Graph.advanceAlongPath(path, 1.5);
        const expected: Path = {
            start: { edgeId: "CD", distance: 0 },
            end: { edgeId: "CD", distance: 0.5 },
            orientedEdges: [{ edge: graph.getEdge("CD"), isForward: true }],
            nodes: [],
            locations: [{ x: 2, y: 0 }, { x: 2.5, y: 0 }],
            length: 0.5,
        };
        expect(advanced).toEqual(expected);
    });

    it("should throw on negative distance", () => {
        expect(() => Graph.advanceAlongPath(path, -1)).toThrowError(/negative/);
    });
});

describe("getClosestPoint()", () => {
    const angledSegment = (() => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 12, y: 9 } },
        ];
        const edges: SimpleEdge[] = [
            { id: "AB", startNodeId: "A", endNodeId: "B" },
        ];
        return Graph.create(nodes, edges).withClosestPointMesh(0.25);
    })();

    it("should return a point at the requested location if it exists", () => {
        const closestPoint = angledSegment.getClosestPoint({ x: 4, y: 3 });
        const expected: EdgePoint = { edgeId: "AB", distance: 5 };
        expect(closestPoint).toEqual(expected);
    });

    it("should return the closest point in the middle of a segment", () => {
        const closestPoint = angledSegment.getClosestPoint({ x: 5, y: 10 });
        const expected: EdgePoint = { edgeId: "AB", distance: 10 };
        expect(closestPoint).toEqual(expected);
    });

    it("should return the closest point at the end of a segment", () => {
        const closestPoint = angledSegment.getClosestPoint({ x: 15, y: 15 });
        const expected: EdgePoint = { edgeId: "AB", distance: 15 };
        expect(closestPoint).toEqual(expected);
    });

    it("should return the closest point if exactly an endpoint of the segment", () => {
        const closestPoint1 = angledSegment.getClosestPoint({ x: 0, y: 0 });
        const expected1: EdgePoint = { edgeId: "AB", distance: 0 };
        expect(closestPoint1).toEqual(expected1);

        const closestPoint2 = angledSegment.getClosestPoint({ x: 12, y: 9 });
        const expected2: EdgePoint = { edgeId: "AB", distance: 15 };
        expect(closestPoint2).toEqual(expected2);
    });

    it("should return the closest point among multiple segments", () => {
        const graph = TestGraphs.getTriangle().withClosestPointMesh(0.25);
        const closestPoint = graph.getClosestPoint({ x: 0.125, y: 0.25 });
        const expected = { edgeId: "CA", distance: 0.75 };
        expect(closestPoint).toEqual(expected);
    });

    it("should work for edge with inner locations", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 1, y: 0 } },
        ];
        const edges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "B",
                innerLocations: [{ x: 0, y: 1 }, { x: 1, y: 1 }],
            },
        ];
        const graph = Graph.create(nodes, edges).withClosestPointMesh(0.25);
        const closestPoint = graph.getClosestPoint({ x: 0.25, y: 2 });
        const expected = { edgeId: "AB", distance: 1.25 };
        expect(closestPoint).toEqual(expected);
    });

    it("should work for an edge where start and end are the same location", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 0, y: 0 } },
        ];
        const edges: SimpleEdge[] = [
            { id: "AB", startNodeId: "A", endNodeId: "B" },
        ];
        const graph = Graph.create(nodes, edges).withClosestPointMesh(0.25);
        const closestPoint = graph.getClosestPoint({ x: 1, y: 1 });
        const expected = { edgeId: "AB", distance: 0 };
        expect(closestPoint).toEqual(expected);
    });
});

describe("distance()", () => {
    it("should return zero given the same point twice", () => {
        const location: Location = { x: 1, y: 1 };
        expect(Graph.distance(location, location)).toEqual(0);
    });

    it("should return the distance between two points", () => {
        expect(Graph.distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toEqual(5);
    });
});

function expectGraphsToBeEqual(actual: Graph, expected: Graph): void {
    expect(actual.getAllNodes()).toEqual(expected.getAllNodes());
    expect(actual.getAllEdges()).toEqual(expected.getAllEdges());
}

describe("canonicalizePath()", () => {
    // Expose private static method.
    const canonicalizePath: (path: Path) => Path = (Graph as any)
        .canonicalizePath;

    it("should leave ordinary path unchanged", () => {
        const graph = TestGraphs.getFourNodes();
        const path: Path = {
            start: { edgeId: "AB", distance: 0.5 },
            end: { edgeId: "CD", distance: 0.5 },
            nodes: [graph.getNode("B"), graph.getNode("C")],
            orientedEdges: [
                { edge: graph.getEdge("AB"), isForward: true },
                { edge: graph.getEdge("BC"), isForward: true },
                { edge: graph.getEdge("CD"), isForward: true },
            ],
            locations: [
                { x: 0.5, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 2.5, y: 0 },
            ],
            length: 2,
        };
        const canonPath = canonicalizePath(path);
        expect(canonPath).toEqual(path);
    });

    it("should remove starting zero length segment", () => {
        const graph = TestGraphs.getFourNodes();
        const path: Path = {
            start: { edgeId: "AB", distance: 1 },
            end: { edgeId: "CD", distance: 0.5 },
            nodes: [graph.getNode("B"), graph.getNode("C")],
            orientedEdges: [
                { edge: graph.getEdge("AB"), isForward: true },
                { edge: graph.getEdge("BC"), isForward: true },
                { edge: graph.getEdge("CD"), isForward: true },
            ],
            locations: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2.5, y: 0 }],
            length: 1.5,
        };
        const expected: Path = {
            ...path,
            start: { edgeId: "BC", distance: 0 },
            nodes: [graph.getNode("C")],
            orientedEdges: [
                { edge: graph.getEdge("BC"), isForward: true },
                { edge: graph.getEdge("CD"), isForward: true },
            ],
        };
        const actual = canonicalizePath(path);
        expect(actual).toEqual(expected);
    });

    it("should remove ending zero length segment", () => {
        const graph = TestGraphs.getFourNodes();
        const path: Path = {
            start: { edgeId: "AB", distance: 0.5 },
            end: { edgeId: "CD", distance: 0 },
            nodes: [graph.getNode("B"), graph.getNode("C")],
            orientedEdges: [
                { edge: graph.getEdge("AB"), isForward: true },
                { edge: graph.getEdge("BC"), isForward: true },
                { edge: graph.getEdge("CD"), isForward: true },
            ],
            locations: [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
            length: 1.5,
        };
        const expected: Path = {
            ...path,
            end: { edgeId: "BC", distance: 1 },
            nodes: [graph.getNode("B")],
            orientedEdges: [
                { edge: graph.getEdge("AB"), isForward: true },
                { edge: graph.getEdge("BC"), isForward: true },
            ],
        };
        const actual = canonicalizePath(path);
        expect(actual).toEqual(expected);
    });

    it("should remove both starting and ending zero length segments", () => {
        const graph = TestGraphs.getFourNodes();
        const path: Path = {
            start: { edgeId: "AB", distance: 1 },
            end: { edgeId: "CD", distance: 0 },
            nodes: [graph.getNode("B"), graph.getNode("C")],
            orientedEdges: [
                { edge: graph.getEdge("AB"), isForward: true },
                { edge: graph.getEdge("BC"), isForward: true },
                { edge: graph.getEdge("CD"), isForward: true },
            ],
            locations: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
            length: 1,
        };
        const expected: Path = {
            ...path,
            start: { edgeId: "BC", distance: 0 },
            end: { edgeId: "BC", distance: 1 },
            nodes: [],
            orientedEdges: [{ edge: graph.getEdge("BC"), isForward: true }],
        };
        const actual = canonicalizePath(path);
        expect(actual).toEqual(expected);
    });

    it("should behave on single point path", () => {
        const graph = TestGraphs.getTwoNodes();
        const start = { edgeId: "AB", distance: 0.5 };
        const path: Path = {
            start,
            end: start,
            nodes: [],
            orientedEdges: [{ edge: graph.getEdge("AB"), isForward: true }],
            locations: [{ x: 0.5, y: 0 }],
            length: 0,
        };
        const canonPath = canonicalizePath(path);
        expect(canonPath).toBe(path);
    });

    it("should behave on single point path where that point is a node", () => {
        const graph = TestGraphs.getTwoNodes();
        const start = { edgeId: "AB", distance: 1 };
        const path: Path = {
            start,
            end: start,
            nodes: [],
            orientedEdges: [{ edge: graph.getEdge("AB"), isForward: true }],
            locations: [{ x: 1, y: 0 }],
            length: 0,
        };
        const canonPath = canonicalizePath(path);
        expect(canonPath).toBe(path);
    });

    it("should behave on path where start and end are different representations of same node", () => {
        const graph = TestGraphs.getFourNodes();
        const start = { edgeId: "AB", distance: 1 };
        const end = { edgeId: "BC", distance: 0 };
        const path: Path = {
            start,
            end,
            nodes: [graph.getNode("B")],
            orientedEdges: [
                { edge: graph.getEdge("AB"), isForward: true },
                { edge: graph.getEdge("BC"), isForward: true },
            ],
            locations: [{ x: 1, y: 0 }],
            length: 0,
        };
        const expected: Path = {
            ...path,
            start: end,
            nodes: [],
            orientedEdges: [{ edge: graph.getEdge("BC"), isForward: true }],
        };
        const actual = canonicalizePath(path);
        expect(expected).toEqual(actual);
    });
});
