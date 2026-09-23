package tn.damascino.privilege.qr;

import java.time.Instant;
import java.util.UUID;

/**
 * Content of a dynamic QR code.
 *
 * @param beneficiaryId  account holder
 * @param nonce          single-use identifier of this code
 * @param sessionVersion session that generated it (a login on another device revokes it)
 * @param expiresAt      end of validity (renewed every 30 s by the screen)
 */
public record QrPayload(UUID beneficiaryId, String nonce, long sessionVersion, Instant expiresAt) {
}
