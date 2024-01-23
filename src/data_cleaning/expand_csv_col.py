"""Module"""
import ast
import csv
import argparse
from typing import List, Tuple, cast


def main():
    """
    The main function.
    """
    ap_ = argparse.ArgumentParser(description='Expands the given column of the given CSV into multiple columns with the given names. This is useful for if you have a column of (x, y, z) values stored as "(number, number, number)" but the application needs each x,y,z value to be in its own column (i.e. every x value in one column, every y value in another column, and every z value in a third column).')
    ap_.add_argument('file', type=str, help="The path to the CSV file.")
    ap_.add_argument('column_name', type=str, help="The column of the CSV to expand.")
    ap_.add_argument('expand_cols_into', type=str, help='The names of the columns that each value in the given column should be expanded into. This should be given as a comma-delimited list with quotes around the whole thing (e.g. "column1,column2,column3")')
    ap_.add_argument('-p', '--prepend_to_expand_cols', type=str, help='The optional string to prepend to each "expand_cols_into" column name.')
    parsed = ap_.parse_args()

    prepend_to_names = cast(str, parsed.prepend_to_expand_cols) or ""

    file_name = parsed.file

    rows:List[List[str]] = []
    with open(file_name, 'r', newline='', encoding="utf-8") as file:
        reader = csv.reader(file, quotechar="\"")

        for row in reader:
            rows.append(row)

    col_to_expand = rows[0].index(parsed.column_name)

    expand_col_names_ = cast(str, parsed.expand_cols_into)
    if expand_col_names_.startswith('"') and expand_col_names_.endswith('"'):
        expand_col_names_ = expand_col_names_[1:-1]
    elif expand_col_names_.startswith('"') or expand_col_names_.endswith('"'):
        raise AssertionError(f'"expand_cols_into" should either be wrapped in quotes or not wrapped in quotes. Instead, it only has one quote: {expand_col_names_}')
    expand_col_names = expand_col_names_.split(",")

    def cast_tuple(val:str) -> Tuple[str, ...]:
        val = val.strip()
        if (val.startswith('(') and val.endswith(')')) \
                or val.startswith('[') and val.endswith(']'):
            val = val[1:-1]
            return tuple(v for v in val.split(','))
        raise ValueError('Cannot convert "{val}" to a tuple.')

    out_csv = [[] for _ in rows]

    for col, header_name in enumerate(rows[0]):
        if 'time' in header_name:
            header_name = 'time'

        if col == col_to_expand:
            out_csv[0].extend([prepend_to_names + col_name for col_name in expand_col_names])
        else:
            out_csv[0].append(header_name)

        for row, row_val in enumerate(rows[1:]):
            row_val = row_val[col]
            if col == col_to_expand:
                try:
                    vals = cast_tuple(row_val)
                except ValueError as exception:
                    raise ValueError(f'Value at row {row}, col {col} ({row_val}) could not be converted to a tuple.') from exception
                assert len(vals) == len(expand_col_names), f'Value at row {row}, col {col} ({row_val}) was converted to a tuple with more values than "expand_cols_into" ({expand_col_names}) has.'
                for val in vals:
                    out_csv[row + 1].append(val)
            else:
                out_csv[row + 1].append(row_val)

    file_name = file_name[:-len('.csv')] + "_cleaned.csv"
    with open(file_name, 'w+', newline='', encoding="utf-8") as file:
        writer = csv.writer(file, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        for row in out_csv:
            writer.writerow(row)

if __name__ == "__main__":
    main()
