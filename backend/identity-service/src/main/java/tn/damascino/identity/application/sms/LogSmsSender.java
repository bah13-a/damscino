package tn.damascino.identity.application.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Test environment: nothing is sent, the message is written to the service log. */
public class LogSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(LogSmsSender.class);

    @Override
    public void send(String phone, String text) {
        log.info("SMS (simulé) vers {} : {}", phone, text);
    }

    @Override
    public boolean simulated() {
        return true;
    }
}
