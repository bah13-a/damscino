package tn.damascino.identity.application.command;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.AccountActivated;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.Role;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.AuthResult;
import tn.damascino.identity.application.SecretPolicy;
import tn.damascino.identity.application.TokenIssuer;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.RefreshSessionRepository;

import java.time.Clock;
import java.time.Instant;

/** Changes the password (mandatory at first login) and reopens a fresh session on the current device. */
@Component
public class ChangePasswordHandler implements CommandHandler<ChangePasswordCommand, AuthResult> {

    private final AccountRepository accounts;
    private final RefreshSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final TokenIssuer tokenIssuer;
    private final EventPublisher events;
    private final Clock clock;

    public ChangePasswordHandler(AccountRepository accounts, RefreshSessionRepository sessions,
                                 PasswordEncoder passwordEncoder, TokenIssuer tokenIssuer, EventPublisher events,
                                 Clock clock) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.tokenIssuer = tokenIssuer;
        this.events = events;
        this.clock = clock;
    }

    @Override
    @Transactional
    public AuthResult handle(ChangePasswordCommand command) {
        Account account = accounts.findById(command.accountId())
                .filter(Account::isActive)
                .orElseThrow(() -> ApiException.unauthorized("UNAUTHENTICATED", "Authentification requise"));
        if (command.currentPassword() == null
                || !passwordEncoder.matches(command.currentPassword(), account.getPasswordHash())) {
            throw ApiException.badRequest("INVALID_CURRENT_PASSWORD", "Mot de passe actuel incorrect");
        }
        SecretPolicy.check(account.getRole(), command.newPassword());
        if (command.newPassword().equals(command.currentPassword())) {
            throw ApiException.badRequest("SAME_PASSWORD", "Le nouveau mot de passe doit être différent de l'actuel");
        }

        Instant now = clock.instant();
        boolean firstActivation = account.changePassword(passwordEncoder.encode(command.newPassword()), now);
        if (account.getRole() == Role.BENEFICIARY) {
            sessions.deleteAllForAccount(account.getId());
        }
        if (firstActivation) {
            events.publish(new AccountActivated(account.getId(), account.getBeneficiaryId(), now));
        }
        return tokenIssuer.open(account, command.userAgent());
    }
}
