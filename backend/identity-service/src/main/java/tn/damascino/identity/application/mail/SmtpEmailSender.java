package tn.damascino.identity.application.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Sends through the SMTP server of the server configuration (MAIL_* variables), e.g. a free Gmail account
 * (smtp.gmail.com, ~500 e-mails a day) with an application password. Port 587 with STARTTLS, or 465 with SSL.
 */
public class SmtpEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailSender.class);

    private final SmtpMailer.Connection connection;

    public SmtpEmailSender(String host, int port, String username, String password, String from, String fromName) {
        String sender = from == null || from.isBlank() ? username : from.trim();
        // an account address without its password (entered later in Administration → Messagerie) is not usable yet
        boolean missingPassword = username != null && !username.isBlank() && (password == null || password.isBlank());
        this.connection = new SmtpMailer.Connection(missingPassword ? null : host, port, username, password, sender, fromName);
        // the service starts without settings (first installation): the code then leaves by SMS
        if (!connection.usable()) {
            log.warn("E-mail non configuré : Administration → Messagerie, ou variables MAIL_* (docs/SMS.md)");
        }
    }

    @Override
    public boolean send(String to, String subject, String text) {
        if (!connection.usable()) {
            log.warn("E-mail non envoyé vers {} : messagerie non configurée", to);
            return false;
        }
        String failure = SmtpMailer.send(connection, to, subject, text);
        if (failure != null) {
            log.warn("Envoi e-mail impossible vers {} : {}", to, failure);
        }
        return failure == null;
    }
}
