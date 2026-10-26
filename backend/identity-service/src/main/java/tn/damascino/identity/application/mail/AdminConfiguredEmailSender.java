package tn.damascino.identity.application.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tn.damascino.identity.domain.MailSettings;
import tn.damascino.identity.domain.MailSettingsRepository;

import java.util.Optional;

/**
 * Sends with the e-mail account entered in Administration → Messagerie when there is one (read at every
 * sending: a change applies at once, without restart), otherwise with the server configuration.
 */
public class AdminConfiguredEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(AdminConfiguredEmailSender.class);

    private final MailSettingsRepository settings;
    private final MailSettingsVault vault;
    private final EmailSender serverConfiguration;
    private final String fromName;

    public AdminConfiguredEmailSender(MailSettingsRepository settings, MailSettingsVault vault,
                                      EmailSender serverConfiguration, String fromName) {
        this.settings = settings;
        this.vault = vault;
        this.serverConfiguration = serverConfiguration;
        this.fromName = fromName;
    }

    @Override
    public boolean send(String to, String subject, String text) {
        Optional<MailSettings> saved = settings.current();
        if (saved.isEmpty()) {
            return serverConfiguration.send(to, subject, text);
        }
        MailSettings s = saved.get();
        Optional<String> password = vault.decrypt(s.getPasswordCipher());
        if (password.isEmpty()) {
            log.warn("E-mail non envoyé vers {} : mot de passe illisible (secret du serveur changé), "
                    + "ressaisissez-le dans Administration → Messagerie", to);
            return false;
        }
        String failure = SmtpMailer.send(connection(s, password.get()), to, subject, text);
        if (failure != null) {
            log.warn("Envoi e-mail impossible vers {} : {}", to, failure);
        }
        return failure == null;
    }

    @Override
    public boolean simulated() {
        return settings.current().isEmpty() && serverConfiguration.simulated();
    }

    SmtpMailer.Connection connection(MailSettings s, String password) {
        return new SmtpMailer.Connection(s.getHost(), s.getPort(), s.getUsername(), password, s.getFromAddress(), fromName);
    }
}
