import { expect } from "chai";
import Graph from "../src/graph";
import { Location, SimpleEdge, SimpleNode } from "../src/types";
import * as TestGraphs from "./testGraphs";

describe("constructor", () => {
    it("should fail if node ID is repeated", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 0, y: 0 } },
            { id: 0, location: { x: 0, y: 1 } },
        ];
        expect(() => Graph.create(nodes, [])).to.throw(/0/);
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
        expect(() => Graph.create(nodes, edges)).to.throw(/0/);
    });

    it("should fail if edge references nonexistent node", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 0, y: 0 } },
            { id: 1, location: { x: 0, y: 1 } },
        ];
        const edges: SimpleEdge[] = [{ id: 0, startNodeId: 0, endNodeId: 2 }];
        expect(() => Graph.create(nodes, edges)).to.throw(/2/);
    });
});

describe("getAllNodes()", () => {
    it("should return nothing on an empty graph", () => {
        const graph = Graph.create([], []);
        expect(graph.getAllNodes()).to.be.empty;
    });

    it("should return a node with no edges if it is entire graph", () => {
        const node = TestGraphs.getSingleNode().getAllNodes()[0];
        expect(node.id).to.equal(0);
        expect(node.location).to.deep.equal({ x: 0, y: 0 });
        expect(node.edgeIds).to.be.empty;
    });

    it("should return nodes with edge between them on such a graph", () => {
        const nodes = TestGraphs.getTwoNodes().getAllNodes();
        expect(nodes).to.have.lengthOf(2);
        const [nodeA, nodeB] = nodes;
        expect(nodeA.id).to.equal("A");
        expect(nodeB.id).to.equal("B");
        expect(nodeA.edgeIds).to.deep.equal(["AB"]);
        expect(nodeB.edgeIds).to.deep.equal(["AB"]);
    });
});

describe("getNode()", () => {
    it("should return the requested node", () => {
        const node = TestGraphs.getSingleNode().getNode(0);
        expect(node.id).to.equal(0);
    });

    it("should return undefined if node does not exist", () => {
        expect(TestGraphs.getSingleNode().getNode(1)).to.be.undefined;
    });
});

describe("getAllEdges()", () => {
    it("should return nothing on an empty graph", () => {
        const graph = Graph.create([], []);
        expect(graph.getAllEdges()).to.be.empty;
    });

    it("should return the edge on a graph with a single edge", () => {
        const edges = TestGraphs.getTwoNodes().getAllEdges();
        expect(edges).to.have.lengthOf(1);
        const [edge] = edges;
        expect(edge.id).to.equal("AB");
        expect(edge.startNodeId).to.equal("A");
        expect(edge.endNodeId).to.equal("B");
        expect(edge.innerLocations).to.be.empty;
        expect(edge.length).to.equal(1);
    });
});

describe("getEdge()", () => {
    it("should return the requested edge", () => {
        const edge = TestGraphs.getTwoNodes().getEdge("AB");
        expect(edge.id).to.equal("AB");
    });

    it("should return undefined if edge does not exist", () => {
        expect(TestGraphs.getTwoNodes().getEdge(1)).to.be.undefined;
    });
});

describe("getEdgesOfNode()", () => {
    it("should return edges with node as their endpoint", () => {
        const edges = TestGraphs.getTriangle().getEdgesOfNode("A");
        const edgeIds = edges.map((edge) => edge.id).sort();
        expect(edgeIds).to.deep.equal(["AB", "CA"]);
    });

    it("should throw on nonexistent node ID", () => {
        expect(() => TestGraphs.getTriangle().getEdgesOfNode(-1)).to.throw(/-1/);
    });
});

describe("getEndpointsOfEdge()", () => {
    it("should return nodes at ends of edge", () => {
        const endpoints = TestGraphs.getTriangle().getEndpointsOfEdge("CA");
        expect(endpoints.map((node) => node.id)).to.deep.equal(["C", "A"]);
    });

    it("should throw on nonexistent edge ID", () => {
        expect(() => TestGraphs.getTriangle().getEndpointsOfEdge(-1)).to.throw(/-1/);
    });
});

