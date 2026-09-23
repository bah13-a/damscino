package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.partner.application.query.BeneficiaryView;

import java.util.UUID;

public record SetBeneficiaryActiveCommand(AuthenticatedUser actor, UUID beneficiaryId, boolean active)
        implements Command<BeneficiaryView> {
}
