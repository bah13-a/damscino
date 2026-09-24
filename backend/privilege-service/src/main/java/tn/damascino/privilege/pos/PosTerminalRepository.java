package tn.damascino.privilege.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PosTerminalRepository extends JpaRepository<PosTerminal, UUID> {

    Optional<PosTerminal> findByKeyHash(String keyHash);

    boolean existsByNameIgnoreCase(String name);

    List<PosTerminal> findAllByOrderByNameAsc();

    @Transactional
    @Modifying
    @Query("update PosTerminal t set t.lastUsedAt = :when where t.id = :id")
    void touch(UUID id, Instant when);
}
