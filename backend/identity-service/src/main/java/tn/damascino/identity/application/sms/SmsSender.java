package tn.damascino.identity.application.sms;

/** Delivers a text message. The provider is chosen with {@code damascino.sms.provider}. */
public interface SmsSender {

    /** @param phone international format, e.g. +21698123456 */
    void send(String phone, String text);

    /** True when no real SMS leaves the server (test environment): the code may be shown in the app instead. */
    default boolean simulated() {
        return false;
    }
}
