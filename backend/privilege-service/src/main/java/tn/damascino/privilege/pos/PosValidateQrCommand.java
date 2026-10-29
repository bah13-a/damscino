package tn.damascino.privilege.pos;

import tn.damascino.common.cqrs.Command;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Handheld scanner plugged into the till: the till sends the code it read and applies its standard discount when the
 * answer is valid. One call validates the passage (no ticket lines, no reservation).
 *
 * @param cashier  name of the cashier, optional (shown to the customer and in the statistics)
 * @param ticketId number of the ticket, optional (kept for the reconciliation with the sales export)
 */
public record PosValidateQrCommand(PosPrincipal terminal, String qrCode, String cashier, String ticketId)
        implements Command<PosValidateQrCommand.Result> {

    /**
     * @param valid           true: apply the discount {@code discountName} of {@code discountPercent} %
     * @param reason          refusal code (QR_EXPIRED, QR_ALREADY_USED, QUOTA_REACHED…) when not valid
     * @param message         text to display on the till
     * @param validationCode  code to note on the ticket (reconciliation)
     */
    public record Result(boolean valid, String reason, String message, String discountName,
                         BigDecimal discountPercent, String clientName, String partnerName,
                         UUID redemptionId, String validationCode) {
    }
}
