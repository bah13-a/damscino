package tn.damascino.identity.application.mail;

/** Delivers an e-mail. The provider is chosen with {@code damascino.mail.provider}. */
public interface EmailSender {

    /** @return false when the address could not be reached (the cause is logged), never throws */
    boolean send(String to, String subject, String text);

    /** True when no real e-mail leaves the server (test environment). */
    default boolean simulated() {
        return false;
    }
}
