package tn.damascino.common.events;

import java.util.UUID;

/** A new session was opened (or all sessions revoked): older tokens must not generate QR codes any more. */
public record BeneficiarySessionChanged(UUID beneficiaryId, long sessionVersion) implements DomainEvent {

    @Override
    public String eventType() {
        return EventTypes.BENEFICIARY_SESSION_CHANGED;
    }
}
