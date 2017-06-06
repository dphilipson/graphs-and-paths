declare module "rbush-knn" {
    import rbush = require("rbush");

    function knn<T>(
        tree: rbush.RBush<T>,
        x: number,
        y: number,
        k?: number,
        filterFn?: (t: T) => boolean,
    ): T[];

    export = knn;
}
