package tn.damascino.identity.application.sms;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Counts SMS code requests per client address over a sliding hour, including refused numbers, so that a single
 * address can neither run up the SMS bill nor probe the partner lists.
 */
@Component
public class SmsRateLimiter {

    private static final Duration WINDOW = Duration.ofHours(1);

    private final Map<String, Deque<Instant>> requests = new ConcurrentHashMap<>();
    private final Clock clock;
    private final int maxPerHour;

    public SmsRateLimiter(Clock clock, @Value("${damascino.sms.max-per-ip-per-hour}") int maxPerHour) {
        this.clock = clock;
        this.maxPerHour = maxPerHour;
    }

    /** @return false when the address already used its quota for the last hour */
    public boolean tryAcquire(String clientIp) {
        Instant now = clock.instant();
        Instant since = now.minus(WINDOW);
        if (requests.size() > 10_000) {
            requests.values().removeIf(q -> { synchronized (q) { return q.isEmpty() || q.peekLast().isBefore(since); } });
        }
        Deque<Instant> window = requests.computeIfAbsent(clientIp == null ? "unknown" : clientIp, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst().isBefore(since)) {
                window.pollFirst();
            }
            if (window.size() >= maxPerHour) {
                return false;
            }
            window.addLast(now);
            return true;
        }
    }
}
