package tn.damascino.identity.application.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Test environment: nothing is sent, the message is written to the service log. */
public class LogEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LogEmailSender.class);

    @Override
    public boolean send(String to, String subject, String text) {
        log.info("E-mail (simulé) vers {} : {} — {}", to, subject, text);
        return true;
    }

    @Override
    public boolean simulated() {
        return true;
    }
}
