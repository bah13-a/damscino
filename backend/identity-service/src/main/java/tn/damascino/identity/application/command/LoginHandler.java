package tn.damascino.identity.application.command;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.BeneficiarySessionChanged;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.Role;
import tn.damascino.common.util.PhoneNumbers;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.AuthResult;
import tn.damascino.identity.application.TokenIssuer;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.RefreshSessionRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Component
public class LoginHandler implements CommandHandler<LoginCommand, AuthResult> {

    private final AccountRepository accounts;
    private final RefreshSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final TokenIssuer tokenIssuer;
    private final EventPublisher events;
    private final Clock clock;
    private final int maxAttempts;
    private final Duration lockDuration;
    /** Hash compared when the account does not exist, so that response time does not reveal valid logins. */
    private final String dummyHash;

    public LoginHandler(AccountRepository accounts, RefreshSessionRepository sessions, PasswordEncoder passwordEncoder,
                        TokenIssuer tokenIssuer, EventPublisher events, Clock clock,
                        @Value("${damascino.lockout.max-attempts}") int maxAttempts,
                        @Value("${damascino.lockout.duration}") Duration lockDuration) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.tokenIssuer = tokenIssuer;
        this.events = events;
        this.clock = clock;
        this.maxAttempts = maxAttempts;
        this.lockDuration = lockDuration;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Override
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResult handle(LoginCommand command) {
        Instant now = clock.instant();
        String username = command.space() == Role.BENEFICIARY
                ? PhoneNumbers.normalize(command.username())
                : command.username() == null ? null : command.username().trim().toLowerCase(Locale.ROOT);
        String password = command.password() == null ? "" : command.password();

        Account account = accounts.findByUsername(username).filter(a -> a.getRole() == command.space()).orElse(null);
        if (account == null) {
            passwordEncoder.matches(password, dummyHash);
            throw invalidCredentials();
        }
        if (account.isLocked(now)) {
            throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
                    "Compte temporairement bloqué après plusieurs tentatives. Réessayez dans quelques minutes.");
        }
        if (!passwordEncoder.matches(password, account.getPasswordHash())) {
            account.registerFailedLogin(now, maxAttempts, lockDuration);
            throw invalidCredentials();
        }
        if (!account.isActive()) {
            throw ApiException.forbidden("ACCOUNT_DISABLED", "Ce compte est désactivé. Contactez Damascino.");
        }

        account.registerSuccessfulLogin(now);
        if (account.getRole() == Role.BENEFICIARY) {
            sessions.deleteAllForAccount(account.getId());
            events.publish(new BeneficiarySessionChanged(account.getBeneficiaryId(), account.getSessionVersion()));
        }
        return tokenIssuer.open(account, command.userAgent());
    }

    private static ApiException invalidCredentials() {
        return ApiException.unauthorized("INVALID_CREDENTIALS", "Identifiant ou mot de passe incorrect");
    }
}
