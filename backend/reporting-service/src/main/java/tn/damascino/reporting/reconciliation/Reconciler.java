package tn.damascino.reporting.reconciliation;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Compares the discounts entered in the till with the passages validated on the platform.
 * Matching order: the 6-digit validation code written on the ticket, then the ticket number (connected till),
 * then the same day, same amount and closest time (within the tolerance).
 */
public final class Reconciler {

    private static final BigDecimal CENT = new BigDecimal("0.01");
    private static final Pattern CODE = Pattern.compile("(?<!\\d)(\\d{6})(?!\\d)");

    private Reconciler() {
    }

    public record Sale(int line, LocalDateTime dateTime, String ticket, BigDecimal amount, String label, String code,
                       String cashier) {
    }

    public record Passage(UUID id, LocalDateTime dateTime, String beneficiaryName, String partnerName, String staffName,
                          BigDecimal dishPrice, BigDecimal discountAmount, String validationCode, String ticketId,
                          String channel) {
    }

    public enum MatchedBy {
        CODE,
        TICKET,
        TIME_AND_AMOUNT
    }

    public record Match(Sale sale, Passage passage, MatchedBy matchedBy, BigDecimal amountGap) {

        public boolean hasGap() {
            return amountGap != null && amountGap.abs().compareTo(CENT) >= 0;
        }
    }

    public record Result(List<Match> matched, List<Sale> unmatchedSales, List<Passage> unmatchedPassages) {
    }

    public static Result reconcile(List<Sale> sales, List<Passage> passages, Duration tolerance) {
        List<Passage> open = new ArrayList<>(passages);
        List<Match> matched = new ArrayList<>();
        List<Sale> unmatchedSales = new ArrayList<>();
        List<Sale> sorted = sales.stream().sorted(Comparator.comparing(Sale::dateTime)).toList();

        // pass 1: validation code or ticket number (exact evidence) for every sale, before any time-based guess
        List<Sale> remaining = new ArrayList<>();
        for (Sale sale : sorted) {
            Optional<Match> exact = byCode(sale, open).or(() -> byTicket(sale, open));
            exact.ifPresentOrElse(match -> {
                matched.add(match);
                open.remove(match.passage());
            }, () -> remaining.add(sale));
        }
        // pass 2: same day, same amount, closest time
        for (Sale sale : remaining) {
            Optional<Passage> candidate = open.stream()
                    .filter(p -> p.dateTime().toLocalDate().equals(sale.dateTime().toLocalDate()))
                    .filter(p -> Duration.between(p.dateTime(), sale.dateTime()).abs().compareTo(tolerance) <= 0)
                    .filter(p -> p.discountAmount() == null || sale.amount() == null
                            || p.discountAmount().subtract(sale.amount()).abs().compareTo(CENT) < 0)
                    // a passage with the same amount beats one validated without price, then the closest in time wins
                    .min(Comparator.<Passage>comparingInt(p -> p.discountAmount() == null ? 1 : 0)
                            .thenComparing(p -> Duration.between(p.dateTime(), sale.dateTime()).abs()));
            if (candidate.isPresent()) {
                matched.add(match(sale, candidate.get(), MatchedBy.TIME_AND_AMOUNT));
                open.remove(candidate.get());
            } else {
                unmatchedSales.add(sale);
            }
        }
        matched.sort(Comparator.comparing(m -> m.sale().dateTime()));
        return new Result(matched, unmatchedSales, open);
    }

    private static Optional<Match> byCode(Sale sale, List<Passage> open) {
        if (sale.code() == null || sale.code().isBlank()) {
            return Optional.empty();
        }
        Set<String> codes = new HashSet<>();
        Matcher m = CODE.matcher(sale.code());
        while (m.find()) {
            codes.add(m.group(1));
        }
        return open.stream().filter(p -> p.validationCode() != null && codes.contains(p.validationCode()))
                .findFirst().map(p -> match(sale, p, MatchedBy.CODE));
    }

    private static Optional<Match> byTicket(Sale sale, List<Passage> open) {
        if (sale.ticket() == null || sale.ticket().isBlank()) {
            return Optional.empty();
        }
        return open.stream().filter(p -> sale.ticket().trim().equalsIgnoreCase(p.ticketId()))
                .findFirst().map(p -> match(sale, p, MatchedBy.TICKET));
    }

    private static Match match(Sale sale, Passage passage, MatchedBy by) {
        BigDecimal gap = sale.amount() == null || passage.discountAmount() == null
                ? null : sale.amount().subtract(passage.discountAmount());
        return new Match(sale, passage, by, gap);
    }
}
