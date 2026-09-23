package tn.damascino.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tn.damascino.common.events.PartnerChanged;
import tn.damascino.common.persistence.StringListConverter;
import tn.damascino.common.time.UsagePeriod;
import tn.damascino.common.web.ApiException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** A company or group (Mall of Sfax, Famille Mokador, ...) whose members benefit from the advantage. */
@Entity
@Table(name = "partner")
public class Partner {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(name = "contact_name")
    private String contactName;

    @Column(name = "contact_phone")
    private String contactPhone;

    @Column(name = "contact_email")
    private String contactEmail;

    private boolean active;

    @Column(name = "convention_start", nullable = false)
    private LocalDate conventionStart;

    @Column(name = "convention_end", nullable = false)
    private LocalDate conventionEnd;

    @Column(name = "discount_percent", nullable = false)
    private BigDecimal discountPercent;

    @Convert(converter = StringListConverter.class)
    @Column(name = "eligible_categories", nullable = false)
    private List<String> eligibleCategories;

    @Convert(converter = StringListConverter.class)
    @Column(name = "excluded_categories", nullable = false)
    private List<String> excludedCategories;

    @Column(name = "usages_per_period", nullable = false)
    private int usagesPerPeriod;

    @Enumerated(EnumType.STRING)
    @Column(name = "usage_period", nullable = false)
    private UsagePeriod usagePeriod;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Partner() {
    }

    public Partner(PartnerProfile profile, AdvantageRule rule, Instant now) {
        this.id = UUID.randomUUID();
        this.active = true;
        this.createdAt = now;
        updateProfile(profile, now);
        applyRule(rule, now);
    }

    public void updateProfile(PartnerProfile profile, Instant now) {
        if (profile.conventionEnd().isBefore(profile.conventionStart())) {
            throw ApiException.badRequest("INVALID_CONVENTION", "La date de fin doit être postérieure à la date de début");
        }
        this.name = profile.name().trim();
        this.contactName = profile.contactName();
        this.contactPhone = profile.contactPhone();
        this.contactEmail = profile.contactEmail();
        this.conventionStart = profile.conventionStart();
        this.conventionEnd = profile.conventionEnd();
        this.updatedAt = now;
    }

    public void applyRule(AdvantageRule rule, Instant now) {
        this.discountPercent = rule.discountPercent();
        this.eligibleCategories = rule.eligibleCategories();
        this.excludedCategories = rule.excludedCategories();
        this.usagesPerPeriod = rule.usagesPerPeriod();
        this.usagePeriod = rule.usagePeriod();
        this.updatedAt = now;
    }

    public void setActive(boolean active, Instant now) {
        this.active = active;
        this.updatedAt = now;
    }

    public boolean isConventionRunning(LocalDate today) {
        return active && !today.isBefore(conventionStart) && !today.isAfter(conventionEnd);
    }

    public AdvantageRule rule() {
        return new AdvantageRule(discountPercent, eligibleCategories, excludedCategories, usagesPerPeriod, usagePeriod);
    }

    public PartnerProfile profile() {
        return new PartnerProfile(name, contactName, contactPhone, contactEmail, conventionStart, conventionEnd);
    }

    public PartnerChanged snapshot() {
        return new PartnerChanged(id, name, active, conventionStart, conventionEnd, discountPercent,
                eligibleCategories, excludedCategories, usagesPerPeriod, usagePeriod);
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
