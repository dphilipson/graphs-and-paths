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

export function getIntermediateLocation(start: Location, end: Location, distance: number): Location {
    if (distance < 0) {
        throw new Error(`Distance cannot be negative, but was ${distance}`);
    }
    const length = distanceBetween(start, end);
    if (distance > length) {
        throw new Error(`Distance ${distance} was greater than lenth between endpoints ${length}`);
    }
    const t = distance / length;
    return {
        x: (1 - t) * start.x + t * end.x,
        y: (1 - t) * start.y + t * end.y,
    };
}

function distanceBetween(location1: Location, location2: Location): number {
    const dx = location2.x - location1.x;
    const dy = location2.y - location1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function unimplemented(): never {
    throw new Error("Not yet implemented");
}
