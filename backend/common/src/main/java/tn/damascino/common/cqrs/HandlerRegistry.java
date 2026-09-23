package tn.damascino.common.cqrs;

import org.springframework.aop.support.AopUtils;
import org.springframework.core.ResolvableType;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Indexes handlers by the message type they declare as first generic argument. */
final class HandlerRegistry<H> {

    private final Map<Class<?>, H> handlers = new HashMap<>();

    HandlerRegistry(List<? extends H> beans, Class<?> handlerInterface) {
        for (H bean : beans) {
            Class<?> target = AopUtils.getTargetClass(bean);
            Class<?> messageType = ResolvableType.forClass(target).as(handlerInterface).getGeneric(0).resolve();
            if (messageType == null) {
                throw new IllegalStateException("Cannot resolve message type of handler " + target.getName());
            }
            H previous = handlers.put(messageType, bean);
            if (previous != null) {
                throw new IllegalStateException("Two handlers registered for " + messageType.getName());
            }
        }
    }

    H find(Class<?> messageType) {
        H handler = handlers.get(messageType);
        if (handler == null) {
            throw new IllegalStateException("No handler registered for " + messageType.getName());
        }
        return handler;
    }
}
