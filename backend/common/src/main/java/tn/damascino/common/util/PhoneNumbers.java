package tn.damascino.common.util;

/** Normalises Tunisian phone numbers used as beneficiary login (8 digits, without +216). */
public final class PhoneNumbers {

    private PhoneNumbers() {
    }

    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("\\D", "");
        if (digits.startsWith("00216")) {
            digits = digits.substring(5);
        } else if (digits.startsWith("216") && digits.length() == 11) {
            digits = digits.substring(3);
        }
        return digits;
    }

    public static boolean isValid(String normalized) {
        return normalized != null && normalized.matches("\\d{8}");
    }
}
