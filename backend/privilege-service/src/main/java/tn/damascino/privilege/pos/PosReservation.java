package tn.damascino.privilege.pos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * The advantage reserved for an open ticket. The QR code is only valid 40 s, while a ticket can stay open several
 * minutes: the reservation keeps the advantage (and counts in the quota) until the till confirms or it expires.
 */
@Entity
@Table(name = "pos_reservation")
public class PosReservation {

    public enum Status {
        RESERVED,
        CONFIRMED,
        CANCELLED,
        EXPIRED
    }

    @Id
    private UUID id;

    @Column(name = "terminal_id", nullable = false)
    private UUID terminalId;

    @Column(name = "ticket_id", nullable = false)
    private String ticketId;

    private String cashier;

    @Column(name = "beneficiary_id", nullable = false)
    private UUID beneficiaryId;

    @Column(name = "partner_id", nullable = false)
    private UUID partnerId;

    @Column(name = "qr_nonce", nullable = false, unique = true)
    private String qrNonce;

    @Column(name = "period_key", nullable = false)
    private String periodKey;

    @Column(name = "line_id")
    private String lineId;

    @Column(name = "dish_label")
    private String dishLabel;

    @Column(name = "dish_price")
    private BigDecimal dishPrice;

    @Column(name = "discount_percent", nullable = false)
    private BigDecimal discountPercent;

    @Column(name = "discount_amount")
    private BigDecimal discountAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(name = "reserved_until", nullable = false)
    private Instant reservedUntil;

    @Column(name = "redemption_id")
    private UUID redemptionId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PosReservation() {
    }

    public PosReservation(UUID terminalId, String ticketId, String cashier, UUID beneficiaryId, UUID partnerId,
                          String qrNonce, String periodKey, BigDecimal discountPercent, Instant reservedUntil,
                          Instant now) {
        this.id = UUID.randomUUID();
        this.terminalId = terminalId;
        this.ticketId = ticketId;
        this.cashier = cashier;
        this.beneficiaryId = beneficiaryId;
        this.partnerId = partnerId;
        this.qrNonce = qrNonce;
        this.periodKey = periodKey;
        this.discountPercent = discountPercent;
        this.status = Status.RESERVED;
        this.reservedUntil = reservedUntil;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** (Re)computes the discounted line when the ticket is previewed again after a change. */
    public void applyTo(DiscountCalculator.Choice choice, BigDecimal discountPercent, Instant reservedUntil, Instant now) {
        this.lineId = choice.lineId();
        this.dishLabel = choice.label();
        this.dishPrice = choice.unitPrice();
        this.discountPercent = discountPercent;
        this.discountAmount = choice.discountAmount();
        this.reservedUntil = reservedUntil;
        this.updatedAt = now;
    }

    public boolean isActive(Instant now) {
        return status == Status.CONFIRMED || (status == Status.RESERVED && reservedUntil.isAfter(now));
    }

    public void confirmed(UUID redemptionId, Instant now) {
        this.status = Status.CONFIRMED;
        this.redemptionId = redemptionId;
        this.updatedAt = now;
    }

    public void cancelled(Instant now) {
        this.status = Status.CANCELLED;
        this.updatedAt = now;
    }

    public void expired(Instant now) {
        this.status = Status.EXPIRED;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTerminalId() {
        return terminalId;
    }

    public String getTicketId() {
        return ticketId;
    }

    public String getCashier() {
        return cashier;
    }

    public UUID getBeneficiaryId() {
        return beneficiaryId;
    }

    public UUID getPartnerId() {
        return partnerId;
    }

    public String getQrNonce() {
        return qrNonce;
    }

    public String getPeriodKey() {
        return periodKey;
    }

    public String getLineId() {
        return lineId;
    }

    public String getDishLabel() {
        return dishLabel;
    }

    public BigDecimal getDishPrice() {
        return dishPrice;
    }

    public BigDecimal getDiscountPercent() {
        return discountPercent;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public Status getStatus() {
        return status;
    }

    public Instant getReservedUntil() {
        return reservedUntil;
    }

    public UUID getRedemptionId() {
        return redemptionId;
    }
}
