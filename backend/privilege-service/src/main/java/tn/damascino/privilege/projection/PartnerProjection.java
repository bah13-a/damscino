package tn.damascino.privilege.projection;

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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Copy of the partner convention and advantage rule, maintained from {@link PartnerChanged} events. */
@Entity
@Table(name = "partner_view")
public class PartnerProjection {

    @Id
    private UUID id;

    private String name;

    private boolean active;

    @Column(name = "convention_start")
    private LocalDate conventionStart;

    @Column(name = "convention_end")
    private LocalDate conventionEnd;

    @Column(name = "discount_percent")
    private BigDecimal discountPercent;

    @Convert(converter = StringListConverter.class)
    @Column(name = "eligible_categories")
    private List<String> eligibleCategories;

    @Convert(converter = StringListConverter.class)
    @Column(name = "excluded_categories")
    private List<String> excludedCategories;

    @Column(name = "usages_per_period")
    private int usagesPerPeriod;

    @Enumerated(EnumType.STRING)
    @Column(name = "usage_period")
    private UsagePeriod usagePeriod;

    protected PartnerProjection() {
    }

    public PartnerProjection(UUID id) {
        this.id = id;
    }

    public void apply(PartnerChanged event) {
        this.name = event.name();
        this.active = event.active();
        this.conventionStart = event.conventionStart();
        this.conventionEnd = event.conventionEnd();
        this.discountPercent = event.discountPercent();
        this.eligibleCategories = event.eligibleCategories();
        this.excludedCategories = event.excludedCategories();
        this.usagesPerPeriod = event.usagesPerPeriod();
        this.usagePeriod = event.usagePeriod();
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

    public LocalDate getConventionStart() {
        return conventionStart;
    }

    public LocalDate getConventionEnd() {
        return conventionEnd;
    }

    public BigDecimal getDiscountPercent() {
        return discountPercent;
    }

    public List<String> getEligibleCategories() {
        return eligibleCategories;
    }

    public List<String> getExcludedCategories() {
        return excludedCategories;
    }

    public int getUsagesPerPeriod() {
        return usagesPerPeriod;
    }

    public UsagePeriod getUsagePeriod() {
        return usagePeriod;
    }
}
