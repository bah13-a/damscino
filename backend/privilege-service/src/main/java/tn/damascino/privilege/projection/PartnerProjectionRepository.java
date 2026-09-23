package tn.damascino.privilege.projection;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PartnerProjectionRepository extends JpaRepository<PartnerProjection, UUID> {
}
