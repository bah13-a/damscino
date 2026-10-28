package tn.damascino.privilege.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.RedemptionConfirmed;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.application.ScanEvaluator;
import tn.damascino.privilege.application.ScanEvaluator.Evaluation;
import tn.damascino.privilege.application.ScanNotices;
import tn.damascino.privilege.application.ScanResult;
import tn.damascino.privilege.domain.Redemption;
import tn.damascino.privilege.domain.RedemptionRepository;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.settings.TillSettingsRepository;

import java.math.BigDecimal;
import java.time.Clock;

/**
 * Every rule is re-checked here, under a row lock on the beneficiary: two cashiers scanning the same code (or two
 * codes of the same person) at the same time cannot validate twice.
 */
@Component
public class ConfirmRedemptionHandler implements CommandHandler<ConfirmRedemptionCommand, ScanResult> {

    private static final BigDecimal MAX_PRICE = BigDecimal.valueOf(10_000);

    private final ScanEvaluator evaluator;
    private final RedemptionRepository redemptions;
    private final EventPublisher events;
    private final TillSettingsRepository tillSettings;
    private final ScanNotices notices;
    private final Clock clock;

    public ConfirmRedemptionHandler(ScanEvaluator evaluator, RedemptionRepository redemptions, EventPublisher events,
                                    TillSettingsRepository tillSettings, ScanNotices notices, Clock clock) {
        this.tillSettings = tillSettings;
        this.evaluator = evaluator;
        this.redemptions = redemptions;
        this.events = events;
        this.notices = notices;
        this.clock = clock;
    }

    @Override
    @Transactional
    public ScanResult handle(ConfirmRedemptionCommand command) {
        BigDecimal price = command.dishPrice();
        if (price != null && (price.signum() < 0 || price.compareTo(MAX_PRICE) > 0)) {
            throw ApiException.badRequest("INVALID_PRICE", "Prix du plat invalide");
        }
        Evaluation evaluation = evaluator.evaluate(command.token(), true);
        if (!evaluation.accepted()) {
            return evaluator.refuse(evaluation, command.staff(), "CONFIRM");
        }
        if (price == null && tillSettings.current().isPriceRequired()) {
            throw ApiException.badRequest("PRICE_REQUIRED", "Saisissez le prix du plat remisé");
        }
        BeneficiaryProjection b = evaluation.beneficiary();
        PartnerProjection p = evaluation.partner();
        Redemption redemption = redemptions.saveAndFlush(new Redemption(b.getId(), p.getId(),
                command.staff().accountId(), command.staff().displayName(), evaluation.periodKey(),
                evaluation.payload().nonce(), price, p.getDiscountPercent(), clock.instant()));

        events.publish(new RedemptionConfirmed(redemption.getId(), b.getId(), b.fullName(), p.getId(), p.getName(),
                command.staff().accountId(), command.staff().displayName(), redemption.getPeriodKey(),
                redemption.getDishPrice(), redemption.getDiscountPercent(), redemption.getDiscountAmount(),
                redemption.getValidatedAt(), redemption.getChannel(), null, null, null,
                redemption.getValidationCode()));
        notices.confirmed(b.getId(), command.staff().displayName(), redemption.getDiscountPercent(),
                redemption.getDishPrice(), redemption.getDiscountAmount());

        return new ScanResult(ScanResult.Status.CONFIRMED, null, "Passage validé", b.fullName(), p.getName(),
                p.getDiscountPercent(), p.getEligibleCategories(), p.getExcludedCategories(),
                (int) (p.getUsagesPerPeriod() - evaluation.usedInPeriod() - 1), redemption.getId(),
                redemption.getDishPrice(), redemption.getDiscountAmount(), redemption.getValidatedAt(),
                redemption.getValidationCode());
    }
}
