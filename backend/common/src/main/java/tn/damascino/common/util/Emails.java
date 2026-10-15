package tn.damascino.common.util;

import java.util.Locale;
import java.util.regex.Pattern;

/** Optional e-mail address of a beneficiary: trimmed and lower-cased, empty means none. */
public final class Emails {

    private static final Pattern VALID = Pattern.compile("^[^\\s@<>\"]+@[^\\s@<>\"]+\\.[a-z]{2,}$");

    private Emails() {
    }

    /** @return the normalized address, or null when blank */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim().toLowerCase(Locale.ROOT);
    }

    /** True for null (no address) or a plausible address. */
    public static boolean isValidOrEmpty(String normalized) {
        return normalized == null || (normalized.length() <= 254 && VALID.matcher(normalized).matches());
    }

    /** a•••@example.com */
    public static String mask(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? "•••" + email.substring(Math.max(at, 0)) : email.charAt(0) + "•••" + email.substring(at);
    }
}
