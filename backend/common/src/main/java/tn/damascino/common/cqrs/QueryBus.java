package tn.damascino.common.cqrs;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/** Dispatches queries to their single handler (read side). */
@Component
public class QueryBus {

    private final HandlerRegistry<QueryHandler<?, ?>> registry;

    public QueryBus(ObjectProvider<QueryHandler<?, ?>> handlers) {
        this.registry = new HandlerRegistry<>(handlers.stream().toList(), QueryHandler.class);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public <R> R ask(Query<R> query) {
        QueryHandler handler = registry.find(query.getClass());
        return (R) handler.handle(query);
    }
}
