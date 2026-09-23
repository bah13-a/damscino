package tn.damascino.common.events;

import java.time.Instant;
import java.util.UUID;

/** Trace of an administration action (who, what, when). */
public record AuditRecorded(
        UUID actorId,
        String actorName,
        String action,
        String targetType,
        String targetId,
        String details,
        Instant occurredAt) implements DomainEvent {

    @Override
    public String eventType() {
        return EventTypes.AUDIT_RECORDED;
    }
}
