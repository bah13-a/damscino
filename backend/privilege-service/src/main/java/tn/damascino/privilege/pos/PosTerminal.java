package tn.damascino.privilege.pos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tn.damascino.common.security.Secrets;

import java.time.Instant;
import java.util.UUID;

/** A till (poste de caisse) allowed to call the till API with its own key. Only the key hash is stored. */
@Entity
@Table(name = "pos_terminal")
public class PosTerminal {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(name = "key_prefix", nullable = false)
    private String keyPrefix;

    @Column(name = "key_hash", nullable = false, unique = true)
    private String keyHash;

    private boolean active;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    /** Identifier printed in the counter QR code (not a secret: it only says where the customer is). */
    @Column(name = "counter_code", nullable = false, unique = true)
    private String counterCode;

    protected PosTerminal() {
    }

    public PosTerminal(String name, String keyPrefix, String keyHash, Instant now) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.keyPrefix = keyPrefix;
        this.keyHash = keyHash;
        this.active = true;
        this.createdAt = now;
        this.counterCode = Secrets.randomToken(16);
    }

    /** New counter QR code: the printed one stops working (label damaged or photographed). */
    public void renewCounterCode() {
        this.counterCode = Secrets.randomToken(16);
    }

    public void rotateKey(String keyPrefix, String keyHash) {
        this.keyPrefix = keyPrefix;
        this.keyHash = keyHash;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getKeyPrefix() {
        return keyPrefix;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getCounterCode() {
        return counterCode;
    }

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }
}
