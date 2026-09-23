package tn.damascino.partner.application.query;

import tn.damascino.common.time.UsagePeriod;
import tn.damascino.partner.domain.AdvantageRule;
import tn.damascino.partner.domain.Partner;
import tn.damascino.partner.domain.PartnerProfile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PartnerView(
        UUID id,
        String name,
        String contactName,
        String contactPhone,
        String contactEmail,
        boolean active,
        LocalDate conventionStart,
        LocalDate conventionEnd,
        boolean conventionRunning,
        BigDecimal discountPercent,
        List<String> eligibleCategories,
        List<String> excludedCategories,
        int usagesPerPeriod,
        UsagePeriod usagePeriod,
        long beneficiaryCount,
        long activatedCount) {

    public static PartnerView of(Partner partner, LocalDate today, long beneficiaryCount, long activatedCount) {
        PartnerProfile p = partner.profile();
        AdvantageRule r = partner.rule();
        return new PartnerView(partner.getId(), p.name(), p.contactName(), p.contactPhone(), p.contactEmail(),
                partner.isActive(), p.conventionStart(), p.conventionEnd(), partner.isConventionRunning(today),
                r.discountPercent(), r.eligibleCategories(), r.excludedCategories(), r.usagesPerPeriod(),
                r.usagePeriod(), beneficiaryCount, activatedCount);
    }
}
