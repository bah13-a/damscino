package tn.damascino.reporting.reconciliation;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ValuesTest {

    @Test
    void readsTillAmounts() {
        assertThat(Values.amount("8,000")).isEqualByComparingTo("8");
        assertThat(Values.amount("-8.000 DT")).isEqualByComparingTo("8");
        assertThat(Values.amount("1.234,500")).isEqualByComparingTo("1234.5");
        assertThat(Values.amount("1,234.500")).isEqualByComparingTo("1234.5");
        assertThat(Values.amount("")).isNull();
        assertThat(Values.amount("n/a")).isNull();
    }

    @Test
    void readsTillDates() {
        LocalDateTime expected = LocalDateTime.of(2026, 9, 24, 12, 31);
        assertThat(Values.dateTime("24/09/2026 12:31")).isEqualTo(expected);
        assertThat(Values.dateTime("2026-09-24 12:31:00")).isEqualTo(expected);
        assertThat(Values.dateTime("24/09/2026", "12h31")).isEqualTo(expected);
        assertThat(Values.dateTime("hier")).isNull();
    }

    @Test
    void guessesTheColumnsOfATypicalExport() {
        ColumnMapping m = ColumnMapping.guess(List.of("N° Ticket", "Date", "Heure", "Caissier", "Total TTC",
                "Libellé remise", "Montant remise", "Commentaire"));

        assertThat(m).isEqualTo(new ColumnMapping(null, 1, 2, 0, 6, 5, 7, 3));
    }
}
