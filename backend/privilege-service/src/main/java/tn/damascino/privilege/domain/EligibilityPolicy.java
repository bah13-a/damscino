package tn.damascino.privilege.domain;

import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.PartnerProjection;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Business rules checked server-side both when the QR code is generated and when it is confirmed at the till:
 * existing and active beneficiary, active partner with a running convention, quota of the period not reached.
 */
public final class EligibilityPolicy {

    private EligibilityPolicy() {
    }

    public static Optional<RefusalReason> evaluate(BeneficiaryProjection beneficiary, PartnerProjection partner,
                                                   LocalDate today, long usedInPeriod) {
        if (beneficiary == null || !beneficiary.isKnown() || partner == null) {
            return Optional.of(RefusalReason.UNKNOWN_ACCOUNT);
        }
        if (!beneficiary.isActive()) {
            return Optional.of(RefusalReason.BENEFICIARY_INACTIVE);
        }
        if (!partner.isActive()) {
            return Optional.of(RefusalReason.PARTNER_INACTIVE);
        }
        if (today.isBefore(partner.getConventionStart())) {
            return Optional.of(RefusalReason.CONVENTION_NOT_STARTED);
        }
        if (today.isAfter(partner.getConventionEnd())) {
            return Optional.of(RefusalReason.CONVENTION_EXPIRED);
        }
        if (usedInPeriod >= partner.getUsagesPerPeriod()) {
            return Optional.of(RefusalReason.QUOTA_REACHED);
        }
        return Optional.empty();
    }
}
