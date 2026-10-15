package tn.damascino.identity.application.sms;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SmsConfig {

    @Bean
    public SmsSender smsSender(@Value("${damascino.sms.provider}") String provider,
                               @Value("${damascino.sms.gateway.url:}") String url,
                               @Value("${damascino.sms.gateway.username:}") String username,
                               @Value("${damascino.sms.gateway.password:}") String password,
                               @Value("${damascino.sms.twilio.api-url:}") String twilioUrl,
                               @Value("${damascino.sms.twilio.account-sid:}") String twilioSid,
                               @Value("${damascino.sms.twilio.auth-token:}") String twilioToken,
                               @Value("${damascino.sms.twilio.from:}") String twilioFrom,
                               @Value("${damascino.sms.twilio.messaging-service-sid:}") String twilioService) {
        return switch (provider) {
            case "log" -> new LogSmsSender();
            case "android-gateway" -> new AndroidGatewaySmsSender(url, username, password);
            case "twilio" -> new TwilioSmsSender(twilioUrl, twilioSid, twilioToken, twilioFrom, twilioService);
            default -> throw new IllegalStateException(
                    "SMS_PROVIDER inconnu : " + provider + " (log, android-gateway ou twilio)");
        };
    }
}
