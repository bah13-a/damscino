package tn.damascino.privilege.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RedemptionRepository extends JpaRepository<Redemption, UUID> {

    long countByBeneficiaryIdAndPeriodKey(UUID beneficiaryId, String periodKey);

    boolean existsByQrNonce(String qrNonce);

    List<Redemption> findByBeneficiaryIdOrderByValidatedAtDesc(UUID beneficiaryId, Pageable pageable);
}
