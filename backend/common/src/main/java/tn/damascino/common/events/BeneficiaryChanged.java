package tn.damascino.common.events;

import java.time.Instant;
import java.util.UUID;

/** Full snapshot of a beneficiary. */
public record BeneficiaryChanged(
        UUID beneficiaryId,
        UUID partnerId,
        String firstName,
        String lastName,
        String phone,
        boolean active,
        Instant createdAt,
        /** optional, receives the activation code like the phone (null in events published before it existed) */
        String email) implements DomainEvent {

    public String fullName() {
        return (firstName + " " + lastName).trim();
    }

    @Override
    public String eventType() {
        return EventTypes.BENEFICIARY_CHANGED;
    }
}
