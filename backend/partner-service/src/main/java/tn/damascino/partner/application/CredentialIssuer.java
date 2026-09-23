package tn.damascino.partner.application;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import tn.damascino.common.events.BeneficiaryCredentialsIssued;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.partner.domain.Beneficiary;

import java.time.Clock;

/**
 * Generates a temporary password, keeps it encrypted for the access export and sends only its bcrypt hash to the
 * identity service.
 */
@Component
public class CredentialIssuer {

    /** Lower cost for temporary passwords (changed at first login) so that importing 1 000 people stays fast. */
    private final BCryptPasswordEncoder temporaryEncoder = new BCryptPasswordEncoder(8);

    private final CredentialVault vault;
    private final EventPublisher events;
    private final Clock clock;

    public CredentialIssuer(CredentialVault vault, EventPublisher events, Clock clock) {
        this.vault = vault;
        this.events = events;
        this.clock = clock;
    }

    public IssuedCredentials issue(Beneficiary beneficiary) {
        String password = TemporaryPasswords.generate();
        beneficiary.credentialsIssued(vault.encrypt(password), clock.instant());
        events.publish(new BeneficiaryCredentialsIssued(beneficiary.getId(), beneficiary.getPartnerId(),
                beneficiary.getPhone(), beneficiary.fullName(), beneficiary.isActive(), temporaryEncoder.encode(password)));
        return new IssuedCredentials(beneficiary.getId(), beneficiary.getFirstName(), beneficiary.getLastName(),
                beneficiary.getPhone(), password);
    }
}
