package tn.damascino.privilege.pos;

import tn.damascino.common.web.ApiException;

final class PosRequests {

    private PosRequests() {
    }

    static void checkTicket(String ticketId) {
        if (ticketId == null || ticketId.isBlank() || ticketId.length() > 80) {
            throw ApiException.badRequest("INVALID_TICKET", "Numéro de ticket manquant ou trop long (80 caractères max.)");
        }
    }

    /** Name recorded in the usage log: the till, and the cashier when the till sends it. */
    static String staffName(PosPrincipal terminal, String cashier) {
        return cashier == null || cashier.isBlank() ? terminal.name() : terminal.name() + " · " + cashier.trim();
    }

    static PosDtos.Discount discount(PosReservation reservation, String category) {
        return new PosDtos.Discount(reservation.getLineId(), reservation.getDishLabel(), category,
                reservation.getDishPrice(), reservation.getDiscountPercent(), reservation.getDiscountAmount());
    }
}
