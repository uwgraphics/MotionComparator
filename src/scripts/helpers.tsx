import { AssertionError } from 'assert';
import T from './true_three';

/**
 * Converts the given animation_frame from Gazebo coordinates to Threejs coordinates.
 * THREE.js
 *    Y
 *    |
 *    |
 *    .-----X
 *  ／
 *  Z
 *  
 *  ROS URDf
 *        Z
 *        |   X
 *        | ／
 *  Y-----.
 * @param rotation The current rotation of the object.
 * @param position The current position of the object.
 * @returns The given rotation and position converted from Gazebo Coodinates to
 * Threejs coordinates.
 */
export function gazeboToThreeCoords(rotation:T.Quaternion, position:T.Vector3): [T.Quaternion, T.Vector3] {
    // Transform the rotation from the old one to the new coordinate system.
    let q = new T.Quaternion(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0, rotation.w ?? 0);
    let axis = new T.Vector3();
    let angle = 0;

    {
        let t = q.w * q.w;
        angle = 2 * Math.acos(q.w);
        axis.x = q.x / Math.max(Math.sqrt(1 - t), 0.00000001);
        axis.y = q.y / Math.max(Math.sqrt(1 - t), 0.00000001);
        axis.z = q.z / Math.max(Math.sqrt(1 - t), 0.00000001);

        let axis2 = new T.Vector3();
        axis2.z = axis.x;
        axis2.x = axis.y;
        axis2.y = axis.z;
        
        let q2 = new T.Quaternion();
        q2.setFromAxisAngle(axis2, angle);
        q.copy(q2);
    }

    // Transform the postion from the old coordinate system to the new one
    let pos = position.clone();
    {
        let x = pos.x;
        let y = pos.y;
        let z = pos.z;

        // Switch Y and Z axis
        pos.y = z;
        pos.z = y;

        // mirror x axis
        pos.x = x ? -x : x;

        // Need to rotate 90 degrees about the origin on the Y axis (because
        // that's what works)
        let p = new T.Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
        p.applyEuler(new T.Euler(0, Math.PI / 2, 0));
        pos.x = p.x;
        pos.y = p.y;
        pos.z = p.z;
    }

    return [q, pos];
}

let ESC_MAP: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * Sanatizes text so that it is safe to put into the DOM.
 * @param s The text to sanatize.
 * @param forAttribute Whether the text is for an attribute.
 * @returns The sanatized text.
 */
export function sanitizeText(s: string, forAttribute: boolean): string {
    return s.replace(
            forAttribute ? /[&<>'"]/g : /[&<>]/g,
            function(c: string) { return ESC_MAP[c]; }
    );
}

export function findLargestSmallerElement(array: number[], target: number): number {
    let left = 0;
    let right = array.length - 1;
    let result = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);

        if (array[mid] < target) {
            result = mid; // Update the result and continue searching in the right half
            left = mid + 1;
        } else {
            right = mid - 1; // Search in the left half
        }
    }

    return result;
}

/**
* process the option name according to its prefix
* @param currDataType 
* @param currSpeciProperty 
* @returns 
*/
export function processProperties(eventName: string): string{
   let [, currSpeciProperty, currDataType] = eventName.split("&");
   let [, dataType] = currDataType.split(" ");
   if(currDataType.startsWith("joint"))return "&angle" + "&" + dataType;
   else return "&" + currSpeciProperty + "&" + dataType;
}

export function getEndPointFromQuaternion(quaternion: T.Quaternion, pre_vector: T.Vector3 | undefined, positive: boolean): T.Vector3
{
    quaternion.normalize();
    let endpoint = undefined;
    const origin = new T.Vector3(0, 0, 0);
    if (pre_vector != undefined) {
        let v1 = new T.Vector3(quaternion.x, quaternion.y, quaternion.z);
        let v2 = new T.Vector3(-quaternion.x, -quaternion.y, -quaternion.z);
        let d1 = v1.distanceTo(pre_vector);
        let d2 = v2.distanceTo(pre_vector);
        if  (d1 < d2 || d1 == d2 && positive)
            endpoint = origin.clone().add(v1);
        else 
            endpoint = origin.clone().add(v2);
    } else {
        let v = new T.Vector3(-quaternion.x, -quaternion.y, -quaternion.z);
        if(positive) v = new T.Vector3(quaternion.x, quaternion.y, quaternion.z);
        // let v = new T.Vector3(-quaternion.x, -quaternion.y, -quaternion.z);
        // if (quaternion.w < 0)
        //     v = new T.Vector3(quaternion.x, quaternion.y, quaternion.z);
        endpoint = origin.clone().add(v);
    }
    return endpoint;
}

