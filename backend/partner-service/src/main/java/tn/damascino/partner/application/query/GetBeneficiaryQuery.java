package tn.damascino.partner.application.query;

import tn.damascino.common.cqrs.Query;

import java.util.UUID;

public record GetBeneficiaryQuery(UUID beneficiaryId) implements Query<BeneficiaryView> {
}
