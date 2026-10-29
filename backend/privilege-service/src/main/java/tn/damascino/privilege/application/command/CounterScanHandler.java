package tn.damascino.privilege.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.RedemptionConfirmed;
import tn.damascino.common.events.RedemptionRejected;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.security.Role;
import tn.damascino.common.security.Secrets;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.application.QuotaService;
import tn.damascino.privilege.application.ScanNotices;
import tn.damascino.privilege.application.command.CounterScanCommand.Result;
import tn.damascino.privilege.application.command.CounterScanCommand.Status;
import tn.damascino.privilege.domain.EligibilityPolicy;
import tn.damascino.privilege.domain.Redemption;
import tn.damascino.privilege.domain.RedemptionRepository;
import tn.damascino.privilege.domain.RefusalReason;
import tn.damascino.privilege.pos.PosTerminal;
import tn.damascino.privilege.pos.PosTerminalRepository;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.BeneficiaryProjectionRepository;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.projection.PartnerProjectionRepository;
import tn.damascino.privilege.settings.TillSettingsRepository;

import java.time.Clock;
import java.time.LocalDate;

/**
 * The counter QR code only says where the customer is: the right comes from the signed-in account. Checked under a
 * row lock on the beneficiary, so the quota of the period (once a day by default, renewed at midnight) cannot be used
 * twice, even from two phones or with a photo of the label.
 */
@Component
public class CounterScanHandler implements CommandHandler<CounterScanCommand, Result> {

    private final PosTerminalRepository terminals;
    private final BeneficiaryProjectionRepository beneficiaries;
    private final PartnerProjectionRepository partners;
    private final QuotaService quota;
    private final RedemptionRepository redemptions;
    private final TillSettingsRepository tillSettings;
    private final EventPublisher events;
    private final ScanNotices notices;
    private final Clock clock;

    public CounterScanHandler(PosTerminalRepository terminals, BeneficiaryProjectionRepository beneficiaries,
                              PartnerProjectionRepository partners, QuotaService quota,
                              RedemptionRepository redemptions, TillSettingsRepository tillSettings,
                              EventPublisher events, ScanNotices notices, Clock clock) {
        this.terminals = terminals;
        this.beneficiaries = beneficiaries;
        this.partners = partners;
        this.quota = quota;
        this.redemptions = redemptions;
        this.tillSettings = tillSettings;
        this.events = events;
        this.notices = notices;
        this.clock = clock;
    }

    @Override
    @Transactional
    public Result handle(CounterScanCommand command) {
        AuthenticatedUser user = command.user();
        if (user.role() != Role.BENEFICIARY || user.beneficiaryId() == null) {
            throw ApiException.forbidden("FORBIDDEN", "Réservé aux bénéficiaires");
        }
        if (user.passwordChangeRequired()) {
            throw ApiException.forbidden("PASSWORD_CHANGE_REQUIRED", "Veuillez d'abord changer votre mot de passe");
        }
        BeneficiaryProjection beneficiary = beneficiaries.findForUpdate(user.beneficiaryId()).orElse(null);
        if (beneficiary != null && user.sessionVersion() < beneficiary.getSessionVersion()) {
            throw ApiException.unauthorized("SESSION_REPLACED",
                    "Votre compte est connecté sur un autre appareil. Reconnectez-vous pour utiliser votre avantage.");
        }
        PartnerProjection partner = beneficiary == null || beneficiary.getPartnerId() == null
                ? null : partners.findById(beneficiary.getPartnerId()).orElse(null);
        String discountName = tillSettings.current().getDiscountLabel();
        PosTerminal terminal = command.counterCode() == null ? null
                : terminals.findByCounterCode(command.counterCode().trim()).filter(PosTerminal::isActive).orElse(null);
        if (terminal == null) {
            return refuse(beneficiary, partner, null, RefusalReason.COUNTER_UNKNOWN, discountName);
        }

        LocalDate today = LocalDate.now(clock);
        String periodKey = partner == null ? null : partner.getUsagePeriod().keyOf(today);
        long used = periodKey == null ? 0 : quota.used(beneficiary.getId(), periodKey);
        RefusalReason refusal = EligibilityPolicy.evaluate(beneficiary, partner, today, used).orElse(null);
        if (refusal != null) {
            return refuse(beneficiary, partner, terminal, refusal, discountName);
        }

        Redemption redemption = redemptions.saveAndFlush(Redemption.fromCounter(beneficiary.getId(), partner.getId(),
                terminal.getId(), terminal.getName(), periodKey, Secrets.randomToken(16),
                partner.getDiscountPercent(), clock.instant()));
        events.publish(new RedemptionConfirmed(redemption.getId(), beneficiary.getId(), beneficiary.fullName(),
                partner.getId(), partner.getName(), terminal.getId(), terminal.getName(), periodKey, null,
                redemption.getDiscountPercent(), null, redemption.getValidatedAt(), Redemption.CHANNEL_COUNTER,
                terminal.getName(), null, null, redemption.getValidationCode()));
        notices.confirmed(beneficiary.getId(), terminal.getName(), redemption.getDiscountPercent(), null, null);
        return new Result(Status.CONFIRMED, null, "Remise validée", terminal.getName(), beneficiary.fullName(),
                partner.getName(), discountName, redemption.getDiscountPercent(), redemption.getValidatedAt(),
                redemption.getValidationCode());
    }

    private Result refuse(BeneficiaryProjection b, PartnerProjection p, PosTerminal terminal, RefusalReason reason,
                          String discountName) {
        String tillName = terminal == null ? null : terminal.getName();
        events.publish(new RedemptionRejected(b == null ? null : b.getId(), b == null ? null : b.fullName(),
                p == null ? null : p.getId(), p == null ? null : p.getName(),
                terminal == null ? null : terminal.getId(), tillName, reason.name(), "COUNTER", clock.instant()));
        notices.refused(b, tillName, reason);
        String message = reason == RefusalReason.COUNTER_UNKNOWN
                ? "Ce QR code de caisse n'est pas reconnu : demandez au caissier."
                : reason == RefusalReason.QUOTA_REACHED
                ? "Avantage déjà utilisé : il sera de nouveau disponible " + switch (p.getUsagePeriod()) {
                    case DAY -> "demain";
                    case WEEK -> "la semaine prochaine";
                    case MONTH -> "le mois prochain";
                } + "."
                : reason.message();
        return new Result(Status.REFUSED, reason.name(), message, tillName, b == null ? null : b.fullName(),
                p == null ? null : p.getName(), discountName, null, clock.instant(), null);
    }
}
