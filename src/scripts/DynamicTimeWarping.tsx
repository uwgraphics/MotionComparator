import assert from "assert";
import { binarySearchLowerBound, zip } from "./helpers";

export type dynTimeWarpDistFunc = (ts1value: number, ts2value: number, ts1Index: number, ts2Index: number) => number;

export class DynamicTimeWarp {
    protected _ts1: number[];
    protected _ts2: number[];
    protected _distFunction: dynTimeWarpDistFunc;

    protected _indexMap: [number[], number[]];

    protected _valueMap: [number[], number[]];

    constructor(ts1: number[], ts2: number[], distanceFunction: dynTimeWarpDistFunc) {
        this._ts1 = ts1;
        this._ts2 = ts2;
        this._distFunction = distanceFunction;

        this._indexMap = dynamicTimeWarp(ts1, ts2, distanceFunction);

        // Full "distance" of ts1 from ts2
        //let distance = matrix[ts1.length - 1][ts2.length - 1];

        let iPath: number[] = [];
        let jPath: number[] = [];
        let [is, js] = this._indexMap;
        for (const [i, j] of zip(is, js)) {
            iPath.push(ts1[i]);
            jPath.push(ts2[j]);
        }
        this._valueMap = [iPath, jPath];

        let [baseTimes, targetTimes] = this._valueMap;

        // Assert that both arrays are in ascending order
        assert(baseTimes[0] <= baseTimes[baseTimes.length - 1])
        assert(targetTimes[0] <= targetTimes[targetTimes.length - 1])
    }

    ts1 = (): ReadonlyArray<number> => { return this._ts1; }
    ts2 = (): ReadonlyArray<number> => { return this._ts2; }

    distFunction = (): dynTimeWarpDistFunc => { return this._distFunction; }

    /**
     * @returns The map of indexes in ts1 to indexes in ts2.
     */
    indexMap = (): [ReadonlyArray<number>, ReadonlyArray<number>] => {
        return this._indexMap;
    }

    /**
     * @returns The map of values in ts1 to values in ts2.
     */
    valueMap = (): readonly [readonly number[], readonly number[]] => {
        return this._valueMap;
    }

    // Time Warping

    protected doTimeWarp = (currTime:number, currSceneTimes: readonly number[], otherSceneTimes: readonly number[], key?: (currTime:number) => boolean): number => {
        if (currTime < currSceneTimes[0]) {
            currTime = currSceneTimes[0];
        } else if (currTime >= currSceneTimes[currSceneTimes.length - 1]) {
            currTime = currSceneTimes[currSceneTimes.length - 1];
        }

        let currStartI = Math.min(binarySearchLowerBound(currSceneTimes, currTime), currSceneTimes.length - 1);
        return otherSceneTimes[currStartI] ?? currTime;

        // Within these bounds [currStartI, currEndI) lies the same value (possibly repeated over and over again)
//        let [currStartI, currEndI] = binarySearchBounds(currSceneTimes, currTime);
//        let prevCurrStartI = Math.max(currStartI - 1, 0);
//        let nextCurrEndI = Math.min(currEndI, currSceneTimes.length - 1);
//        let prevCurrStartTime = currSceneTimes[prevCurrStartI];
//        let nextCurrEndTime = currSceneTimes[nextCurrEndI];
//
//        let otherTime = otherSceneTimes[currStartI];
//
//        let [otherStartI, otherEndI] = binarySearchBounds(otherSceneTimes, otherTime);
//        let prevOtherStartI = Math.max(otherStartI - 1, 0);
//        let nextOtherEndI = Math.min(otherEndI, currSceneTimes.length - 1);
//        let prevOtherStartTime = otherSceneTimes[prevOtherStartI];
//        let nextOtherEndTime = otherSceneTimes[nextOtherEndI];
//        return lerp(prevOtherStartTime, nextOtherEndTime, lerpT(prevCurrStartTime, currTime, nextCurrEndTime));
    }

    /**
     * @returns The map of values in ts1 to values in ts2. This is an alias for
     * `this.valueMap()`.
     */
    timeWarpMap = (): readonly [readonly number[], readonly number[]] =>{
        return this._valueMap;
    }

