package tn.damascino.common.outbox;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.messaging.Messaging;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

/** Polls the outbox and forwards pending events to the topic exchange, in creation order. */
@Component
public class OutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);

    private final OutboxRepository outbox;
    private final RabbitTemplate rabbit;
    private final Clock clock;

    public OutboxRelay(OutboxRepository outbox, RabbitTemplate rabbit, Clock clock) {
        this.outbox = outbox;
        this.rabbit = rabbit;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${damascino.outbox.poll-interval-ms:1000}")
    @Transactional
    public void relay() {
        List<OutboxEvent> pending = outbox.findPending(PageRequest.of(0, 100));
        for (OutboxEvent event : pending) {
            try {
                rabbit.convertAndSend(Messaging.EXCHANGE, event.getEventType(), event.getEnvelope(), message -> {
                    message.getMessageProperties().setContentType(MessageProperties.CONTENT_TYPE_TEXT_PLAIN);
                    message.getMessageProperties().setMessageId(event.getId().toString());
                    return message;
                });
                event.markPublished(clock.instant());
            } catch (AmqpException e) {
                log.warn("Broker unavailable, {} event(s) kept in outbox: {}", pending.size(), e.getMessage());
                return;
            }
        }
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "Africa/Tunis")
    @Transactional
    public void purge() {
        outbox.purgePublishedBefore(clock.instant().minus(Duration.ofDays(7)));
    }
}
