package tn.damascino.privilege.domain;

import org.junit.jupiter.api.Test;
import tn.damascino.common.events.BeneficiaryChanged;
import tn.damascino.common.events.PartnerChanged;
import tn.damascino.common.time.UsagePeriod;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.PartnerProjection;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EligibilityPolicyTest {

    private final UUID partnerId = UUID.randomUUID();
    private final LocalDate today = LocalDate.of(2026, 9, 23);

    private PartnerProjection partner(boolean active, LocalDate start, LocalDate end) {
        PartnerProjection partner = new PartnerProjection(partnerId);
        partner.apply(new PartnerChanged(partnerId, "Mall of Sfax", active, start, end, BigDecimal.valueOf(20),
                List.of("PLATS"), List.of("BOISSONS", "DESSERTS"), 1, UsagePeriod.DAY));
        return partner;
    }

    private BeneficiaryProjection beneficiary(boolean active) {
        UUID id = UUID.randomUUID();
        BeneficiaryProjection b = new BeneficiaryProjection(id);
        b.apply(new BeneficiaryChanged(id, partnerId, "Amira", "Ben Salah", "98123456", active, Instant.now(), null));
        return b;
    }

    private final PartnerProjection running = partner(true, today.minusMonths(1), today.plusMonths(6));

    @Test
    void grantsTheAdvantageOncePerDay() {
        assertThat(EligibilityPolicy.evaluate(beneficiary(true), running, today, 0)).isEmpty();
        assertThat(EligibilityPolicy.evaluate(beneficiary(true), running, today, 1)).contains(RefusalReason.QUOTA_REACHED);
    }

    @Test
    void refusesInactiveOrUnknownAccounts() {
        assertThat(EligibilityPolicy.evaluate(beneficiary(false), running, today, 0))
                .contains(RefusalReason.BENEFICIARY_INACTIVE);
        assertThat(EligibilityPolicy.evaluate(new BeneficiaryProjection(UUID.randomUUID()), running, today, 0))
                .contains(RefusalReason.UNKNOWN_ACCOUNT);
    }

    @Test
    void checksPartnerAndConventionDates() {
        assertThat(EligibilityPolicy.evaluate(beneficiary(true), partner(false, today, today), today, 0))
                .contains(RefusalReason.PARTNER_INACTIVE);
        assertThat(EligibilityPolicy.evaluate(beneficiary(true), partner(true, today.plusDays(1), today.plusDays(9)), today, 0))
                .contains(RefusalReason.CONVENTION_NOT_STARTED);
        assertThat(EligibilityPolicy.evaluate(beneficiary(true), partner(true, today.minusYears(1), today.minusDays(1)), today, 0))
                .contains(RefusalReason.CONVENTION_EXPIRED);
        assertThat(EligibilityPolicy.evaluate(beneficiary(true), partner(true, today, today), today, 0)).isEmpty();
    }

    @Test
    void computesTheDiscountOfTheSpecificationExample() {
        // Eau 4 DT + Azmari Kebab 40 DT + Kunafa 15 DT : 20 % sur le kebab = 8 DT
        assertThat(Redemption.discountOf(BigDecimal.valueOf(40), BigDecimal.valueOf(20))).isEqualByComparingTo("8");
        assertThat(Redemption.discountOf(null, BigDecimal.valueOf(20))).isNull();
    }
}
