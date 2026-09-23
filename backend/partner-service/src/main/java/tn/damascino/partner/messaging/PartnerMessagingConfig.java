package tn.damascino.partner.messaging;

import org.springframework.amqp.core.Declarables;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tn.damascino.common.events.EventTypes;
import tn.damascino.common.messaging.Messaging;

@Configuration
public class PartnerMessagingConfig {

    public static final String QUEUE = "partner-service.events";

    @Bean
    public Declarables partnerQueue() {
        return Messaging.serviceQueue(QUEUE, EventTypes.ACCOUNT_ACTIVATED);
    }
}
