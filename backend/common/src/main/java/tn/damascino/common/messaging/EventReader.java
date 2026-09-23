package tn.damascino.common.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import tn.damascino.common.events.EventEnvelope;

/** Deserialises messages received from the bus. */
@Component
public class EventReader {

    private final ObjectMapper objectMapper;

    public EventReader(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public EventEnvelope envelope(String body) {
        try {
            return objectMapper.readValue(body, EventEnvelope.class);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Malformed event: " + e.getOriginalMessage(), e);
        }
    }

    public <T> T payload(EventEnvelope envelope, Class<T> type) {
        try {
            return objectMapper.treeToValue(envelope.payload(), type);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Malformed payload for " + envelope.type(), e);
        }
    }
}
