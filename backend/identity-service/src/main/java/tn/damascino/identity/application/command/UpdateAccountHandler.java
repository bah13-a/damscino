package tn.damascino.identity.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.AuditRecorded;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.Role;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.query.AccountView;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.RefreshSessionRepository;

import java.time.Clock;
import java.time.Instant;

@Component
public class UpdateAccountHandler implements CommandHandler<UpdateAccountCommand, AccountView> {

    private final AccountRepository accounts;
    private final RefreshSessionRepository sessions;
    private final EventPublisher events;
    private final Clock clock;

    public UpdateAccountHandler(AccountRepository accounts, RefreshSessionRepository sessions, EventPublisher events,
                                Clock clock) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.events = events;
        this.clock = clock;
    }

    @Override
    @Transactional
    public AccountView handle(UpdateAccountCommand command) {
        Account account = accounts.findById(command.accountId())
                .filter(a -> a.getRole() != Role.BENEFICIARY)
                .orElseThrow(() -> ApiException.notFound("Compte"));
        if (command.displayName() != null && !command.displayName().isBlank()) {
            account.rename(command.displayName().trim());
        }
        if (command.active() != null) {
            if (!command.active() && account.getId().equals(command.actor().accountId())) {
                throw ApiException.badRequest("SELF_DEACTIVATION", "Vous ne pouvez pas désactiver votre propre compte");
            }
            account.setActive(command.active());
            if (!command.active()) {
                sessions.deleteAllForAccount(account.getId());
            }
        }
        Instant now = clock.instant();
        events.publish(new AuditRecorded(command.actor().accountId(), command.actor().displayName(),
                "ACCOUNT_UPDATED", "ACCOUNT", account.getId().toString(),
                account.getUsername() + (account.isActive() ? " actif" : " désactivé"), now));
        return AccountView.of(account, now);
    }
}
