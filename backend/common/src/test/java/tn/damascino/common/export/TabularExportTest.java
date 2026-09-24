package tn.damascino.common.export;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TabularExportTest {

    @Test
    void csvCellsThatExcelWouldRunAsFormulasAreNeutralised() {
        assertThat(TabularExport.csvCell("=HYPERLINK(\"http://x\",\"clic\")")).isEqualTo("'=HYPERLINK(\"http://x\",\"clic\")");
        assertThat(TabularExport.csvCell("@SUM(A1)")).isEqualTo("'@SUM(A1)");
        assertThat(TabularExport.csvCell("-2+3+cmd|' /C calc'!A0")).isEqualTo("'-2+3+cmd|' /C calc'!A0");
        assertThat(TabularExport.csvCell("+21698123456")).isEqualTo("+21698123456");
        assertThat(TabularExport.csvCell("-5,5")).isEqualTo("-5,5");
        assertThat(TabularExport.csvCell("Ben Ali")).isEqualTo("Ben Ali");
        assertThat(TabularExport.csvCell(12)).isEqualTo(12);
        assertThat(TabularExport.csvCell(null)).isEqualTo("");

        String csv = new String(TabularExport.csv(List.of("Nom"), List.of(List.of("=1+1"))), StandardCharsets.UTF_8);
        assertThat(csv).contains("'=1+1");
    }
}
