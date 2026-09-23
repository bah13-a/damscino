package tn.damascino.identity.application;

import tn.damascino.common.security.Role;

import java.util.UUID;

public record AuthResult(
        String accessToken,
        String refreshToken,
        long expiresIn,
        UUID accountId,
        Role role,
        String displayName,
        boolean mustChangePassword) {
}