describe("getOtherEndpoint()", () => {
    it("should return the other endpoint of an edge", () => {
        const endpoint = TestGraphs.getTwoNodes().getOtherEndpoint("AB", "A");
        expect(endpoint.id).to.equal("B");
    });

    it("should throw on nonexistent edge ID", () => {
        expect(() => TestGraphs.getTwoNodes().getOtherEndpoint("TD", "A")).to.throw(/TD/);
    });

    it("should throw if node is not an endpoint of edge", () => {
        expect(() => TestGraphs.getTriangle().getOtherEndpoint("AB", "C")).to.throw(/endpoint/);
    });
});

describe("getNeighbors()", () => {
    it("should return the neighbors of a node", () => {
        const neighbors = TestGraphs.getTriangle().getNeighbors("A");
        expect(neighbors.map((node) => node.id).sort()).to.deep.equal(["B", "C"]);
    });

    it("should throw nonexistent node ID", () => {
        expect(() => TestGraphs.getTriangle().getNeighbors("TD")).to.throw(/TD/);
    });
});

describe("getLocation()", () => {
    it("should return the correct location on an edge with no inner points", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 10, y: 10 } },
            { id: "B", location: { x: 40, y: 50 } },
        ];
        const edges: SimpleEdge[] = [{ id: "AB", startNodeId: "A", endNodeId: "B" }];
        const graph = Graph.create(nodes, edges);
        const distances = [0, 10, 50];
        const expectedLocations: Location[] = [
            { x: 10, y: 10 },
            { x: 16, y: 18 },
            { x: 40, y: 50 },
        ];
        const actualLocations = distances.map((distance) => graph.getLocation({ edgeId: "AB", distance }));
        expect(actualLocations).to.deep.equal(expectedLocations);
    });

    it("should return the correct location on an edge with inner points", () => {
        // Path is a "stairwell" with two steps.
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 2, y: 2 } },
        ];
        const edges: SimpleEdge[] = [{
            id: "AB",
            startNodeId: "A",
            endNodeId: "B",
            innerLocations: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        }];
        const graph = Graph.create(nodes, edges);
        const distances = [0, 1, 2.5, 4];
        const expectedLocations: Location[] = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1.5, y: 1 },
            { x: 2, y: 2 },
        ];
        const actualLocations = distances.map((distance) => graph.getLocation({ edgeId: "AB", distance }));
        expect(actualLocations).to.deep.equal(expectedLocations);
    });

    it("should behave in double imprecision corner case", () => {
        // Fact: 2/3 + 1/3 === 1, but 1 - 2/3 - 1/3 !== 0 in floating point arithmatic.
        // This test checks that this does not cause trouble for us.
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 2 / 3, y: 1 / 3 } },
        ];
        const edges: SimpleEdge[] = [{
            id: "AB",
            startNodeId: "A",
            endNodeId: "B",
            innerLocations: [{ x: 2 / 3, y: 0 }],
        }];
        const graph = Graph.create(nodes, edges);
        const { length } = graph.getEdge("AB");
        expect(graph.getLocation({ edgeId: "AB", distance: length })).to.deep.equal({ x: 2 / 3, y: 1 / 3 });
    });

    it("should throw on nonexistent edgeId", () => {
        expect(() => TestGraphs.getTriangle().getLocation({ edgeId: "TD", distance: 0 })).to.throw(/TD/);
    });

    it("should return start on negative distance", () => {
        expect(TestGraphs.getTriangle().getLocation({ edgeId: "AB", distance: -1 })).to.deep.equal({ x: 0, y: 0 });
    });

    it("should return end on distance greater than edge length", () => {
        expect(TestGraphs.getTriangle().getLocation({ edgeId: "AB", distance: 10 })).to.deep.equal({ x: 1, y: 0 });
    });
});

