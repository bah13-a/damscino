package tn.damascino.common.web;

import java.util.regex.Pattern;

/**
 * Input hygiene shared by every service. The frontend never renders data as HTML (React escapes it), but names and
 * labels also end up in Excel/CSV exports, logs and possibly e-mails: markup and script URLs are refused at the
 * entrance rather than trusted to be escaped everywhere.
 */
public final class SafeText {

    /** An HTML tag, comment or declaration opening ({@code <b}, {@code </}, {@code <!}, {@code <?}) or a script URL. */
    private static final Pattern MARKUP =
            Pattern.compile("<\\s*[a-zA-Z/!?]|(?:javascript|vbscript|data\\s*:\\s*text/html)\\s*:?", Pattern.CASE_INSENSITIVE);
    /** Control characters (except tab and line breaks) and bidirectional overrides used to disguise text. */
    private static final Pattern INVISIBLE = Pattern.compile("[\\p{Cc}&&[^\\t\\n\\r]]|[\\u202A-\\u202E\\u2066-\\u2069\\u200B\\uFEFF]");
    /** Fields that are compared byte for byte (passwords, PIN, tokens, keys): never altered nor inspected. */
    private static final Pattern SECRET_FIELD = Pattern.compile("(?i).*password|secret|.*token|pin|pinCode|apiKey");

    public static final String MESSAGE = "Contenu non autorisé (balises HTML ou script)";

    private SafeText() {
    }

    public static boolean isSecretField(String field) {
        return field != null && SECRET_FIELD.matcher(field).matches();
    }

    public static boolean containsMarkup(String value) {
        return value != null && MARKUP.matcher(value).find();
    }

    public static String stripInvisible(String value) {
        return value == null ? null : INVISIBLE.matcher(value).replaceAll("");
    }

    /** Refused by the JSON reader: reported as a validation error on {@link #field()}. */
    public static class UnsafeTextException extends RuntimeException {
        private final String field;

        public UnsafeTextException(String field) {
            super(MESSAGE);
            this.field = field;
        }

        public String field() {
            return field;
        }
    }
}
