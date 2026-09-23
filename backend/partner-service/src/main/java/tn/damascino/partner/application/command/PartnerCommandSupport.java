package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import tn.damascino.common.util.PhoneNumbers;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.application.query.PartnerView;
import tn.damascino.partner.domain.BeneficiaryRepository;
import tn.damascino.partner.domain.MenuCategoryRepository;
import tn.damascino.partner.domain.Partner;
import tn.damascino.partner.domain.PartnerRepository;
import tn.damascino.partner.domain.AdvantageRule;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/** Shared lookups and validations used by the write-side handlers. */
@Component
public class PartnerCommandSupport {

    private final PartnerRepository partners;
    private final BeneficiaryRepository beneficiaries;
    private final MenuCategoryRepository categories;
    private final Clock clock;

    public PartnerCommandSupport(PartnerRepository partners, BeneficiaryRepository beneficiaries,
                                 MenuCategoryRepository categories, Clock clock) {
        this.partners = partners;
        this.beneficiaries = beneficiaries;
        this.categories = categories;
        this.clock = clock;
    }

    public Partner partner(UUID id) {
        return partners.findById(id).orElseThrow(() -> ApiException.notFound("Partenaire"));
    }

    public void checkCategoriesExist(AdvantageRule rule) {
        Set<String> known = new HashSet<>();
        categories.findAll().forEach(c -> known.add(c.getCode()));
        List<String> unknown = Stream.concat(rule.eligibleCategories().stream(), rule.excludedCategories().stream())
                .filter(code -> !known.contains(code)).toList();
        if (!unknown.isEmpty()) {
            throw ApiException.badRequest("UNKNOWN_CATEGORY", "Catégorie inconnue : " + String.join(", ", unknown));
        }
    }

    public String validPhone(String raw) {
        String phone = PhoneNumbers.normalize(raw);
        if (!PhoneNumbers.isValid(phone)) {
            throw ApiException.badRequest("INVALID_PHONE", "Numéro de téléphone invalide (8 chiffres attendus)");
        }
        return phone;
    }

    public static String required(String value, String label) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest("MISSING_FIELD", label + " est obligatoire");
        }
        return value.trim();
    }

    public PartnerView view(Partner partner) {
        long total = 0;
        long activated = 0;
        for (Object[] row : beneficiaries.countByPartner()) {
            if (partner.getId().equals(row[0])) {
                total = ((Number) row[1]).longValue();
                activated = row[2] == null ? 0 : ((Number) row[2]).longValue();
            }
        }
        return PartnerView.of(partner, LocalDate.now(clock), total, activated);
    }
}
