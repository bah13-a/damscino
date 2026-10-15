package tn.damascino.partner.application.command;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.util.Emails;
import tn.damascino.common.util.PhoneNumbers;
import tn.damascino.common.web.SafeText;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.application.CredentialIssuer;
import tn.damascino.partner.application.IssuedCredentials;
import tn.damascino.partner.application.importing.BeneficiaryFileParser;
import tn.damascino.partner.application.importing.ImportReport;
import tn.damascino.partner.application.importing.ImportReport.Skipped;
import tn.damascino.partner.application.importing.ImportRow;
import tn.damascino.partner.domain.Beneficiary;
import tn.damascino.partner.domain.BeneficiaryRepository;
import tn.damascino.partner.domain.Partner;
import tn.damascino.partner.domain.PartnerRepository;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Imports an Excel/CSV list for a partner with duplicate control (inside the file and against existing
 * beneficiaries) and generates the personal access of every new beneficiary.
 */
@Component
public class ImportBeneficiariesHandler implements CommandHandler<ImportBeneficiariesCommand, ImportReport> {

    private final BeneficiaryRepository beneficiaries;
    private final PartnerRepository partners;
    private final PartnerCommandSupport support;
    private final CredentialIssuer credentialIssuer;
    private final EventPublisher events;
    private final Audit audit;
    private final Clock clock;
    private final int maxRows;

    public ImportBeneficiariesHandler(BeneficiaryRepository beneficiaries, PartnerRepository partners,
                                      PartnerCommandSupport support, CredentialIssuer credentialIssuer,
                                      EventPublisher events, Audit audit, Clock clock,
                                      @Value("${damascino.import.max-rows}") int maxRows) {
        this.beneficiaries = beneficiaries;
        this.partners = partners;
        this.support = support;
        this.credentialIssuer = credentialIssuer;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
        this.maxRows = maxRows;
    }

    @Override
    @Transactional
    public ImportReport handle(ImportBeneficiariesCommand command) {
        Partner partner = support.partner(command.partnerId());
        List<ImportRow> rows = BeneficiaryFileParser.parse(command.filename(), command.content(), maxRows);

        Map<String, Beneficiary> existing = new HashMap<>();
        List<String> phones = rows.stream().map(r -> PhoneNumbers.normalize(r.phone())).toList();
        beneficiaries.findByPhoneIn(phones).forEach(b -> existing.put(b.getPhone(), b));
        Map<UUID, String> partnerNames = new HashMap<>();
        partners.findAll().forEach(p -> partnerNames.put(p.getId(), p.getName()));

        Instant now = clock.instant();
        Set<String> seenInFile = new HashSet<>();
        List<IssuedCredentials> created = new ArrayList<>();
        List<Skipped> skipped = new ArrayList<>();

        for (ImportRow row : rows) {
            String phone = PhoneNumbers.normalize(row.phone());
            String email = Emails.normalize(row.email());
            String reason = null;
            if (row.lastName().isBlank() || row.firstName().isBlank()) {
                reason = "Nom ou prénom manquant";
            } else if (SafeText.containsMarkup(row.lastName()) || SafeText.containsMarkup(row.firstName())) {
                reason = SafeText.MESSAGE;
            } else if (!PhoneNumbers.isValid(phone)) {
                reason = "Téléphone invalide (8 chiffres attendus)";
            } else if (!Emails.isValidOrEmpty(email)) {
                reason = "E-mail invalide";
            } else if (!seenInFile.add(phone)) {
                reason = "Doublon dans le fichier";
            } else if (existing.containsKey(phone)) {
                Beneficiary other = existing.get(phone);
                reason = other.getPartnerId().equals(partner.getId())
                        ? "Déjà enregistré pour ce partenaire"
                        : "Déjà enregistré chez " + partnerNames.getOrDefault(other.getPartnerId(), "un autre partenaire");
            }
            if (reason != null) {
                skipped.add(new Skipped(row.line(), row.lastName(), row.firstName(), row.phone(), reason));
                continue;
            }
            Beneficiary beneficiary = beneficiaries.save(
                    new Beneficiary(partner.getId(), SafeText.stripInvisible(row.firstName()),
                            SafeText.stripInvisible(row.lastName()), phone, email, now));
            events.publish(beneficiary.snapshot());
            created.add(credentialIssuer.issue(beneficiary));
        }

        audit.record(command.actor(), "BENEFICIARIES_IMPORTED", "PARTNER", partner.getId(),
                "%s · %s : %d créés, %d ignorés".formatted(partner.getName(), command.filename(), created.size(),
                        skipped.size()));
        return new ImportReport(rows.size(), created, skipped);
    }
}
