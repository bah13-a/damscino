package tn.damascino.privilege.pos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

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

    protected PosTerminal() {
    }

    public PosTerminal(String name, String keyPrefix, String keyHash, Instant now) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.keyPrefix = keyPrefix;
        this.keyHash = keyHash;
        this.active = true;
        this.createdAt = now;
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

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }
}
