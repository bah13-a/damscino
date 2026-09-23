package tn.damascino.common.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarable;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;

import java.util.ArrayList;
import java.util.List;

public final class Messaging {

    /** Topic exchange carrying every integration event, routing key = event type. */
    public static final String EXCHANGE = "damascino.events";
    public static final String DEAD_LETTER_EXCHANGE = "damascino.dlx";

    private Messaging() {
    }

    /**
     * Declares the durable queue of a consuming service, bound to the given event types, plus its
     * dead-letter queue receiving the messages that still fail after the listener retries.
     */
    public static Declarables serviceQueue(String queueName, String... eventTypes) {
        TopicExchange exchange = new TopicExchange(EXCHANGE, true, false);
        FanoutExchange dlx = new FanoutExchange(DEAD_LETTER_EXCHANGE + "." + queueName, true, false);
        Queue queue = QueueBuilder.durable(queueName).deadLetterExchange(dlx.getName()).build();
        Queue deadLetters = QueueBuilder.durable(queueName + ".dlq").build();

        List<Declarable> declarables = new ArrayList<>(List.of(exchange, dlx, queue, deadLetters,
                BindingBuilder.bind(deadLetters).to(dlx)));
        for (String type : eventTypes) {
            Binding binding = BindingBuilder.bind(queue).to(exchange).with(type);
            declarables.add(binding);
        }
        return new Declarables(declarables);
    }
}
