package tn.damascino.privilege.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;

import java.time.Instant;

/** "Utiliser mon avantage": issues the dynamic QR code of the day for the connected beneficiary. */
public record GenerateQrCommand(AuthenticatedUser user) implements Command<GenerateQrCommand.QrCode> {

    public record QrCode(String token, Instant expiresAt, long refreshInSeconds, Instant serverTime) {
    }
}
