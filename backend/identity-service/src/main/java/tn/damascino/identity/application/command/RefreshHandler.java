package tn.damascino.identity.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.security.Secrets;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.AuthResult;
import tn.damascino.identity.application.TokenIssuer;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.RefreshSession;
import tn.damascino.identity.domain.RefreshSessionRepository;

import java.time.Clock;

/** Rotates the refresh token. Fails once the session was replaced by a login on another device. */
@Component
public class RefreshHandler implements CommandHandler<RefreshCommand, AuthResult> {

    private final RefreshSessionRepository sessions;
    private final AccountRepository accounts;
    private final TokenIssuer tokenIssuer;
    private final Clock clock;

    public RefreshHandler(RefreshSessionRepository sessions, AccountRepository accounts, TokenIssuer tokenIssuer,
                          Clock clock) {
        this.sessions = sessions;
        this.accounts = accounts;
        this.tokenIssuer = tokenIssuer;
        this.clock = clock;
    }

    @Override
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResult handle(RefreshCommand command) {
        if (command.refreshToken() == null || command.refreshToken().isBlank()) {
            throw sessionExpired();
        }
        RefreshSession session = sessions.findByTokenHash(Secrets.sha256Hex(command.refreshToken()))
                .orElseThrow(RefreshHandler::sessionExpired);
        sessions.delete(session);
        if (session.isExpired(clock.instant())) {
            throw sessionExpired();
        }
        Account account = accounts.findById(session.getAccountId())
                .filter(Account::isActive)
                .orElseThrow(RefreshHandler::sessionExpired);
        return tokenIssuer.open(account, command.userAgent());
    }

    private static ApiException sessionExpired() {
        return ApiException.unauthorized("SESSION_EXPIRED", "Session expirée, veuillez vous reconnecter");
    }
}
