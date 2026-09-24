package tn.damascino.privilege.pos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** Maps an article of the till (SKU / référence) to a Damascino menu category. */
@Entity
@Table(name = "pos_product")
public class PosProduct {

    @Id
    private String sku;

    private String label;

    @Column(nullable = false)
    private String category;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PosProduct() {
    }

    public PosProduct(String sku, String label, String category, Instant now) {
        this.sku = sku;
        update(label, category, now);
    }

    public void update(String label, String category, Instant now) {
        this.label = label;
        this.category = category;
        this.updatedAt = now;
    }

    public String getSku() {
        return sku;
    }

    public String getLabel() {
        return label;
    }

    public String getCategory() {
        return category;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
