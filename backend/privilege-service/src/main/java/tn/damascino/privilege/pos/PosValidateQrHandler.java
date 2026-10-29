package tn.damascino.privilege.pos;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.RedemptionConfirmed;
import tn.damascino.common.events.RedemptionRejected;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.application.ScanEvaluator;
import tn.damascino.privilege.application.ScanEvaluator.Evaluation;
import tn.damascino.privilege.application.ScanNotices;
import tn.damascino.privilege.domain.Redemption;
import tn.damascino.privilege.domain.RedemptionRepository;
import tn.damascino.privilege.pos.PosValidateQrCommand.Result;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.settings.TillSettingsRepository;

import java.time.Clock;

/**
 * Same checks as the cashier's phone (signature, expiry, single use, session, convention, quota), under a row lock on
 * the beneficiary, then the passage is recorded at once: quota, statistics, reconciliation and the customer's phone.
 */
@Component
public class PosValidateQrHandler implements CommandHandler<PosValidateQrCommand, Result> {

    private final ScanEvaluator evaluator;
    private final RedemptionRepository redemptions;
    private final TillSettingsRepository tillSettings;
    private final EventPublisher events;
    private final ScanNotices notices;
    private final Clock clock;

    public PosValidateQrHandler(ScanEvaluator evaluator, RedemptionRepository redemptions,
                                TillSettingsRepository tillSettings, EventPublisher events, ScanNotices notices,
                                Clock clock) {
        this.evaluator = evaluator;
        this.redemptions = redemptions;
        this.tillSettings = tillSettings;
        this.events = events;
        this.notices = notices;
        this.clock = clock;
    }

    @Override
    @Transactional
    public Result handle(PosValidateQrCommand command) {
        if (command.qrCode() == null || command.qrCode().isBlank()) {
            throw ApiException.badRequest("INVALID_QR", "qrCode est obligatoire");
        }
        String ticketId = command.ticketId() == null || command.ticketId().isBlank() ? null : command.ticketId().trim();
        if (ticketId != null) {
            PosRequests.checkTicket(ticketId);
        }
        String staffName = PosRequests.staffName(command.terminal(), command.cashier());
        String discountName = tillSettings.current().getDiscountLabel();
        Evaluation evaluation = evaluator.evaluate(command.qrCode(), true);
        BeneficiaryProjection b = evaluation.beneficiary();
        PartnerProjection p = evaluation.partner();

        if (!evaluation.accepted()) {
            events.publish(new RedemptionRejected(
                    b == null ? null : b.getId(), b == null ? null : b.fullName(),
                    p == null ? null : p.getId(), p == null ? null : p.getName(),
                    command.terminal().terminalId(), staffName, evaluation.refusal().name(), "POS", clock.instant()));
            notices.refused(b, staffName, evaluation.refusal());
            return new Result(false, evaluation.refusal().name(), evaluation.refusal().message(), discountName, null,
                    b == null || !b.isKnown() ? null : b.fullName(), p == null ? null : p.getName(), null, null);
        }

        Redemption redemption = redemptions.saveAndFlush(Redemption.fromTill(b.getId(), p.getId(),
                command.terminal().terminalId(), staffName, evaluation.periodKey(), evaluation.payload().nonce(),
                ticketId, null, null, p.getDiscountPercent(), clock.instant()));
        events.publish(new RedemptionConfirmed(redemption.getId(), b.getId(), b.fullName(), p.getId(), p.getName(),
                command.terminal().terminalId(), staffName, redemption.getPeriodKey(), redemption.getDishPrice(),
                redemption.getDiscountPercent(), redemption.getDiscountAmount(), redemption.getValidatedAt(),
                Redemption.CHANNEL_POS, command.terminal().name(), ticketId, null, redemption.getValidationCode()));
        notices.confirmed(b.getId(), staffName, redemption.getDiscountPercent(), null, null);

        return new Result(true, null, "Avantage valide : appliquer la remise « " + discountName + " »", discountName,
                p.getDiscountPercent(), b.fullName(), p.getName(), redemption.getId(), redemption.getValidationCode());
    }
}
