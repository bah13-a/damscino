package tn.damascino.common.events;

import com.fasterxml.jackson.annotation.JsonIgnore;

/** An integration event published through the outbox to the other services. */
public interface DomainEvent {

    /** Routing key on the {@code damascino.events} topic exchange. */
    @JsonIgnore
    String eventType();
}
