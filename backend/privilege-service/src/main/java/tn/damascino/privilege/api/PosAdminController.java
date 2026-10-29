package tn.damascino.privilege.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.privilege.pos.PosAdministration;
import tn.damascino.privilege.pos.PosAdministration.ProductInput;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Administration: tills allowed to call the till API, and the article → category mapping. */
@RestController
public class PosAdminController {

    private final CommandBus commands;
    private final QueryBus queries;

    public PosAdminController(CommandBus commands, QueryBus queries) {
        this.commands = commands;
        this.queries = queries;
    }

    public record NameRequest(String name) {
    }

    public record StatusRequest(boolean active) {
    }

    @GetMapping("/api/pos-terminals")
    public List<PosAdministration.TerminalView> terminals() {
        return queries.ask(new PosAdministration.ListTerminals());
    }

    @PostMapping("/api/pos-terminals")
    @ResponseStatus(HttpStatus.CREATED)
    public PosAdministration.TerminalWithKey create(@RequestBody NameRequest request) {
        return commands.dispatch(new PosAdministration.CreateTerminal(SecuritySupport.currentUser(), request.name()));
    }

    @PostMapping("/api/pos-terminals/{id}/rotate-key")
    public PosAdministration.TerminalWithKey rotate(@PathVariable UUID id) {
        return commands.dispatch(new PosAdministration.RotateKey(SecuritySupport.currentUser(), id));
    }

    @PostMapping("/api/pos-terminals/{id}/counter-code")
    public PosAdministration.TerminalView renewCounterCode(@PathVariable UUID id) {
        return commands.dispatch(new PosAdministration.RenewCounterCode(SecuritySupport.currentUser(), id));
    }

    @PatchMapping("/api/pos-terminals/{id}/status")
    public PosAdministration.TerminalView status(@PathVariable UUID id, @RequestBody StatusRequest request) {
        return commands.dispatch(new PosAdministration.SetTerminalActive(SecuritySupport.currentUser(), id, request.active()));
    }

    @GetMapping("/api/pos-products")
    public List<PosAdministration.ProductView> products() {
        return queries.ask(new PosAdministration.ListProducts());
    }

    /** Creates or updates several articles at once (form or CSV import). */
    @PutMapping("/api/pos-products")
    public Map<String, Integer> saveProducts(@RequestBody List<ProductInput> products) {
        return Map.of("saved", commands.dispatch(new PosAdministration.SaveProducts(SecuritySupport.currentUser(), products)));
    }

    @DeleteMapping("/api/pos-products/{sku}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProduct(@PathVariable String sku) {
        commands.dispatch(new PosAdministration.DeleteProduct(SecuritySupport.currentUser(), sku));
    }
}
