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
                               @Value("${damascino.sms.gateway.password:}") String password) {
        return switch (provider) {
            case "log" -> new LogSmsSender();
            case "android-gateway" -> new AndroidGatewaySmsSender(url, username, password);
            default -> throw new IllegalStateException("SMS_PROVIDER inconnu : " + provider + " (log ou android-gateway)");
        };
    }
}
