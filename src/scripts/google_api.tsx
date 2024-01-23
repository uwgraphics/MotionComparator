import { AssertionError } from "assert";
import { readBlobAsText } from "./load_functions";

// The google api used can be found at https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets#Spreadsheet

let gAPIkey = process.env.REACT_APP_GOOGLE_API_KEY;
if (typeof gAPIkey === 'string') gAPIkey = gAPIkey.trim();
const GOOGLE_API_KEY = gAPIkey;
//const GOOGLE_OAUTH_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]; // You need to set this when creating the API key for the API key, cannot set the scope of the key here
const GOOGLE_URL_PREFIX = "https://docs.google.com/";
const GOOGLE_SPREADSHEET_URL_PREFIX = "https://docs.google.com/spreadsheets/d/";

if (GOOGLE_API_KEY === undefined) {
    console.warn(`Google API key not found: Google-related functionalities will not be supported.`);
}

// Helper Methods

function appendStr(s:string, prefix:string, sToAppend?:string | boolean):string {
    if (typeof sToAppend === "boolean") s = `${s}${prefix}${sToAppend}`;
    else if (sToAppend && sToAppend.length > 0) s = `${s}${prefix}${sToAppend}`
    return s;
}

// Google response enums

enum DIMENSION {
    DIMENSION_UNSPECIFIED = "DIMENSION_UNSPECIFIED",
    ROWS = "ROWS",
    COLUMNS = "COLUMNS",
}

enum VALUE_RENDER_OPTION {
    FORMATTED_VALUE = "FORMATTED_VALUE",
    UNFORMATTED_VALUE = "UNFORMATTED_VALUE",
    FORMULA = "FORMULA",
}

enum DATE_TIME_RENDER_OPTION {
    SERIAL_NUMBER = "SERIAL_NUMBER",
    FORMATTED_STRING = "FORMATTED_STRING",
}

enum RECALCULATION_INTERVAL {
    RECALCULATION_INTERVAL_UNSPECIFIED = "RECALCULATION_INTERVAL_UNSPECIFIED",
    ON_CHANGE = "ON_CHANGE",
    MINUTE = "MINUTE",
    HOUR = "HOUR",
}

enum SHEET_TYPE {
    SHEET_TYPE_UNSPECIFIED = "SHEET_TYPE_UNSPECIFIED",
    GRID = "GRID",
    OBJECT = "OBJECT",
    DATA_SOURCE = "DATA_SOURCE",
}

// Google Response Interfaces

interface batch_get_response {
    spreadsheetId: string, // Id of the spreadsheet you requested the batch from
    valueRanges: value_range[]; // ranges with returned data
}

interface value_range {
    range: string, // Range in A1 notation
    majorDimension: DIMENSION,
    values: string[][], // Will be either row or column major depending on what you specified
}

interface spreadsheet_properties {
    title: string,
    locale: string,
    autoRecalc: RECALCULATION_INTERVAL,
    timeZone: string,

    // Haven't needed yet
    defaultFormat: any,
    iterativeCalculationSettings: any,
    spreadsheetTheme: any,
}

interface grid_properties {
    rowCount: number, // int
    columnCount: number, // int
    frozenRowCount: number, // int
    frozenColCount: number, // int
    hidGridLines: boolean,
    rowGroupControlAfter: boolean,
    columnGroupControlAfter: boolean,
}

interface sheet_properties {
    sheetId: number, // int
    title: string,
    index: number, // int
    sheetType: SHEET_TYPE,
    gridProperties: grid_properties,

    // Haven't needed yet
    tabColorStyle: any,
    rightToLeft: any,
    dataSourceSheetProperties: any,
}

interface grid_data {
    startRow: number, // int
    startColumn: number, // int

    // Haven't needed yet
    rowData: any[],
    rowMetaData: any[],
    columnMetaData: any[],
}

interface sheet {
    properties: sheet_properties,
    data: grid_data,

    // Haven't needed yet
    merges: any[],
    conditionalFormats: any[],
    filterViews: any[],
    protectedRanges: any[],
    basicFilter: any[],
    charts: any[],
    bandedRanges: any[],
    developerMetadata: any[],
    rowGroups: any[],
    columnGroups: any[],
    slicers: any[],
}

