import { Location } from "./types";

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

export function getDistanceAlongPath(path: Location[], distance: number): Location {
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

function distanceBetween(location1: Location, location2: Location): number {
    const dx = location2.x - location1.x;
    const dy = location2.y - location1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function unimplemented(): never {
    throw new Error("Not yet implemented");
}