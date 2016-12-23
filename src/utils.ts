import { Edge, Location, OrientedEdge, SimpleEdge } from "./types";

export function getPathLength(path: Location[]): number {
    if (path.length === 0) {
        return 0;
    } else {
        let sum = 0;
        for (let i = 0, limit = path.length - 1; i < limit; i++) {
            sum += distanceBetween(path[i], path[i + 1]);
        }
        return sum;
    }
}

export function getLocationAlongPath(path: Location[], distance: number): Location {
    const numPointsInPath = path.length;
    let distanceLeft = distance;
    for (let i = 0; i < numPointsInPath - 1; i++) {
        const segmentStart = path[i];
        const segmentEnd = path[i + 1];
        const segmentLength = distanceBetween(segmentStart, segmentEnd);
        if (distanceLeft <= segmentLength) {
            return getIntermediateLocation(segmentStart, segmentEnd, distanceLeft);
        } else {
            distanceLeft -= segmentLength;
        }
    }
    return path[numPointsInPath - 1];
}

function getIntermediateLocation(start: Location, end: Location, distance: number): Location {
    const length = distanceBetween(start, end);
    const t = clamp(distance / length, 0, 1);
    return {
        x: (1 - t) * start.x + t * end.x,
        y: (1 - t) * start.y + t * end.y,
    };
}

function clamp(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
}

export function distanceBetween(location1: Location, location2: Location): number {
    const dx = location2.x - location1.x;
    const dy = location2.y - location1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function compareIds(id1: number | string, id2: number | string) {
    // Numbers before strings, then natural order.
    if (typeof id1 === typeof id2) {
        if (id1 < id2) {
            return -1;
        } else if (id1 === id2) {
            return 0;
        } else {
            return 1;
        }
    } else if (typeof id1 === "number") {
        return -1;
    } else {
        return 1;
    }
}

export function reversePath(edges: OrientedEdge[]): OrientedEdge[] {
    return edges
        .map(({edge, isForward}) => ({edge, isForward: !isForward}))
        .reverse();
}

export function flatMap<T, U>(array: T[], f: (t: T) => U[]): U[] {
    return Array.prototype.concat.apply([], array.map(f));
}

export function min<T>(array: T[], comparator: (t1: T, t2: T) => number): T {
    if (array.length === 0) {
        throw new Error("Cannot take minimum of empty array");
    }
    return array.reduce((a, b) => comparator(a, b) < 0 ? a : b);
}

export function unimplemented(): never {
    throw new Error("Not yet implemented");
}
