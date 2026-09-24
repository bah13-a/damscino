package tn.damascino.partner.application.query;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import tn.damascino.partner.domain.Beneficiary;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

final class BeneficiarySpecifications {

    private BeneficiarySpecifications() {
    }

    static Specification<Beneficiary> matching(String text, UUID partnerId, Boolean active) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (partnerId != null) {
                predicates.add(cb.equal(root.get("partnerId"), partnerId));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            if (text != null && !text.isBlank()) {
                List<Predicate> any = new ArrayList<>();
                for (String token : text.trim().toLowerCase(Locale.ROOT).split("\\s+")) {
                    String like = "%" + token.replace("%", "").replace("_", "") + "%";
                    List<Predicate> tokenMatches = new ArrayList<>(List.of(
                            cb.like(cb.lower(root.get("firstName")), like),
                            cb.like(cb.lower(root.get("lastName")), like)));
                    // a phone fragment ("98 123", "+216 98…"), not a name that happens to contain a digit
                    String digits = token.replaceAll("\\D", "");
                    if (isPhoneFragment(token)) {
                        tokenMatches.add(cb.like(root.get("phone"), "%" + digits + "%"));
                    }
                    any.add(cb.or(tokenMatches.toArray(Predicate[]::new)));
                }
                predicates.add(cb.and(any.toArray(Predicate[]::new)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    static boolean isPhoneFragment(String token) {
        return token.matches("[+().\\-]*\\d[\\d+().\\-]*");
    }
}
