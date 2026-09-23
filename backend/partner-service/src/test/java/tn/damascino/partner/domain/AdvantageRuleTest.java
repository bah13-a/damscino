package tn.damascino.partner.domain;

import org.junit.jupiter.api.Test;
import tn.damascino.common.time.UsagePeriod;
import tn.damascino.common.web.ApiException;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdvantageRuleTest {

    @Test
    void defaultRuleMatchesTheSpecification() {
        AdvantageRule rule = AdvantageRule.defaultRule();

        assertThat(rule.discountPercent()).isEqualByComparingTo("20");
        assertThat(rule.usagesPerPeriod()).isEqualTo(1);
        assertThat(rule.usagePeriod()).isEqualTo(UsagePeriod.DAY);
        assertThat(rule.excludedCategories()).containsExactly("BOISSONS", "DESSERTS");
    }

    @Test
    void refusesACategoryBothEligibleAndExcluded() {
        assertThatThrownBy(() -> new AdvantageRule(BigDecimal.TEN, List.of("plats"), List.of("PLATS"), 1, UsagePeriod.DAY))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void refusesAnInvalidPercentage() {
        assertThatThrownBy(() -> new AdvantageRule(BigDecimal.valueOf(120), List.of("PLATS"), List.of(), 1, UsagePeriod.DAY))
                .isInstanceOf(ApiException.class);
    }
}
