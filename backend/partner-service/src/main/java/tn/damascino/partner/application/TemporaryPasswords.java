package tn.damascino.partner.application;

import java.security.SecureRandom;

/** Generates readable temporary passwords (no 0/O, 1/l/I) of 10 characters with letters and digits. */
public final class TemporaryPasswords {

    private static final String LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
    private static final String DIGITS = "23456789";
    private static final String ALPHABET = LETTERS + DIGITS;
    private static final SecureRandom RANDOM = new SecureRandom();

    private TemporaryPasswords() {
    }

    public static String generate() {
        char[] password = new char[10];
        for (int i = 0; i < password.length; i++) {
            password[i] = ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length()));
        }
        // guarantee at least one letter and one digit
        password[RANDOM.nextInt(5)] = LETTERS.charAt(RANDOM.nextInt(LETTERS.length()));
        password[5 + RANDOM.nextInt(5)] = DIGITS.charAt(RANDOM.nextInt(DIGITS.length()));
        return new String(password);
    }
}
