package tn.damascino.privilege.pos;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Chooses the ticket line that receives the advantage: one eligible dish (category included and not excluded),
 * the line requested by the cashier if any, otherwise the most expensive eligible dish.
 */
public final class DiscountCalculator {

    private DiscountCalculator() {
    }

    public record Line(String lineId, String sku, String label, String category, BigDecimal unitPrice, BigDecimal quantity) {
    }

    public record Choice(String lineId, String label, String category, BigDecimal unitPrice, BigDecimal discountAmount) {
    }

    /**
     * @param skuCategories categories of the till articles mapped in the administration (used when the till does
     *                      not send the category itself)
     */
    public static Optional<Choice> choose(List<Line> lines, Map<String, String> skuCategories, List<String> eligible,
                                          List<String> excluded, BigDecimal percent, String preferredLineId) {
        List<Choice> candidates = lines.stream()
                .filter(line -> line.unitPrice() != null && line.unitPrice().signum() > 0)
                .filter(line -> line.quantity() == null || line.quantity().signum() > 0)
                .map(line -> {
                    String category = categoryOf(line, skuCategories);
                    return new Choice(line.lineId(), line.label(), category, line.unitPrice(),
                            line.unitPrice().multiply(percent).divide(BigDecimal.valueOf(100), 3, RoundingMode.HALF_UP));
                })
                .filter(choice -> choice.category() != null && eligible.contains(choice.category())
                        && !excluded.contains(choice.category()))
                .toList();
        if (preferredLineId != null) {
            Optional<Choice> preferred = candidates.stream().filter(c -> preferredLineId.equals(c.lineId())).findFirst();
            if (preferred.isPresent()) {
                return preferred;
            }
        }
        return candidates.stream().max(Comparator.comparing(Choice::unitPrice));
    }

    static String categoryOf(Line line, Map<String, String> skuCategories) {
        if (line.sku() != null && skuCategories.containsKey(line.sku())) {
            return skuCategories.get(line.sku());
        }
        return line.category() == null || line.category().isBlank() ? null : line.category().trim().toUpperCase(Locale.ROOT);
    }
}
