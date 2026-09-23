package tn.damascino.reporting.query;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.reporting.query.StatisticsQuery.DayLine;
import tn.damascino.reporting.query.StatisticsQuery.PartnerLine;
import tn.damascino.reporting.query.StatisticsQuery.Statistics;
import tn.damascino.reporting.query.StatisticsQuery.Totals;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Component
public class StatisticsHandler implements QueryHandler<StatisticsQuery, Statistics> {

    private final NamedParameterJdbcTemplate jdbc;

    public StatisticsHandler(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public Statistics handle(StatisticsQuery query) {
        ReportFilter filter = query.filter();

        Where people = beneficiaryFilter(filter);
        Where usages = filter.onDates("local_date");
        Where refusals = filter.onInstants("occurred_at");

        Totals totals = jdbc.queryForObject("""
                select
                  (select count(*) from rpt_beneficiary b %s) as authorized,
                  (select count(*) from rpt_beneficiary b %s and b.activated_at is not null) as activated,
                  (select count(distinct beneficiary_id) from rpt_usage %s) as active_users,
                  (select count(*) from rpt_usage %s) as redemptions,
                  (select count(*) from rpt_rejection %s) as refusals,
                  (select coalesce(sum(dish_price), 0) from rpt_usage %s) as dish_total,
                  (select coalesce(sum(discount_amount), 0) from rpt_usage %s) as discount_total
                """.formatted(people.sql("b"), people.sql("b"), usages.sql(), usages.sql(), refusals.sql(),
                        usages.sql(), usages.sql()),
                merge(people, usages, refusals),
                (rs, i) -> new Totals(rs.getLong("authorized"), rs.getLong("activated"), rs.getLong("active_users"),
                        rs.getLong("redemptions"), rs.getLong("refusals"), rs.getBigDecimal("dish_total"),
                        rs.getBigDecimal("discount_total")));

        Where partnerWhere = new Where();
        if (filter.partnerId() != null) {
            partnerWhere.and("p.id = :partnerId", "partnerId", filter.partnerId());
        }
        String beneficiaryCondition = filter.beneficiaryId() == null ? "" : " and b.id = :beneficiaryId";
        String usageCondition = usageDateCondition(filter) + (filter.beneficiaryId() == null ? "" : " and u.beneficiary_id = :beneficiaryId");
        partnerWhere.params.addValues(usages.params.getValues());
        List<PartnerLine> byPartner = jdbc.query("""
                select p.id, p.name, p.active,
                  (select count(*) from rpt_beneficiary b where b.partner_id = p.id and b.active%1$s) as authorized,
                  (select count(*) from rpt_beneficiary b where b.partner_id = p.id and b.active
                      and b.activated_at is not null%1$s) as activated,
                  (select count(distinct u.beneficiary_id) from rpt_usage u where u.partner_id = p.id%2$s) as active_users,
                  (select count(*) from rpt_usage u where u.partner_id = p.id%2$s) as redemptions,
                  (select coalesce(sum(u.discount_amount), 0) from rpt_usage u where u.partner_id = p.id%2$s) as discount_total
                from rpt_partner p%3$s
                order by p.name
                """.formatted(beneficiaryCondition, usageCondition, partnerWhere.sql()),
                partnerWhere.params,
                (rs, i) -> new PartnerLine(rs.getObject("id", UUID.class), rs.getString("name"), rs.getBoolean("active"),
                        rs.getLong("authorized"), rs.getLong("activated"), rs.getLong("active_users"),
                        rs.getLong("redemptions"), rs.getBigDecimal("discount_total")));

        List<DayLine> byDay = jdbc.query("""
                select local_date, count(*) as redemptions, count(distinct beneficiary_id) as active_users,
                       coalesce(sum(discount_amount), 0) as discount_total
                from rpt_usage %s
                group by local_date
                order by local_date
                """.formatted(usages.sql()), usages.params,
                (rs, i) -> new DayLine(rs.getObject("local_date", LocalDate.class), rs.getLong("redemptions"),
                        rs.getLong("active_users"), rs.getBigDecimal("discount_total")));

        return new Statistics(filter, totals, byPartner, byDay);
    }

    /** "Autorisés" = active beneficiaries (of the partner / the beneficiary selected). */
    private static Where beneficiaryFilter(ReportFilter filter) {
        Where where = new Where().and("active");
        if (filter.partnerId() != null) {
            where.and("partner_id = :partnerId", "partnerId", filter.partnerId());
        }
        if (filter.beneficiaryId() != null) {
            where.and("id = :beneficiaryId", "beneficiaryId", filter.beneficiaryId());
        }
        return where;
    }

    private static String usageDateCondition(ReportFilter filter) {
        String condition = "";
        if (filter.from() != null) {
            condition += " and u.local_date >= :from";
        }
        if (filter.to() != null) {
            condition += " and u.local_date <= :to";
        }
        return condition;
    }

    private static MapSqlParameterSource merge(Where... wheres) {
        var params = new MapSqlParameterSource();
        for (Where where : wheres) {
            params.addValues(where.params.getValues());
        }
        return params;
    }
}
