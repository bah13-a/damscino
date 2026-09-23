package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.application.CredentialIssuer;
import tn.damascino.partner.application.IssuedCredentials;
import tn.damascino.partner.domain.Beneficiary;
import tn.damascino.partner.domain.BeneficiaryRepository;
import tn.damascino.partner.domain.Partner;

import java.time.Clock;

@Component
public class CreateBeneficiaryHandler implements CommandHandler<CreateBeneficiaryCommand, IssuedCredentials> {

    private final BeneficiaryRepository beneficiaries;
    private final PartnerCommandSupport support;
    private final CredentialIssuer credentialIssuer;
    private final EventPublisher events;
    private final Audit audit;
    private final Clock clock;

    public CreateBeneficiaryHandler(BeneficiaryRepository beneficiaries, PartnerCommandSupport support,
                                    CredentialIssuer credentialIssuer, EventPublisher events, Audit audit, Clock clock) {
        this.beneficiaries = beneficiaries;
        this.support = support;
        this.credentialIssuer = credentialIssuer;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional
    public IssuedCredentials handle(CreateBeneficiaryCommand command) {
        Partner partner = support.partner(command.partnerId());
        String phone = support.validPhone(command.phone());
        if (beneficiaries.findByPhone(phone).isPresent()) {
            throw ApiException.conflict("PHONE_TAKEN", "Ce numéro de téléphone est déjà enregistré");
        }
        Beneficiary beneficiary = beneficiaries.save(new Beneficiary(partner.getId(),
                PartnerCommandSupport.required(command.firstName(), "Le prénom"),
                PartnerCommandSupport.required(command.lastName(), "Le nom"), phone, clock.instant()));
        events.publish(beneficiary.snapshot());
        IssuedCredentials credentials = credentialIssuer.issue(beneficiary);
        audit.record(command.actor(), "BENEFICIARY_CREATED", "BENEFICIARY", beneficiary.getId(),
                beneficiary.fullName() + " · " + partner.getName());
        return credentials;
    }
}
