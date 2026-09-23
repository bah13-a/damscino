package tn.damascino.partner.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BeneficiaryRepository extends JpaRepository<Beneficiary, UUID>, JpaSpecificationExecutor<Beneficiary> {

    Optional<Beneficiary> findByPhone(String phone);

    List<Beneficiary> findByPhoneIn(Collection<String> phones);

    List<Beneficiary> findByPartnerIdOrderByLastNameAscFirstNameAsc(UUID partnerId);

    /** [partnerId, total, activated] */
    @Query("""
            select b.partnerId, count(b), sum(case when b.activatedAt is not null then 1 else 0 end)
            from Beneficiary b group by b.partnerId
            """)
    List<Object[]> countByPartner();
}
