package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.security.Role;
import tn.damascino.identity.application.query.AccountView;

/** Creates an administrator or a scanner staff account (identifiant + mot de passe / code PIN). */
public record CreateAccountCommand(AuthenticatedUser actor, Role role, String username, String displayName, String secret)
        implements Command<AccountView> {
}
