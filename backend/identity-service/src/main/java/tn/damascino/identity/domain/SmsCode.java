package tn.damascino.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tn.damascino.common.security.Secrets;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** A one-time activation code sent by SMS: 6 digits, short-lived, a limited number of attempts. */
@Entity
@Table(name = "sms_code")
public class SmsCode {

    public enum Check { VALID, WRONG, EXPIRED, TOO_MANY_ATTEMPTS }

    @Id
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(nullable = false)
    private String phone;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    private int attempts;

    private boolean consumed;

    @Column(name = "client_ip")
    private String clientIp;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected SmsCode() {
    }

    public SmsCode(UUID accountId, String phone, String code, Duration ttl, String clientIp, Instant now) {
        this.id = UUID.randomUUID();
        this.accountId = accountId;
        this.phone = phone;
        this.codeHash = hash(id, code);
        this.expiresAt = now.plus(ttl);
        this.clientIp = clientIp == null || clientIp.length() <= 64 ? clientIp : clientIp.substring(0, 64);
        this.createdAt = now;
    }

    /** The code is salted with the row id, so that equal codes never share a hash. */
    private static String hash(UUID id, String code) {
        return Secrets.sha256Hex(id + ":" + code);
    }

    /** Checks a submitted code; each wrong answer uses one attempt, a valid one consumes the code. */
    public Check verify(String submitted, Instant now, int maxAttempts) {
        if (consumed || !expiresAt.isAfter(now)) {
            return Check.EXPIRED;
        }
        if (attempts >= maxAttempts) {
            return Check.TOO_MANY_ATTEMPTS;
        }
        String candidate = hash(id, submitted == null ? "" : submitted.trim());
        if (!MessageDigest.isEqual(candidate.getBytes(StandardCharsets.US_ASCII),
                codeHash.getBytes(StandardCharsets.US_ASCII))) {
            attempts++;
            return attempts >= maxAttempts ? Check.TOO_MANY_ATTEMPTS : Check.WRONG;
        }
        consumed = true;
        return Check.VALID;
    }

    public void invalidate() {
        consumed = true;
    }

    public int remainingAttempts(int maxAttempts) {
        return Math.max(0, maxAttempts - attempts);
    }

    public UUID getAccountId() {
        return accountId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
