package tn.damascino.common.events;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/** Wire format of every message exchanged on the bus. */
public record EventEnvelope(UUID eventId, String type, Instant occurredAt, String source, JsonNode payload) {
}
