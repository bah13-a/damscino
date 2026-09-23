package tn.damascino.partner.application.importing;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import tn.damascino.common.web.ApiException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Reads beneficiary lists from Excel (.xlsx / .xls) or CSV (';' or ',') with columns Nom, Prénom, Téléphone. */
public final class BeneficiaryFileParser {

    private BeneficiaryFileParser() {
    }

    public static List<ImportRow> parse(String filename, byte[] content, int maxRows) {
        String name = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        List<List<String>> table;
        if (name.endsWith(".csv") || name.endsWith(".txt")) {
            table = readCsv(content);
        } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            table = readExcel(content);
        } else {
            throw ApiException.badRequest("UNSUPPORTED_FILE", "Format non supporté : utilisez un fichier Excel (.xlsx) ou CSV");
        }
        if (table.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "Le fichier est vide");
        }

        List<String> header = table.get(0);
        int lastName = column(header, "nom", "lastname", "nomdefamille");
        int firstName = column(header, "prenom", "firstname");
        int phone = column(header, "telephone", "tel", "phone", "mobile", "numero", "gsm");
        if (lastName < 0 || firstName < 0 || phone < 0) {
            throw ApiException.badRequest("MISSING_COLUMNS",
                    "Colonnes attendues : Nom, Prénom, Téléphone (téléchargez le modèle)");
        }

        List<ImportRow> rows = new ArrayList<>();
        for (int i = 1; i < table.size(); i++) {
            List<String> cells = table.get(i);
            if (cells.stream().allMatch(String::isBlank)) {
                continue;
            }
            if (rows.size() >= maxRows) {
                throw ApiException.badRequest("TOO_MANY_ROWS", "Le fichier dépasse " + maxRows + " lignes");
            }
            rows.add(new ImportRow(i + 1, cell(cells, lastName), cell(cells, firstName), cell(cells, phone)));
        }
        return rows;
    }

    private static List<List<String>> readCsv(byte[] content) {
        String text = new String(content, StandardCharsets.UTF_8);
        if (text.startsWith("﻿")) {
            text = text.substring(1);
        }
        String firstLine = text.lines().findFirst().orElse("");
        char delimiter = firstLine.chars().filter(c -> c == ';').count() >= firstLine.chars().filter(c -> c == ',').count()
                ? ';' : ',';
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
                        cells.add(formatter.formatCellValue(row.getCell(c)).trim());
                    }
                }
                table.add(cells);
            }
            return table;
        } catch (IOException | RuntimeException e) {
            throw ApiException.badRequest("INVALID_FILE", "Fichier Excel illisible");
        }
    }

    private static int column(List<String> header, String... aliases) {
        for (int i = 0; i < header.size(); i++) {
            String key = simplify(header.get(i));
            for (String alias : aliases) {
                if (key.equals(alias)) {
                    return i;
                }
            }
        }
        return -1;
    }

    static String simplify(String value) {
        String noAccents = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return noAccents.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
    }

    private static String cell(List<String> cells, int index) {
        return index < cells.size() && cells.get(index) != null ? cells.get(index).trim() : "";
    }
}
