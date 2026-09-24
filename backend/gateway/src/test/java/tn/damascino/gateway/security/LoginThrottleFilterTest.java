package tn.damascino.gateway.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class LoginThrottleFilterTest {

    private static final class MovableClock extends Clock {
        Instant now = Instant.parse("2026-09-24T10:00:00Z");

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    void blocksAClientAfterTooManyFailuresUntilTheWindowSlides() {
        MovableClock clock = new MovableClock();
        LoginThrottleFilter throttle = new LoginThrottleFilter(3, Duration.ofMinutes(15), clock);

        for (int i = 0; i < 3; i++) {
            assertThat(throttle.isBlocked("10.0.0.1")).isFalse();
            throttle.recordFailure("10.0.0.1");
        }
        assertThat(throttle.isBlocked("10.0.0.1")).isTrue();
        assertThat(throttle.isBlocked("10.0.0.2")).as("other clients are not affected").isFalse();

        clock.now = clock.now.plus(Duration.ofMinutes(15));
        assertThat(throttle.isBlocked("10.0.0.1")).isFalse();
    }

    @Test
    void clientAddressIsTheOneReportedByTheEdgeProxy() {
        var forwarded = MockServerHttpRequest.post("/api/auth/login")
                .header("X-Forwarded-For", "41.226.1.2, 172.18.0.5").build();
        assertThat(LoginThrottleFilter.clientAddress(forwarded)).isEqualTo("41.226.1.2");
    }

    @Test
    void apiResponsesCarryHardeningHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Server", "netty");
        SecurityHeadersFilter.apply(headers);
        assertThat(headers.getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(headers.getFirst("X-Frame-Options")).isEqualTo("DENY");
        assertThat(headers.getFirst("Content-Security-Policy")).contains("default-src 'none'");
        assertThat(headers.getFirst("Cache-Control")).isEqualTo("no-store");
        assertThat(headers.containsKey("Server")).isFalse();
    }
}
