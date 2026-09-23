package tn.damascino.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** A logged-in device. Only the SHA-256 of the refresh token is stored. */
@Entity
@Table(name = "refresh_session")
public class RefreshSession {

    @Id
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "user_agent")
    private String userAgent;

    protected RefreshSession() {
    }

    public RefreshSession(UUID accountId, String tokenHash, Instant expiresAt, Instant createdAt, String userAgent) {
        this.id = UUID.randomUUID();
        this.accountId = accountId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
        this.userAgent = userAgent == null || userAgent.length() <= 300 ? userAgent : userAgent.substring(0, 300);
    }

    public boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now);
    }

    public UUID getAccountId() {
        return accountId;
    }
}
