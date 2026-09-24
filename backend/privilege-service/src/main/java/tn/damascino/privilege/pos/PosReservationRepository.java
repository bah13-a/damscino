package tn.damascino.privilege.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PosReservationRepository extends JpaRepository<PosReservation, UUID> {

    boolean existsByQrNonce(String qrNonce);

    Optional<PosReservation> findByQrNonce(String qrNonce);

    /** The reservation still attached to a ticket (reserved or confirmed). */
    @Query("""
            select r from PosReservation r where r.terminalId = :terminalId and r.ticketId = :ticketId
            and r.status in (tn.damascino.privilege.pos.PosReservation.Status.RESERVED,
                             tn.damascino.privilege.pos.PosReservation.Status.CONFIRMED)
            """)
    Optional<PosReservation> findOpen(UUID terminalId, String ticketId);

    /** Reservations of open tickets that count in the quota of the period (confirmed ones are redemptions). */
    @Query("""
            select count(r) from PosReservation r where r.beneficiaryId = :beneficiaryId and r.periodKey = :periodKey
            and r.status = tn.damascino.privilege.pos.PosReservation.Status.RESERVED and r.reservedUntil > :now
            and r.id <> :excluded
            """)
    long countPending(UUID beneficiaryId, String periodKey, Instant now, UUID excluded);

    @Modifying
    @Query("""
            update PosReservation r set r.status = tn.damascino.privilege.pos.PosReservation.Status.EXPIRED,
            r.updatedAt = :now
            where r.status = tn.damascino.privilege.pos.PosReservation.Status.RESERVED and r.reservedUntil <= :now
            """)
    int expire(Instant now);
}
