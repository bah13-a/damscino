package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.identity.application.AuthResult;

public record RefreshCommand(String refreshToken, String userAgent) implements Command<AuthResult> {
}
