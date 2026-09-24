package tn.damascino.privilege.pos;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.RedemptionRejected;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.application.QuotaService;
import tn.damascino.privilege.domain.EligibilityPolicy;
import tn.damascino.privilege.domain.RefusalReason;
import tn.damascino.privilege.pos.PosDtos.PreviewRequest;
import tn.damascino.privilege.pos.PosDtos.PreviewResponse;
import tn.damascino.privilege.pos.PosDtos.TicketLine;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.BeneficiaryProjectionRepository;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.projection.PartnerProjectionRepository;
import tn.damascino.privilege.qr.QrPayload;
import tn.damascino.privilege.qr.QrTokenService;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Checks the QR code against every rule, picks the discounted line of the ticket and reserves the advantage for the
 * ticket. Previewing the same ticket again (lines changed) updates the reservation; the QR code may have expired by
 * then, the reservation is what counts.
 */
@Component
public class PosPreviewHandler implements CommandHandler<PosPreviewCommand, PreviewResponse> {

    private final QrTokenService qrTokens;
    private final BeneficiaryProjectionRepository beneficiaries;
    private final PartnerProjectionRepository partners;
    private final PosReservationRepository reservations;
    private final PosProductRepository products;
    private final QuotaService quota;
    private final EventPublisher events;
    private final Clock clock;
    private final Duration reservationTtl;

    public PosPreviewHandler(QrTokenService qrTokens, BeneficiaryProjectionRepository beneficiaries,
                             PartnerProjectionRepository partners, PosReservationRepository reservations,
                             PosProductRepository products, QuotaService quota, EventPublisher events, Clock clock,
                             @Value("${damascino.pos.reservation-ttl:15m}") Duration reservationTtl) {
        this.qrTokens = qrTokens;
        this.beneficiaries = beneficiaries;
        this.partners = partners;
        this.reservations = reservations;
        this.products = products;
        this.quota = quota;
        this.events = events;
        this.clock = clock;
        this.reservationTtl = reservationTtl;
    }

    @Override
    @Transactional
    public PreviewResponse handle(PosPreviewCommand command) {
        PreviewRequest request = command.request();
        PosRequests.checkTicket(request.ticketId());
        if (request.lines() == null || request.lines().isEmpty()) {
            throw ApiException.badRequest("EMPTY_TICKET", "Le ticket ne contient aucune ligne");
        }
        Instant now = clock.instant();
        String ticketId = request.ticketId().trim();

        Optional<QrPayload> read = qrTokens.read(request.code());
        if (read.isEmpty()) {
            return refuse(command, null, null, RefusalReason.INVALID_QR);
        }
        QrPayload payload = read.get();
        BeneficiaryProjection beneficiary = beneficiaries.findForUpdate(payload.beneficiaryId()).orElse(null);
        PartnerProjection partner = beneficiary == null || beneficiary.getPartnerId() == null
                ? null : partners.findById(beneficiary.getPartnerId()).orElse(null);

        PosReservation existing = reservations.findOpen(command.terminal().terminalId(), ticketId).orElse(null);
        if (existing != null && existing.getStatus() == PosReservation.Status.RESERVED && !existing.isActive(now)) {
            existing.expired(now);
            reservations.flush();
            existing = null;
        }
        if (existing != null && (existing.getStatus() == PosReservation.Status.CONFIRMED
                || !existing.getBeneficiaryId().equals(payload.beneficiaryId()))) {
            return refuse(command, beneficiary, partner, RefusalReason.TICKET_ALREADY_DISCOUNTED);
        }
        boolean samePreview = existing != null && existing.getQrNonce().equals(payload.nonce());
        if (!samePreview) {
            if (!payload.expiresAt().isAfter(now)) {
                return refuse(command, beneficiary, partner, RefusalReason.QR_EXPIRED);
            }
            if (quota.isNonceUsed(payload.nonce())) {
                return refuse(command, beneficiary, partner, RefusalReason.QR_ALREADY_USED);
            }
            if (beneficiary != null && payload.sessionVersion() < beneficiary.getSessionVersion()) {
                return refuse(command, beneficiary, partner, RefusalReason.SESSION_REPLACED);
            }
        }

        LocalDate today = LocalDate.now(clock);
        String periodKey = partner == null ? null : partner.getUsagePeriod().keyOf(today);
        long used = periodKey == null ? 0
                : quota.usedExcluding(beneficiary.getId(), periodKey, existing == null ? null : existing.getId());
        RefusalReason refusal = EligibilityPolicy.evaluate(beneficiary, partner, today, used).orElse(null);
        if (refusal != null) {
            return refuse(command, beneficiary, partner, refusal);
        }

        List<DiscountCalculator.Line> lines = request.lines().stream()
                .map(l -> new DiscountCalculator.Line(l.lineId(), l.sku(), l.label(), l.category(), l.unitPrice(), l.quantity()))
                .toList();
        Map<String, String> skuCategories = new HashMap<>();
        products.findBySkuIn(lines.stream().map(DiscountCalculator.Line::sku).filter(Objects::nonNull).toList())
                .forEach(p -> skuCategories.put(p.getSku(), p.getCategory()));
        Optional<DiscountCalculator.Choice> choice = DiscountCalculator.choose(lines, skuCategories,
                partner.getEligibleCategories(), partner.getExcludedCategories(), partner.getDiscountPercent(),
                request.preferredLineId());
        if (choice.isEmpty()) {
            return refuse(command, beneficiary, partner, RefusalReason.NO_ELIGIBLE_ITEM);
        }

        PosReservation reservation = existing != null ? existing : new PosReservation(command.terminal().terminalId(),
                ticketId, request.cashier(), beneficiary.getId(), partner.getId(), payload.nonce(), periodKey,
                partner.getDiscountPercent(), now.plus(reservationTtl), now);
        reservation.applyTo(choice.get(), partner.getDiscountPercent(), now.plus(reservationTtl), now);
        reservations.save(reservation);

        BigDecimal total = total(request.lines());
        return new PreviewResponse("VALID", null, "Avantage valide", reservation.getId(), reservation.getReservedUntil(),
                new PosDtos.Beneficiary(beneficiary.fullName(), partner.getName()),
                PosRequests.discount(reservation, choice.get().category()),
                total, total.subtract(choice.get().discountAmount()));
    }

    private PreviewResponse refuse(PosPreviewCommand command, BeneficiaryProjection b, PartnerProjection p,
                                   RefusalReason reason) {
        events.publish(new RedemptionRejected(
                b == null ? null : b.getId(), b == null ? null : b.fullName(),
                p == null ? null : p.getId(), p == null ? null : p.getName(),
                command.terminal().terminalId(), PosRequests.staffName(command.terminal(), command.request().cashier()),
                reason.name(), "POS", clock.instant()));
        return new PreviewResponse("REFUSED", reason.name(), reason.message(), null, null,
                b == null || !b.isKnown() ? null : new PosDtos.Beneficiary(b.fullName(), p == null ? null : p.getName()),
                null, total(command.request().lines()), total(command.request().lines()));
    }

    static BigDecimal total(List<TicketLine> lines) {
        BigDecimal total = BigDecimal.ZERO;
        for (TicketLine line : lines == null ? List.<TicketLine>of() : lines) {
            if (line.unitPrice() != null) {
                total = total.add(line.unitPrice().multiply(line.quantity() == null ? BigDecimal.ONE : line.quantity()));
            }
        }
        return total.setScale(3, java.math.RoundingMode.HALF_UP);
    }
}
