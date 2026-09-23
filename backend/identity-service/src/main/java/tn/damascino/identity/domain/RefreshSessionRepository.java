package tn.damascino.identity.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshSessionRepository extends JpaRepository<RefreshSession, UUID> {

    Optional<RefreshSession> findByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from RefreshSession s where s.accountId = :accountId")
    void deleteAllForAccount(UUID accountId);

    @Modifying
    @Query("delete from RefreshSession s where s.tokenHash = :tokenHash")
    void deleteByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from RefreshSession s where s.expiresAt < :now")
    int purgeExpired(Instant now);
}
