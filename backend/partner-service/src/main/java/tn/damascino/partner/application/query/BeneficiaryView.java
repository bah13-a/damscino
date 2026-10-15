package tn.damascino.partner.application.query;

import tn.damascino.partner.domain.Beneficiary;

import java.time.Instant;
import java.util.UUID;

public record BeneficiaryView(
        UUID id,
        UUID partnerId,
        String partnerName,
        String firstName,
        String lastName,
        String phone,
        String email,
        boolean active,
        boolean accountActivated,
        Instant credentialsIssuedAt,
        Instant activatedAt,
        Instant createdAt) {

    public static BeneficiaryView of(Beneficiary b, String partnerName) {
        return new BeneficiaryView(b.getId(), b.getPartnerId(), partnerName, b.getFirstName(), b.getLastName(),
                b.getPhone(), b.getEmail(), b.isActive(), b.getActivatedAt() != null, b.getCredentialsIssuedAt(), b.getActivatedAt(),
                b.getCreatedAt());
    }
}
