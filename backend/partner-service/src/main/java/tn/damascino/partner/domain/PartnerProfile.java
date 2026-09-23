package tn.damascino.partner.domain;

import java.time.LocalDate;

public record PartnerProfile(
        String name,
        String contactName,
        String contactPhone,
        String contactEmail,
        LocalDate conventionStart,
        LocalDate conventionEnd) {
}
