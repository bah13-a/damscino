package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.Role;
import tn.damascino.identity.application.AuthResult;

/** @param space the application space the user is signing into (bénéficiaire, scanner or administration) */
public record LoginCommand(String username, String password, Role space, String userAgent) implements Command<AuthResult> {
}
