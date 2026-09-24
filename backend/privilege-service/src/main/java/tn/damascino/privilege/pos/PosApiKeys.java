package tn.damascino.privilege.pos;

import tn.damascino.common.security.Secrets;

/** API keys of the tills: {@code dpk_<random>}; only the SHA-256 is stored, the key is shown once. */
public final class PosApiKeys {

    public static final String HEADER = "X-Api-Key";

    private PosApiKeys() {
    }

    public record NewKey(String key, String prefix, String hash) {
    }

    public static NewKey generate() {
        String key = "dpk_" + Secrets.randomToken(24);
        return new NewKey(key, key.substring(0, 12), Secrets.sha256Hex(key));
    }

    public static String hash(String key) {
        return Secrets.sha256Hex(key.trim());
    }
}
