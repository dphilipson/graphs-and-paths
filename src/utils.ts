/**
 * Collection of helper methods. These are not exported, and all functions in this file should be
 * marked @hidden.
 */
import { Location, OrientedEdge } from "./types";

/** @hidden */
export function last<T>(ts: T[]): T {
    if (ts.length === 0) {
        throw new Error("Cannot take last element of empty array");
    }
    return ts[ts.length - 1];
}

/**
 * Given an array of locations representing a path, returns an array of the same size representing
 * the cumulative distance to each location in the input. Specifically, the ith element of the
 * returned array is the distance from the start of the path to its ith location. In particular,
 * this means the first element of the returned array is 0 and the last element is the total length
 * of the path.
 * 
 * @hidden
 */
export function getCumulativeDistances(path: Location[]): number[] {
    if (path.length === 0) {
        return [];
    } else {
        let sum = 0;
        const distances: number[] = [0];
        for (let i = 0, limit = path.length - 1; i < limit; i++) {
            sum += distanceBetween(path[i], path[i + 1]);
            distances.push(sum);
        }
        return distances;
    }
}

/**
 * Assuming xs is sorted, returns the index of the largest element of xs which is at most x. If all
 * elements xs are larger than x, then return -1.
 * 
 * @hidden
 */
export function findFloorIndex(xs: number[], x: number): number {
    // Min-max are inclusive-exclusive.
    let minIndex = -1;
    let maxIndex = xs.length;
    while (minIndex < maxIndex - 1) {
        const guessIndex = (minIndex + maxIndex) / 2 | 0;
        const guess = xs[guessIndex];
        if (guess < x) {
            minIndex = guessIndex;
        } else if (guess === x) {
            return guessIndex;
        } else {
            maxIndex = guessIndex;
        }
    }
    return minIndex;
}

/** @hidden */
export function getIntermediateLocation(start: Location, end: Location, distance: number): Location {
    const length = distanceBetween(start, end);
    const t = clamp(distance / length, 0, 1);
    return {
        x: (1 - t) * start.x + t * end.x,
        y: (1 - t) * start.y + t * end.y,
    };
}

/** @hidden */
function clamp(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
}

/** @hidden */
export function distanceBetween(location1: Location, location2: Location): number {
    const dx = location2.x - location1.x;
    const dy = location2.y - location1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/** @hidden */
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

/** @hidden */
export function reversePath(edges: OrientedEdge[]): OrientedEdge[] {
    return edges
        .map(({edge, isForward}) => ({ edge, isForward: !isForward }))
        .reverse();
}

/** @hidden */
export function flatMap<T, U>(array: T[], f: (t: T) => U[]): U[] {
    return array.reduce((result: U[], t) => pushAll(result, f(t)), []);
}

/** @hidden */
export function min<T>(array: T[], comparator: (t1: T, t2: T) => number): T {
    if (array.length === 0) {
        throw new Error("Cannot take minimum of empty array");
    }
    return array.reduce((a, b) => comparator(a, b) < 0 ? a : b);
}

/**
 * Returns information about the closest point on segment ab to point p.
 * 
 * @hidden
 */
export function closestPointOnSegment(
    p: Location,
    a: Location,
    b: Location,
): { distanceDownSegment: number, distanceFromLocation: number } {
    const apX = p.x - a.x;
    const apY = p.y - a.y;
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const ab2 = abX * abX + abY * abY;
    const apDotAb = apX * abX + apY * abY;
    const unclampedT = apDotAb / ab2;
    const t = clamp(unclampedT, 0, 1);
    const distanceDownSegment = Math.sqrt(ab2) * t;
    const closestPoint: Location = {
        x: a.x + t * abX,
        y: a.y + t * abY,
    };
    const distanceFromLocation = distanceBetween(p, closestPoint);
    return { distanceDownSegment, distanceFromLocation };
}

/** @hidden */
export function areLocationsEqual(location1: Location, location2: Location): boolean {
    return location1.x === location2.x && location1.y === location2.y;
}

/** @hidden */
export function dedupeLocations(locations: Location[]): Location[] {
    return dedupe(locations, areLocationsEqual);
}

/** @hidden */
function dedupe<T>(
    ts: T[],
    equals = ((t1: T, t2: T) => t1 === t2),
): T[] {
    const result: T[] = [];
    ts.forEach((t) => {
        if (result.length === 0 || !equals(last(result), t)) {
            result.push(t);
        }
    });
    return result;
}

/** @hidden */
export function pushAll<T>(array: T[], toAdd: T[]): T[] {
    toAdd.forEach((t) => array.push(t));
    return array;
}
