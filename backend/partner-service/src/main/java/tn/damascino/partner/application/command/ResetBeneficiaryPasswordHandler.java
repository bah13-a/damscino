package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.application.CredentialIssuer;
import tn.damascino.partner.application.IssuedCredentials;
import tn.damascino.partner.domain.Beneficiary;
import tn.damascino.partner.domain.BeneficiaryRepository;

/** Forgotten password: a new temporary password is generated, the account is unlocked and must be re-activated. */
@Component
public class ResetBeneficiaryPasswordHandler implements CommandHandler<ResetBeneficiaryPasswordCommand, IssuedCredentials> {

    private final BeneficiaryRepository beneficiaries;
    private final CredentialIssuer credentialIssuer;
    private final Audit audit;

    public ResetBeneficiaryPasswordHandler(BeneficiaryRepository beneficiaries, CredentialIssuer credentialIssuer,
                                           Audit audit) {
        this.beneficiaries = beneficiaries;
        this.credentialIssuer = credentialIssuer;
        this.audit = audit;
    }

    @Override
    @Transactional
    public IssuedCredentials handle(ResetBeneficiaryPasswordCommand command) {
        Beneficiary beneficiary = beneficiaries.findById(command.beneficiaryId())
                .orElseThrow(() -> ApiException.notFound("Bénéficiaire"));
        IssuedCredentials credentials = credentialIssuer.issue(beneficiary);
        audit.record(command.actor(), "BENEFICIARY_PASSWORD_RESET", "BENEFICIARY", beneficiary.getId(),
                beneficiary.fullName());
        return credentials;
    }
}
