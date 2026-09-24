package tn.damascino.reporting.reconciliation;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import tn.damascino.common.web.ApiException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.Charset;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Reads the sales export of any till (Excel or CSV, ';' ',' or tab separated, UTF-8 or Windows-1252). */
public final class SalesFileReader {

    private static final int MAX_ROWS = 50_000;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private SalesFileReader() {
    }

    public static SalesTable read(String filename, byte[] content) {
        String name = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        List<List<String>> table;
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            table = readExcel(content);
        } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
            table = readCsv(content);
        } else {
            throw ApiException.badRequest("UNSUPPORTED_FILE", "Format non supporté : export Excel (.xlsx) ou CSV de la caisse");
        }
        int headerIndex = 0;
        while (headerIndex < table.size() && table.get(headerIndex).stream().allMatch(String::isBlank)) {
            headerIndex++;
        }
        if (headerIndex >= table.size()) {
            throw ApiException.badRequest("EMPTY_FILE", "Le fichier est vide");
        }
        List<String> headers = table.get(headerIndex).stream().map(String::trim).toList();
        List<SalesTable.Row> rows = new ArrayList<>();
        for (int i = headerIndex + 1; i < table.size(); i++) {
            List<String> cells = table.get(i);
            if (cells.stream().allMatch(String::isBlank)) {
                continue;
            }
            if (rows.size() >= MAX_ROWS) {
                throw ApiException.badRequest("TOO_MANY_ROWS", "Le fichier dépasse " + MAX_ROWS + " lignes : exportez une période plus courte");
            }
            rows.add(new SalesTable.Row(i + 1, cells));
        }
        return new SalesTable(headers, rows);
    }

    private static List<List<String>> readCsv(byte[] content) {
        String text = decode(content);
        if (text.startsWith("﻿")) {
            text = text.substring(1);
        }
        String first = text.lines().findFirst().orElse("");
        char delimiter = ';';
        long best = first.chars().filter(c -> c == ';').count();
        for (char candidate : new char[]{',', '\t'}) {
            long count = first.chars().filter(c -> c == candidate).count();
            if (count > best) {
                best = count;
                delimiter = candidate;
            }
        }
        try (CSVParser parser = CSVFormat.DEFAULT.builder().setDelimiter(delimiter).setTrim(true).build()
                .parse(new StringReader(text))) {
            List<List<String>> table = new ArrayList<>();
            for (CSVRecord record : parser) {
                table.add(record.toList());
            }
            return table;
        } catch (IOException | IllegalStateException e) {
            throw ApiException.badRequest("INVALID_FILE", "Fichier CSV illisible");
        }
    }

    /** Exports of Windows tills are often in Windows-1252 rather than UTF-8. */
    private static String decode(byte[] content) {
        try {
            return StandardCharsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(content)).toString();
        } catch (CharacterCodingException e) {
            return new String(content, Charset.forName("windows-1252"));
        }
    }

    private static List<List<String>> readExcel(byte[] content) {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter(Locale.FRANCE);
            List<List<String>> table = new ArrayList<>();
            for (int r = sheet.getFirstRowNum(); r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                List<String> cells = new ArrayList<>();
                if (row != null) {
                    for (int c = 0; c < Math.max(row.getLastCellNum(), 0); c++) {
                        cells.add(text(row.getCell(c), formatter));
                    }
                }
                table.add(cells);
            }
            return table;
        } catch (IOException | RuntimeException e) {
            throw ApiException.badRequest("INVALID_FILE", "Fichier Excel illisible");
        }
    }

    private static String text(Cell cell, DataFormatter formatter) {
        if (cell == null) {
            return "";
        }
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return ISO.format(cell.getLocalDateTimeCellValue());
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            // raw value: the displayed format may hide the millimes
            return java.math.BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
        }
        return formatter.formatCellValue(cell).trim();
    }
}
