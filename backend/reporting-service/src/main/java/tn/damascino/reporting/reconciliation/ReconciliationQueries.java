package tn.damascino.reporting.reconciliation;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.Query;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.time.Zones;
import tn.damascino.common.web.ApiException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Reconciliation of the till sales export with the validated passages (read side, nothing is stored). */
public final class ReconciliationQueries {

    private ReconciliationQueries() {
    }

    public record Inspection(List<String> headers, List<List<String>> sample, int rowCount, ColumnMapping guessedMapping) {
    }

    public record InspectSalesFile(String filename, byte[] content) implements Query<Inspection> {
    }

    public record Reconcile(String filename, byte[] content, ColumnMapping mapping, String discountLabel,
                            int toleranceMinutes) implements Query<Report> {
    }

    public record RejectedRow(int line, String reason) {
    }

    public record Report(
            LocalDate from,
            LocalDate to,
            int rowsRead,
            int discountRows,
            int passages,
            BigDecimal tillDiscountTotal,
            BigDecimal platformDiscountTotal,
            int amountGaps,
            List<Reconciler.Match> matched,
            List<Reconciler.Sale> discountsWithoutPassage,
            List<Reconciler.Passage> passagesWithoutDiscount,
            List<RejectedRow> rejectedRows) {
    }

    @Component
    static class InspectHandler implements QueryHandler<InspectSalesFile, Inspection> {

        @Override
        public Inspection handle(InspectSalesFile query) {
            SalesTable table = SalesFileReader.read(query.filename(), query.content());
            List<List<String>> sample = table.rows().stream().limit(8).map(SalesTable.Row::cells).toList();
            return new Inspection(table.headers(), sample, table.rows().size(), ColumnMapping.guess(table.headers()));
        }
    }

    @Component
    static class ReconcileHandler implements QueryHandler<Reconcile, Report> {

        private final NamedParameterJdbcTemplate jdbc;

        ReconcileHandler(NamedParameterJdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        @Override
        @Transactional(readOnly = true)
        public Report handle(Reconcile query) {
            ColumnMapping m = query.mapping();
            if (m.amount() == null || (m.dateTime() == null && m.date() == null)) {
                throw ApiException.badRequest("MAPPING_INCOMPLETE",
                        "Indiquez au minimum la colonne de date (ou date et heure) et la colonne du montant de remise");
            }
            SalesTable table = SalesFileReader.read(query.filename(), query.content());
            String wanted = Values.simplify(query.discountLabel());

            List<Reconciler.Sale> sales = new ArrayList<>();
            List<RejectedRow> rejected = new ArrayList<>();
            LocalDate from = null;
            LocalDate to = null;
            for (SalesTable.Row row : table.rows()) {
                LocalDateTime when = m.dateTime() != null
                        ? Values.dateTime(row.cell(m.dateTime()))
                        : Values.dateTime(row.cell(m.date()), m.time() == null ? null : row.cell(m.time()));
                if (when == null) {
                    rejected.add(new RejectedRow(row.line(), "Date illisible : « " + row.cell(m.dateTime() != null ? m.dateTime() : m.date()) + " »"));
                    continue;
                }
                from = from == null || when.toLocalDate().isBefore(from) ? when.toLocalDate() : from;
                to = to == null || when.toLocalDate().isAfter(to) ? when.toLocalDate() : to;

                String rawAmount = row.cell(m.amount());
                BigDecimal amount = Values.amount(rawAmount);
                if (amount == null && !rawAmount.isBlank()) {
                    rejected.add(new RejectedRow(row.line(), "Montant illisible : « " + rawAmount + " »"));
                    continue;
                }
                if (amount == null || amount.signum() == 0) {
                    continue; // sale without discount
                }
                String label = m.label() == null ? null : row.cell(m.label());
                if (m.label() != null && !wanted.isEmpty() && !Values.simplify(label).contains(wanted)) {
                    continue; // another kind of discount (happy hour, staff meal…)
                }
                sales.add(new Reconciler.Sale(row.line(), when, blankToNull(row.cell(m.ticket())), amount, label,
                        blankToNull(row.cell(m.code())), blankToNull(row.cell(m.cashier()))));
            }
            if (from == null) {
                throw ApiException.badRequest("NO_DATES", "Aucune date lisible dans le fichier : vérifiez la colonne de date");
            }

            List<Reconciler.Passage> passages = passages(from, to);
            Reconciler.Result result = Reconciler.reconcile(sales, passages,
                    Duration.ofMinutes(Math.max(1, Math.min(query.toleranceMinutes(), 240))));
            return new Report(from, to, table.rows().size(), sales.size(), passages.size(),
                    sales.stream().map(Reconciler.Sale::amount).reduce(BigDecimal.ZERO, BigDecimal::add),
                    passages.stream().map(p -> p.discountAmount() == null ? BigDecimal.ZERO : p.discountAmount())
                            .reduce(BigDecimal.ZERO, BigDecimal::add),
                    (int) result.matched().stream().filter(Reconciler.Match::hasGap).count(),
                    result.matched(), result.unmatchedSales(), result.unmatchedPassages(), rejected);
        }

        private List<Reconciler.Passage> passages(LocalDate from, LocalDate to) {
            return jdbc.query("""
                    select * from rpt_usage
                    where local_date between :from and :to and cancelled_at is null
                    order by validated_at
                    """, new MapSqlParameterSource().addValue("from", from).addValue("to", to),
                    (rs, i) -> new Reconciler.Passage(
                            rs.getObject("id", UUID.class),
                            rs.getTimestamp("validated_at").toInstant().atZone(Zones.TUNIS).toLocalDateTime(),
                            rs.getString("beneficiary_name"), rs.getString("partner_name"), rs.getString("staff_name"),
                            rs.getBigDecimal("dish_price"), rs.getBigDecimal("discount_amount"),
                            rs.getString("validation_code"), rs.getString("ticket_id"), rs.getString("channel")));
        }

        private static String blankToNull(String value) {
            return value == null || value.isBlank() ? null : value;
        }
    }
}
