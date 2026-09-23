package tn.damascino.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tn.damascino.common.events.BeneficiaryChanged;

import java.time.Instant;
import java.util.UUID;

/** A person authorised by a partner. The phone number is the personal login (V1: one number, one partner). */
@Entity
@Table(name = "beneficiary")
public class Beneficiary {

    @Id
    private UUID id;

    @Column(name = "partner_id", nullable = false)
    private UUID partnerId;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(nullable = false, unique = true)
    private String phone;

    private boolean active;

    /** Temporary password, AES-GCM encrypted, kept only until the beneficiary activates the account. */
    @Column(name = "pending_password_cipher")
    private String pendingPasswordCipher;

    @Column(name = "credentials_issued_at")
    private Instant credentialsIssuedAt;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Beneficiary() {
    }

    public Beneficiary(UUID partnerId, String firstName, String lastName, String phone, Instant now) {
        this.id = UUID.randomUUID();
        this.partnerId = partnerId;
        this.firstName = firstName.trim();
        this.lastName = lastName.trim();
        this.phone = phone;
        this.active = true;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(UUID partnerId, String firstName, String lastName, String phone, Instant now) {
        this.partnerId = partnerId;
        this.firstName = firstName.trim();
        this.lastName = lastName.trim();
        this.phone = phone;
        this.updatedAt = now;
    }

    public void credentialsIssued(String passwordCipher, Instant now) {
        this.pendingPasswordCipher = passwordCipher;
        this.credentialsIssuedAt = now;
        this.activatedAt = null;
        this.updatedAt = now;
    }

    public void activated(Instant when) {
        this.activatedAt = when;
        this.pendingPasswordCipher = null;
    }

    public void setActive(boolean active, Instant now) {
        this.active = active;
        this.updatedAt = now;
    }

    public String fullName() {
        return (firstName + " " + lastName).trim();
    }

    public BeneficiaryChanged snapshot() {
        return new BeneficiaryChanged(id, partnerId, firstName, lastName, phone, active, createdAt);
    }

    public UUID getId() {
        return id;
    }

    public UUID getPartnerId() {
        return partnerId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getPhone() {
        return phone;
    }

    public boolean isActive() {
        return active;
    }

    public String getPendingPasswordCipher() {
        return pendingPasswordCipher;
    }

    public Instant getCredentialsIssuedAt() {
        return credentialsIssuedAt;
    }

    public Instant getActivatedAt() {
        return activatedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