    /**
     * @param baseTime The time in the base scene's time scale.
     * @param key Optional key function used as the key in the
     * `binarySearchLowerBound` function. The binary search
     * function is used to map the given `baseTime` to a target
     * time.
     * @returns The time in the target scene's time scale.
     */
    timeWarp = (baseTime: number, key?: (baseTime:number) => boolean): number => {
        let [baseSceneTimes, targetSceneTimes] = this.timeWarpMap();
        return this.doTimeWarp(baseTime, baseSceneTimes, targetSceneTimes, key);
    }

    /**
     * @param targetTime The time in the target scene's time scale.
     * @param key Optional key function used as the key in the
     * `binarySearchLowerBound` function. The binary search
     * function is used to map the given `target` to a base
     * time.
     * @returns The time in the base scene's time scale.
     */
    untimeWarp = (targetTime: number, key?: (targetTime:number) => boolean): number =>{
        let [baseSceneTimes, targetSceneTimes] = this.timeWarpMap();
        return this.doTimeWarp(targetTime, targetSceneTimes, baseSceneTimes, key);
    }
}


/**
 * Goes backward through the matrix and returns the indexes that make up the
 * path through the matrix.
 * 
 * In other words, it traverses the shortest path from start "s" to end "e" and
 * returns each [[.., i, ..], [.., j, ..]] index of each cell that should be used.
 * 
 * [
 *  [e, x, x],
 *  [x, x, x],
 *  [x, x, x],
 *  [x, x, s],
 * ]
 * 
 * Note: the returned arrays are parallel arrays so every value at index "i" in one array
 * corresponds to the value at index "i" of the other array. As such, both
 * arrays will always be the same length.
 */
function traverseMatrix(matrix: number[][]): [number[], number[]] {
    let i = matrix.length - 1;
    let j = matrix[0] !== undefined ? matrix[0].length - 1 : 0;
    let path_is = [];
    let path_js = [];
    while (i > 0 || j > 0) {
        if (i > 0) {
            if (j > 0) {
                if (matrix[i - 1][j] < matrix[i - 1][j - 1]) {
                    if (matrix[i - 1][j] < matrix[i][j - 1]) {
                        path_is.push(i - 1);
                        path_js.push(j);
                        i--;
                    } else {
                        path_is.push(i);
                        path_js.push(j - 1);
                        j--;
                    }
                } else {
                    if (matrix[i - 1][j - 1] < matrix[i][j - 1]) {
                        path_is.push(i - 1);
                        path_js.push(j - 1);
                        i--;
                        j--;
                    } else {
                        path_is.push(i);
                        path_js.push(j - 1);
                        j--;
                    }
                }
            } else {
                path_is.push(i - 1);
                path_js.push(j);
                i--;
            }
        } else {
            path_is.push(i);
            path_js.push(j - 1);
            j--;
        }
    }
    // Paths are in descending order but we want ascending order (like they were given) so reverse them
    path_is.reverse();
    path_js.reverse();
    return [path_is, path_js];
}


/**
 * Dynamically maps the items from list ts1 to items in ts2, trying to keep them
 * as aligned as possible.
 * @param ts1 The first list of items.
 * @param ts2 The second list of items.
 * @param distanceFunction The function used to calculate the distance between each two items.
 * @returns A list mapping each index from ts1 to an index in ts2.
 */
function dynamicTimeWarp(ts1: number[], ts2: number[], distanceFunction: dynTimeWarpDistFunc): [number[], number[]] {
    let matrix: number[][] = [];
    for (let i = 0; i < ts1.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < ts2.length; j++) {
            let cost = Infinity;
            if (i > 0) {
                cost = Math.min(cost, matrix[i - 1][j]);
                if (j > 0) {
                    cost = Math.min(cost, matrix[i - 1][j - 1]);
                    cost = Math.min(cost, matrix[i][j - 1]);
                }
            } else {
                if (j > 0) {
                    cost = Math.min(cost, matrix[i][j - 1]);
                } else {
                    cost = 0;
                }
            }
            matrix[i][j] = cost + distanceFunction(ts1[i], ts2[j], i, j);
        }
    }
    let traversed = traverseMatrix(matrix);
    return traversed;
}



