package tn.damascino.gateway.security;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Hardening headers on every API response: the API only returns JSON and files, never a page, so it may not be
 * framed, sniffed, cached or run any content.
 */
@Component
public class SecurityHeadersFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        exchange.getResponse().beforeCommit(() -> {
            apply(exchange.getResponse().getHeaders());
            return Mono.empty();
        });
        return chain.filter(exchange);
    }

    static void apply(HttpHeaders headers) {
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Frame-Options", "DENY");
        headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox");
        headers.set("Referrer-Policy", "no-referrer");
        headers.set("Cross-Origin-Resource-Policy", "same-origin");
        headers.set("X-Permitted-Cross-Domain-Policies", "none");
        // obsolete XSS auditor: disabled as recommended, the CSP does the job
        headers.set("X-XSS-Protection", "0");
        headers.set(HttpHeaders.CACHE_CONTROL, "no-store");
        headers.set(HttpHeaders.PRAGMA, "no-cache");
        headers.remove("Server");
        headers.remove("X-Powered-By");
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
