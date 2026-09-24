package tn.damascino.privilege.pos;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.RedemptionConfirmed;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.application.QuotaService;
import tn.damascino.privilege.domain.EligibilityPolicy;
import tn.damascino.privilege.domain.Redemption;
import tn.damascino.privilege.domain.RedemptionRepository;
import tn.damascino.privilege.domain.RefusalReason;
import tn.damascino.privilege.pos.PosDtos.ConfirmResponse;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.BeneficiaryProjectionRepository;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.projection.PartnerProjectionRepository;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;

@Component
public class PosConfirmHandler implements CommandHandler<PosConfirmCommand, ConfirmResponse> {

    private final PosReservationRepository reservations;
    private final RedemptionRepository redemptions;
    private final BeneficiaryProjectionRepository beneficiaries;
    private final PartnerProjectionRepository partners;
    private final QuotaService quota;
    private final EventPublisher events;
    private final Clock clock;

    public PosConfirmHandler(PosReservationRepository reservations, RedemptionRepository redemptions,
                             BeneficiaryProjectionRepository beneficiaries, PartnerProjectionRepository partners,
                             QuotaService quota, EventPublisher events, Clock clock) {
        this.reservations = reservations;
        this.redemptions = redemptions;
        this.beneficiaries = beneficiaries;
        this.partners = partners;
        this.quota = quota;
        this.events = events;
        this.clock = clock;
    }

    @Override
    @Transactional
    public ConfirmResponse handle(PosConfirmCommand command) {
        PosDtos.ConfirmRequest request = command.request();
        PosRequests.checkTicket(request.ticketId());
        if (request.reservationId() == null) {
            throw ApiException.badRequest("INVALID_RESERVATION", "reservationId est obligatoire");
        }
        PosReservation reservation = reservations.findById(request.reservationId())
                .filter(r -> r.getTerminalId().equals(command.terminal().terminalId()))
                .filter(r -> r.getTicketId().equals(request.ticketId().trim()))
                .orElse(null);
        if (reservation == null || reservation.getStatus() == PosReservation.Status.CANCELLED) {
            return refused(RefusalReason.RESERVATION_NOT_FOUND, request.ticketId());
        }
        BeneficiaryProjection beneficiary = beneficiaries.findForUpdate(reservation.getBeneficiaryId()).orElse(null);
        PartnerProjection partner = partners.findById(reservation.getPartnerId()).orElse(null);

        if (reservation.getStatus() == PosReservation.Status.CONFIRMED) {
            // replay of a confirmation (network retry): same answer, no second passage
            Redemption done = redemptions.findById(reservation.getRedemptionId()).orElseThrow();
            return confirmed(reservation, done, beneficiary, partner);
        }
        Instant now = clock.instant();
        if (!reservation.isActive(now)) {
            reservation.expired(now);
            return refused(RefusalReason.RESERVATION_EXPIRED, request.ticketId());
        }
        long used = quota.usedExcluding(reservation.getBeneficiaryId(), reservation.getPeriodKey(), reservation.getId());
        RefusalReason refusal = EligibilityPolicy.evaluate(beneficiary, partner, LocalDate.now(clock), used).orElse(null);
        if (refusal != null) {
            reservation.cancelled(now);
            return refused(refusal, request.ticketId());
        }

        String staffName = PosRequests.staffName(command.terminal(), reservation.getCashier());
        Redemption redemption = redemptions.saveAndFlush(Redemption.fromTill(beneficiary.getId(), partner.getId(),
                command.terminal().terminalId(), staffName, reservation.getPeriodKey(), reservation.getQrNonce(),
                reservation.getTicketId(), reservation.getDishLabel(), reservation.getDishPrice(),
                reservation.getDiscountPercent(), request.paidAt() == null ? now : request.paidAt()));
        reservation.confirmed(redemption.getId(), now);

        events.publish(new RedemptionConfirmed(redemption.getId(), beneficiary.getId(), beneficiary.fullName(),
                partner.getId(), partner.getName(), command.terminal().terminalId(), staffName,
                redemption.getPeriodKey(), redemption.getDishPrice(), redemption.getDiscountPercent(),
                redemption.getDiscountAmount(), redemption.getValidatedAt(), Redemption.CHANNEL_POS,
                command.terminal().name(), redemption.getTicketId(), redemption.getDishLabel(),
                redemption.getValidationCode()));
        return confirmed(reservation, redemption, beneficiary, partner);
    }

    private static ConfirmResponse confirmed(PosReservation reservation, Redemption redemption,
                                             BeneficiaryProjection beneficiary, PartnerProjection partner) {
        return new ConfirmResponse("CONFIRMED", null, "Passage validé", redemption.getId(), reservation.getTicketId(),
                new PosDtos.Beneficiary(beneficiary == null ? null : beneficiary.fullName(),
                        partner == null ? null : partner.getName()),
                PosRequests.discount(reservation, null), redemption.getValidationCode(), redemption.getValidatedAt());
    }

    private static ConfirmResponse refused(RefusalReason reason, String ticketId) {
        return new ConfirmResponse("REFUSED", reason.name(), reason.message(), null, ticketId, null, null, null, null);
    }
}
