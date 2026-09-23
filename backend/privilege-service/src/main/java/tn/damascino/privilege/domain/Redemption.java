package tn.damascino.privilege.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
}
