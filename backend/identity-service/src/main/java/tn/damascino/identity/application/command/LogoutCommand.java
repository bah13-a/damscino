package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;

public record LogoutCommand(String refreshToken) implements Command<Void> {
}
