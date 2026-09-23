package tn.damascino.partner.application.query;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.domain.BeneficiaryRepository;
import tn.damascino.partner.domain.Partner;
import tn.damascino.partner.domain.PartnerRepository;

@Component
public class GetBeneficiaryHandler implements QueryHandler<GetBeneficiaryQuery, BeneficiaryView> {

    private final BeneficiaryRepository beneficiaries;
    private final PartnerRepository partners;

    public GetBeneficiaryHandler(BeneficiaryRepository beneficiaries, PartnerRepository partners) {
        this.beneficiaries = beneficiaries;
        this.partners = partners;
    }

    @Override
    @Transactional(readOnly = true)
    public BeneficiaryView handle(GetBeneficiaryQuery query) {
        var beneficiary = beneficiaries.findById(query.beneficiaryId())
                .orElseThrow(() -> ApiException.notFound("Bénéficiaire"));
        String partnerName = partners.findById(beneficiary.getPartnerId()).map(Partner::getName).orElse(null);
        return BeneficiaryView.of(beneficiary, partnerName);
    }
}
