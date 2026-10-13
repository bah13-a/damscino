package tn.damascino.privilege.projection;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tn.damascino.common.events.BeneficiaryChanged;

import java.util.UUID;

/** Beneficiary status and current session version, maintained from partner and identity events. */
@Entity
@Table(name = "beneficiary_view")
public class BeneficiaryProjection {

    @Id
    private UUID id;

    @Column(name = "partner_id")
    private UUID partnerId;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    private String phone;

    private boolean active;

    @Column(name = "session_version")
    private long sessionVersion;

    protected BeneficiaryProjection() {
    }

    public BeneficiaryProjection(UUID id) {
        this.id = id;
    }

    public void apply(BeneficiaryChanged event) {
        this.partnerId = event.partnerId();
        this.firstName = event.firstName();
        this.lastName = event.lastName();
        this.phone = event.phone();
        this.active = event.active();
    }

    /** Session versions only grow: an event delivered late never re-validates an older device. */
    public void sessionChanged(long version) {
        this.sessionVersion = Math.max(this.sessionVersion, version);
    }

    public boolean isKnown() {
        return partnerId != null;
    }

    public String fullName() {
        return ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
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

    public UUID getId() {
        return id;
    }

    public UUID getPartnerId() {
        return partnerId;
    }

    public boolean isActive() {
        return active;
    }

    public long getSessionVersion() {
        return sessionVersion;
    }
}
