package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.application.query.PartnerView;
import tn.damascino.partner.domain.AdvantageRule;
import tn.damascino.partner.domain.Partner;

import java.time.Clock;

@Component
public class UpdateAdvantageRuleHandler implements CommandHandler<UpdateAdvantageRuleCommand, PartnerView> {

    private final PartnerCommandSupport support;
    private final EventPublisher events;
    private final Audit audit;
    private final Clock clock;

    public UpdateAdvantageRuleHandler(PartnerCommandSupport support, EventPublisher events, Audit audit, Clock clock) {
        this.support = support;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional
    public PartnerView handle(UpdateAdvantageRuleCommand command) {
        Partner partner = support.partner(command.partnerId());
        AdvantageRule rule = command.rule();
        support.checkCategoriesExist(rule);
        partner.applyRule(rule, clock.instant());
        events.publish(partner.snapshot());
        audit.record(command.actor(), "ADVANTAGE_RULE_UPDATED", "PARTNER", partner.getId(),
                "%s %% · %d / %s · éligibles %s · exclues %s".formatted(rule.discountPercent().stripTrailingZeros()
                                .toPlainString(), rule.usagesPerPeriod(), rule.usagePeriod(), rule.eligibleCategories(),
                        rule.excludedCategories()));
        return support.view(partner);
    }
}
