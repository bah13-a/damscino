package tn.damascino.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.DynamicUpdate;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.security.Role;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Credentials of an administrator, a scanner staff member or a beneficiary. */
@Entity
@DynamicUpdate
@Table(name = "account")
public class Account {

    @Id
    private UUID id;

    @Version
    private long version;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "beneficiary_id")
    private UUID beneficiaryId;

    @Column(name = "partner_id")
    private UUID partnerId;

    private boolean active;

    @Column(name = "must_change_password")
    private boolean mustChangePassword;

    @Column(name = "failed_attempts")
    private int failedAttempts;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "session_version")
    private long sessionVersion;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Account() {
    }

    private Account(Role role, String username, String displayName, String passwordHash, boolean mustChangePassword,
                    Instant now) {
        this.id = UUID.randomUUID();
        this.role = role;
        this.username = username;
        this.displayName = displayName;
        this.passwordHash = passwordHash;
        this.mustChangePassword = mustChangePassword;
        this.active = true;
        this.createdAt = now;
    }

    public static Account staff(Role role, String username, String displayName, String secretHash, Instant now) {
        if (role == Role.BENEFICIARY) {
            throw new IllegalArgumentException("Use Account.beneficiary for beneficiaries");
        }
        return new Account(role, username, displayName, secretHash, role == Role.ADMIN, now);
    }

    public static Account beneficiary(UUID beneficiaryId, UUID partnerId, String phone, String fullName,
                                      String temporaryPasswordHash, boolean active, Instant now) {
        Account account = new Account(Role.BENEFICIARY, phone, fullName, temporaryPasswordHash, true, now);
        account.beneficiaryId = beneficiaryId;
        account.partnerId = partnerId;
        account.active = active;
        return account;
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }

    /** Counts a failed login; after {@code maxAttempts} consecutive failures the account is locked temporarily. */
    public void registerFailedLogin(Instant now, int maxAttempts, Duration lockDuration) {
        failedAttempts++;
        if (failedAttempts >= maxAttempts) {
            lockedUntil = now.plus(lockDuration);
            failedAttempts = 0;
        }
    }

    public void registerSuccessfulLogin(Instant now) {
        failedAttempts = 0;
        lockedUntil = null;
        lastLoginAt = now;
        if (role == Role.BENEFICIARY) {
            // single active session: every new login invalidates the previous device
            sessionVersion++;
        }
    }

    /** @return true when this change activates the account for the first time */
    public boolean changePassword(String newHash, Instant now) {
        passwordHash = newHash;
        mustChangePassword = false;
        if (role == Role.BENEFICIARY && activatedAt == null) {
            activatedAt = now;
            return true;
        }
        return false;
    }

    /** Temporary credentials (import or reset): unlock, revoke sessions and force a change at next login. */
    public void issueTemporaryPassword(String hash) {
        passwordHash = hash;
        mustChangePassword = true;
        failedAttempts = 0;
        lockedUntil = null;
        sessionVersion++;
    }

    /**
     * Signs in with a code received by SMS: proves the phone number, so the account is activated. A pending temporary
     * password is replaced by {@code unusableHash} (the SMS is now the way in); a personal password is kept.
     *
     * @return true when this sign-in activates the account for the first time
     */
    public boolean signInBySms(String unusableHash, Instant now) {
        if (role != Role.BENEFICIARY) {
            throw new IllegalStateException("SMS sign-in is reserved to beneficiaries");
        }
        if (mustChangePassword) {
            passwordHash = unusableHash;
            mustChangePassword = false;
        }
        registerSuccessfulLogin(now);
        if (activatedAt == null) {
            activatedAt = now;
            return true;
        }
        return false;
    }

    public void resetSecret(String hash) {
        passwordHash = hash;
        mustChangePassword = role == Role.ADMIN;
        failedAttempts = 0;
        lockedUntil = null;
    }

    public void updateBeneficiaryProfile(UUID partnerId, String phone, String fullName, boolean active) {
        this.partnerId = partnerId;
        this.username = phone;
        this.displayName = fullName;
        this.active = active;
    }

    public void rename(String displayName) {
        this.displayName = displayName;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public AuthenticatedUser toPrincipal() {
        return new AuthenticatedUser(id, role, displayName, beneficiaryId, sessionVersion, mustChangePassword);
    }

    public UUID getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Role getRole() {
        return role;
    }

    public String getDisplayName() {
        return displayName;
    }

    public UUID getBeneficiaryId() {
        return beneficiaryId;
    }

    public UUID getPartnerId() {
        return partnerId;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isMustChangePassword() {
        return mustChangePassword;
    }

    public long getSessionVersion() {
        return sessionVersion;
    }

    public Instant getLockedUntil() {
        return lockedUntil;
    }

    public Instant getActivatedAt() {
        return activatedAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
