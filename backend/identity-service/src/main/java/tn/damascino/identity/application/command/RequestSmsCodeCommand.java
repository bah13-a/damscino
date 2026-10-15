package tn.damascino.identity.application.command;

import tn.damascino.common.cqrs.Command;

import java.util.UUID;

/** @param partnerId partner of the activation link the app was opened from, if any */
public record RequestSmsCodeCommand(String phone, UUID partnerId, String clientIp)
        implements Command<RequestSmsCodeCommand.Sent> {

    /**
     * @param smsSent     false when the SMS could not be sent (the code then only left by e-mail)
     * @param maskedEmail address the same code was sent to, null when none
     * @param devCode     the code itself, only in the test environment when nothing is really sent
     */
    public record Sent(String maskedPhone, long expiresIn, long resendIn, String devCode, boolean smsSent,
                       String maskedEmail) {
    }
}
