package tn.damascino.reporting.api;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.export.TabularExport;
import tn.damascino.common.time.Zones;
import tn.damascino.common.web.PageResponse;
import tn.damascino.reporting.query.AuditLogQuery;
import tn.damascino.reporting.query.RejectionLogQuery;
import tn.damascino.reporting.query.ReportFilter;
import tn.damascino.reporting.query.StatisticsQuery;
import tn.damascino.reporting.query.StatisticsQuery.DayLine;
import tn.damascino.reporting.query.StatisticsQuery.PartnerLine;
import tn.damascino.reporting.query.StatisticsQuery.Statistics;
import tn.damascino.reporting.query.UsageLogQuery;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Read side: usage log, statistics, refusals and audit trail, each exportable to Excel and CSV. */
@RestController
@RequestMapping("/api/reporting")
public class ReportingController {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
            .withZone(Zones.TUNIS);
    private static final Map<String, String> REASONS = Map.ofEntries(
            Map.entry("INVALID_QR", "QR invalide"),
            Map.entry("QR_EXPIRED", "QR expiré"),
            Map.entry("QR_ALREADY_USED", "QR déjà utilisé"),
            Map.entry("SESSION_REPLACED", "Session remplacée"),
            Map.entry("UNKNOWN_ACCOUNT", "Compte inconnu"),
            Map.entry("BENEFICIARY_INACTIVE", "Bénéficiaire désactivé"),
            Map.entry("PARTNER_INACTIVE", "Partenaire inactif"),
            Map.entry("CONVENTION_NOT_STARTED", "Convention non commencée"),
            Map.entry("CONVENTION_EXPIRED", "Convention expirée"),
            Map.entry("QUOTA_REACHED", "Déjà utilisé sur la période"),
            Map.entry("NO_ELIGIBLE_ITEM", "Aucun plat éligible sur le ticket"),
            Map.entry("TICKET_ALREADY_DISCOUNTED", "Ticket déjà remisé"));

    private final QueryBus queries;

    public ReportingController(QueryBus queries) {
        this.queries = queries;
    }

