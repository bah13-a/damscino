package tn.damascino.partner.application.importing;

import org.junit.jupiter.api.Test;
import tn.damascino.common.export.TabularExport;
import tn.damascino.common.web.ApiException;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BeneficiaryFileParserTest {

    @Test
    void readsSemicolonCsvWithAccentedHeadersInAnyOrder() {
        String csv = "﻿Téléphone;Prénom;Nom\n98 123 456;Amira;Ben Salah\n;;\n+216 22 333 444;Karim;Trabelsi\n";

        List<ImportRow> rows = BeneficiaryFileParser.parse("liste.csv", csv.getBytes(StandardCharsets.UTF_8), 100);

        assertThat(rows).containsExactly(
                new ImportRow(2, "Ben Salah", "Amira", "98 123 456"),
                new ImportRow(4, "Trabelsi", "Karim", "+216 22 333 444"));
    }

    @Test
    void readsTheExcelTemplate() {
        byte[] xlsx = TabularExport.xlsx("modele", List.of("Nom", "Prénom", "Téléphone"),
                List.of(List.of("Ben Salah", "Amira", 98123456)));

        List<ImportRow> rows = BeneficiaryFileParser.parse("liste.xlsx", xlsx, 100);

        assertThat(rows).containsExactly(new ImportRow(2, "Ben Salah", "Amira", "98123456"));
    }

    @Test
    void rejectsFilesWithoutTheExpectedColumns() {
        byte[] csv = "a,b\n1,2\n".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> BeneficiaryFileParser.parse("x.csv", csv, 100))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Colonnes attendues");
    }
}
