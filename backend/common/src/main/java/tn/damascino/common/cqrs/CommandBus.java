package tn.damascino.common.cqrs;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/** Dispatches commands to their single handler (write side). */
@Component
public class CommandBus {

    private final HandlerRegistry<CommandHandler<?, ?>> registry;

    public CommandBus(ObjectProvider<CommandHandler<?, ?>> handlers) {
        this.registry = new HandlerRegistry<>(handlers.stream().toList(), CommandHandler.class);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public <R> R dispatch(Command<R> command) {
        CommandHandler handler = registry.find(command.getClass());
        return (R) handler.handle(command);
    }
}
