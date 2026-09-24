package tn.damascino.gateway;

import io.netty.channel.ConnectTimeoutException;
import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.ConnectException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeoutException;

/**
 * A microservice that is starting, restarting or down must not look like a bug (500): answers 503 with the same
 * {code, message} JSON as the services, which the frontend displays as is.
 */
@Component
@Order(-2)
public class UnavailableServiceHandler implements ErrorWebExceptionHandler {

    private static final byte[] BODY = """
            {"code":"SERVICE_UNAVAILABLE","message":"Service en cours de démarrage, réessayez dans un instant."}"""
            .getBytes(StandardCharsets.UTF_8);

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable error) {
        if (!isUnavailable(error) || exchange.getResponse().isCommitted()) {
            return Mono.error(error);
        }
        exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        exchange.getResponse().getHeaders().set("Retry-After", "10");
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(BODY);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    static boolean isUnavailable(Throwable error) {
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (t instanceof ConnectException || t instanceof UnknownHostException || t instanceof ConnectTimeoutException
                    || t instanceof TimeoutException) {
                return true;
            }
            if (t instanceof ResponseStatusException rse && (rse.getStatusCode().value() == 503 || rse.getStatusCode().value() == 504)) {
                return true;
            }
        }
        return false;
    }
}
