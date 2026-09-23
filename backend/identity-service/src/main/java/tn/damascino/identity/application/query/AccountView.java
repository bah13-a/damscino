package tn.damascino.identity.application.query;

import tn.damascino.common.security.Role;
import tn.damascino.identity.domain.Account;

import java.time.Instant;
import java.util.UUID;

public record AccountView(
        UUID id,
        String username,
        String displayName,
        Role role,
        boolean active,
        boolean locked,
        boolean mustChangePassword,
        Instant lastLoginAt,
        Instant createdAt) {

    public static AccountView of(Account account, Instant now) {
        return new AccountView(account.getId(), account.getUsername(), account.getDisplayName(), account.getRole(),
                account.isActive(), account.isLocked(now), account.isMustChangePassword(), account.getLastLoginAt(),
                account.getCreatedAt());
    }
}
