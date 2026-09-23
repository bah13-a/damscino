package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.application.query.PartnerView;
import tn.damascino.partner.domain.AdvantageRule;
import tn.damascino.partner.domain.Partner;
import tn.damascino.partner.domain.PartnerProfile;
import tn.damascino.partner.domain.PartnerRepository;

import java.time.Clock;
import java.time.Instant;

@Component
public class SavePartnerHandler implements CommandHandler<SavePartnerCommand, PartnerView> {

    private final PartnerRepository partners;
    private final PartnerCommandSupport support;
    private final EventPublisher events;
    private final Audit audit;
    private final Clock clock;

    public SavePartnerHandler(PartnerRepository partners, PartnerCommandSupport support, EventPublisher events,
                              Audit audit, Clock clock) {
        this.partners = partners;
        this.support = support;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional
    public PartnerView handle(SavePartnerCommand command) {
        PartnerProfile profile = command.profile();
        String name = PartnerCommandSupport.required(profile.name(), "Le nom du partenaire");
        if (profile.conventionStart() == null || profile.conventionEnd() == null) {
            throw ApiException.badRequest("MISSING_FIELD", "Les dates de début et de fin de convention sont obligatoires");
        }
        if (command.rule() != null) {
            support.checkCategoriesExist(command.rule());
        }
        Instant now = clock.instant();
        Partner partner;
        if (command.partnerId() == null) {
            if (partners.existsByNameIgnoreCase(name)) {
                throw ApiException.conflict("PARTNER_EXISTS", "Un partenaire porte déjà ce nom");
            }
            AdvantageRule rule = command.rule() == null ? AdvantageRule.defaultRule() : command.rule();
            partner = partners.save(new Partner(profile, rule, now));
            audit.record(command.actor(), "PARTNER_CREATED", "PARTNER", partner.getId(), name);
        } else {
            partner = support.partner(command.partnerId());
            if (partners.existsByNameIgnoreCaseAndIdNot(name, partner.getId())) {
                throw ApiException.conflict("PARTNER_EXISTS", "Un partenaire porte déjà ce nom");
            }
            partner.updateProfile(profile, now);
            if (command.rule() != null) {
                partner.applyRule(command.rule(), now);
            }
            audit.record(command.actor(), "PARTNER_UPDATED", "PARTNER", partner.getId(), name);
        }
        events.publish(partner.snapshot());
        return support.view(partner);
    }
}
