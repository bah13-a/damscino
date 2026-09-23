package tn.damascino.common.messaging;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class MessagingConfig {

    @Bean
    public TopicExchange eventsExchange() {
        return new TopicExchange(Messaging.EXCHANGE, true, false);
    }
}
