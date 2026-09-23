package tn.damascino.privilege.projection;

import org.springframework.amqp.core.Declarables;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tn.damascino.common.events.EventTypes;
import tn.damascino.common.messaging.Messaging;

@Configuration
public class PrivilegeMessagingConfig {

    public static final String QUEUE = "privilege-service.events";

    @Bean
    public Declarables privilegeQueue() {
        return Messaging.serviceQueue(QUEUE,
                EventTypes.PARTNER_CHANGED,
                EventTypes.BENEFICIARY_CHANGED,
                EventTypes.BENEFICIARY_SESSION_CHANGED);
    }
}
