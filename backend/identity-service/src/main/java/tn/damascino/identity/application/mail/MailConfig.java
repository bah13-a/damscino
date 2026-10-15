package tn.damascino.identity.application.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MailConfig {

    @Bean
    public EmailSender emailSender(@Value("${damascino.mail.provider}") String provider,
                                   @Value("${damascino.mail.host:}") String host,
                                   @Value("${damascino.mail.port:587}") int port,
                                   @Value("${damascino.mail.username:}") String username,
                                   @Value("${damascino.mail.password:}") String password,
                                   @Value("${damascino.mail.from:}") String from,
                                   @Value("${damascino.mail.from-name:Damascino Privilèges}") String fromName) {
        return switch (provider) {
            case "log" -> new LogEmailSender();
            case "smtp" -> new SmtpEmailSender(host, port, username, password, from, fromName);
            default -> throw new IllegalStateException("MAIL_PROVIDER inconnu : " + provider + " (log ou smtp)");
        };
    }
}
