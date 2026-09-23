package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;

import java.util.UUID;

public record ResetAccountSecretCommand(AuthenticatedUser actor, UUID accountId, String secret) implements Command<Void> {
}
