package tn.damascino.privilege.projection;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.events.BeneficiaryChanged;
import tn.damascino.common.events.BeneficiarySessionChanged;
import tn.damascino.common.events.EventEnvelope;
import tn.damascino.common.events.EventTypes;
import tn.damascino.common.events.PartnerChanged;
import tn.damascino.common.messaging.EventReader;

@Component
public class ProjectionUpdater {

    private final PartnerProjectionRepository partners;
    private final BeneficiaryProjectionRepository beneficiaries;
    private final EventReader reader;

    public ProjectionUpdater(PartnerProjectionRepository partners, BeneficiaryProjectionRepository beneficiaries,
                             EventReader reader) {
        this.partners = partners;
        this.beneficiaries = beneficiaries;
        this.reader = reader;
    }

    @RabbitListener(queues = PrivilegeMessagingConfig.QUEUE)
    @Transactional
    public void on(String message) {
        EventEnvelope envelope = reader.envelope(message);
        switch (envelope.type()) {
            case EventTypes.PARTNER_CHANGED -> {
                PartnerChanged event = reader.payload(envelope, PartnerChanged.class);
                PartnerProjection partner = partners.findById(event.partnerId())
                        .orElseGet(() -> new PartnerProjection(event.partnerId()));
                partner.apply(event);
                partners.save(partner);
            }
            case EventTypes.BENEFICIARY_CHANGED -> {
                BeneficiaryChanged event = reader.payload(envelope, BeneficiaryChanged.class);
                BeneficiaryProjection beneficiary = beneficiaries.findById(event.beneficiaryId())
                        .orElseGet(() -> new BeneficiaryProjection(event.beneficiaryId()));
                beneficiary.apply(event);
                beneficiaries.save(beneficiary);
            }
            case EventTypes.BENEFICIARY_SESSION_CHANGED -> {
                BeneficiarySessionChanged event = reader.payload(envelope, BeneficiarySessionChanged.class);
                BeneficiaryProjection beneficiary = beneficiaries.findById(event.beneficiaryId())
                        .orElseGet(() -> new BeneficiaryProjection(event.beneficiaryId()));
                beneficiary.sessionChanged(event.sessionVersion());
                beneficiaries.save(beneficiary);
            }
            default -> {
                // not interested
            }
        }
    }
}
