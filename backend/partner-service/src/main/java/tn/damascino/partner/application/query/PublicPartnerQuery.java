package tn.damascino.partner.application.query;

import tn.damascino.common.cqrs.Query;

import java.util.UUID;

/** Minimal, unauthenticated information displayed on the partner activation link. */
public record PublicPartnerQuery(UUID partnerId) implements Query<PublicPartnerQuery.PublicPartner> {

    public record PublicPartner(UUID id, String name, boolean active) {
    }
}
