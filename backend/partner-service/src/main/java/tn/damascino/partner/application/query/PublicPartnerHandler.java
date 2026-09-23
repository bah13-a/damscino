package tn.damascino.partner.application.query;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.domain.PartnerRepository;

@Component
public class PublicPartnerHandler implements QueryHandler<PublicPartnerQuery, PublicPartnerQuery.PublicPartner> {

    private final PartnerRepository partners;

    public PublicPartnerHandler(PartnerRepository partners) {
        this.partners = partners;
    }

    @Override
    @Transactional(readOnly = true)
    public PublicPartnerQuery.PublicPartner handle(PublicPartnerQuery query) {
        return partners.findById(query.partnerId())
                .map(p -> new PublicPartnerQuery.PublicPartner(p.getId(), p.getName(), p.isActive()))
                .orElseThrow(() -> ApiException.notFound("Partenaire"));
    }
}
