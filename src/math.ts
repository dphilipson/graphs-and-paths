import { Location } from "./types";

export function distance(location1: Location, location2: Location): number {
    const dx = location2.x - location1.x;
    const dy = location2.y - location1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function pathLength(path: Location[]): number {
    if (path.length === 0) {
        return 0;
    } else {
        let sum = 0;
        for (let i = 0, limit = path.length - 1; i < limit; i++) {
            sum += distance(path[i], path[i + 1]);
        }
        return sum;
    }
}

export function unimplemented(): never {
    throw new Error("Not yet implemented");
}
