package tn.damascino.identity.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.security.Secrets;
import tn.damascino.identity.domain.RefreshSessionRepository;

@Component
public class LogoutHandler implements CommandHandler<LogoutCommand, Void> {

    private final RefreshSessionRepository sessions;

    public LogoutHandler(RefreshSessionRepository sessions) {
        this.sessions = sessions;
    }

    @Override
    @Transactional
    public Void handle(LogoutCommand command) {
        if (command.refreshToken() != null && !command.refreshToken().isBlank()) {
            sessions.deleteByTokenHash(Secrets.sha256Hex(command.refreshToken()));
        }
        return null;
    }
}
