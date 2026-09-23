package tn.damascino.reporting.query;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.web.PageResponse;

import java.util.Locale;
import java.util.UUID;

@Component
public class AuditLogHandler implements QueryHandler<AuditLogQuery, PageResponse<AuditLogQuery.Row>> {

    private final NamedParameterJdbcTemplate jdbc;

    public AuditLogHandler(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AuditLogQuery.Row> handle(AuditLogQuery query) {
        Where where = new ReportFilter(null, null, query.from(), query.to()).onInstants("occurred_at");
        if (query.text() != null && !query.text().isBlank()) {
            where.and("(lower(actor_name) like :text or lower(action) like :text or lower(coalesce(details, '')) like :text)",
                    "text", "%" + query.text().trim().toLowerCase(Locale.ROOT) + "%");
        }
        long total = jdbc.queryForObject("select count(*) from rpt_audit" + where.sql(), where.params, Long.class);
        String sql = "select * from rpt_audit" + where.sql() + " order by occurred_at desc";
        int size = query.size();
        if (size > 0) {
            size = Math.min(size, 500);
            sql += " limit :limit offset :offset";
            where.params.addValue("limit", size).addValue("offset", (long) Math.max(query.page(), 0) * size);
        }
        var rows = jdbc.query(sql, where.params, (rs, i) -> new AuditLogQuery.Row(
                rs.getObject("id", UUID.class), rs.getTimestamp("occurred_at").toInstant(), rs.getString("actor_name"),
                rs.getString("action"), rs.getString("target_type"), rs.getString("target_id"),
                rs.getString("details"), rs.getString("source")));
        int effectiveSize = size > 0 ? size : (int) Math.max(total, 1);
        return new PageResponse<>(rows, size > 0 ? Math.max(query.page(), 0) : 0, effectiveSize, total,
                (int) Math.ceil(total / (double) effectiveSize));
    }
}
