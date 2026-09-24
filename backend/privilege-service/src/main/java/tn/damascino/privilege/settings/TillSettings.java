package tn.damascino.privilege.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * How the cashier applies the advantage in the existing "Remise" menu of the till (single row). Drives the
 * instructions shown on the staff scanner and the reconciliation of the till exports.
 */
@Entity
@Table(name = "till_settings")
public class TillSettings {

    public static final short SINGLETON = 1;

    public enum ApplyMode {
        /** Percentage discount on the line of the dish (the till supports per-line discounts). */
        LINE_PERCENT,
        /** Amount discount on the whole ticket (the till only supports ticket discounts). */
        TICKET_AMOUNT
    }

    @Id
    private short id;

    @Column(name = "discount_label", nullable = false)
    private String discountLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "apply_mode", nullable = false)
    private ApplyMode applyMode;

    @Column(name = "price_required", nullable = false)
    private boolean priceRequired;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TillSettings() {
    }

    public void update(String discountLabel, ApplyMode applyMode, boolean priceRequired, Instant now) {
        this.discountLabel = discountLabel;
        this.applyMode = applyMode;
        this.priceRequired = priceRequired;
        this.updatedAt = now;
    }

    public String getDiscountLabel() {
        return discountLabel;
    }

    public ApplyMode getApplyMode() {
        return applyMode;
    }

    public boolean isPriceRequired() {
        return priceRequired;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
