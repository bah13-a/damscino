package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.application.query.BeneficiaryView;
import tn.damascino.partner.domain.Beneficiary;
import tn.damascino.partner.domain.BeneficiaryRepository;

import java.time.Clock;

@Component
public class SetBeneficiaryActiveHandler implements CommandHandler<SetBeneficiaryActiveCommand, BeneficiaryView> {

    private final BeneficiaryRepository beneficiaries;
    private final PartnerCommandSupport support;
    private final EventPublisher events;
    private final Audit audit;
    private final Clock clock;

    public SetBeneficiaryActiveHandler(BeneficiaryRepository beneficiaries, PartnerCommandSupport support,
                                       EventPublisher events, Audit audit, Clock clock) {
        this.beneficiaries = beneficiaries;
        this.support = support;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional
    public BeneficiaryView handle(SetBeneficiaryActiveCommand command) {
        Beneficiary beneficiary = beneficiaries.findById(command.beneficiaryId())
                .orElseThrow(() -> ApiException.notFound("Bénéficiaire"));
        beneficiary.setActive(command.active(), clock.instant());
        events.publish(beneficiary.snapshot());
        audit.record(command.actor(), command.active() ? "BENEFICIARY_REACTIVATED" : "BENEFICIARY_DEACTIVATED",
                "BENEFICIARY", beneficiary.getId(), beneficiary.fullName());
        return BeneficiaryView.of(beneficiary, support.partner(beneficiary.getPartnerId()).getName());
    }
}
