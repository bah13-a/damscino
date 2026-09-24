package tn.damascino.privilege.application;

import org.springframework.stereotype.Component;
import tn.damascino.privilege.domain.RedemptionRepository;
import tn.damascino.privilege.pos.PosReservationRepository;

import java.time.Clock;
import java.util.UUID;

/**
 * Usages that count in the quota of a period: validated passages (not cancelled) plus advantages reserved by a
 * till for a ticket still open. Also tells whether a QR code was already consumed by one or the other.
 */
@Component
public class QuotaService {

    private static final UUID NONE = new UUID(0, 0);

    private final RedemptionRepository redemptions;
    private final PosReservationRepository reservations;
    private final Clock clock;

    public QuotaService(RedemptionRepository redemptions, PosReservationRepository reservations, Clock clock) {
        this.redemptions = redemptions;
        this.reservations = reservations;
        this.clock = clock;
    }

    public long used(UUID beneficiaryId, String periodKey) {
        return usedExcluding(beneficiaryId, periodKey, null);
    }

    /** @param excludedReservation reservation being re-previewed, which must not count against itself */
    public long usedExcluding(UUID beneficiaryId, String periodKey, UUID excludedReservation) {
        return redemptions.countActive(beneficiaryId, periodKey)
                + reservations.countPending(beneficiaryId, periodKey, clock.instant(),
                excludedReservation == null ? NONE : excludedReservation);
    }

    public boolean isNonceUsed(String nonce) {
        return redemptions.existsByQrNonce(nonce) || reservations.existsByQrNonce(nonce);
    }
}
