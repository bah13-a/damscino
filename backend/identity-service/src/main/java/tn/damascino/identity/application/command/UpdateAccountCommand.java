package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.identity.application.query.AccountView;

import java.util.UUID;

public record UpdateAccountCommand(AuthenticatedUser actor, UUID accountId, String displayName, Boolean active)
        implements Command<AccountView> {
}