/**
 * get the values of the distance levels
 * @param array distance array
 * @returns 
 */
export function getDistanceLevels(array: number[]): number[] {
    function partition(arr: number[], left: number, right: number, pivotIndex: number): number {
      const pivotValue = arr[pivotIndex];
      [arr[pivotIndex], arr[right]] = [arr[right], arr[pivotIndex]];
      let storeIndex = left;
      
      for (let i = left; i < right; i++) {
        if (arr[i] < pivotValue) {
          [arr[i], arr[storeIndex]] = [arr[storeIndex], arr[i]];
          storeIndex++;
        }
      }
      
      [arr[storeIndex], arr[right]] = [arr[right], arr[storeIndex]];
      return storeIndex;
    }
    
    function selectKth(arr: number[], left: number, right: number, k: number): number {
      while (left <= right) {
        const pivotIndex = Math.floor((left + right) / 2);
        const pivotNewIndex = partition(arr, left, right, pivotIndex);
        
        if (pivotNewIndex === k) {
          return arr[pivotNewIndex];
        } else if (k < pivotNewIndex) {
          right = pivotNewIndex - 1;
        } else {
          left = pivotNewIndex + 1;
        }
      }
      return arr[left];
    }
    
    const n = array.length;
    let result: number[] = [];
    let previous = -1;
    for(let i=0.1; i<1; i+=0.1) // get the n*i th largest element in the array, which is the value of that threshold
    {
        let curr = selectKth(array, 0, n - 1, Math.floor(n*i));
        if(curr - previous >= 0.01) // make sure that each level has relatively large differences
        {
            previous = curr;
            result.push(curr);
        }
    }
    
    return result;
  }

/**
 * get the lighted color of the selected color
 * @param color 
 * @param factor 
 * @returns 
 */
export function lightenColor(color: string, factor: number): [number, number, number] {
    let threeColor = new T.Color(color);
    threeColor = threeColor.lerp(new T.Color("white"), factor);
    return [threeColor.r, threeColor.g, threeColor.b];
}

