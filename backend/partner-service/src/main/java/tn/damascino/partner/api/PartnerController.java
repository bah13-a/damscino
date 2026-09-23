package tn.damascino.partner.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.export.TabularExport;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.common.time.UsagePeriod;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.application.command.ImportBeneficiariesCommand;
import tn.damascino.partner.application.command.RepublishSnapshotsCommand;
import tn.damascino.partner.application.command.SavePartnerCommand;
import tn.damascino.partner.application.command.SetPartnerActiveCommand;
import tn.damascino.partner.application.command.UpdateAdvantageRuleCommand;
import tn.damascino.partner.application.importing.ImportReport;
import tn.damascino.partner.application.query.AccessRow;
import tn.damascino.partner.application.query.ExportAccessesQuery;
import tn.damascino.partner.application.query.GetPartnerQuery;
import tn.damascino.partner.application.query.ListPartnersQuery;
import tn.damascino.partner.application.query.PartnerView;
import tn.damascino.partner.application.query.PublicPartnerQuery;
import tn.damascino.partner.domain.AdvantageRule;
import tn.damascino.partner.domain.PartnerProfile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/partners")
public class PartnerController {

    private final CommandBus commands;
    private final QueryBus queries;

    public PartnerController(CommandBus commands, QueryBus queries) {
        this.commands = commands;
        this.queries = queries;
    }

    public record RuleRequest(@NotNull BigDecimal discountPercent, List<String> eligibleCategories,
                              List<String> excludedCategories, int usagesPerPeriod, @NotNull UsagePeriod usagePeriod) {

        AdvantageRule toRule() {
            return new AdvantageRule(discountPercent, eligibleCategories, excludedCategories, usagesPerPeriod, usagePeriod);
        }
    }

    public record PartnerRequest(@NotBlank String name, String contactName, String contactPhone, String contactEmail,
                                 @NotNull LocalDate conventionStart, @NotNull LocalDate conventionEnd,
                                 @Valid RuleRequest rule) {

        PartnerProfile toProfile() {
            return new PartnerProfile(name, contactName, contactPhone, contactEmail, conventionStart, conventionEnd);
        }
    }

    public record StatusRequest(boolean active) {
    }

    @GetMapping
    public List<PartnerView> list() {
        return queries.ask(new ListPartnersQuery());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PartnerView create(@Valid @RequestBody PartnerRequest request) {
        return commands.dispatch(new SavePartnerCommand(SecuritySupport.currentUser(), null, request.toProfile(),
                request.rule() == null ? null : request.rule().toRule()));
    }

    @GetMapping("/{id}")
    public PartnerView get(@PathVariable UUID id) {
        return queries.ask(new GetPartnerQuery(id));
    }

    @GetMapping("/{id}/public")
    public PublicPartnerQuery.PublicPartner publicInfo(@PathVariable UUID id) {
        return queries.ask(new PublicPartnerQuery(id));
    }

    @PutMapping("/{id}")
    public PartnerView update(@PathVariable UUID id, @Valid @RequestBody PartnerRequest request) {
        return commands.dispatch(new SavePartnerCommand(SecuritySupport.currentUser(), id, request.toProfile(),
                request.rule() == null ? null : request.rule().toRule()));
    }

    @PatchMapping("/{id}/status")
    public PartnerView status(@PathVariable UUID id, @RequestBody StatusRequest request) {
        return commands.dispatch(new SetPartnerActiveCommand(SecuritySupport.currentUser(), id, request.active()));
    }

    @PutMapping("/{id}/rule")
    public PartnerView rule(@PathVariable UUID id, @Valid @RequestBody RuleRequest request) {
        return commands.dispatch(new UpdateAdvantageRuleCommand(SecuritySupport.currentUser(), id, request.toRule()));
    }

    @PostMapping(path = "/{id}/beneficiaries/import", consumes = "multipart/form-data")
    public ImportReport importBeneficiaries(@PathVariable UUID id, @RequestPart("file") MultipartFile file)
            throws IOException {
        if (file.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "Le fichier est vide");
        }
        return commands.dispatch(new ImportBeneficiariesCommand(SecuritySupport.currentUser(), id,
                file.getOriginalFilename(), file.getBytes()));
    }

    @GetMapping("/{id}/accesses/export")
    public ResponseEntity<byte[]> exportAccesses(@PathVariable UUID id,
                                                 @RequestParam(defaultValue = "xlsx") String format) {
        PartnerView partner = queries.ask(new GetPartnerQuery(id));
        List<List<Object>> rows = new ArrayList<>();
        for (AccessRow r : queries.ask(new ExportAccessesQuery(id))) {
            rows.add(List.of(r.lastName(), r.firstName(), r.login(),
                    r.temporaryPassword() == null ? "" : r.temporaryPassword(), r.status()));
        }
        return TabularExport.response("acces-" + slug(partner.name()), format,
                List.of("Nom", "Prénom", "Identifiant (téléphone)", "Mot de passe temporaire", "Statut"), rows);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam(defaultValue = "xlsx") String format) {
        List<List<Object>> rows = new ArrayList<>();
        for (PartnerView p : list()) {
            rows.add(java.util.Arrays.asList(p.name(), p.contactName(), p.contactPhone(), p.contactEmail(),
                    p.active() ? "Actif" : "Inactif", p.conventionStart().toString(), p.conventionEnd().toString(),
                    p.discountPercent(), String.join(", ", p.eligibleCategories()),
                    p.usagesPerPeriod() + " / " + p.usagePeriod(), p.beneficiaryCount(), p.activatedCount()));
        }
        return TabularExport.response("partenaires", format, List.of("Partenaire", "Contact", "Téléphone", "E-mail",
                "Statut", "Début convention", "Fin convention", "Remise %", "Catégories éligibles", "Fréquence",
                "Bénéficiaires", "Comptes activés"), rows);
    }

    @PostMapping("/republish")
    public Map<String, Integer> republish() {
        return Map.of("events", commands.dispatch(new RepublishSnapshotsCommand(SecuritySupport.currentUser())));
    }

    static String slug(String name) {
        return java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }
}
