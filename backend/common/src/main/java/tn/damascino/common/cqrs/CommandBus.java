package tn.damascino.common.cqrs;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/** Dispatches commands to their single handler (write side). */
@Component
public class CommandBus {

    /**
     * A command that lost an optimistic-locking race is replayed on fresh state (each attempt is its own transaction),
     * after a short random pause so that concurrent writers do not collide again at the same instant.
     */
    static final int MAX_ATTEMPTS = 6;
    private static final int MAX_BACKOFF_MILLIS = 60;

    private final HandlerRegistry<CommandHandler<?, ?>> registry;

    public CommandBus(ObjectProvider<CommandHandler<?, ?>> handlers) {
        this.registry = new HandlerRegistry<>(handlers.stream().toList(), CommandHandler.class);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public <R> R dispatch(Command<R> command) {
        CommandHandler handler = registry.find(command.getClass());
        for (int attempt = 1; ; attempt++) {
            try {
                return (R) handler.handle(command);
            } catch (OptimisticLockingFailureException e) {
                if (attempt >= MAX_ATTEMPTS) {
                    throw e;
                }
                pause(attempt);
            }
        }
    }

    private static void pause(int attempt) {
        try {
            Thread.sleep(ThreadLocalRandom.current().nextInt(5, MAX_BACKOFF_MILLIS) * (long) attempt / 2 + 1);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
