package tn.damascino.partner.domain;

import tn.damascino.common.time.UsagePeriod;
import tn.damascino.common.web.ApiException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

/** Advantage granted to the beneficiaries of a partner (configurable from the administration). */
public record AdvantageRule(
        BigDecimal discountPercent,
        List<String> eligibleCategories,
        List<String> excludedCategories,
        int usagesPerPeriod,
        UsagePeriod usagePeriod) {

    /** V1 rule: 20 % on one eligible dish per calendar day; drinks and desserts excluded. */
    public static AdvantageRule defaultRule() {
        return new AdvantageRule(BigDecimal.valueOf(20), List.of("PLATS"), List.of("BOISSONS", "DESSERTS"), 1,
                UsagePeriod.DAY);
    }

    public AdvantageRule {
        if (discountPercent == null || discountPercent.signum() <= 0 || discountPercent.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw ApiException.badRequest("INVALID_RULE", "Le pourcentage de remise doit être compris entre 0 et 100");
        }
        if (usagesPerPeriod < 1 || usagesPerPeriod > 100) {
            throw ApiException.badRequest("INVALID_RULE", "Le nombre d'utilisations par période doit être entre 1 et 100");
        }
        if (usagePeriod == null) {
            throw ApiException.badRequest("INVALID_RULE", "La période est obligatoire");
        }
        eligibleCategories = normalize(eligibleCategories);
        excludedCategories = normalize(excludedCategories);
        if (eligibleCategories.isEmpty()) {
            throw ApiException.badRequest("INVALID_RULE", "Au moins une catégorie éligible est requise");
        }
        if (eligibleCategories.stream().anyMatch(excludedCategories::contains)) {
            throw ApiException.badRequest("INVALID_RULE", "Une catégorie ne peut pas être à la fois éligible et exclue");
        }
    }

    private static List<String> normalize(List<String> codes) {
        return codes == null ? List.of() : codes.stream()
                .filter(c -> c != null && !c.isBlank())
                .map(c -> c.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
    }
}
