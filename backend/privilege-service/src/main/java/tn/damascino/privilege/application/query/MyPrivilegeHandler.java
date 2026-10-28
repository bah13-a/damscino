package tn.damascino.privilege.application.query;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.application.query.MyPrivilegeQuery.Availability;
import tn.damascino.privilege.application.query.MyPrivilegeQuery.Dashboard;
import tn.damascino.privilege.application.query.MyPrivilegeQuery.LastScan;
import tn.damascino.privilege.application.query.MyPrivilegeQuery.Passage;
import tn.damascino.privilege.domain.EligibilityPolicy;
import tn.damascino.privilege.application.QuotaService;
import tn.damascino.privilege.domain.RedemptionRepository;
import tn.damascino.privilege.domain.RefusalReason;
import tn.damascino.privilege.domain.ScanNoticeRepository;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.BeneficiaryProjectionRepository;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.projection.PartnerProjectionRepository;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

@Component
public class MyPrivilegeHandler implements QueryHandler<MyPrivilegeQuery, Dashboard> {

    private final BeneficiaryProjectionRepository beneficiaries;
    private final PartnerProjectionRepository partners;
    private final RedemptionRepository redemptions;
    private final QuotaService quota;
    private final ScanNoticeRepository scanNotices;
    private final Clock clock;

    public MyPrivilegeHandler(BeneficiaryProjectionRepository beneficiaries, PartnerProjectionRepository partners,
                              RedemptionRepository redemptions, QuotaService quota, ScanNoticeRepository scanNotices,
                              Clock clock) {
        this.beneficiaries = beneficiaries;
        this.partners = partners;
        this.redemptions = redemptions;
        this.quota = quota;
        this.scanNotices = scanNotices;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public Dashboard handle(MyPrivilegeQuery query) {
        if (query.user().beneficiaryId() == null) {
            throw ApiException.forbidden("FORBIDDEN", "Réservé aux bénéficiaires");
        }
        BeneficiaryProjection beneficiary = beneficiaries.findById(query.user().beneficiaryId()).orElse(null);
        if (beneficiary != null && query.user().sessionVersion() < beneficiary.getSessionVersion()) {
            // the screen polls this endpoint: the previous device is signed out within seconds
            throw ApiException.unauthorized("SESSION_REPLACED",
                    "Votre compte est connecté sur un autre appareil. Reconnectez-vous pour utiliser votre avantage.");
        }
        PartnerProjection partner = beneficiary == null || beneficiary.getPartnerId() == null
                ? null : partners.findById(beneficiary.getPartnerId()).orElse(null);
        if (beneficiary == null || !beneficiary.isKnown() || partner == null) {
            return new Dashboard(query.user().displayName(), null, null, List.of(), List.of(), 0, null, 0,
                    Availability.PENDING, "Votre compte est en cours d'activation, réessayez dans un instant.", null,
                    null, List.of(), null);
        }

        LocalDate today = LocalDate.now(clock);
        long used = quota.used(beneficiary.getId(), partner.getUsagePeriod().keyOf(today));
        RefusalReason refusal = EligibilityPolicy.evaluate(beneficiary, partner, today, used).orElse(null);
        Availability availability = refusal == null ? Availability.AVAILABLE : switch (refusal) {
            case QUOTA_REACHED -> Availability.USED;
            case CONVENTION_NOT_STARTED -> Availability.CONVENTION_NOT_STARTED;
            case CONVENTION_EXPIRED, PARTNER_INACTIVE -> Availability.CONVENTION_EXPIRED;
            default -> Availability.INACTIVE;
        };
        String message = switch (availability) {
            case AVAILABLE -> "Disponible";
            case USED -> "Déjà utilisé " + switch (partner.getUsagePeriod()) {
                case DAY -> "aujourd'hui";
                case WEEK -> "cette semaine";
                case MONTH -> "ce mois-ci";
            };
            case CONVENTION_NOT_STARTED -> "La convention commence le " + partner.getConventionStart();
            case CONVENTION_EXPIRED -> "Convention expirée";
            case INACTIVE -> "Compte désactivé";
            case PENDING -> "En cours d'activation";
        };

        List<Passage> history = redemptions.findHistory(beneficiary.getId(),
                        PageRequest.of(0, 50)).stream()
                .map(r -> new Passage(r.getId(), r.getValidatedAt(), r.getDiscountPercent(), r.getDishPrice(),
                        r.getDiscountAmount()))
                .toList();

        return new Dashboard(beneficiary.fullName(), partner.getName(), partner.getDiscountPercent(),
                partner.getEligibleCategories(), partner.getExcludedCategories(), partner.getUsagesPerPeriod(),
                partner.getUsagePeriod(), used, availability, message,
                availability == Availability.USED ? partner.getUsagePeriod().nextStart(today) : null,
                partner.getConventionEnd(), history, lastScan(beneficiary, today));
    }

    /** Only today's scan: yesterday's result would be stale on a screen that announces what just happened. */
    private LastScan lastScan(BeneficiaryProjection beneficiary, LocalDate today) {
        return scanNotices.findById(beneficiary.getId())
                .filter(n -> LocalDate.ofInstant(n.getScannedAt(), clock.getZone()).equals(today))
                .map(n -> new LastScan(n.getStatus(), n.getReason(), n.getMessage(), n.getStaffName(),
                        n.getDiscountPercent(), n.getDishPrice(), n.getDiscountAmount(), n.getScannedAt()))
                .orElse(null);
    }
}
