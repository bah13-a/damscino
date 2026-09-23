package tn.damascino.partner.application.query;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.time.Zones;
import tn.damascino.partner.application.CredentialVault;
import tn.damascino.partner.domain.Beneficiary;
import tn.damascino.partner.domain.BeneficiaryRepository;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
public class ExportAccessesHandler implements QueryHandler<ExportAccessesQuery, List<AccessRow>> {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(Zones.TUNIS);

    private final BeneficiaryRepository beneficiaries;
    private final CredentialVault vault;

    public ExportAccessesHandler(BeneficiaryRepository beneficiaries, CredentialVault vault) {
        this.beneficiaries = beneficiaries;
        this.vault = vault;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccessRow> handle(ExportAccessesQuery query) {
        return beneficiaries.findByPartnerIdOrderByLastNameAscFirstNameAsc(query.partnerId()).stream()
                .map(this::row)
                .toList();
    }

    private AccessRow row(Beneficiary b) {
        String status;
        String password = null;
        if (!b.isActive()) {
            status = "Désactivé";
        } else if (b.getActivatedAt() != null) {
            status = "Compte activé le " + DATE.format(b.getActivatedAt());
        } else {
            status = "À activer (changer le mot de passe à la première connexion)";
        }
        if (b.isActive() && b.getActivatedAt() == null && b.getPendingPasswordCipher() != null) {
            password = vault.decrypt(b.getPendingPasswordCipher());
        }
        return new AccessRow(b.getLastName(), b.getFirstName(), b.getPhone(), password, status);
    }
}
