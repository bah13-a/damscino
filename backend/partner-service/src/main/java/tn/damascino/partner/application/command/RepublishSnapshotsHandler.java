package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.domain.BeneficiaryRepository;
import tn.damascino.partner.domain.PartnerRepository;

@Component
public class RepublishSnapshotsHandler implements CommandHandler<RepublishSnapshotsCommand, Integer> {

    private final PartnerRepository partners;
    private final BeneficiaryRepository beneficiaries;
    private final EventPublisher events;
    private final Audit audit;

    public RepublishSnapshotsHandler(PartnerRepository partners, BeneficiaryRepository beneficiaries,
                                     EventPublisher events, Audit audit) {
        this.partners = partners;
        this.beneficiaries = beneficiaries;
        this.events = events;
        this.audit = audit;
    }

    @Override
    @Transactional
    public Integer handle(RepublishSnapshotsCommand command) {
        int count = 0;
        for (var partner : partners.findAll()) {
            events.publish(partner.snapshot());
            count++;
        }
        for (var beneficiary : beneficiaries.findAll()) {
            events.publish(beneficiary.snapshot());
            count++;
        }
        audit.record(command.actor(), "SNAPSHOTS_REPUBLISHED", "SYSTEM", null, count + " événements");
        return count;
    }
}
