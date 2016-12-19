import * as chai from "chai";
import Graph from "../src/graph";
import { SimpleEdge, SimpleNode } from "../src/types";

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
        const node = getSingleNode().getAllNodes()[0];
        expect(node.id).to.equal(0);
        expect(node.location).to.deep.equal({ x: 0, y: 0 });
        expect(node.edgeIds).to.be.empty;
    });

    it("should return nodes with edge between them on such a graph", () => {
        const nodes = getTwoNodesConnectedByEdge().getAllNodes();
        expect(nodes).to.have.lengthOf(2);
        const [nodeA, nodeB] = nodes;
        expect(nodeA.id).to.equal(0);
        expect(nodeB.id).to.equal(1);
        expect(nodeA.edgeIds).to.deep.equal([0]);
        expect(nodeB.edgeIds).to.deep.equal([0]);
    });
});

describe("getNode()", () => {
    it("should return the requested node", () => {
        const node = getSingleNode().getNode(0);
        expect(node.id).to.equal(0);
    });

    it("should return undefined if node does not exist", () => {
        expect(getSingleNode().getNode(1)).to.be.undefined;
    });
});

describe("getAllEdges()", () => {
    it("should return nothing on an empty graph", () => {
        const graph = new Graph([], []);
        expect(graph.getAllEdges()).to.be.empty;
    });

    it("should return the edge on a graph with a single edge", () => {
        const edges = getTwoNodesConnectedByEdge().getAllEdges();
        expect(edges).to.have.lengthOf(1);
        const [edge] = edges;
        expect(edge.id).to.equal(0);
        expect(edge.startNodeId).to.equal(0);
        expect(edge.endNodeId).to.equal(1);
        expect(edge.innerLocations).to.be.empty;
        expect(edge.length).to.equal(1);
    });
});

describe("getEdge()", () => {
    it("should return the requested edge", () => {
        const edge = getTwoNodesConnectedByEdge().getEdge(0);
        expect(edge.id).to.equal(0);
    });

    it("should return undefined if edge does not exist", () => {
        expect(getTwoNodesConnectedByEdge().getEdge(1)).to.be.undefined;
    });
});

describe("getEdgesOfNode()", () => {
    it("should return edges with node as their endpoint", () => {
        const edges = getTriangle().getEdgesOfNode("A");
        const edgeIds = edges.map((edge) => edge.id).sort();
        expect(edgeIds).to.deep.equal(["AB", "CA"]);
    });

    it("should throw on nonexistent node ID", () => {
        expect(() => getTriangle().getEdgesOfNode(-1)).to.throw(new RegExp("-1"));
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

function getSingleNode(): Graph {
    const node = { id: 0, location: { x: 0, y: 0 } };
    return new Graph([node], []);
}

function getTwoNodesConnectedByEdge(): Graph {
    const nodeA = { id: 0, location: { x: 0, y: 0 } };
    const nodeB = { id: 1, location: { x: 1, y: 0 } };
    const edgeAB = { id: 0, startNodeId: 0, endNodeId: 1 };
    return new Graph([nodeA, nodeB], [edgeAB]);
};

function getTriangle(): Graph {
    const nodes: SimpleNode[] = [
        { id: "A", location: { x: 0, y: 0 } },
        { id: "B", location: { x: 1, y: 0 } },
        { id: "C", location: { x: 0, y: 1 } },
    ];
    const edges: SimpleEdge[] = [
        { id: "AB", startNodeId: "A", endNodeId: "B" },
        { id: "BC", startNodeId: "B", endNodeId: "C" },
        { id: "CA", startNodeId: "C", endNodeId: "A" },
    ];
    return new Graph(nodes, edges);
}
