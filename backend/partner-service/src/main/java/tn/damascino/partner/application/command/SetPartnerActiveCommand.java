package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.partner.application.query.PartnerView;

import java.util.UUID;

public record SetPartnerActiveCommand(AuthenticatedUser actor, UUID partnerId, boolean active)
        implements Command<PartnerView> {
}
