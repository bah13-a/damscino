package tn.damascino.privilege.qr;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tn.damascino.common.security.Secrets;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * Signed QR tokens: {@code DP1.<base64url(json)>.<base64url(HMAC-SHA256)>}. The signature prevents forging a code;
 * the short expiry and the single-use nonce make shared screenshots useless.
 */
@Component
public class QrTokenService {

    private static final String PREFIX = "DP1";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final byte[] key;
    private final ObjectMapper objectMapper;

    public QrTokenService(@Value("${damascino.qr.secret}") String secret, ObjectMapper objectMapper) {
        this.key = Secrets.deriveKey(secret);
        this.objectMapper = objectMapper;
    }

    public String sign(QrPayload payload) {
        ObjectNode json = objectMapper.createObjectNode()
                .put("b", payload.beneficiaryId().toString())
                .put("n", payload.nonce())
                .put("v", payload.sessionVersion())
                .put("e", payload.expiresAt().getEpochSecond());
        String body = ENCODER.encodeToString(json.toString().getBytes(StandardCharsets.UTF_8));
        String signed = PREFIX + "." + body;
        return signed + "." + ENCODER.encodeToString(hmac(signed));
    }

    /** @return the payload when the signature is valid (expiry is checked by the caller) */
    public Optional<QrPayload> read(String token) {
        if (token == null) {
            return Optional.empty();
        }
        String[] parts = token.trim().split("\\.");
        if (parts.length != 3 || !PREFIX.equals(parts[0])) {
            return Optional.empty();
        }
        try {
            byte[] expected = hmac(parts[0] + "." + parts[1]);
            if (!MessageDigest.isEqual(expected, DECODER.decode(parts[2]))) {
                return Optional.empty();
            }
            JsonNode json = objectMapper.readTree(DECODER.decode(parts[1]));
            return Optional.of(new QrPayload(
                    UUID.fromString(json.get("b").asText()),
                    json.get("n").asText(),
                    json.get("v").asLong(),
                    Instant.ofEpochSecond(json.get("e").asLong())));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private byte[] hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
