package tn.damascino.partner.application.query;

import tn.damascino.common.cqrs.Query;

import java.util.List;
import java.util.UUID;

public record ExportAccessesQuery(UUID partnerId) implements Query<List<AccessRow>> {
}
