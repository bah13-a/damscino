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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.export.TabularExport;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.common.time.Zones;
import tn.damascino.common.web.PageResponse;
import tn.damascino.partner.application.IssuedCredentials;
import tn.damascino.partner.application.command.CreateBeneficiaryCommand;
import tn.damascino.partner.application.command.ResetBeneficiaryPasswordCommand;
import tn.damascino.partner.application.command.SetBeneficiaryActiveCommand;
import tn.damascino.partner.application.command.UpdateBeneficiaryCommand;
import tn.damascino.partner.application.query.BeneficiaryView;
import tn.damascino.partner.application.query.GetBeneficiaryQuery;
import tn.damascino.partner.application.query.ListBeneficiariesQuery;
import tn.damascino.partner.application.query.SearchBeneficiariesQuery;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/beneficiaries")
public class BeneficiaryController {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(Zones.TUNIS);

    private final CommandBus commands;
    private final QueryBus queries;

    public BeneficiaryController(CommandBus commands, QueryBus queries) {
        this.commands = commands;
        this.queries = queries;
    }

    public record BeneficiaryRequest(@NotNull UUID partnerId, @NotBlank String firstName, @NotBlank String lastName,
                                     @NotBlank String phone, String email) {
    }

    public record StatusRequest(boolean active) {
    }

    @GetMapping
    public PageResponse<BeneficiaryView> search(@RequestParam(required = false) String q,
                                                @RequestParam(required = false) UUID partnerId,
                                                @RequestParam(required = false) Boolean active,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "25") int size) {
        return queries.ask(new SearchBeneficiariesQuery(q, partnerId, active, page, size));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IssuedCredentials create(@Valid @RequestBody BeneficiaryRequest request) {
        return commands.dispatch(new CreateBeneficiaryCommand(SecuritySupport.currentUser(), request.partnerId(),
                request.firstName(), request.lastName(), request.phone(), request.email()));
    }

    @GetMapping("/{id}")
    public BeneficiaryView get(@PathVariable UUID id) {
        return queries.ask(new GetBeneficiaryQuery(id));
    }

    @PutMapping("/{id}")
    public BeneficiaryView update(@PathVariable UUID id, @Valid @RequestBody BeneficiaryRequest request) {
        return commands.dispatch(new UpdateBeneficiaryCommand(SecuritySupport.currentUser(), id, request.partnerId(),
                request.firstName(), request.lastName(), request.phone(), request.email()));
    }

    @PatchMapping("/{id}/status")
    public BeneficiaryView status(@PathVariable UUID id, @RequestBody StatusRequest request) {
        return commands.dispatch(new SetBeneficiaryActiveCommand(SecuritySupport.currentUser(), id, request.active()));
    }

    @PostMapping("/{id}/reset-password")
    public IssuedCredentials resetPassword(@PathVariable UUID id) {
        return commands.dispatch(new ResetBeneficiaryPasswordCommand(SecuritySupport.currentUser(), id));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String q,
                                         @RequestParam(required = false) UUID partnerId,
                                         @RequestParam(required = false) Boolean active,
                                         @RequestParam(defaultValue = "xlsx") String format) {
        List<List<Object>> rows = new ArrayList<>();
        for (BeneficiaryView b : queries.ask(new ListBeneficiariesQuery(q, partnerId, active))) {
            rows.add(java.util.Arrays.asList(b.lastName(), b.firstName(), b.phone(), b.email() == null ? "" : b.email(),
                    b.partnerName(),
                    b.active() ? "Actif" : "Désactivé", b.accountActivated() ? "Oui" : "Non",
                    date(b.activatedAt()), date(b.createdAt())));
        }
        return TabularExport.response("beneficiaires", format, List.of("Nom", "Prénom", "Téléphone", "E-mail", "Partenaire",
                "Statut", "Compte activé", "Activé le", "Ajouté le"), rows);
    }

    @GetMapping("/import-template")
    public ResponseEntity<byte[]> importTemplate(@RequestParam(defaultValue = "xlsx") String format) {
        return TabularExport.response("modele-import-beneficiaires", format, List.of("Nom", "Prénom", "Téléphone", "E-mail"),
                List.of(List.of("Ben Salah", "Amira", "98123456", "amira.bensalah@exemple.tn")));
    }

    private static String date(Instant instant) {
        return instant == null ? "" : DATE.format(instant);
    }
}
