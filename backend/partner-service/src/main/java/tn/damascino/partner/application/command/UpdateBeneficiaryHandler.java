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
import tn.damascino.partner.domain.Partner;

import java.time.Clock;

@Component
public class UpdateBeneficiaryHandler implements CommandHandler<UpdateBeneficiaryCommand, BeneficiaryView> {

    private final BeneficiaryRepository beneficiaries;
    private final PartnerCommandSupport support;
    private final EventPublisher events;
    private final Audit audit;
    private final Clock clock;

    public UpdateBeneficiaryHandler(BeneficiaryRepository beneficiaries, PartnerCommandSupport support,
                                    EventPublisher events, Audit audit, Clock clock) {
        this.beneficiaries = beneficiaries;
        this.support = support;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional
    public BeneficiaryView handle(UpdateBeneficiaryCommand command) {
        Beneficiary beneficiary = beneficiaries.findById(command.beneficiaryId())
                .orElseThrow(() -> ApiException.notFound("Bénéficiaire"));
        Partner partner = support.partner(command.partnerId() == null ? beneficiary.getPartnerId() : command.partnerId());
        String phone = support.validPhone(command.phone());
        beneficiaries.findByPhone(phone).filter(other -> !other.getId().equals(beneficiary.getId())).ifPresent(other -> {
            throw ApiException.conflict("PHONE_TAKEN", "Ce numéro de téléphone est déjà enregistré");
        });
        beneficiary.update(partner.getId(), PartnerCommandSupport.required(command.firstName(), "Le prénom"),
                PartnerCommandSupport.required(command.lastName(), "Le nom"), phone, clock.instant());
        events.publish(beneficiary.snapshot());
        audit.record(command.actor(), "BENEFICIARY_UPDATED", "BENEFICIARY", beneficiary.getId(),
                beneficiary.fullName() + " · " + partner.getName());
        return BeneficiaryView.of(beneficiary, partner.getName());
    }
}
