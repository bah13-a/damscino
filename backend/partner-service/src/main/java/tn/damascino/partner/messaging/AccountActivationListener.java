package tn.damascino.partner.messaging;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.events.AccountActivated;
import tn.damascino.common.events.EventEnvelope;
import tn.damascino.common.events.EventTypes;
import tn.damascino.common.messaging.EventReader;
import tn.damascino.partner.domain.BeneficiaryRepository;

/** Once the beneficiary chose a personal password, the encrypted temporary password is destroyed. */
@Component
public class AccountActivationListener {

    private final BeneficiaryRepository beneficiaries;
    private final EventReader reader;

    public AccountActivationListener(BeneficiaryRepository beneficiaries, EventReader reader) {
        this.beneficiaries = beneficiaries;
        this.reader = reader;
    }

    @RabbitListener(queues = PartnerMessagingConfig.QUEUE)
    @Transactional
    public void on(String message) {
        EventEnvelope envelope = reader.envelope(message);
        if (EventTypes.ACCOUNT_ACTIVATED.equals(envelope.type())) {
            AccountActivated event = reader.payload(envelope, AccountActivated.class);
            beneficiaries.findById(event.beneficiaryId()).ifPresent(b -> b.activated(event.activatedAt()));
        }
    }
}
