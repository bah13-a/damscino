package tn.damascino.reporting.projection;

import org.springframework.amqp.core.Declarables;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tn.damascino.common.events.EventTypes;
import tn.damascino.common.messaging.Messaging;

@Configuration
public class ReportingMessagingConfig {

    public static final String QUEUE = "reporting-service.events";

    @Bean
    public Declarables reportingQueue() {
        return Messaging.serviceQueue(QUEUE,
                EventTypes.PARTNER_CHANGED,
                EventTypes.BENEFICIARY_CHANGED,
                EventTypes.ACCOUNT_ACTIVATED,
                EventTypes.REDEMPTION_CONFIRMED,
                EventTypes.REDEMPTION_REJECTED,
                EventTypes.REDEMPTION_CANCELLED,
                EventTypes.AUDIT_RECORDED);
    }
}
