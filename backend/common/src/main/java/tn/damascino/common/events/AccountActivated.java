package tn.damascino.common.events;

import java.time.Instant;
import java.util.UUID;

/** A beneficiary replaced the temporary password with a personal one (account "activé"). */
public record AccountActivated(UUID accountId, UUID beneficiaryId, Instant activatedAt) implements DomainEvent {

    @Override
    public String eventType() {
        return EventTypes.ACCOUNT_ACTIVATED;
    }
}
