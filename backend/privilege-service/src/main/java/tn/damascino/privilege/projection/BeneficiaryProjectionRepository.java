package tn.damascino.privilege.projection;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface BeneficiaryProjectionRepository extends JpaRepository<BeneficiaryProjection, UUID> {

    /** Serialises concurrent validations of the same beneficiary (two cashiers scanning simultaneously). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from BeneficiaryProjection b where b.id = :id")
    Optional<BeneficiaryProjection> findForUpdate(UUID id);
}
