package tn.damascino.identity.messaging;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.events.BeneficiaryChanged;
import tn.damascino.common.events.BeneficiaryCredentialsIssued;
import tn.damascino.common.events.BeneficiarySessionChanged;
import tn.damascino.common.events.EventEnvelope;
import tn.damascino.common.events.EventTypes;
import tn.damascino.common.messaging.EventReader;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.RefreshSessionRepository;

import java.time.Clock;

/** Keeps beneficiary login accounts in sync with the partner lists managed by the partner service. */
@Component
public class BeneficiaryAccountsProjector {

    private final AccountRepository accounts;
    private final RefreshSessionRepository sessions;
    private final EventPublisher events;
    private final EventReader reader;
    private final Clock clock;

    public BeneficiaryAccountsProjector(AccountRepository accounts, RefreshSessionRepository sessions,
                                        EventPublisher events, EventReader reader, Clock clock) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.events = events;
        this.reader = reader;
        this.clock = clock;
    }

    @RabbitListener(queues = IdentityMessagingConfig.QUEUE)
    @Transactional
    public void on(String message) {
        EventEnvelope envelope = reader.envelope(message);
        switch (envelope.type()) {
            case EventTypes.BENEFICIARY_CREDENTIALS_ISSUED ->
                    credentialsIssued(reader.payload(envelope, BeneficiaryCredentialsIssued.class));
            case EventTypes.BENEFICIARY_CHANGED -> beneficiaryChanged(reader.payload(envelope, BeneficiaryChanged.class));
            default -> {
                // not interested
            }
        }
    }

    private void credentialsIssued(BeneficiaryCredentialsIssued event) {
        Account account = accounts.findByBeneficiaryId(event.beneficiaryId()).orElse(null);
        if (account == null) {
            account = Account.beneficiary(event.beneficiaryId(), event.partnerId(), event.phone(), event.fullName(),
                    event.passwordHash(), event.active(), clock.instant());
        } else {
            account.updateBeneficiaryProfile(event.partnerId(), event.phone(), event.fullName(), event.active());
            account.issueTemporaryPassword(event.passwordHash());
            sessions.deleteAllForAccount(account.getId());
        }
        accounts.save(account);
        events.publish(new BeneficiarySessionChanged(event.beneficiaryId(), account.getSessionVersion()));
    }

    private void beneficiaryChanged(BeneficiaryChanged event) {
        accounts.findByBeneficiaryId(event.beneficiaryId()).ifPresent(account -> {
            account.updateBeneficiaryProfile(event.partnerId(), event.phone(), event.fullName(), event.active());
            if (!event.active()) {
                sessions.deleteAllForAccount(account.getId());
            }
        });
    }
}
