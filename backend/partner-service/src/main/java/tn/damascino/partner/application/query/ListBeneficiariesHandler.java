package tn.damascino.partner.application.query;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.partner.domain.BeneficiaryRepository;
import tn.damascino.partner.domain.PartnerRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class ListBeneficiariesHandler implements QueryHandler<ListBeneficiariesQuery, List<BeneficiaryView>> {

    private final BeneficiaryRepository beneficiaries;
    private final PartnerRepository partners;

    public ListBeneficiariesHandler(BeneficiaryRepository beneficiaries, PartnerRepository partners) {
        this.beneficiaries = beneficiaries;
        this.partners = partners;
    }

    @Override
    @Transactional(readOnly = true)
    public List<BeneficiaryView> handle(ListBeneficiariesQuery query) {
        Map<UUID, String> partnerNames = new HashMap<>();
        partners.findAll().forEach(p -> partnerNames.put(p.getId(), p.getName()));
        return beneficiaries.findAll(BeneficiarySpecifications.matching(query.text(), query.partnerId(), query.active()),
                        Sort.by("lastName", "firstName")).stream()
                .map(b -> BeneficiaryView.of(b, partnerNames.get(b.getPartnerId())))
                .toList();
    }
}
