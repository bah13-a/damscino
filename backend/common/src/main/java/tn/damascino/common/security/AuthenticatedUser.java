package tn.damascino.common.security;

import java.util.UUID;

/** Identity carried by the access token and exposed as the Spring Security principal. */
public record AuthenticatedUser(
        UUID accountId,
        Role role,
        String displayName,
        UUID beneficiaryId,
        long sessionVersion,
        boolean passwordChangeRequired) {
}
