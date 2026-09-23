package tn.damascino.privilege.qr;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class QrTokenServiceTest {

    private final QrTokenService service = new QrTokenService("test-secret-long-enough", new ObjectMapper());

    @Test
    void roundTripsASignedPayload() {
        QrPayload payload = new QrPayload(UUID.randomUUID(), "nonce-1", 3, Instant.parse("2026-09-23T10:00:40Z"));

        String token = service.sign(payload);

        assertThat(token).startsWith("DP1.");
        assertThat(service.read(token)).contains(payload);
    }

    @Test
    void rejectsTamperedOrForeignTokens() {
        String token = service.sign(new QrPayload(UUID.randomUUID(), "n", 1, Instant.now()));
        String[] parts = token.split("\\.");
        String forged = parts[0] + "." + parts[1].substring(0, parts[1].length() - 2) + "AA." + parts[2];

        assertThat(service.read(forged)).isEmpty();
        assertThat(new QrTokenService("another-secret-long-enough", new ObjectMapper()).read(token)).isEmpty();
        assertThat(service.read("hello")).isEmpty();
        assertThat(service.read(null)).isEmpty();
    }
}
