package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.partner.application.query.PartnerView;
import tn.damascino.partner.domain.AdvantageRule;
import tn.damascino.partner.domain.PartnerProfile;

import java.util.UUID;

/**
 * Creates ({@code partnerId} null) or updates a partner. {@code rule} null keeps the current rule, or applies the
 * V1 default rule on creation.
 */
public record SavePartnerCommand(AuthenticatedUser actor, UUID partnerId, PartnerProfile profile, AdvantageRule rule)
        implements Command<PartnerView> {
}