    @GetMapping("/usages")
    public PageResponse<UsageLogQuery.Row> usages(@RequestParam(required = false) UUID partnerId,
                                                  @RequestParam(required = false) UUID beneficiaryId,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "50") int size) {
        return queries.ask(new UsageLogQuery(new ReportFilter(partnerId, beneficiaryId, from, to), page, Math.max(size, 1)));
    }

    @GetMapping("/usages/export")
    public ResponseEntity<byte[]> exportUsages(@RequestParam(required = false) UUID partnerId,
                                               @RequestParam(required = false) UUID beneficiaryId,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                               @RequestParam(defaultValue = "xlsx") String format) {
        var page = queries.ask(new UsageLogQuery(new ReportFilter(partnerId, beneficiaryId, from, to), 0, 0));
        List<List<Object>> rows = new ArrayList<>();
        for (UsageLogQuery.Row r : page.items()) {
            rows.add(Arrays.asList(dateTime(r.validatedAt()), r.beneficiaryName(), r.partnerName(), r.staffName(),
                    r.dishPrice(), r.discountPercent(), r.discountAmount(),
                    "POS".equals(r.channel()) ? "Caisse" : "Scanner", r.ticketId(), r.dishLabel(), r.validationCode(),
                    r.cancelledAt() == null ? "" : "Annulé le " + dateTime(r.cancelledAt()) + " (" + r.cancelReason() + ")"));
        }
        return TabularExport.response("utilisations", format, List.of("Date et heure", "Bénéficiaire", "Partenaire",
                "Membre du personnel", "Prix du plat (DT)", "Remise %", "Montant remisé (DT)", "Canal", "N° de ticket",
                "Plat remisé", "Code de validation", "Annulation"), rows);
    }

    @GetMapping("/statistics")
    public Statistics statistics(@RequestParam(required = false) UUID partnerId,
                                 @RequestParam(required = false) UUID beneficiaryId,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return queries.ask(new StatisticsQuery(new ReportFilter(partnerId, beneficiaryId, from, to)));
    }

    /** {@code table} = partners (default) or days. */
    @GetMapping("/statistics/export")
    public ResponseEntity<byte[]> exportStatistics(@RequestParam(required = false) UUID partnerId,
                                                   @RequestParam(required = false) UUID beneficiaryId,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                   @RequestParam(defaultValue = "partners") String table,
                                                   @RequestParam(defaultValue = "xlsx") String format) {
        Statistics stats = statistics(partnerId, beneficiaryId, from, to);
        List<List<Object>> rows = new ArrayList<>();
        if ("days".equals(table)) {
            for (DayLine d : stats.byDay()) {
                rows.add(Arrays.asList(d.day().toString(), d.redemptions(), d.activeUsers(), d.discountTotal()));
            }
            return TabularExport.response("statistiques-par-jour", format,
                    List.of("Jour", "Passages", "Utilisateurs actifs", "Remises (DT)"), rows);
        }
        for (PartnerLine p : stats.byPartner()) {
            rows.add(Arrays.asList(p.partnerName(), p.active() ? "Actif" : "Inactif", p.authorized(), p.activated(),
                    p.activeUsers(), p.redemptions(), p.discountTotal()));
        }
        var t = stats.totals();
        rows.add(Arrays.asList("TOTAL", "", t.authorized(), t.activated(), t.activeUsers(), t.redemptions(),
                t.discountTotal()));
        return TabularExport.response("statistiques-par-partenaire", format, List.of("Partenaire", "Statut",
                "Autorisés", "Comptes activés", "Utilisateurs actifs", "Passages", "Remises (DT)"), rows);
    }

    @GetMapping("/rejections")
    public PageResponse<RejectionLogQuery.Row> rejections(@RequestParam(required = false) UUID partnerId,
                                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "50") int size) {
        return queries.ask(new RejectionLogQuery(new ReportFilter(partnerId, null, from, to), page, Math.max(size, 1)));
    }

    @GetMapping("/rejections/export")
    public ResponseEntity<byte[]> exportRejections(@RequestParam(required = false) UUID partnerId,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                   @RequestParam(defaultValue = "xlsx") String format) {
        var page = queries.ask(new RejectionLogQuery(new ReportFilter(partnerId, null, from, to), 0, 0));
        List<List<Object>> rows = new ArrayList<>();
        for (RejectionLogQuery.Row r : page.items()) {
            rows.add(Arrays.asList(dateTime(r.occurredAt()), r.beneficiaryName(), r.partnerName(), r.staffName(),
                    REASONS.getOrDefault(r.reason(), r.reason()), "CONFIRM".equals(r.stage()) ? "Confirmation" : "POS".equals(r.stage()) ? "Caisse" : "Contrôle"));
        }
        return TabularExport.response("refus", format, List.of("Date et heure", "Bénéficiaire", "Partenaire",
                "Membre du personnel", "Motif", "Étape"), rows);
    }

    @GetMapping("/audit")
    public PageResponse<AuditLogQuery.Row> audit(@RequestParam(required = false) String q,
                                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "50") int size) {
        return queries.ask(new AuditLogQuery(q, from, to, page, Math.max(size, 1)));
    }

    @GetMapping("/audit/export")
    public ResponseEntity<byte[]> exportAudit(@RequestParam(required = false) String q,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                              @RequestParam(defaultValue = "xlsx") String format) {
        var page = queries.ask(new AuditLogQuery(q, from, to, 0, 0));
        List<List<Object>> rows = new ArrayList<>();
        for (AuditLogQuery.Row r : page.items()) {
            rows.add(Arrays.asList(dateTime(r.occurredAt()), r.actorName(), r.action(), r.targetType(), r.details()));
        }
        return TabularExport.response("journal-administration", format,
                List.of("Date et heure", "Auteur", "Action", "Objet", "Détails"), rows);
    }

    private static String dateTime(Instant instant) {
        return instant == null ? "" : DATE_TIME.format(instant);
    }
}