describe("lengths", () => {
    it("should be correct for edge with no inner locations", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 1, y: 1 } },
            { id: 1, location: { x: 4, y: -3 } },
        ];
        const edges: SimpleEdge[] = [{ id: 0, startNodeId: 0, endNodeId: 1 }];
        const edge = Graph.create(nodes, edges).getEdge(0);
        expect(edge.length).to.equal(5);
    });

    it("should be correct for edge with inner locations", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 0, y: 0 } },
            { id: 1, location: { x: 0, y: 6 } },
        ];
        const edges: SimpleEdge[] = [{
            id: 0,
            startNodeId: 0,
            endNodeId: 1,
            innerLocations: [{ x: 4, y: 3 }],
        }];
        const edge = Graph.create(nodes, edges).getEdge(0);
        expect(edge.length).to.equal(10);
    });
});

describe("coalesced()", () => {
    it("should return identical graph if nothing to coalesce", () => {
        const graph = TestGraphs.getTwoNodes();
        const coalesced = graph.coalesced();
        expect(coalesced.getAllNodes()).to.deep.equal(graph.getAllNodes());
        expect(coalesced.getAllEdges()).to.deep.equal(graph.getAllEdges());
    });

    it("should coalesce segmented curve into single curve", () => {
        const nodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "B", location: { x: 1, y: 0 } },
            { id: "C", location: { x: 1, y: 1 } },
            { id: "D", location: { x: 2, y: 1 } },
        ];
        const edges: SimpleEdge[] = [
            { id: "AB", startNodeId: "A", endNodeId: "B" },
            { id: "BC", startNodeId: "B", endNodeId: "C" },
            { id: "CD", startNodeId: "C", endNodeId: "D" },
        ];
        const expectedNodes: SimpleNode[] = [
            { id: "A", location: { x: 0, y: 0 } },
            { id: "D", location: { x: 2, y: 1 } },
        ];
        const expectedEdges: SimpleEdge[] = [
            {
                id: "AB",
                startNodeId: "A",
                endNodeId: "D",
                innerLocations: [{ x: 1, y: 0 }, { x: 1, y: 1 }],
            },
        ];
        const graph = Graph.create(nodes, edges).coalesced();
        const expectedGraph = Graph.create(expectedNodes, expectedEdges);
        expect(graph.getAllNodes()).to.deep.equal(expectedGraph.getAllNodes());
        expect(graph.getAllEdges()).to.deep.equal(expectedGraph.getAllEdges());
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
            { id: "rightArm1", startNodeId: "center", endNodeId: "rightArmJoint" },
            { id: "rightArm2", startNodeId: "rightArmJoint", endNodeId: "rightArmEnd" },
            { id: "topArm1", startNodeId: "center", endNodeId: "topArmJoint" },
            { id: "topArm2", startNodeId: "topArmJoint", endNodeId: "topArmEnd" },
            { id: "leftArm1", startNodeId: "center", endNodeId: "leftArmJoint" },
            { id: "leftArm2", startNodeId: "leftArmJoint", endNodeId: "leftArmEnd" },
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
        expect(graph.getAllNodes()).to.deep.equal(expectedGraph.getAllNodes());
        expect(graph.getAllEdges()).to.deep.equal(expectedGraph.getAllEdges());
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
        const expectedEdges: SimpleEdge[] = [{
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
        }];
        const graph = Graph.create(nodes, edges).coalesced();
        const expectedGraph = Graph.create(expectedNodes, expectedEdges);
        expect(graph.getAllNodes()).to.deep.equal(expectedGraph.getAllNodes());
        expect(graph.getAllEdges()).to.deep.equal(expectedGraph.getAllEdges());
    });

    it("should handle an isolated cycle", () => {
        const expectedNodes: SimpleNode[] = [{ id: "A", location: { x: 0, y: 0 } }];
        const expectedEdges: SimpleEdge[] = [{
            id: "AB",
            startNodeId: "A",
            endNodeId: "A",
            innerLocations: [{ x: 1, y: 0 }, { x: 0, y: 1 }],
        }];
        const graph = TestGraphs.getTriangle().coalesced();
        const expectedGraph = Graph.create(expectedNodes, expectedEdges);
        expect(graph.getAllNodes()).to.deep.equal(expectedGraph.getAllNodes());
        expect(graph.getAllEdges()).to.deep.equal(expectedGraph.getAllEdges());
    });
});
