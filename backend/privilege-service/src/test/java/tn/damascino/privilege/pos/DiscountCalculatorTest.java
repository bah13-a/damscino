package tn.damascino.privilege.pos;

import org.junit.jupiter.api.Test;
import tn.damascino.privilege.pos.DiscountCalculator.Line;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DiscountCalculatorTest {

    private static final List<String> ELIGIBLE = List.of("PLATS");
    private static final List<String> EXCLUDED = List.of("BOISSONS", "DESSERTS");
    private static final BigDecimal TWENTY = BigDecimal.valueOf(20);

    private static Line line(String id, String sku, String label, String category, double price) {
        return new Line(id, sku, label, category, BigDecimal.valueOf(price), BigDecimal.ONE);
    }

    /** Exemple du cahier des charges : Eau 4 DT + Azmari Kebab 40 DT + Kunafa 15 DT → 8 DT de remise sur le kebab. */
    private final List<Line> ticket = List.of(
            line("1", "EAU-50", "Eau", "BOISSONS", 4),
            line("2", "KEB-AZM", "Azmari Kebab", "PLATS", 40),
            line("3", "DES-KUN", "Kunafa", "DESSERTS", 15));

    @Test
    void discountsTheEligibleDishOfTheSpecificationExample() {
        var choice = DiscountCalculator.choose(ticket, Map.of(), ELIGIBLE, EXCLUDED, TWENTY, null).orElseThrow();

        assertThat(choice.lineId()).isEqualTo("2");
        assertThat(choice.discountAmount()).isEqualByComparingTo("8");
    }

    @Test
    void picksTheMostExpensiveEligibleDishUnlessTheCashierChoseOne() {
        List<Line> twoDishes = List.of(line("1", null, "Chawarma", "plats", 18), line("2", null, "Mixed grill", "PLATS", 52));

        assertThat(DiscountCalculator.choose(twoDishes, Map.of(), ELIGIBLE, EXCLUDED, TWENTY, null).orElseThrow().lineId())
                .isEqualTo("2");
        assertThat(DiscountCalculator.choose(twoDishes, Map.of(), ELIGIBLE, EXCLUDED, TWENTY, "1").orElseThrow().lineId())
                .isEqualTo("1");
    }

    @Test
    void usesTheArticleMappingWhenTheTillDoesNotSendCategories() {
        List<Line> withoutCategories = List.of(line("1", "EAU-50", "Eau", null, 4), line("2", "KEB-AZM", "Azmari Kebab", null, 40));

        var choice = DiscountCalculator.choose(withoutCategories, Map.of("KEB-AZM", "PLATS", "EAU-50", "BOISSONS"),
                ELIGIBLE, EXCLUDED, TWENTY, null);

        assertThat(choice).get().extracting(DiscountCalculator.Choice::label).isEqualTo("Azmari Kebab");
    }

    @Test
    void noDiscountWithoutEligibleDish() {
        List<Line> drinksOnly = List.of(line("1", null, "Eau", "BOISSONS", 4), line("2", null, "Kunafa", "DESSERTS", 15));

        assertThat(DiscountCalculator.choose(drinksOnly, Map.of(), ELIGIBLE, EXCLUDED, TWENTY, null)).isEmpty();
        assertThat(DiscountCalculator.choose(List.of(line("1", "X", "Inconnu", null, 30)), Map.of(), ELIGIBLE, EXCLUDED,
                TWENTY, null)).isEmpty();
    }
}
