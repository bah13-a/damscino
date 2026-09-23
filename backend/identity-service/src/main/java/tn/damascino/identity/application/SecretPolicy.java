package tn.damascino.identity.application;

import tn.damascino.common.security.Role;
import tn.damascino.common.web.ApiException;

/** Password rules: 8 characters minimum; scanner staff use a 4 to 8 digit PIN. */
public final class SecretPolicy {

    private SecretPolicy() {
    }

    public static void check(Role role, String secret) {
        if (secret == null) {
            throw ApiException.badRequest("WEAK_PASSWORD", "Mot de passe requis");
        }
        if (role == Role.STAFF) {
            if (!secret.matches("\\d{4,8}")) {
                throw ApiException.badRequest("INVALID_PIN", "Le code PIN doit contenir 4 à 8 chiffres");
            }
            return;
        }
        if (secret.length() < 8) {
            throw ApiException.badRequest("WEAK_PASSWORD", "Le mot de passe doit contenir au moins 8 caractères");
        }
        if (secret.length() > 72) {
            throw ApiException.badRequest("WEAK_PASSWORD", "Le mot de passe est trop long (72 caractères maximum)");
        }
    }
}
