package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.partner.application.IssuedCredentials;

import java.util.UUID;

/** Manual addition of one beneficiary; returns the generated access. */
public record CreateBeneficiaryCommand(AuthenticatedUser actor, UUID partnerId, String firstName, String lastName,
                                       String phone, String email) implements Command<IssuedCredentials> {
}
