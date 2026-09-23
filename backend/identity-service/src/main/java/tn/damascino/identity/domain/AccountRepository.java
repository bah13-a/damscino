package tn.damascino.identity.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.damascino.common.security.Role;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    Optional<Account> findByUsername(String username);

    Optional<Account> findByBeneficiaryId(UUID beneficiaryId);

    boolean existsByRole(Role role);

    boolean existsByUsername(String username);

    List<Account> findByRoleInOrderByDisplayNameAsc(List<Role> roles);
}