interface spreadsheet_data {
    spreadsheetId: string,
    spreadsheetURL: string,
    properties: spreadsheet_properties,
    sheets: sheet[],

    // Haven't needed yet
    namedRanges: any,
    developerMetadata: any,
    dataSources: any,
    dataSourcesSchedules: any,
}

/**
 * Gets all the information pertaining to one google Spreadsheet.
 * @param spreadsheetId The id of the Spreadsheet to get.
 * @param ranges The ranges of the sheet to get (if any).
 * @param includeGridData Whether to include the data of the sheets of the Spreadsheet.
 * @returns a Promise that resolves to the requested data of the Spreadsheet.
 */
async function gSheetsSheetGet(spreadsheetId:string, ranges?:SpreadsheetRange[], includeGridData:boolean=false):Promise<spreadsheet_data> {
    let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    url += `?key=${GOOGLE_API_KEY}`; // first param needs '?'
    url = appendStr(url, `&includeGridData=`, includeGridData);

    if (ranges) {
        for (const range of ranges) {
            url = appendStr(url, `&ranges=`, range.toA1());
        }
    }

    let response = await fetch(url);

    if (!response.ok) {
        let errorText = await readBlobAsText(await response.blob());

        console.error(`There was an error in the Google Sheets batchGet response. Response error as Text: ${errorText}`);
        throw new Error('Error fetching GSheet');
    }

    let json = await response.json();
    return json;
}

/**
 * Gets a batch of data from a spreadsheet.
 * @param spreadsheetId The id of the Spreadsheet.
 * @param ranges The ranges to get from the Spreadsheet (all must have either
 * undefined SheetNames or a sheetName of a Sheet that actually exists,
 * otherwise an error will occur). If the SheetName of the Range is undefined,
 * then the range is gotten from the first sheet of the Spreadsheet. If only a
 * spreadsheet name is given, then every value of that spreadsheet will be gotten.
 * @param majorDimension The major dimension that the Data should be in (column
 * or row).
 * @param valueRenderOption How to render values.
 * @param dateTimeRenderOption How to render Dates.
 * @param sheetNames The names of the sheets of the Spreadsheet. If not given,
 * the function will fetch them. Make sure they are all names of sheets that
 * exist, otherwise an error could be thrown.
 * @returns A promise that resolves to the requested data.
 */
