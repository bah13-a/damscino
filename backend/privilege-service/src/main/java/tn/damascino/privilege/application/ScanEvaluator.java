package tn.damascino.privilege.application;

import org.springframework.stereotype.Component;
import tn.damascino.common.events.RedemptionRejected;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.privilege.domain.EligibilityPolicy;
import tn.damascino.privilege.domain.RefusalReason;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.BeneficiaryProjectionRepository;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.projection.PartnerProjectionRepository;
import tn.damascino.privilege.qr.QrPayload;
import tn.damascino.privilege.qr.QrTokenService;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

/** Runs every check of a scanned QR code (token, session, beneficiary, partner, convention, quota). */
@Component
public class ScanEvaluator {

    private final QrTokenService qrTokens;
    private final BeneficiaryProjectionRepository beneficiaries;
    private final PartnerProjectionRepository partners;
    private final QuotaService quota;
    private final EventPublisher events;
    private final Clock clock;

    public ScanEvaluator(QrTokenService qrTokens, BeneficiaryProjectionRepository beneficiaries,
                         PartnerProjectionRepository partners, QuotaService quota, EventPublisher events,
                         Clock clock) {
        this.qrTokens = qrTokens;
        this.beneficiaries = beneficiaries;
        this.partners = partners;
        this.quota = quota;
        this.events = events;
        this.clock = clock;
    }

    public record Evaluation(QrPayload payload, BeneficiaryProjection beneficiary, PartnerProjection partner,
                             String periodKey, long usedInPeriod, RefusalReason refusal) {

        public boolean accepted() {
            return refusal == null;
        }
    }

    /**
     * @param lockBeneficiary take a row lock on the beneficiary so that two simultaneous confirmations are serialised
     */
    public Evaluation evaluate(String token, boolean lockBeneficiary) {
        Instant now = clock.instant();
        Optional<QrPayload> read = qrTokens.read(token);
        if (read.isEmpty()) {
            return refused(null, null, null, RefusalReason.INVALID_QR);
        }
        QrPayload payload = read.get();
        BeneficiaryProjection beneficiary = (lockBeneficiary
                ? beneficiaries.findForUpdate(payload.beneficiaryId())
                : beneficiaries.findById(payload.beneficiaryId())).orElse(null);
        PartnerProjection partner = beneficiary == null || beneficiary.getPartnerId() == null
                ? null : partners.findById(beneficiary.getPartnerId()).orElse(null);

        if (!payload.expiresAt().isAfter(now)) {
            return refused(payload, beneficiary, partner, RefusalReason.QR_EXPIRED);
        }
        if (quota.isNonceUsed(payload.nonce())) {
            return refused(payload, beneficiary, partner, RefusalReason.QR_ALREADY_USED);
        }
        if (beneficiary != null && payload.sessionVersion() < beneficiary.getSessionVersion()) {
            return refused(payload, beneficiary, partner, RefusalReason.SESSION_REPLACED);
        }
        LocalDate today = LocalDate.now(clock);
        String periodKey = partner == null ? null : partner.getUsagePeriod().keyOf(today);
        long used = periodKey == null ? 0 : quota.used(beneficiary.getId(), periodKey);
        RefusalReason refusal = EligibilityPolicy.evaluate(beneficiary, partner, today, used).orElse(null);
        return new Evaluation(payload, beneficiary, partner, periodKey, used, refusal);
    }

    private Evaluation refused(QrPayload payload, BeneficiaryProjection beneficiary, PartnerProjection partner,
                               RefusalReason reason) {
        return new Evaluation(payload, beneficiary, partner, null, 0, reason);
    }

    /** Journalises the refusal and builds the red screen. */
    public ScanResult refuse(Evaluation evaluation, AuthenticatedUser staff, String stage) {
        BeneficiaryProjection b = evaluation.beneficiary();
        PartnerProjection p = evaluation.partner();
        events.publish(new RedemptionRejected(
                b == null ? null : b.getId(), b == null ? null : b.fullName(),
                p == null ? null : p.getId(), p == null ? null : p.getName(),
                staff.accountId(), staff.displayName(), evaluation.refusal().name(), stage, clock.instant()));
        return new ScanResult(ScanResult.Status.REFUSED, evaluation.refusal().name(), evaluation.refusal().message(),
                b == null ? null : b.fullName(), p == null ? null : p.getName(),
                p == null ? null : p.getDiscountPercent(), p == null ? null : p.getEligibleCategories(),
                p == null ? null : p.getExcludedCategories(), null, null, null, null, null, null);
    }
}
