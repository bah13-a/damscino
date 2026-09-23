package tn.damascino.common.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.events.DomainEvent;
import tn.damascino.common.events.EventEnvelope;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/** Records integration events in the outbox, inside the caller's transaction. */
@Component
public class EventPublisher {

    private final OutboxRepository outbox;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final String source;

    public EventPublisher(OutboxRepository outbox, ObjectMapper objectMapper, Clock clock,
                          @Value("${spring.application.name:unknown}") String source) {
        this.outbox = outbox;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.source = source;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void publish(DomainEvent event) {
        UUID id = UUID.randomUUID();
        Instant now = clock.instant();
        EventEnvelope envelope = new EventEnvelope(id, event.eventType(), now, source, objectMapper.valueToTree(event));
        try {
            outbox.save(new OutboxEvent(id, event.eventType(), objectMapper.writeValueAsString(envelope), now));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise event " + event.eventType(), e);
        }
    }
}
