package tn.damascino.partner.application.query;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.partner.application.command.PartnerCommandSupport;

@Component
public class GetPartnerHandler implements QueryHandler<GetPartnerQuery, PartnerView> {

    private final PartnerCommandSupport support;

    public GetPartnerHandler(PartnerCommandSupport support) {
        this.support = support;
    }

    @Override
    @Transactional(readOnly = true)
    public PartnerView handle(GetPartnerQuery query) {
        return support.view(support.partner(query.partnerId()));
    }
}
