package tn.damascino.common.events;

import java.util.UUID;

/**
 * A (new or reset) temporary password was generated for a beneficiary. Only the bcrypt hash travels on
 * the bus; the identity service stores it and forces a password change at next login.
 */
public record BeneficiaryCredentialsIssued(
        UUID beneficiaryId,
        UUID partnerId,
        String phone,
        String fullName,
        boolean active,
        String passwordHash,
        /** optional, receives the activation code like the phone */
        String email) implements DomainEvent {

    @Override
    public String eventType() {
        return EventTypes.BENEFICIARY_CREDENTIALS_ISSUED;
    }
}
