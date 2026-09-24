package tn.damascino.reporting.reconciliation;

import java.util.List;

/** Raw content of a sales export of the till: header row and data rows (with their line number in the file). */
public record SalesTable(List<String> headers, List<Row> rows) {

    public record Row(int line, List<String> cells) {

        public String cell(Integer index) {
            return index == null || index < 0 || index >= cells.size() ? "" : cells.get(index).trim();
        }
    }
}
