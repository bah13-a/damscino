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
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.RefreshSessionRepository;

import java.time.Clock;

/** Administrator sets a new password / PIN for a staff or admin account and closes its sessions. */
@Component
public class ResetAccountSecretHandler implements CommandHandler<ResetAccountSecretCommand, Void> {

    private final AccountRepository accounts;
    private final RefreshSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final EventPublisher events;
    private final Clock clock;

    public ResetAccountSecretHandler(AccountRepository accounts, RefreshSessionRepository sessions,
                                     PasswordEncoder passwordEncoder, EventPublisher events, Clock clock) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
        this.clock = clock;
    }

    @Override
    @Transactional
    public Void handle(ResetAccountSecretCommand command) {
        Account account = accounts.findById(command.accountId())
                .filter(a -> a.getRole() != Role.BENEFICIARY)
                .orElseThrow(() -> ApiException.notFound("Compte"));
        SecretPolicy.check(account.getRole(), command.secret());
        account.resetSecret(passwordEncoder.encode(command.secret()));
        sessions.deleteAllForAccount(account.getId());
        events.publish(new AuditRecorded(command.actor().accountId(), command.actor().displayName(),
                "ACCOUNT_SECRET_RESET", "ACCOUNT", account.getId().toString(), account.getUsername(),
                clock.instant()));
        return null;
    }
}