async function gSheetsBatchGet(
        spreadsheetId:string,
        ranges?:SpreadsheetRange[],
        majorDimension:DIMENSION=DIMENSION.ROWS,
        valueRenderOption:VALUE_RENDER_OPTION=VALUE_RENDER_OPTION.FORMATTED_VALUE,
        dateTimeRenderOption:DATE_TIME_RENDER_OPTION=DATE_TIME_RENDER_OPTION.FORMATTED_STRING,
        sheetNames?:string[]
        ):Promise<batch_get_response> {
    let url:string = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet`;
    url += `?key=${GOOGLE_API_KEY}`; // first param needs '?'
    url = appendStr(url, `&majorDimension=`, majorDimension);
    url = appendStr(url, `&valueRenderOption=`, valueRenderOption);
    url = appendStr(url, `&dateTimeRenderOption=`, dateTimeRenderOption);

    if (sheetNames === undefined) {
        sheetNames = [];

        let spreadsheet = await gSheetsSheetGet(spreadsheetId);
        for (const sheet of spreadsheet.sheets) {
            let title = sheet.properties.title;
            sheetNames.push(title); // Should get all data from the sheet
        }
    }

    if (ranges === undefined) {
        // If ranges is not specified, then get all the values of every sheet
        ranges = [];
        for (const sheetName of sheetNames) {
            ranges.push(new SpreadsheetRange(sheetName)); // Should get all data from the sheet
        }
    } else {
        // Make sure that all ranges are for sheets that exist.
        let _ranges = [];
        for (const range of ranges) {
            let sheetName = range.sheetName();
            if (sheetName === undefined || sheetNames.indexOf(sheetName) !== -1) {
                _ranges.push(range);
            }
        }
        ranges = _ranges;
    }

    if (ranges) {
        for (const range of ranges) {
            url = appendStr(url, `&ranges=`, range.toA1());
        }
    }

    let response = await fetch(url);

    if (!response.ok) {
        let errorText = await readBlobAsText(await response.blob());

        console.error(`There was an error in the Google Sheets batchGet response. Response error as Text: ${errorText}`);
        throw new Error('Error fetching GSheet');
    }

    let json:batch_get_response = await response.json();
    return json;
}

// Exported Interfaces (interfaces for data as to how it can actually be
// returned by one of these methods)

// Useful question functions

export function isGoogleURL(url:string):boolean {
    url = url.trim().replace('\\', '/');
    return url.startsWith(GOOGLE_URL_PREFIX);
}

export function isGoogleSpreedsheetURL(url:string):boolean {
    url = url.trim().replace('\\', '/');
    return url.startsWith(GOOGLE_SPREADSHEET_URL_PREFIX);
}

/**
 * Returns the Spreadsheet ID from the url.
 * @param url The URL to get the spreadsheet ID from.
 * @returns The id of the spreadsheet that the url is for.
 */
export function spreadsheetIdFromSpreadsheetURL(url:string):string {
    url = url.trim().replace('\\', '/');
    if (!isGoogleSpreedsheetURL(url)) {
        throw new AssertionError({message:`URL ${url} is not a url to a google spreadsheet.`});
    }
    return url.slice(GOOGLE_SPREADSHEET_URL_PREFIX.length, url.length).split('/')[0];
}

const ALPHABET_LENGTH = 26;
/**
 * Converts a column number to A1 notation.
 * @param column The 0-indexed column number to convert to A1 notation.
 * @returns the A1 string version of the column.
 */
function cellColToA1(column:number):string {
    if (column < 0) column = 0;
    const a1Notation = [];
    let block = column;
    while (block >= 0) {
        a1Notation.unshift(String.fromCharCode((block % ALPHABET_LENGTH) + 'A'.charCodeAt(0)));
        block = Math.floor(block / ALPHABET_LENGTH) - 1;
    }
    return a1Notation.join('');
}

/**
 * Converts a column in A1 notation to the 0-indexed number of the column.
 * @param column The column in A1 Notation to convert back to a number.
 * @returns The number version of the column in A1 notiation.
 */
function cellColFromA1(column:string):number {
    let columnNum = 0;
    for (const char of column.split('')) {
        columnNum *= ALPHABET_LENGTH;
        columnNum += char.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    }
    columnNum -= 1; // Make it 0-indexed
    return columnNum;
}


/**
 * Returns the A1 notation of a single cell. The row and/or column
 * should be 0 indexed.
 * @param row The row of the cell.
 * @param column The column of the cell.
 * @returns The cell in A1 notation.
 */
function cellToA1(row?:number | null, column?:number | null):string {
    if (row && row < 0) row = 0;
    if (column && column < 0) column = 0;
    let out = ``;
    if (column !== undefined && column !== null) out += cellColToA1(column);
    if (row !== undefined && row !== null) out += row + 1; // In A1 notation, rows are 1-indexed
    return out;
}

/**
 * Return the number representation of the row and column of a cell converted
 * from A1 notation.
 * @param cell The cell in A1 notation.
 * @returns The cell's row and column as 0-indexed numbers in form [row, column]
 */
function cellFromA1(cell:string): [number | null, number | null] {
    // Match columnName
    const res = cell.trim().toUpperCase().match(/([A-Z]+)([0-9]+)/);
    let columnString:string;
    let rowString:string;

    if (res === null) {
        columnString = '';
        rowString = cell;
    } else {
        [, columnString, rowString] = res;
    }

    let rowNum: number | null;
    let colNum: number | null;

    if (columnString.length === 0) {
        colNum = null;
    } else {
        colNum = cellColFromA1(columnString); // Returns 0-indexed column number
    }

    if (rowString.length === 0) {
        rowNum = null;
    } else {
        rowNum = parseFloat(rowString); // already 0 indexed
        if (isNaN(rowNum)) rowNum = null;
    }

    // RowNum is 1-indexed but should be 0-indexed, so make it 0-indexed
    if (rowNum !== null) rowNum--;

    return [rowNum, colNum];
}


export class SpreadsheetRange {
    _rowStart?: number;
    _rowEnd?: number;
    _colStart?: number;
    _colEnd?: number;
    _sheetName?: string;

    /**
     * Constructs a SpreadsheetRange object.
     * 
     * Note: All row and column numbers should be 0 indexed (so (0, 0) is the
     * top-left-most cell of the spreadsheet).
     * 
     * @param sheetName The name of the spreedsheet the range is for.
     * @param rowStart The starting row.
     * @param rowEnd The ending row.
     * @param colStart The starting column.
     * @param colEnd The ending column.
     */
    constructor(sheetName?:string, rowStart?:number, rowEnd?:number, colStart?:number, colEnd?:number) {
        this.setSheetName(sheetName);
        this.setRowStart(rowStart);
        this.setRowEnd(rowEnd);
        this.setColStart(colStart);
        this.setColEnd(colEnd);
    }

    equalTo(other:SpreadsheetRange):boolean {
        return (this._sheetName === other._sheetName
            &&  this._rowStart  === other._rowStart
            &&  this._rowEnd    === other._rowEnd
            &&  this._colStart  === other._colStart
            &&  this._colEnd    === other._colEnd
        );
    }

    protected valid(value:undefined | number): number | undefined {
        if (value === undefined) return undefined;
        if (value < 0) value = 0;
        return value;
    }

    sheetName():string | undefined { return this._sheetName; }
    setSheetName(name?:string) { this._sheetName = name; }

    rowStart():number | undefined { return this._rowStart; }
    setRowStart(value?:number) { this._rowStart = this.valid(value); }
    colStart():number | undefined { return this._colStart; }
    setColStart(value?:number) { this._colStart = this.valid(value); }

    rowEnd():number | undefined { return this._rowEnd; }
    setRowEnd(value?:number) { this._rowEnd = this.valid(value); }
    colEnd():number | undefined { return this._colEnd; }
    setColEnd(value?:number) { this._colEnd = this.valid(value); }

    clone(): SpreadsheetRange {
        return new SpreadsheetRange(this.sheetName(), this.rowStart(), this.rowEnd(), this.colStart(), this.colEnd());
    }

    /**
     * This SpreadsheetRange in A1 notation.
     * @returns this SpreadsheetRange in A1 notation.
     */
    toA1(includeSheetName:boolean=true): string {
        let [rowStart, rowEnd, colStart, colEnd] = [this._rowStart, this._rowEnd, this._colStart, this._colEnd];
        if (rowStart !== undefined && rowEnd !== undefined) {
            let [temp1, temp2] = [rowStart, rowEnd];
            rowStart = Math.min(temp1, temp2);
            rowEnd = Math.max(temp1, temp2);
        }

        if (colStart !== undefined && colEnd !== undefined) {
            let [temp1, temp2] = [colStart, colEnd];
            colStart = Math.min(temp1, temp2);
            colEnd = Math.max(temp1, temp2);
        }

        let startA1 = cellToA1(rowStart, colStart);
        let endA1 = cellToA1(rowEnd, colEnd);

        let out = `${startA1}:${endA1}`;
        if (out === ':') out = '';

        if (includeSheetName && this._sheetName !== undefined) {
            if (out.length > 0) {
                out = `${this._sheetName}!${out}`;
            } else {
                out = `${this._sheetName}`;
            }
        }

        return out;
    }

    static fromA1(a1:string):SpreadsheetRange {
        a1 = a1.trim();

        let sr = new SpreadsheetRange();

        type t = number | undefined | null;
        let startRow:t, endRow:t, startCol:t, endCol:t;
        let sheetName:string | undefined | null;

        sheetName = sr.sheetName();
        [startRow, endRow] = [sr.rowStart(), sr.rowEnd()];
        [startCol, endCol] = [sr.colStart(), sr.colEnd()];

        if (a1.indexOf('!') !== -1) {
            let cell;
            [sheetName, cell] = a1.split('!');
            sheetName = sheetName.trim();

            if (cell.indexOf(':') !== -1) {
                let [start, end] = cell.split(':');
                [startRow, startCol] = cellFromA1(start);
                [endRow, endCol] = cellFromA1(end);
            } else {
                // Assume that it is start cell
                [startRow, startCol] = cellFromA1(cell);
            }
        } else {
            // no "!" seperateor so a1 is either the spreadsheet name or a cell
            if (a1.indexOf(':') !== -1) {
                // a1 is a cell
                let [start, end] = a1.split(':');
                [startRow, startCol] = cellFromA1(start);
                [endRow, endCol] = cellFromA1(end);
            } else {
                // Assume that a1 is the name of a sheet of the Spreadsheet
                sheetName = a1.trim();
            }
        }

        sr.setSheetName(sheetName ?? undefined);
        sr.setRowStart(startRow ?? undefined);
        sr.setColStart(startCol ?? undefined);
        sr.setRowEnd(endRow ?? undefined);
        sr.setColEnd(endCol ?? undefined);

        return sr;
    }
}

/**
 * Data from a single page of a spreadsheet.
 */
export interface google_sheets_sheet_data {
    title: string, // title of the sheet

    // Each specified range for this spreadsheet turns into 1 
    // index of this sheet
    data: {
        range: SpreadsheetRange,
        data: string[][],
    }[];
}

/**
 * The data from an entire spreadsheet.
 */
export interface google_sheets_spreadsheet_data {
    id: string, // id of the full spreadsheet
    title: string, // title of the full spreadsheet
    sheets: google_sheets_sheet_data[]; // all the (loaded) sheets of the spreadsheet.
}

/**
 * Returns the requested data from the requested spreadsheet.
 * @param spreadsheetId The ID of the google spreadsheet.
 * @param ranges The ranges to get the values from. For each range, if it
 * has a sheetName, then its range will be gotten from that sheet. Otherwise it
 * is just gotten from the first sheet of the SpreadSheet. If ranges is undefined,
 * then all the data from every sheet of the spreadsheet is gotten.
 * @returns A promise that resolves to the requested data from the spreadsheet.
 */
export async function loadGoogleSheetsData({spreadsheetId, ranges}:{spreadsheetId:string, ranges?:SpreadsheetRange[]}):Promise<google_sheets_spreadsheet_data> {
    let spreadsheet = await gSheetsSheetGet(spreadsheetId);
    let sheetNames = [];
    for (const sheet of spreadsheet.sheets) {
        sheetNames.push(sheet.properties.title);
    }

    let gData = await gSheetsBatchGet(spreadsheetId, ranges, DIMENSION.ROWS, VALUE_RENDER_OPTION.FORMATTED_VALUE, DATE_TIME_RENDER_OPTION.FORMATTED_STRING, sheetNames);

    // Now that we have the response data, we need to process it into a google_sheets_data object
    if (gData.spreadsheetId !== spreadsheetId) {
        throw new AssertionError({
            message: `Spreadsheet data returned from gSheetsBatchGet method (with spreadsheet id:"${gData.spreadsheetId}") was not from the same spreadsheet as the one requested by loadGoogleSheetsData (spreadsheet id "${spreadsheetId}")`
        });
    }

    let valueRanges = gData.valueRanges;
    let dataMap:Map<string, google_sheets_sheet_data> = new Map();
    for (const range of valueRanges) {
        let sr:SpreadsheetRange = SpreadsheetRange.fromA1(range.range);
        let sheetTitle = sr.sheetName() as string; // We know that it is string because the ranges given by the google api always includes the name of the sheet the data came from

        let mappedData = dataMap.get(sheetTitle);
        if (mappedData === undefined) {
            mappedData = {
                title: sheetTitle,
                data: [],
            }
            dataMap.set(sheetTitle, mappedData);
        }

        if (range.values) {
            mappedData.data.push({
                range: sr,
                data: range.values,
            });
        }
    }

    let sheets:google_sheets_sheet_data[] = [];
    for (const data of dataMap.values()) {
        sheets.push(data);
    }

    let data:google_sheets_spreadsheet_data = {
        id: spreadsheetId,
        title: spreadsheet.properties.title,
        sheets: sheets,
    };

    return data;
}









