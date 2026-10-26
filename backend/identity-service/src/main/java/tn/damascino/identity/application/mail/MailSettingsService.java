package tn.damascino.identity.application.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.events.AuditRecorded;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.util.Emails;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.domain.MailSettings;
import tn.damascino.identity.domain.MailSettingsRepository;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

/** Administration → Messagerie: the e-mail account that sends the activation codes. */
@Service
public class MailSettingsService {

    public enum Source { ADMIN, SERVER, NONE }

    /** The password is never returned, only whether one is saved. */
    public record View(Source source, String host, int port, String username, String fromAddress,
                       boolean passwordSet, Instant updatedAt, String updatedBy) {
    }

    /** @param password empty to keep the saved one */
    public record Form(String host, Integer port, String username, String password, String fromAddress) {
    }

    private final MailSettingsRepository settings;
    private final MailSettingsVault vault;
    private final EventPublisher events;
    private final Clock clock;
    private final boolean serverConfigured;
    private final String fromName;

    public MailSettingsService(MailSettingsRepository settings, MailSettingsVault vault, EventPublisher events,
                               Clock clock,
                               @Value("${damascino.mail.provider}") String provider,
                               @Value("${damascino.mail.host:}") String host,
                               @Value("${damascino.mail.username:}") String username,
                               @Value("${damascino.mail.from:}") String from,
                               @Value("${damascino.mail.from-name:Damascino Privilèges}") String fromName) {
        this.settings = settings;
        this.vault = vault;
        this.events = events;
        this.clock = clock;
        this.serverConfigured = "smtp".equals(provider) && !host.isBlank() && !(username + from).isBlank();
        this.fromName = fromName;
    }

    @Transactional(readOnly = true)
    public View view() {
        return settings.current()
                .map(s -> new View(Source.ADMIN, s.getHost(), s.getPort(), s.getUsername(), s.getFromAddress(), true,
                        s.getUpdatedAt(), s.getUpdatedBy()))
                .orElseGet(() -> new View(serverConfigured ? Source.SERVER : Source.NONE, "smtp.gmail.com", 587, "",
                        "", false, null, null));
    }

    @Transactional
    public View save(AuthenticatedUser actor, Form form) {
        Optional<MailSettings> saved = settings.current();
        Validated v = validate(form, saved);
        String cipher = v.passwordChanged ? vault.encrypt(v.connection.password()) : saved.orElseThrow().getPasswordCipher();
        Instant now = clock.instant();
        MailSettings s = saved.orElse(null);
        if (s == null) {
            s = new MailSettings(v.connection.host(), v.connection.port(), v.connection.username(), cipher,
                    v.connection.from(), actor.displayName(), now);
        } else {
            s.update(v.connection.host(), v.connection.port(), v.connection.username(), cipher, v.connection.from(),
                    actor.displayName(), now);
        }
        settings.save(s);
        audit(actor, "MAIL_SETTINGS_UPDATED", v.connection.username() + " via " + v.connection.host());
        return view();
    }

    /** Sends a test e-mail with the values of the form (saved password if left empty), without saving them. */
    @Transactional(readOnly = true)
    public void test(Form form, String to) {
        String recipient = Emails.normalize(to);
        if (recipient == null || !Emails.isValidOrEmpty(recipient)) {
            throw ApiException.badRequest("INVALID_EMAIL", "Adresse du destinataire du test invalide");
        }
        Validated v = validate(form, settings.current());
        String failure = SmtpMailer.send(v.connection, recipient, "Test Damascino Privilèges",
                "Bonjour,\n\nLa messagerie de Damascino Privilèges fonctionne : les codes d'activation des "
                        + "bénéficiaires seront envoyés depuis " + v.connection.from() + ".\n\nDamascino");
        if (failure != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MAIL_TEST_FAILED", failure);
        }
    }

    @Transactional
    public View reset(AuthenticatedUser actor) {
        settings.current().ifPresent(s -> {
            settings.delete(s);
            audit(actor, "MAIL_SETTINGS_RESET", s.getUsername());
        });
        return view();
    }

    private record Validated(SmtpMailer.Connection connection, boolean passwordChanged) {
    }

    private Validated validate(Form form, Optional<MailSettings> saved) {
        String host = form.host() == null || form.host().isBlank() ? "smtp.gmail.com" : form.host().trim().toLowerCase(Locale.ROOT);
        if (!host.matches("[a-z0-9.-]+")) {
            throw ApiException.badRequest("INVALID_HOST", "Adresse du serveur de messagerie invalide");
        }
        int port = form.port() == null ? 587 : form.port();
        if (port < 1 || port > 65535) {
            throw ApiException.badRequest("INVALID_PORT", "Port invalide (587 ou 465)");
        }
        String username = Emails.normalize(form.username());
        if (username == null || !Emails.isValidOrEmpty(username)) {
            throw ApiException.badRequest("INVALID_EMAIL", "Adresse e-mail du compte invalide");
        }
        String from = form.fromAddress() == null || form.fromAddress().isBlank() ? username : Emails.normalize(form.fromAddress());
        if (!Emails.isValidOrEmpty(from)) {
            throw ApiException.badRequest("INVALID_EMAIL", "Adresse d'expédition invalide");
        }
        String password = form.password() == null ? "" : form.password();
        // Google shows application passwords in 4 groups of 4 letters
        if (host.endsWith("gmail.com")) {
            password = password.replace(" ", "");
        }
        boolean changed = !password.isEmpty();
        if (!changed) {
            password = saved.flatMap(s -> vault.decrypt(s.getPasswordCipher())).orElseThrow(() ->
                    ApiException.badRequest("PASSWORD_REQUIRED", "Saisissez le mot de passe de la messagerie"));
        }
        if (password.length() > 200) {
            throw ApiException.badRequest("INVALID_PASSWORD", "Mot de passe trop long");
        }
        return new Validated(new SmtpMailer.Connection(host, port, username, password, from, fromName), changed);
    }

    private void audit(AuthenticatedUser actor, String action, String details) {
        events.publish(new AuditRecorded(actor.accountId(), actor.displayName(), action, "MAIL_SETTINGS", "1",
                details, clock.instant()));
    }
}
