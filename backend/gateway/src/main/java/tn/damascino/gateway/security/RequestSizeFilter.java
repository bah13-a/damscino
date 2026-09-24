package tn.damascino.gateway.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/** Refuses oversized requests at the edge (the largest legitimate upload is a 10 MB till sales export). */
@Component
public class RequestSizeFilter implements GlobalFilter, Ordered {

    private final long maxBytes;

    public RequestSizeFilter(@Value("${security.max-request-size:12MB}") DataSize maxSize) {
        this.maxBytes = maxSize.toBytes();
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (exchange.getRequest().getHeaders().getContentLength() > maxBytes) {
            exchange.getResponse().setStatusCode(HttpStatus.PAYLOAD_TOO_LARGE);
            return exchange.getResponse().setComplete();
        }
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 2;
    }
}
