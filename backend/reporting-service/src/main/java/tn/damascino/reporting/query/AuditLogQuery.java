package tn.damascino.reporting.query;

import tn.damascino.common.cqrs.Query;
import tn.damascino.common.web.PageResponse;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Journal des actions d'administration (size 0 = every row). */
public record AuditLogQuery(String text, LocalDate from, LocalDate to, int page, int size)
        implements Query<PageResponse<AuditLogQuery.Row>> {

    public record Row(UUID id, Instant occurredAt, String actorName, String action, String targetType, String targetId,
                      String details, String source) {
    }
}
