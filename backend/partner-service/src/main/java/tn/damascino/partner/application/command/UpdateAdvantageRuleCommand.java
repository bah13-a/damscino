package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.partner.application.query.PartnerView;
import tn.damascino.partner.domain.AdvantageRule;

import java.util.UUID;

public record UpdateAdvantageRuleCommand(AuthenticatedUser actor, UUID partnerId, AdvantageRule rule)
        implements Command<PartnerView> {
}
