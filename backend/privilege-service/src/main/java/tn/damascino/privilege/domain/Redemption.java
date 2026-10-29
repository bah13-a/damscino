package tn.damascino.privilege.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

/** A validated passage at the till: one eligible dish discounted for one beneficiary. */
@Entity
@Table(name = "redemption")
public class Redemption {

    @Id
    private UUID id;

    @Column(name = "beneficiary_id", nullable = false)
    private UUID beneficiaryId;

    @Column(name = "partner_id", nullable = false)
    private UUID partnerId;

    @Column(name = "staff_account_id", nullable = false)
    private UUID staffAccountId;

    @Column(name = "staff_name", nullable = false)
    private String staffName;

    @Column(name = "period_key", nullable = false)
    private String periodKey;

    @Column(name = "qr_nonce", nullable = false, unique = true)
    private String qrNonce;

    @Column(name = "dish_price")
    private BigDecimal dishPrice;

    @Column(name = "discount_percent", nullable = false)
    private BigDecimal discountPercent;

    @Column(name = "discount_amount")
    private BigDecimal discountAmount;

    @Column(name = "validated_at", nullable = false)
    private Instant validatedAt;

    /** SCANNER or POS. */
    @Column(nullable = false)
    private String channel;

    @Column(name = "pos_terminal_id")
    private UUID posTerminalId;

    @Column(name = "ticket_id")
    private String ticketId;

    @Column(name = "dish_label")
    private String dishLabel;

    /** Short code shown to the cashier, written on the ticket when the till is not connected (remise assistée). */
    @Column(name = "validation_code")
    private String validationCode;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancel_reason")
    private String cancelReason;

    public static final String CHANNEL_SCANNER = "SCANNER";
    public static final String CHANNEL_POS = "POS";
    /** The customer scanned the QR code stuck on the counter with the app. */
    public static final String CHANNEL_COUNTER = "COUNTER";
    private static final SecureRandom RANDOM = new SecureRandom();

    protected Redemption() {
    }

    public Redemption(UUID beneficiaryId, UUID partnerId, UUID staffAccountId, String staffName, String periodKey,
                      String qrNonce, BigDecimal dishPrice, BigDecimal discountPercent, Instant validatedAt) {
        this.id = UUID.randomUUID();
        this.beneficiaryId = beneficiaryId;
        this.partnerId = partnerId;
        this.staffAccountId = staffAccountId;
        this.staffName = staffName;
        this.periodKey = periodKey;
        this.qrNonce = qrNonce;
        this.dishPrice = dishPrice;
        this.discountPercent = discountPercent;
        this.discountAmount = discountOf(dishPrice, discountPercent);
        this.validatedAt = validatedAt;
        this.channel = CHANNEL_SCANNER;
        this.validationCode = "%06d".formatted(RANDOM.nextInt(1_000_000));
    }

    /** Passage validated by a connected till: the discounted line comes from the ticket. */
    public static Redemption fromTill(UUID beneficiaryId, UUID partnerId, UUID terminalId, String terminalLabel,
                                      String periodKey, String qrNonce, String ticketId, String dishLabel,
                                      BigDecimal dishPrice, BigDecimal discountPercent, Instant validatedAt) {
        Redemption redemption = new Redemption(beneficiaryId, partnerId, terminalId, terminalLabel, periodKey, qrNonce,
                dishPrice, discountPercent, validatedAt);
        redemption.channel = CHANNEL_POS;
        redemption.posTerminalId = terminalId;
        redemption.ticketId = ticketId;
        redemption.dishLabel = dishLabel;
        return redemption;
    }

    /** The customer scanned the counter QR code of the till {@code terminalId}. */
    public static Redemption fromCounter(UUID beneficiaryId, UUID partnerId, UUID terminalId, String terminalLabel,
                                         String periodKey, String nonce, BigDecimal discountPercent,
                                         Instant validatedAt) {
        Redemption redemption = new Redemption(beneficiaryId, partnerId, terminalId, terminalLabel, periodKey, nonce,
                null, discountPercent, validatedAt);
        redemption.channel = CHANNEL_COUNTER;
        redemption.posTerminalId = terminalId;
        return redemption;
    }

    /** Ticket cancelled or refunded: the passage no longer counts in the quota nor in the statistics. */
    public boolean cancel(Instant when, String reason) {
        if (cancelledAt != null) {
            return false;
        }
        cancelledAt = when;
        cancelReason = reason;
        return true;
    }

    /** Discount in dinars, rounded to the millime (e.g. 20 % of 40 DT = 8.000 DT). */
    public static BigDecimal discountOf(BigDecimal price, BigDecimal percent) {
        if (price == null) {
            return null;
        }
        return price.multiply(percent).divide(BigDecimal.valueOf(100), 3, RoundingMode.HALF_UP);
    }

    public UUID getId() {
        return id;
    }

    public UUID getBeneficiaryId() {
        return beneficiaryId;
    }

    public UUID getPartnerId() {
        return partnerId;
    }

    public UUID getStaffAccountId() {
        return staffAccountId;
    }

    public String getStaffName() {
        return staffName;
    }

    public String getPeriodKey() {
        return periodKey;
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

    public Instant getValidatedAt() {
        return validatedAt;
    }

    public String getChannel() {
        return channel;
    }

    public UUID getPosTerminalId() {
        return posTerminalId;
    }

    public String getTicketId() {
        return ticketId;
    }

    public String getDishLabel() {
        return dishLabel;
    }

    public String getValidationCode() {
        return validationCode;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public String getCancelReason() {
        return cancelReason;
    }
}
