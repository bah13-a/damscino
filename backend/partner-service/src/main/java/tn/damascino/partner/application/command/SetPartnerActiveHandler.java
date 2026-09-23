package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.application.query.PartnerView;
import tn.damascino.partner.domain.Partner;

import java.time.Clock;

@Component
public class SetPartnerActiveHandler implements CommandHandler<SetPartnerActiveCommand, PartnerView> {

    private final PartnerCommandSupport support;
    private final EventPublisher events;
    private final Audit audit;
    private final Clock clock;

    public SetPartnerActiveHandler(PartnerCommandSupport support, EventPublisher events, Audit audit, Clock clock) {
        this.support = support;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional
    public PartnerView handle(SetPartnerActiveCommand command) {
        Partner partner = support.partner(command.partnerId());
        partner.setActive(command.active(), clock.instant());
        events.publish(partner.snapshot());
        audit.record(command.actor(), command.active() ? "PARTNER_ACTIVATED" : "PARTNER_DEACTIVATED", "PARTNER",
                partner.getId(), partner.getName());
        return support.view(partner);
    }
}
