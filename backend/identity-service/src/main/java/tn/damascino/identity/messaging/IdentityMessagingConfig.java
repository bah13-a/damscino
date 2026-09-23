package tn.damascino.identity.messaging;

import org.springframework.amqp.core.Declarables;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tn.damascino.common.events.EventTypes;
import tn.damascino.common.messaging.Messaging;

@Configuration
public class IdentityMessagingConfig {

    public static final String QUEUE = "identity-service.events";

    @Bean
    public Declarables identityQueue() {
        return Messaging.serviceQueue(QUEUE,
                EventTypes.BENEFICIARY_CREDENTIALS_ISSUED,
                EventTypes.BENEFICIARY_CHANGED);
    }
}
