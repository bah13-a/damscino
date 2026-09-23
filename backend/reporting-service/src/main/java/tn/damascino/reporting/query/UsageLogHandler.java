package tn.damascino.reporting.query;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.web.PageResponse;

import java.util.List;
import java.util.UUID;

@Component
public class UsageLogHandler implements QueryHandler<UsageLogQuery, PageResponse<UsageLogQuery.Row>> {

    private final NamedParameterJdbcTemplate jdbc;

    public UsageLogHandler(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UsageLogQuery.Row> handle(UsageLogQuery query) {
        Where where = query.filter().onDates("local_date");
        long total = jdbc.queryForObject("select count(*) from rpt_usage" + where.sql(), where.params, Long.class);
        String sql = "select * from rpt_usage" + where.sql() + " order by validated_at desc";
        int size = query.size();
        if (size > 0) {
            size = Math.min(size, 500);
            sql += " limit :limit offset :offset";
            where.params.addValue("limit", size).addValue("offset", (long) Math.max(query.page(), 0) * size);
        }
        List<UsageLogQuery.Row> rows = jdbc.query(sql, where.params, (rs, i) -> new UsageLogQuery.Row(
                rs.getObject("id", UUID.class), rs.getTimestamp("validated_at").toInstant(),
                rs.getObject("beneficiary_id", UUID.class), rs.getString("beneficiary_name"),
                rs.getObject("partner_id", UUID.class), rs.getString("partner_name"), rs.getString("staff_name"),
                rs.getBigDecimal("dish_price"), rs.getBigDecimal("discount_percent"),
                rs.getBigDecimal("discount_amount")));
        int effectiveSize = size > 0 ? size : (int) Math.max(total, 1);
        return new PageResponse<>(rows, size > 0 ? Math.max(query.page(), 0) : 0, effectiveSize, total,
                (int) Math.ceil(total / (double) effectiveSize));
    }
}
