package tn.damascino.identity.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SmsCodeRepository extends JpaRepository<SmsCode, UUID> {

    Optional<SmsCode> findFirstByPhoneOrderByCreatedAtDesc(String phone);

    List<SmsCode> findByPhoneAndConsumedFalse(String phone);

    long countByPhoneAndCreatedAtAfter(String phone, Instant since);

    @Modifying
    @Query("delete from SmsCode c where c.createdAt < :before")
    int purgeOlderThan(Instant before);
}
