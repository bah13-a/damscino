package tn.damascino.partner.application;

import org.springframework.stereotype.Component;
import tn.damascino.common.events.AuditRecorded;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.AuthenticatedUser;

import java.time.Clock;

@Component
public class Audit {

    private final EventPublisher events;
    private final Clock clock;

    public Audit(EventPublisher events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    public void record(AuthenticatedUser actor, String action, String targetType, Object targetId, String details) {
        events.publish(new AuditRecorded(actor.accountId(), actor.displayName(), action, targetType,
                targetId == null ? null : targetId.toString(), details, clock.instant()));
    }
}
