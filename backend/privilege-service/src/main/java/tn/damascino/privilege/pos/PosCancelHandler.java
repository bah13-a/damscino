package tn.damascino.privilege.pos;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.RedemptionCancelled;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.privilege.domain.RedemptionRepository;
import tn.damascino.privilege.pos.PosDtos.CancelResponse;

import java.time.Clock;
import java.time.Instant;

@Component
public class PosCancelHandler implements CommandHandler<PosCancelCommand, CancelResponse> {

    private final PosReservationRepository reservations;
    private final RedemptionRepository redemptions;
    private final EventPublisher events;
    private final Clock clock;

    public PosCancelHandler(PosReservationRepository reservations, RedemptionRepository redemptions,
                            EventPublisher events, Clock clock) {
        this.reservations = reservations;
        this.redemptions = redemptions;
        this.events = events;
        this.clock = clock;
    }

    @Override
    @Transactional
    public CancelResponse handle(PosCancelCommand command) {
        PosRequests.checkTicket(command.request().ticketId());
        String ticketId = command.request().ticketId().trim();
        String reason = command.request().reason() == null || command.request().reason().isBlank()
                ? "Ticket annulé en caisse" : command.request().reason().trim();
        PosReservation reservation = reservations.findOpen(command.terminal().terminalId(), ticketId).orElse(null);
        if (reservation == null) {
            return new CancelResponse("NOTHING_TO_CANCEL", ticketId, null);
        }
        Instant now = clock.instant();
        reservation.cancelled(now);
        if (reservation.getRedemptionId() != null) {
            redemptions.findById(reservation.getRedemptionId()).ifPresent(redemption -> {
                if (redemption.cancel(now, reason)) {
                    events.publish(new RedemptionCancelled(redemption.getId(), redemption.getBeneficiaryId(), ticketId,
                            reason, now));
                }
            });
        }
        return new CancelResponse("CANCELLED", ticketId, reservation.getRedemptionId());
    }
}
