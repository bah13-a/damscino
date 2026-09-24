package tn.damascino.privilege.pos;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request and response bodies of the till API (v1). */
public final class PosDtos {

    private PosDtos() {
    }

    public record TicketLine(String lineId, String sku, String label, String category, BigDecimal unitPrice,
                             BigDecimal quantity) {
    }

    public record PreviewRequest(String code, String ticketId, String cashier, String preferredLineId,
                                 List<TicketLine> lines) {
    }

    public record ConfirmRequest(UUID reservationId, String ticketId, Instant paidAt) {
    }

    public record CancelRequest(String ticketId, String reason) {
    }

    public record Beneficiary(String name, String partner) {
    }

    public record Discount(String lineId, String label, String category, BigDecimal unitPrice, BigDecimal percent,
                           BigDecimal amount) {
    }

    /** status: VALID or REFUSED (reason + message). */
    public record PreviewResponse(String status, String reason, String message, UUID reservationId,
                                  Instant reservedUntil, Beneficiary beneficiary, Discount discount,
                                  BigDecimal totalBefore, BigDecimal totalAfter) {
    }

    /** status: CONFIRMED or REFUSED. */
    public record ConfirmResponse(String status, String reason, String message, UUID redemptionId, String ticketId,
                                  Beneficiary beneficiary, Discount discount, String validationCode,
                                  Instant validatedAt) {
    }

    /** status: CANCELLED or NOTHING_TO_CANCEL. */
    public record CancelResponse(String status, String ticketId, UUID redemptionId) {
    }

    public record Ping(String terminal, Instant serverTime, String apiVersion) {
    }
}
