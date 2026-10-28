package tn.damascino.privilege.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Daily QR code for a beneficiary, renewed at midnight. */
@Entity
@Table(name = "daily_qr")
public class DailyQr {

    @Id
    private UUID id;

    @Column(name = "beneficiary_id", nullable = false)
    private UUID beneficiaryId;

    @Column(name = "qr_code", nullable = false, columnDefinition = "text")
    private String qrCode;

    @Column(name = "qr_date", nullable = false)
    private LocalDate qrDate;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    @Column(name = "used_at")
    private Instant usedAt;

    protected DailyQr() {
    }

    public DailyQr(UUID beneficiaryId, String qrCode, LocalDate qrDate, Instant generatedAt) {
        this.id = UUID.randomUUID();
        this.beneficiaryId = beneficiaryId;
        this.qrCode = qrCode;
        this.qrDate = qrDate;
        this.generatedAt = generatedAt;
    }

    /** New code for the rest of the day (the previous one was used or revoked). */
    public void renew(String qrCode, Instant when) {
        this.qrCode = qrCode;
        this.generatedAt = when;
        this.usedAt = null;
    }

    public void markAsUsed(Instant when) {
        if (usedAt == null) {
            this.usedAt = when;
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getBeneficiaryId() {
        return beneficiaryId;
    }

    public String getQrCode() {
        return qrCode;
    }

    public LocalDate getQrDate() {
        return qrDate;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public boolean isUsed() {
        return usedAt != null;
    }
}
