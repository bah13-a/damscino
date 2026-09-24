package tn.damascino.gateway.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Slows down password spraying: after too many failed logins from one client address in the window, further login
 * attempts from that address are refused with 429 until the window slides. Complements the per-account lockout
 * (5 failures) of identity-service, which cannot see attempts spread over many accounts.
 */
@Component
public class LoginThrottleFilter implements GlobalFilter, Ordered {

    static final String LOGIN_PATH = "/api/auth/login";
    private static final byte[] BODY = """
            {"code":"TOO_MANY_ATTEMPTS","message":"Trop de tentatives de connexion. Réessayez dans quelques minutes."}"""
            .getBytes(StandardCharsets.UTF_8);
    private static final int MAX_TRACKED_CLIENTS = 50_000;
    private static final Logger log = LoggerFactory.getLogger(LoginThrottleFilter.class);

    private final int maxFailures;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    @Autowired
    public LoginThrottleFilter(@Value("${security.login-throttle.max-failures:100}") int maxFailures,
                               @Value("${security.login-throttle.window:10m}") Duration window) {
        this(maxFailures, window, Clock.systemUTC());
    }

    LoginThrottleFilter(int maxFailures, Duration window, Clock clock) {
        this.maxFailures = maxFailures;
        this.window = window;
        this.clock = clock;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        if (request.getMethod() != HttpMethod.POST || !LOGIN_PATH.equals(request.getPath().value())) {
            return chain.filter(exchange);
        }
        String client = clientAddress(request);
        if (isBlocked(client)) {
            log.warn("Login refused for {}: too many failed attempts", client);
            var response = exchange.getResponse();
            response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
            response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
            response.getHeaders().set("Retry-After", String.valueOf(window.toSeconds()));
            return response.writeWith(Mono.just(response.bufferFactory().wrap(BODY)));
        }
        exchange.getResponse().beforeCommit(() -> {
            var status = exchange.getResponse().getStatusCode();
            if (status != null && (status.value() == 401 || status.value() == 423)) {
                recordFailure(client);
            }
            return Mono.empty();
        });
        return chain.filter(exchange);
    }

    boolean isBlocked(String client) {
        Deque<Instant> attempts = failures.get(client);
        if (attempts == null) {
            return false;
        }
        synchronized (attempts) {
            prune(attempts);
            return attempts.size() >= maxFailures;
        }
    }

    void recordFailure(String client) {
        if (failures.size() >= MAX_TRACKED_CLIENTS) {
            failures.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    prune(e.getValue());
                    return e.getValue().isEmpty();
                }
            });
        }
        Deque<Instant> attempts = failures.computeIfAbsent(client, k -> new ArrayDeque<>());
        synchronized (attempts) {
            prune(attempts);
            attempts.addLast(clock.instant());
            log.debug("Failed login from {} ({} in the window)", client, attempts.size());
        }
    }

    private void prune(Deque<Instant> attempts) {
        Instant limit = clock.instant().minus(window);
        while (!attempts.isEmpty() && !attempts.peekFirst().isAfter(limit)) {
            attempts.removeFirst();
        }
    }

    /** Client address as seen by the edge proxy (Caddy, Codespaces…), which sets X-Forwarded-For. */
    static String clientAddress(ServerHttpRequest request) {
        String forwarded = request.getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        InetSocketAddress remote = request.getRemoteAddress();
        return remote == null || remote.getAddress() == null ? "unknown" : remote.getAddress().getHostAddress();
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 1;
    }
}
