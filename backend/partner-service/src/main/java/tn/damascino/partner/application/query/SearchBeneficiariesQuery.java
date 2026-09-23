package tn.damascino.partner.application.query;

import tn.damascino.common.cqrs.Query;
import tn.damascino.common.web.PageResponse;

import java.util.UUID;

/** Search by name or phone, optionally restricted to a partner and / or a status. */
public record SearchBeneficiariesQuery(String text, UUID partnerId, Boolean active, int page, int size)
        implements Query<PageResponse<BeneficiaryView>> {
}
