package tn.damascino.identity.application.mail;

import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.io.UnsupportedEncodingException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

/** One SMTP delivery: STARTTLS on 587 (Gmail), SSL on 465. */
public final class SmtpMailer {

    public record Connection(String host, int port, String username, String password, String from, String fromName) {

        boolean usable() {
            return host != null && !host.isBlank() && from != null && !from.isBlank();
        }
    }

    private SmtpMailer() {
    }

    /** @return null when the message was accepted by the server, otherwise the reason in French */
    public static String send(Connection c, String to, String subject, String text) {
        if (!c.usable()) {
            return "Messagerie non configurée.";
        }
        JavaMailSenderImpl mailer = new JavaMailSenderImpl();
        mailer.setHost(c.host());
        mailer.setPort(c.port());
        boolean auth = c.username() != null && !c.username().isBlank();
        if (auth) {
            mailer.setUsername(c.username());
            mailer.setPassword(c.password() == null ? "" : c.password());
        }
        mailer.setDefaultEncoding(StandardCharsets.UTF_8.name());
        Properties props = mailer.getJavaMailProperties();
        props.put("mail.smtp.auth", String.valueOf(auth));
        if (c.port() == 465) {
            props.put("mail.smtp.ssl.enable", "true");
        } else {
            props.put("mail.smtp.starttls.enable", "true");
        }
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");
        try {
            MimeMessage message = mailer.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setFrom(new InternetAddress(c.from(), c.fromName(), StandardCharsets.UTF_8.name()));
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, false);
            mailer.send(message);
            return null;
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            return reason(e);
        }
    }

    static String reason(Exception e) {
        if (e instanceof MailAuthenticationException || hasCause(e, AuthenticationFailedException.class)) {
            return "Adresse ou mot de passe refusés par le serveur de messagerie. Avec Gmail, utilisez un mot de passe "
                    + "d'application (16 lettres) et activez la validation en deux étapes.";
        }
        if (hasCause(e, UnknownHostException.class)) {
            return "Serveur de messagerie introuvable : vérifiez son adresse.";
        }
        if (hasCause(e, ConnectException.class) || hasCause(e, SocketTimeoutException.class)) {
            return "Serveur de messagerie injoignable : vérifiez l'adresse et le port (587 ou 465).";
        }
        if (e instanceof MailSendException || hasCause(e, jakarta.mail.SendFailedException.class)) {
            return "Le serveur de messagerie a refusé l'envoi : " + rootMessage(e);
        }
        return "Envoi impossible : " + rootMessage(e);
    }

    private static boolean hasCause(Throwable e, Class<? extends Throwable> type) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (type.isInstance(t)) {
                return true;
            }
            if (t instanceof MailSendException send) {
                for (Exception failed : send.getFailedMessages().values()) {
                    if (failed != t && hasCause(failed, type)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
        }
        return t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage().trim();
    }
}
