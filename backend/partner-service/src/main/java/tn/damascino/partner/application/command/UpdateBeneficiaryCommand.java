package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.partner.application.query.BeneficiaryView;

import java.util.UUID;

public record UpdateBeneficiaryCommand(AuthenticatedUser actor, UUID beneficiaryId, UUID partnerId, String firstName,
                                       String lastName, String phone, String email) implements Command<BeneficiaryView> {
}
