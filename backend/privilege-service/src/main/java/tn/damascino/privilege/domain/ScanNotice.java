package tn.damascino.privilege.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Last scan of a beneficiary's QR code (phone, handheld scanner or till), displayed live in the beneficiary's app. */
@Entity
@Table(name = "scan_notice")
public class ScanNotice {

    @Id
    @Column(name = "beneficiary_id")
    private UUID beneficiaryId;

    @Column(nullable = false)
    private String status;

    private String reason;

    @Column(nullable = false)
    private String message;

    @Column(name = "staff_name")
    private String staffName;

    @Column(name = "discount_percent")
    private BigDecimal discountPercent;

    @Column(name = "dish_price")
    private BigDecimal dishPrice;

    @Column(name = "discount_amount")
    private BigDecimal discountAmount;

    @Column(name = "scanned_at", nullable = false)
    private Instant scannedAt;

    protected ScanNotice() {
    }

    public UUID getBeneficiaryId() {
        return beneficiaryId;
    }

    public String getStatus() {
        return status;
    }

    public String getReason() {
        return reason;
    }

    public String getMessage() {
        return message;
    }

    public String getStaffName() {
        return staffName;
    }

    public BigDecimal getDiscountPercent() {
        return discountPercent;
    }

    public BigDecimal getDishPrice() {
        return dishPrice;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public Instant getScannedAt() {
        return scannedAt;
    }
}
