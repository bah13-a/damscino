package tn.damascino.common.cqrs;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CommandBusTest {

    record Increment(int failures) implements Command<Integer> {
    }

    static class IncrementHandler implements CommandHandler<Increment, Integer> {
        final AtomicInteger calls = new AtomicInteger();

        @Override
        public Integer handle(Increment command) {
            if (calls.incrementAndGet() <= command.failures()) {
                throw new OptimisticLockingFailureException("concurrent update");
            }
            return calls.get();
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private CommandBus bus(IncrementHandler handler) {
        DefaultListableBeanFactory factory = new DefaultListableBeanFactory();
        factory.registerSingleton("handler", handler);
        return new CommandBus((ObjectProvider) factory.getBeanProvider(CommandHandler.class));
    }

    @Test
    void replaysACommandThatLostAnOptimisticLockingRace() {
        IncrementHandler handler = new IncrementHandler();
        assertThat(bus(handler).dispatch(new Increment(2))).isEqualTo(3);
    }

    @Test
    void givesUpAfterThreeAttempts() {
        IncrementHandler handler = new IncrementHandler();
        assertThatThrownBy(() -> bus(handler).dispatch(new Increment(5))).isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(handler.calls.get()).isEqualTo(3);
    }
}
