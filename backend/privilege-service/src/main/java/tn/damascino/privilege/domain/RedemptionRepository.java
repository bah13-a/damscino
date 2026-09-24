package tn.damascino.privilege.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface RedemptionRepository extends JpaRepository<Redemption, UUID> {

    /** Passages counting in the quota of the period (cancelled ones are excluded). */
    @Query("select count(r) from Redemption r where r.beneficiaryId = :beneficiaryId and r.periodKey = :periodKey and r.cancelledAt is null")
    long countActive(UUID beneficiaryId, String periodKey);

    boolean existsByQrNonce(String qrNonce);

    @Query("select r from Redemption r where r.beneficiaryId = :beneficiaryId and r.cancelledAt is null order by r.validatedAt desc")
    List<Redemption> findHistory(UUID beneficiaryId, Pageable pageable);
}
