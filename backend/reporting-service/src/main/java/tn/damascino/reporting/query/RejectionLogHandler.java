package tn.damascino.reporting.query;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.web.PageResponse;

import java.util.UUID;

@Component
public class RejectionLogHandler implements QueryHandler<RejectionLogQuery, PageResponse<RejectionLogQuery.Row>> {

    private final NamedParameterJdbcTemplate jdbc;

    public RejectionLogHandler(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RejectionLogQuery.Row> handle(RejectionLogQuery query) {
        Where where = query.filter().onInstants("occurred_at");
        long total = jdbc.queryForObject("select count(*) from rpt_rejection" + where.sql(), where.params, Long.class);
        String sql = "select * from rpt_rejection" + where.sql() + " order by occurred_at desc";
        int size = query.size();
        if (size > 0) {
            size = Math.min(size, 500);
            sql += " limit :limit offset :offset";
            where.params.addValue("limit", size).addValue("offset", (long) Math.max(query.page(), 0) * size);
        }
        var rows = jdbc.query(sql, where.params, (rs, i) -> new RejectionLogQuery.Row(
                rs.getObject("id", UUID.class), rs.getTimestamp("occurred_at").toInstant(),
                rs.getString("beneficiary_name"), rs.getString("partner_name"), rs.getString("staff_name"),
                rs.getString("reason"), rs.getString("stage")));
        int effectiveSize = size > 0 ? size : (int) Math.max(total, 1);
        return new PageResponse<>(rows, size > 0 ? Math.max(query.page(), 0) : 0, effectiveSize, total,
                (int) Math.ceil(total / (double) effectiveSize));
    }
}
