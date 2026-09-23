package tn.damascino.partner.application.query;

import tn.damascino.common.cqrs.Query;

import java.util.List;

public record ListPartnersQuery() implements Query<List<PartnerView>> {
}
