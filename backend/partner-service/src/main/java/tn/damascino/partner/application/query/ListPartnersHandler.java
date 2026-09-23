package tn.damascino.partner.application.query;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.partner.domain.BeneficiaryRepository;
import tn.damascino.partner.domain.PartnerRepository;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class ListPartnersHandler implements QueryHandler<ListPartnersQuery, List<PartnerView>> {

    private final PartnerRepository partners;
    private final BeneficiaryRepository beneficiaries;
    private final Clock clock;

    public ListPartnersHandler(PartnerRepository partners, BeneficiaryRepository beneficiaries, Clock clock) {
        this.partners = partners;
        this.beneficiaries = beneficiaries;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PartnerView> handle(ListPartnersQuery query) {
        Map<UUID, long[]> counts = new HashMap<>();
        for (Object[] row : beneficiaries.countByPartner()) {
            counts.put((UUID) row[0], new long[]{((Number) row[1]).longValue(),
                    row[2] == null ? 0 : ((Number) row[2]).longValue()});
        }
        LocalDate today = LocalDate.now(clock);
        return partners.findAllByOrderByNameAsc().stream().map(p -> {
            long[] c = counts.getOrDefault(p.getId(), new long[]{0, 0});
            return PartnerView.of(p, today, c[0], c[1]);
        }).toList();
    }
}
