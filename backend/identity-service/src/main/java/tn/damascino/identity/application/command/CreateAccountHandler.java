package tn.damascino.identity.application.command;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.AuditRecorded;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.Role;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.SecretPolicy;
import tn.damascino.identity.application.query.AccountView;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;

@Component
public class CreateAccountHandler implements CommandHandler<CreateAccountCommand, AccountView> {

    private final AccountRepository accounts;
    private final PasswordEncoder passwordEncoder;
    private final EventPublisher events;
    private final Clock clock;

    public CreateAccountHandler(AccountRepository accounts, PasswordEncoder passwordEncoder, EventPublisher events,
                                Clock clock) {
        this.accounts = accounts;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
        this.clock = clock;
    }

    @Override
    @Transactional
    public AccountView handle(CreateAccountCommand command) {
        if (command.role() == null || command.role() == Role.BENEFICIARY) {
            throw ApiException.badRequest("INVALID_ROLE",
                    "Les comptes bénéficiaires sont créés par l'import des listes partenaires");
        }
        String username = normalizeStaffUsername(command.username());
        if (accounts.existsByUsername(username)) {
            throw ApiException.conflict("USERNAME_TAKEN", "Cet identifiant est déjà utilisé");
        }
        SecretPolicy.check(command.role(), command.secret());
        String displayName = command.displayName() == null || command.displayName().isBlank()
                ? username : command.displayName().trim();

        Instant now = clock.instant();
        Account account = accounts.save(Account.staff(command.role(), username, displayName,
                passwordEncoder.encode(command.secret()), now));
        events.publish(new AuditRecorded(command.actor().accountId(), command.actor().displayName(),
                "ACCOUNT_CREATED", "ACCOUNT", account.getId().toString(),
                command.role() + " " + username, now));
        return AccountView.of(account, now);
    }

    static String normalizeStaffUsername(String raw) {
        String username = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        // staff logins must not look like a phone number, which is reserved for beneficiaries
        if (!username.matches("[a-z][a-z0-9._-]{2,49}")) {
            throw ApiException.badRequest("INVALID_USERNAME",
                    "Identifiant invalide : 3 à 50 caractères, commençant par une lettre (lettres, chiffres, . _ -)");
        }
        return username;
    }
}
