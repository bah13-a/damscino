package tn.damascino.identity.application.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

/**
 * Sends through any SMTP server, e.g. a free Gmail account (smtp.gmail.com, ~500 e-mails a day) with an application
 * password. Port 587 with STARTTLS, or 465 with SSL.
 */
public class SmtpEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailSender.class);

    private final JavaMailSenderImpl mailer = new JavaMailSenderImpl();
    private final String from;
    private final String fromName;
    private final boolean configured;

    public SmtpEmailSender(String host, int port, String username, String password, String from, String fromName) {
        this.from = from == null || from.isBlank() ? username : from.trim();
        this.fromName = fromName;
        // the service starts without settings (first installation): the code then only leaves by SMS
        this.configured = host != null && !host.isBlank() && this.from != null && !this.from.isBlank();
        if (!configured) {
            log.warn("E-mail non configuré : renseigner MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD et MAIL_FROM (docs/SMS.md)");
        }
        mailer.setHost(host);
        mailer.setPort(port);
        mailer.setUsername(username == null || username.isBlank() ? null : username);
        mailer.setPassword(password == null || password.isBlank() ? null : password);
        mailer.setDefaultEncoding(StandardCharsets.UTF_8.name());
        Properties props = mailer.getJavaMailProperties();
        props.put("mail.smtp.auth", String.valueOf(username != null && !username.isBlank()));
        if (port == 465) {
            props.put("mail.smtp.ssl.enable", "true");
        } else {
            props.put("mail.smtp.starttls.enable", "true");
        }
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");
    }

    @Override
    public boolean send(String to, String subject, String text) {
        if (!configured) {
            log.warn("E-mail non envoyé vers {} : MAIL_HOST / MAIL_FROM manquants", to);
            return false;
        }
        try {
            MimeMessage message = mailer.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setFrom(new InternetAddress(from, fromName, StandardCharsets.UTF_8.name()));
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, false);
            mailer.send(message);
            return true;
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            log.warn("Envoi e-mail impossible vers {} : {}", to, e.getMessage());
            return false;
        }
    }
}
