package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;

public record DeleteCategoryCommand(AuthenticatedUser actor, String code) implements Command<Void> {
}
