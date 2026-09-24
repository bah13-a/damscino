package tn.damascino.reporting.reconciliation;

import org.junit.jupiter.api.Test;
import tn.damascino.reporting.reconciliation.Reconciler.MatchedBy;
import tn.damascino.reporting.reconciliation.Reconciler.Passage;
import tn.damascino.reporting.reconciliation.Reconciler.Sale;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ReconcilerTest {

    private static final LocalDateTime NOON = LocalDateTime.of(2026, 9, 24, 12, 0);

    private static Passage passage(String code, int minute, double amount) {
        return new Passage(UUID.randomUUID(), NOON.plusMinutes(minute), "Client " + code, "Mall of Sfax", "Sami",
                BigDecimal.valueOf(amount * 5), BigDecimal.valueOf(amount), code, null, "SCANNER");
    }

    private static Sale sale(int line, int minute, double amount, String comment) {
        return new Sale(line, NOON.plusMinutes(minute), "T" + line, BigDecimal.valueOf(amount), "Damascino Privilèges",
                comment, "Sami");
    }

    @Test
    void matchesByCodeThenByTimeAndAmountAndReportsTheRest() {
        Passage withCode = passage("428249", 0, 8);
        Passage withoutCode = passage("111111", 30, 6);
        Passage forgotten = passage("222222", 90, 7);

        Reconciler.Result result = Reconciler.reconcile(List.of(
                sale(2, 3, 8, "code 428249"),     // code written on the ticket
                sale(3, 34, 6, null),             // no code: same amount 4 minutes later
                sale(4, 200, 9, null)),           // discount entered without any validated passage
                List.of(withCode, withoutCode, forgotten), Duration.ofMinutes(30));

        assertThat(result.matched()).extracting(Reconciler.Match::matchedBy).containsExactly(MatchedBy.CODE, MatchedBy.TIME_AND_AMOUNT);
        assertThat(result.unmatchedSales()).extracting(Sale::line).containsExactly(4);
        assertThat(result.unmatchedPassages()).containsExactly(forgotten);
    }

    @Test
    void codeMatchReportsAnAmountGap() {
        Reconciler.Result result = Reconciler.reconcile(List.of(sale(2, 5, 10, "428249")),
                List.of(passage("428249", 0, 8)), Duration.ofMinutes(30));

        assertThat(result.matched().get(0).hasGap()).isTrue();
        assertThat(result.matched().get(0).amountGap()).isEqualByComparingTo("2");
    }

    @Test
    void prefersAPassageWithTheSameAmountOverOneValidatedWithoutPrice() {
        Passage withoutPrice = new Passage(UUID.randomUUID(), NOON.plusMinutes(1), "Sans prix", "Mall", "Sami", null, null,
                "333333", null, "SCANNER");
        Passage sameAmount = passage("444444", 10, 8);

        Reconciler.Result result = Reconciler.reconcile(List.of(sale(2, 2, 8, null)), List.of(withoutPrice, sameAmount),
                Duration.ofMinutes(30));

        assertThat(result.matched().get(0).passage()).isEqualTo(sameAmount);
        assertThat(result.unmatchedPassages()).containsExactly(withoutPrice);
    }

    @Test
    void doesNotMatchADifferentAmountOrTooFarInTime() {
        Reconciler.Result result = Reconciler.reconcile(List.of(sale(2, 5, 10, null), sale(3, 50, 8, null)),
                List.of(passage("428249", 0, 8)), Duration.ofMinutes(30));

        assertThat(result.matched()).isEmpty();
        assertThat(result.unmatchedSales()).hasSize(2);
    }
}
