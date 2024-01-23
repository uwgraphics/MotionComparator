import { cleanCSV, CSVValTypes, enumerate, parseCSVFromString } from "../src/scripts/helpers";
import { CSVWithBadDataQuotesStartAndTrailEndSpace, DummyCSV, simpleCSV } from "./dummy_csvs";

describe("Testing helper functions", () => {
    function testCSV(CSV: DummyCSV, t: CSVValTypes) {
        let csv = Array.from(parseCSVFromString(CSV.string));
        test(`Check number of rows for ${CSV.name}`, () => {
            expect(csv.length).toBe(CSV.numRows);
        });

        test(`Check number of cols for ${CSV.name}`, () => {
            for (const row of csv) { expect(row.length).toBe(CSV.numCols); }
        });

        test(`Check row length ${CSV.name}`, () => {
            for (const row of csv) {
                expect(row.length).toBe(CSV.numCols);

                for (const v of row) {
                    expect(typeof v).toBe('string');
                }
            }
        });

        let cleanedCSV = cleanCSV({
            csv,
            valTypes: t,
            fillBadCellsWith: 0,
            removeDuplicateRows: true,
            nonEmpty: true,
        });

        test(`Check number of rows for cleaned ${CSV.name}`, () => {
            expect(cleanedCSV.length).toBe(CSV.numRows);
        })

        test(`Check number of cols for cleaned ${CSV.name}`, () => {
            for (const row of cleanedCSV) { expect(row.length).toBe(CSV.numCols); }
        })

        test(`Check row length cleaned ${CSV.name}`, () => {
            for (const [rowNum, row] of enumerate(cleanedCSV)) {
                expect(row.length).toBe(CSV.numCols);

                for (const v of row) {
                    if (rowNum === 0) {
                        expect(typeof v).toBe('string');
                    } else {
                        if (t === CSVValTypes.NUMBER) {
                            expect(typeof v).toBe('number');

                        } else if (t === CSVValTypes.STRING) {
                            expect(typeof v).toBe('string');

                        } else if (t === CSVValTypes.STRING_AND_NUMBER) {
                            if (typeof v === 'number') {
                                expect(typeof v).toBe('number');
                            } else {
                                expect(typeof v).toBe('string');
                            }
                        } else {
                            expect(typeof v).toBe('string');
                        }
                    }
                }
            }
        });
    }

    testCSV(simpleCSV, CSVValTypes.NUMBER);
    testCSV(simpleCSV, CSVValTypes.STRING);
    testCSV(simpleCSV, CSVValTypes.STRING_AND_NUMBER);

    testCSV(CSVWithBadDataQuotesStartAndTrailEndSpace, CSVValTypes.NUMBER);
    testCSV(CSVWithBadDataQuotesStartAndTrailEndSpace, CSVValTypes.STRING);
    testCSV(CSVWithBadDataQuotesStartAndTrailEndSpace, CSVValTypes.STRING_AND_NUMBER);
});

export {}