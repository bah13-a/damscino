package tn.damascino.partner.application.query;

import tn.damascino.common.cqrs.Query;

import java.util.List;
import java.util.UUID;

/** Unpaged list used by the Excel / CSV export. */
public record ListBeneficiariesQuery(String text, UUID partnerId, Boolean active) implements Query<List<BeneficiaryView>> {
}