export function binarySearchIndexLargestSmallerEqual(arr: number[], target: number): number | undefined {
    let left = 0;
    let right = arr.length - 1;
    let index: number | undefined = undefined;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (arr[mid] <= target) {
            index = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    
    return index;
}

export function binarySearchIndexSmallestGreaterEqual(arr: number[], target: number): number | undefined {
    let left = 0;
    let right = arr.length - 1;
    let index: number | undefined = undefined;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (arr[mid] >= target) {
            index = mid;
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    
    return index;
}

export function recurseMaterialTraverse(material:undefined | T.Material | T.Material[], func:(material:T.Material)=>void) {
    if (material === undefined) {
    } else if (Array.isArray(material)) {
        for (const mat of material) {
            recurseMaterialTraverse(mat, func);
        }
    } else {
        func(material);
    }
}


/**
 * Returns a generator that parses the given CSV string row by row, yielding
 * each row sequentially from the first to the last.
 * @param str The CSV string that should be parsed.
 * 
 * Note: This function was derived from https://stackoverflow.com/a/14991797
 */
export function *parseCSVFromString(str: string): Generator<(string | number)[], any, void> {
    str = str.trim();
    // Iterate over each character, keep track of current row and column (of the returned array)
    for (var quote:boolean = false, arr:(string|number)[] = [], col = 0, c = 0; c < str.length; c++) {
        var cc = str[c], nc = str[c+1];       // Current character, next character
        arr[col] = arr[col] || '';   // Create a new column (start with empty string) if necessary

        // If the current character is a quotation mark, and we're inside a
        // quoted field, and the next character is also a quotation mark,
        // add a quotation mark to the current column and skip the next character
        if (cc === '"' && quote && nc === '"') { arr[col] += cc; ++c; } else 

        // If it's just one quotation mark, begin/end quoted field
        if (cc === '"') { ( quote = !quote ); } else

        // If it's a comma and we're not in a quoted field, move on to the next column
        if (cc === ',' && !quote) { ++col; } else

        // If it's a newline (CRLF) and we're not in a quoted field, skip the next character
        // and move on to the next row and move to column 0 of that new row
        if (cc === '\r' && nc === '\n' && !quote) { yield arr; col = 0; arr = []; ++c; } else

        // If it's a newline (LF or CR) and we're not in a quoted field,
        // move on to the next row and move to column 0 of that new row
        if ((cc === '\n' || cc === '\r') && !quote) { yield arr; col = 0; arr = []; } else

        // Otherwise, append the current character to the current column
        { (arr[col] += cc) }
    }
    arr.length && (yield arr)
}

export enum CSVValTypes {
    NUMBER = "number",
    STRING = "string",
    STRING_AND_NUMBER = "string_and_number",
}

/**
 * Cleans up a CSV by making all strings that can be numbers into numbers,
 * removing empty cells/rows, and extending columns by copying their last value
 * downwards until every column has the same number of rows (i.e. no jagged
 * columns).
 * @param csv The CSV to clean.
 * @param valTypes The types that values are allowed to be. Values are all cells
 * not in the header row. An AssertionError will be thrown if a value cannot be
 * coerced into the requested type.
 * @param nonEmpty If true, this method will throw an AssertionError if the csv
 * is Empty (if the only row is the header row).
 * @param extendCols If true, this method will extend columns by their last
 * value until all columns of the CSV are the same length.
 * @param inPlace If true, then the given CSV is cleaned in place (it
 * is mutated), otherwise a copy of it is made and that is mutated instead.
 * In both cases the mutated csv is returned.
 * @returns The cleaned CSV.
 */
export function cleanCSV({csv, valTypes=CSVValTypes.NUMBER, nonEmpty=true, extendCols=true, inPlace=false, removeDuplicateRows=true, fillBadCellsWith=undefined}:{csv:(number | string)[][], valTypes?:CSVValTypes, nonEmpty?:boolean, extendCols?:boolean, inPlace?:boolean, removeDuplicateRows?:boolean, fillBadCellsWith?:(number | string)}):(number | string)[][] {
    let cleanedCSV:(number | string)[][] = []; // will be the new CSV

    let makeStr = (cellValue?:number | string):(number | string) => {
            if (typeof cellValue === "number") {
                return cellValue.toString();
            } else if (cellValue === undefined) {
                return "";
            }
            return cellValue;
        }

    if (inPlace) {
        for (const row of csv) {
            for (let j = 0; j < row.length; j++) {
                row[j] = makeStr(row[j]);
            }
        }
        cleanedCSV = csv;
    } else {
        // copy old csv into the new one (because we will mutate the new one) and
        // turn all values into strings (for convenience)
        for (const row of csv) {
            const newCSVRow:(string | number)[] = [];
            cleanedCSV.push(newCSVRow);

            for (const v of row) {
                newCSVRow.push(makeStr(v));
            }
        }
    }

    // Remove all empty cells from end of rows
    for (let rowNum = 0; rowNum < cleanedCSV.length; rowNum++) {
        const row = cleanedCSV[rowNum];
        while (row.length > 0 && row[row.length - 1] === "") {
            row.pop();
        }
    }

    // Remove all empty rows
    {
        let emptyRow = (row:(string | number)[]):boolean => {
            return (row.length === 0) || ((row.length === 1) && row[0] === "");
        }

        let rowNum = 0;
        while (rowNum < cleanedCSV.length) {
            if (emptyRow(cleanedCSV[rowNum])) {
                cleanedCSV.splice(rowNum, 1); // remove empty row
            } else {
                rowNum++; // this row is not empty, continue to next one
            }
        }
    }
    
    if (nonEmpty) {
        if (cleanedCSV.length === 0) {
            throw new AssertionError({
                message:`The CSV was empty. CSV: ${cleanedCSV}`
            });
        } else if (cleanedCSV.length === 1) {
            throw new AssertionError({
                message:`The CSV only had 1 row (the header row). CSV: ${cleanedCSV}`
            });
        }
    } 

    // If length === 0 then empty so return that and if length === 1 then only
    // header row so return that.
    if (cleanedCSV.length <= 1) {
        return cleanedCSV;
    }

    const headerRow = cleanedCSV[0];

    // Shorten all rows to be at most as long as the header row
    for (let rowNum = 0; rowNum < cleanedCSV.length; rowNum++) {
        while (cleanedCSV[rowNum].length > headerRow.length) {
            cleanedCSV[rowNum].pop();
        }
    }

    if (extendCols) {
        // Extend the columns by their last value until all columns are the same
        // length

        // Initialize previous values for each column
        const prevValues:(number | string)[] = [];
        for (let i = 0; i < headerRow.length; i++) {
            let v = cleanedCSV[1][i];
            if (v === undefined) v = "";
            prevValues.push(v);
        }

        for (const row of cleanedCSV) {
            // Fill in the row
            for (let colNum = 0; colNum < headerRow.length; colNum++) {
                if ((row.length - 1) < colNum) {
                    // Need to add value to the current column at the current row
                    row.push(prevValues[colNum]);
                } else {
                    prevValues[colNum] = row[colNum];
                }
            }
        }
    }

    // Depending on the valType, turn all values to strings, numbers, or numbers
    // when possible

    /**
     * Gets the value of the cell, turning it into a number if possible.
     * @param cellValue The value of the current cell.
     * @returns The number representation of the cellValue if possible and the
     * cellValue otherwise.
     */
    let value:(cellValue:string | number) => (string | number);

    if (valTypes === CSVValTypes.STRING_AND_NUMBER) {
        value = (cellValue) => {
            if (typeof cellValue === "string") {
                let floatValue = parseFloat(cellValue);
                if (!isNaN(floatValue)) return floatValue;
            }
            return cellValue;
        }
    } else if (valTypes === CSVValTypes.NUMBER) {
        value = (cellValue) => {
            if (typeof cellValue === "string") {
                let v = parseFloat(cellValue);
                if (isNaN(v)) {
                    if (typeof fillBadCellsWith === "number") {
                        v = fillBadCellsWith;
                    } else if ((typeof fillBadCellsWith === "string") && (!isNaN(parseFloat(cellValue)))) {
                        v = parseFloat(cellValue);
                    } else {
                        throw new AssertionError({
                            message: `Failed to clean CSV: "${v}" could not be turned into a number.`
                        });
                    }
                }
                cellValue = v;
            }
            return cellValue;
        }
    } else if (valTypes === CSVValTypes.STRING) {
        value = makeStr;
    } else {
        throw new AssertionError({ message: `Failed to clean CSV: Unexpected valTypes value "${valTypes}".`});
    }

    // Turn all values (skip header row) into their correct represtation (string
    // or number) for the given valTypes
    for (let rowNum = 1; rowNum < cleanedCSV.length; rowNum++) {
        for (let colNum = 0; colNum < cleanedCSV[rowNum].length; colNum++) {
            cleanedCSV[rowNum][colNum] = value(cleanedCSV[rowNum][colNum]);
        }
    }

    if (removeDuplicateRows) {
        /**
         * Returns True if the two given rows are equal, false otherwise.
         * @param row1 The first row to check.
         * @param row2 The second row to check.
         * @returns True if the two given rows are equal, false otherwise.
         */
        function rowsEqual(row1:(string | number)[], row2:(string | number)[]):boolean {
            if (row1.length !== row2.length) return false;

            for (let j = 0; j < row1.length; j++) {
                if (row1[j] !== row2[j]) {
                    return false;
                }
            }
            return true;
        }

        {
            let i = 1;
            while (i < cleanedCSV.length) {
                // If previous row equals the current row then delete the
                // current row
                if (rowsEqual(cleanedCSV[i - 1], cleanedCSV[i])) {
                    cleanedCSV.splice(i, 1);
                } else {
                    i++;
                }
            }
        }
    }

    return cleanedCSV;
}

/**
 * Desaturates the given color based on the current scene background color and
 * returns the desaturated color.
 * @param color The color to desaturate.
 * @param sceneColor The background color to desaturate the color by.
 * @returns The desaturated color.
 */
export function getDesaturatedColor(color:T.Color, sceneColor:T.Color):T.Color {
    let r = color.r;
    let g = color.g;
    let b = color.b;

    let average = (r + g + b) / 3;

    r = lerp(lerp(r, average, 0.4), sceneColor.r, 0.4);
    g = lerp(lerp(g, average, 0.4), sceneColor.g, 0.4);
    b = lerp(lerp(b, average, 0.4), sceneColor.b, 0.4);

    return new T.Color(r, g, b);
}

/**
 * Returns the given angle in degrees in radians.
 * @param degrees The angle in degrees.
 * @returns The angle in radians.
 */
export function degsToRads(degrees:number):number {
    return degrees * (Math.PI / 180);
}

/**
 * Returns the given angle in radians in degrees.
 * @param radians The angle in radians.
 * @returns The angle in degrees.
 */
export function radsToDegs(radians:number):number {
    return radians * (180 / Math.PI);
}

/**
 * Takes a value that lies within a range and returns a percentage value `t` of
 * how close it is to the value `moreThanV` from `lessThanT`
 * 
 * This is useful as it can be plugged in for `t` of the `lerp` function.
 * @param lessThanV The lower bound of the range.
 * @param v The value between the lower and upper bounds of the range.
 * @param moreThanV The upper bound of the range.
 * @returns Where the value is in between the lower and upper bounds. This
 * is returned in the form of a number where 0.0 is 0% (i.e. the value is
 * equal to the lower bounds) and 1.0 is 100% (i.e. the value is equal to
 * the upper bounds).
 */
export function lerpT(lessThanV: number, v: number, moreThanV: number): number {
        let smallTimeRange = Math.abs(v - lessThanV);
        let fullTimeRange = Math.abs(moreThanV - lessThanV);
        let t = smallTimeRange / fullTimeRange;
        return t;
}

/**
 * Returns the linear interpolation between a and b based on the time t.
 * @param a The first value.
 * @param b The second value.
 * @param t The time between the two values. It should be in range [0, 1]
 * @returns The linear interpolation between a and b based on the time t.
 */
export function lerp(a:number, b:number, t:number):number {
    return a + (b - a) * t;
}

/**
 * Returns the given value rounded to the given number of decimal places.
 * Source: https://www.jacklmoore.com/notes/rounding-in-javascript/
 * @param value The value to round.
 * @param decimals The decimal place to round the value to (must be in [0, infinity])
 * @returns The given value rounded to the given number of decimal places.
 */
export function round(value:number, decimals:number):number {
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}

/**
 * Returns the T.Color resulting from the ramp at time t.
 * @param colors The color ramp.
 * @param t The t value between the colors.
 * @returns The T.Color resulting from the color ramp at time t.
 */
export function getColorFromRamp(colors:T.Color[], t:number):T.Color {
    t *= (colors.length - 1);
    let index = Math.floor(t);
    let u = t - index;
    let color1 = colors[index];
    let color2 = colors[(index < colors.length - 1 ? index + 1 : index)];
    return new T.Color(
        lerp(color1.r, color2.r, u),
        lerp(color1.g, color2.g, u),
        lerp(color1.b, color2.b, u)
    )
}

/**
 * Returns a transposed version of the given 2D matrix.
 * @param matrix The matrix to transpose.
 * @returns The transposed version of the matrix.
 */
export function transposeMatrix<O>(matrix:O[][]):O[][] {
    let tm = []
    let w = matrix.length;
    let h = matrix[0].length;
    for(let i = 0; i < h; i++) {
        let row = []
        for(let k = 0; k < w; k++) {
            row.push(matrix[k][i])
        }
        tm.push(row)
    }
    return tm
}


const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const usedIds = new Set<string>();
/**
 * Generates a string of letters and numbers that is gauranteed to be unique
 * for the full duration of this execution of the application.
 * @minLength The minimum length that the ID should have.
 * @maxLength The maximum length that the ID should have.
 */
export function newID(minLength:number=4, maxLength?:number):string {
    if (maxLength && maxLength < minLength) maxLength = minLength;
    let id = "";
    let baseAttempts = 100; // this number of tries for a unique string for each length of the string
    let attempts = baseAttempts;
    while (true) {
        let newId = id + ID_CHARS[randInt(0, ID_CHARS.length - 1)];

        if (maxLength !== undefined && newID.length > maxLength) {
            // Restart the ID generation because the generated ID was too long
            id = "";
            continue;
        }

        if ((newId.length < minLength) || (attempts <= 0)) {
            // Try again with the id 1 char longer
            id = newId;
            attempts = baseAttempts;
            continue;
        }

        if (usedIds.has(newId)) {
            attempts--;
        } else {
            usedIds.add(newId);
            return newId;
        }
    }
}

/**
 * Returns a new Unique key for a list of React elements.
 */
//export function newKey():string {
    //return newID(4);
//}

/**
 * Generates and returns a float in the range [min, max)
 * @param min The minimum float allowed.
 * @param max The maximum float allowed.
 */
export function randFloat(min:number=0, max:number=1):number {
    return ((Math.random() * (max - min)) + min);
}

/**
 * Generates and returns a random integer in range [min, max]
 * @param min The minimum Integer allowed.
 * @param max The max Integer allowed.
 */
export function randInt(min:number=0, max:number=1):number {
    return Math.round(randFloat(min, max));
}

/**
 * Generates and returns a random color string.
 * @returns A random color string.
 */
export function randColor(min:number=0x000000, max:number=0xffffff): string {
    let color = '#' + Math.floor(randFloat(min, max)).toString(16);
    while (color.length < 6) {
        color += '0';
    }
    return color;
}

/**
 * Clamps the given value to the range [min, max], returning
 * min if the value is less than min, max if the value is more than
 * max and the value itself if the value is in the range.
 * @param value The value to clamp.
 * @param min The min value allowed.
 * @param max The max value allowed.
 * @returns The clamped value.
 */
export function clamp(value:number, min:number=0, max:number=1):number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

const INT_CHARS = "0123456789";
/**
 * Filters the given value and returns a string that is a valid number string.
 * @param value The value to filter.
 * @returns The filtered value.
 */
export function onlyNumbersFilter(value:string):string {
    let newValue = "";
    let numDecimals = 0;
    for (let i = 0; i < value.length; i++) {
        const c = value[i];

        if (INT_CHARS.includes(c)) {
            newValue += c; // numeral
        } else if (numDecimals === 0 && c === ".") {
            newValue += c; // first decimal point
            numDecimals++;
        } else if (newValue.length === 0 && c === "-") {
            newValue += c; // - sign at beginning of number
        }
    }
    return newValue;
}

export function range(end:number):Generator<number, void, void>;
export function range(start:number, end:number):Generator<number, void, void>;
export function range(start:number, end:number, step:number):Generator<number, void, void>;
export function* range(arg1:number, arg2?:number, arg3?:number):Generator<number, void, void> {
    let start:number, end:number, step:number;
    step = arg3 ?? 1;
    if (arg2 === undefined) {
        start = 0;
        end = arg1;
    } else {
        start = arg1;
        end = arg2;
    }
    for (let i = start; i < end; i += step) {
        yield i;
    }
}

/**
 * Enumerates the given array, returning the values of it in form [index, value]
 * @param iterable The iterable array to enumerate.
 */
export function* enumerate<T>(iterable:Iterable<T>):Generator<[number, T], void, void> {
    let i = 0;
    for (const value of iterable) {
        yield [i++, value];
    }
}

/**
 * Returns a generator that will iterate over the values of the given iterables
 * until one of the iterables run out of values.
 * @param iterables The iterables to iterate over.
 * @returns A generator that will iterate over the values of the given iterables
 * until one of the iterables run out of values.
 */
export function* zip<T>(...iterables:Array<Iterable<T>>):Generator<T[], void, void> {
    let iters = iterables.map((iterable) => iterable[Symbol.iterator]());

    while (true) {
        const values = [];
        for (const iter of iters) {
            let { value, done } = iter.next();

            if (done) {
                // If done, then no more values to return.
                break;
            }

            values.push(value);
        }

        if (values.length !== iters.length) {
            // If lengths not equal, then an iterator was finished and therefore
            // did not have its value recorded, so the zip function is done.
            return;
        }

        yield values;
    }
}


/**
 * Iterates through the given iterable in reverse-order.
 * @param iterable The iterable to reverse-iterate.
 * @returns A generator that will yield each item of the iterable in reverse order.
 */
export function * reversed<T>(iterable:Iterable<T> | ArrayLike<T>):Generator<T, void, void> {
    if ("reverse" in iterable) {
        // @ts-ignore
        return iterable.reverse();
    } else if ("reversed" in iterable) {
        // @ts-ignore
        return iterable.reversed();
    } else {
        for (const obj of Array.from(iterable).reverse()) {
            yield obj;
        }
    }
}

/**
 * Returns the insert position of an item if it existed in the array.
 * 
 * The following implementation returns an index 0 ≤ i ≤ array.length such that
 * the given predicate is false for array[i - 1] and true for array[i]. If the
 * predicate is false everywhere, array.length is returned.
 * 
 * WARNING: The predicate must theoretically (the algorithm does not
 * actually do any sorting) sort the values such that they are in ascending
 * order.
 * 
 * Adapted from https://stackoverflow.com/a/41956372
 * @param array The array of values to binary search.
 * @param pred The predicate of the binary search.
 * @returns The lowest index at which the predicate returns true.
 */
export function binarySearch<T>(array: readonly T[], pred: (value: T) => boolean): number {
    let lo = -1, hi = array.length;
    while (1 + lo < hi) {
        const mi = lo + ((hi - lo) >> 1);
        if (pred(array[mi])) {
            hi = mi;
        } else {
            lo = mi;
        }
    }
    return hi;
}

/**
 * Does 2 binary searches to find the upper and lower bounds of the array where
 * the item is present. Better to do 2 binary searches (which is still
 * O(log(N))) than a binary search to find the lower bounds and then a linear
 * search to find the upper bounds from the lower bounds (which is O(N)).
 * 
 * Example: `binarySearchBounds([0, 2, 2, 2, 3, 5], 2)` returns the range `[1, 4]`
 * 
 * WARNING: The array must be in ascending order after the key is applied.
 * @param array The array to binary search.
 * @param item The item to binary search for.
 * @param key The function to apply to the given item and the items of the array
 * in order to get the item that should be compared. If not given, then the items
 * are compared without any key function.
 * @returns The [lower, upper) bounds of the items that match the given item.
 */
export function binarySearchBounds<T, K>(array: ReadonlyArray<T>, item: T, key?: (item: T) => K): [number, number] {
    return [binarySearchLowerBound(array, item, key), binarySearchUpperBound(array, item, key)]
}

/**
 * Does a binary search to find the lowest index at which the given item can be found.
 * 
 * In other words, this function returns i such that array[i - 1] < item <= array[i].
 * 
 * Example: `binarySearchLowerBound([0, 2, 2, 2, 3, 5], 2)` returns the index `1`
 * 
 * WARNING: the array must be in ascending order after the key is applied.
 * @param array The array to binary search.
 * @param item The item to binary search for.
 * @param key The function to apply to the given item and the items of the array
 * in order to get the item that should be compared. If not given, then the items
 * are compared without any key function.
 * @returns The lower bound index i.e. the lowest index that matches the given item.
 */
export function binarySearchLowerBound<T, K>(array: ReadonlyArray<T>, item: T, key?: (item: T) => K): number {
    if (key === undefined) { return binarySearch(array, (j) => j >= item) }
    return binarySearch(array, (j) => key(j) >= key(item))
}

/**
 * Does a binary search to find the highest index (+ 1) at which the given item can be found.
 * 
 * In other words, this function returns i such that array[i - 1] <= item < array[i].
 * 
 * Example: `binarySearchUpperBound([0, 2, 2, 2, 3, 5], 2)` returns the index `4`
 * 
 * WARNING: the array must be in ascending order after the key is applied.
 * @param array The array to binary search.
 * @param item The item to binary search for.
 * @param key The function to apply to the given item and the items of the array
 * in order to get the item that should be compared. If not given, then the items
 * are compared without any key function.
 * @returns The upper bound index i.e. the highest index (+ 1) that matches the given item.
 */
export function binarySearchUpperBound<T, K>(array: ReadonlyArray<T>, item: T, key?: (item: T) => K): number {
    if (key === undefined) { return binarySearch(array, (j) => j > item) }
    return binarySearch(array, (j) => key(j) > key(item))
}

/**
 * Returns a version of the given array where all values that appear more than
 * once have been removed from the array.
 * @param array The array to remove duplicates from.
 * @returns The given array without any of the values that appeared more than
 * once in the array. The output array may not have its output values in the
 * same order as the input array.
 */
export function onlyUniques<T>(array: ReadonlyArray<T>): T[] {
    // boolean true stands for "exactly 1 seen" and boolean false means more than 1 seen
    let map: Map<T, boolean> = new Map();
    for (const v of array) {
        let count = map.get(v);
        if (count !== undefined) {
            map.set(v, false);
        } else {
            map.set(v, true);
        }
    }

    let out: T[] = [];
    for (const [v, onlyOneSeen] of map.entries()) {
        if (onlyOneSeen) {
            out.push(v);
        }
    }
    return out;
}

/**
 * Returns a version of the given array where all values that appear more than
 * once have been removed from the array.
 * @param array The array to remove duplicates from.
 * @param key The function used get the value to deduplicate from each item. For
 * example, each item of the array my have a "name" and you want to make sure
 * that if a name appears more than once every item with said name is removed
 * from the array. In such a case, `key` is simply a function that returns
 * the name of each item it is passed.
 * @returns The given array without any of the values that appeared more than
 * once in the array. The output array may not have its output values in the
 * same order as the input array.
 */
export function onlyUniquesUsing<T, K>(array: ReadonlyArray<T>, key: (item: T) => K): T[] {
    // boolean true stands for "exactly 1 seen" and boolean false means "more than 1 seen"
    let map: Map<K, [T, boolean]> = new Map();
    for (const v of array) {
        let k = key(v);
        let value = map.get(k);
        if (value !== undefined) {
            map.set(k, [v, false]); // seeing for the second or more time
        } else {
            map.set(k, [v, true]); // first one seen
        }
    }

    let out: T[] = [];
    for (const [, [v, onlyOneSeen]] of map.entries()) {
        if (onlyOneSeen) {
            out.push(v);
        }
    }
    return out;
}

/**
 * Counts how many times a value is equal to the given `item` is in the given array.
 * @param array The array to look through.
 * @param item The item to look for.
 * @returns How many times `item` appears in `array`.
 */
export function count<T>(array: ReadonlyArray<T>, item: T): number {
    return array.filter((listItem) => listItem === item).length;
}

/**
 * Counts how many times a value is equal to the given `item` is in the given array.
 * The items are compared using their returned values from `key`.
 * @param array The array to look through.
 * @param item The item to look for.
 * @param key The function used to get the keys to compare for each item.
 * @returns How many times `item` appears in `array`.
 */
export function countUsing<T, K>(array: ReadonlyArray<T>, item: T, key: (item: T) => K): number {
    return array.filter((listItem) => key(listItem) === key(item)).length;
}


/**
 * Returns a version of the given array with only unique values.
 * 
 * The first of each unique value will be in the output array.
 * @param array The array to deduplicate.
 * @returns A copy of the given array but with all of its values deduplicated.
 */
export function deduplicate<T>(array: ReadonlyArray<T>): T[] {
    return [... new Set(array)];
}

/**
 * Returns a version of the given array with only unique `key` values.
 * 
 * The first of each unique value will be in the output array.
 * @param array The array to deduplicate.
 * @param key The function that returns what about an item of the array must tbe unique.
 * @returns A deduplicated version of the given array.
 */
export function deduplicateUsing<T, K>(array: ReadonlyArray<T>, key: (v: T) => K): T[] {
    let seen = new Map();
    return array.filter((item) => {
        let k = key(item);
        return seen.has(k) ? false : (seen.set(k, true))
    });
}

/**
 * Generates a logging function that will only log the first `numTimes` times.
 * This is useful for something like animation debugging where you want to
 * see what a value is but do not want it to log so much that it lags out
 * your computer.
 * @param numTimes The number of times you want it to log before ceasing to log
 * anything after that point.
 * @returns The logging function that is safe to use even in animations.
 */
export function genSafeLogger(numTimes:number):(...args:any) => void {
    return (...args) => {
        if (numTimes > 0) {
            console.log(...args);
            numTimes--;
        }
    }
}
export const log = genSafeLogger(1000);