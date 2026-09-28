package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.identity.application.AuthResult;

public record VerifySmsCodeCommand(String phone, String code, String userAgent) implements Command<AuthResult> {
}
