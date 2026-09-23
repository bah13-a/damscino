package tn.damascino.partner.application.query;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.web.PageResponse;
import tn.damascino.partner.domain.BeneficiaryRepository;
import tn.damascino.partner.domain.PartnerRepository;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class SearchBeneficiariesHandler implements QueryHandler<SearchBeneficiariesQuery, PageResponse<BeneficiaryView>> {

    private final BeneficiaryRepository beneficiaries;
    private final PartnerRepository partners;

    public SearchBeneficiariesHandler(BeneficiaryRepository beneficiaries, PartnerRepository partners) {
        this.beneficiaries = beneficiaries;
        this.partners = partners;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<BeneficiaryView> handle(SearchBeneficiariesQuery query) {
        Map<UUID, String> partnerNames = new HashMap<>();
        partners.findAll().forEach(p -> partnerNames.put(p.getId(), p.getName()));
        int size = Math.min(Math.max(query.size(), 1), 200);
        var page = beneficiaries.findAll(
                BeneficiarySpecifications.matching(query.text(), query.partnerId(), query.active()),
                PageRequest.of(Math.max(query.page(), 0), size, Sort.by("lastName", "firstName")));
        return PageResponse.of(page, b -> BeneficiaryView.of(b, partnerNames.get(b.getPartnerId())));
    }
}
