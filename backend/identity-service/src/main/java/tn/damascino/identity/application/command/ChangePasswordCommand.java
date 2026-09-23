package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.identity.application.AuthResult;

import java.util.UUID;

public record ChangePasswordCommand(UUID accountId, String currentPassword, String newPassword, String userAgent)
        implements Command<AuthResult> {
}
