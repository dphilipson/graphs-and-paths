import * as chai from "chai";
import Graph from "../src/graph";
import { SimpleEdge, SimpleNode } from "../src/types";
import * as TestGraphs from "./testGraphs";

const { expect } = chai;

describe("constructor", () => {
    it("should fail if node ID is repeated", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 0, y: 0 } },
            { id: 0, location: { x: 0, y: 1 } },
        ];
        expect(() => new Graph(nodes, [])).to.throw(/0/);
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
        expect(() => new Graph(nodes, edges)).to.throw(/0/);
    });

    it("should fail if edge references nonexistent node", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 0, y: 0 } },
            { id: 1, location: { x: 0, y: 1 } },
        ];
        const edges: SimpleEdge[] = [{ id: 0, startNodeId: 0, endNodeId: 2 }];
        expect(() => new Graph(nodes, edges)).to.throw(/2/);
    });
});

describe("getAllNodes()", () => {
    it("should return nothing on an empty graph", () => {
        const graph = new Graph([], []);
        expect(graph.getAllNodes()).to.be.empty;
    });

    it("should return a node with no edges if it is entire graph", () => {
        const node = TestGraphs.getSingleNode().getAllNodes()[0];
        expect(node.id).to.equal(0);
        expect(node.location).to.deep.equal({ x: 0, y: 0 });
        expect(node.edgeIds).to.be.empty;
    });

    it("should return nodes with edge between them on such a graph", () => {
        const nodes = TestGraphs.getTwoNodesConnectedByEdge().getAllNodes();
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
        const graph = new Graph([], []);
        expect(graph.getAllEdges()).to.be.empty;
    });

    it("should return the edge on a graph with a single edge", () => {
        const edges = TestGraphs.getTwoNodesConnectedByEdge().getAllEdges();
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
        const edge = TestGraphs.getTwoNodesConnectedByEdge().getEdge("AB");
        expect(edge.id).to.equal("AB");
    });

    it("should return undefined if edge does not exist", () => {
        expect(TestGraphs.getTwoNodesConnectedByEdge().getEdge(1)).to.be.undefined;
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

describe("distances", () => {
    it("should be correct for edge with no inner locations", () => {
        const nodes: SimpleNode[] = [
            { id: 0, location: { x: 1, y: 1 } },
            { id: 1, location: { x: 4, y: -3 } },
        ];
        const edges: SimpleEdge[] = [{ id: 0, startNodeId: 0, endNodeId: 1 }];
        const edge = new Graph(nodes, edges).getEdge(0);
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
        const edge = new Graph(nodes, edges).getEdge(0);
        expect(edge.length).to.equal(10);
    });
});
