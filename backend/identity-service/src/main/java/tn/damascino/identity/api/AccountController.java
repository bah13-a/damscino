package tn.damascino.identity.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.security.Role;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.identity.application.command.CreateAccountCommand;
import tn.damascino.identity.application.command.ResetAccountSecretCommand;
import tn.damascino.identity.application.command.UpdateAccountCommand;
import tn.damascino.identity.application.query.AccountView;
import tn.damascino.identity.application.query.ListStaffAccountsQuery;

import java.util.List;
import java.util.UUID;

/** Administration of administrator and scanner staff accounts. */
@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final CommandBus commands;
    private final QueryBus queries;

    public AccountController(CommandBus commands, QueryBus queries) {
        this.commands = commands;
        this.queries = queries;
    }

    public record CreateAccountRequest(@NotNull Role role, @NotBlank String username, String displayName,
                                       @NotBlank String secret) {
    }

    public record UpdateAccountRequest(String displayName, Boolean active) {
    }

    public record ResetSecretRequest(@NotBlank String secret) {
    }

    @GetMapping
    public List<AccountView> list(@RequestParam(required = false) Role role) {
        return queries.ask(new ListStaffAccountsQuery(role));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountView create(@Valid @RequestBody CreateAccountRequest request) {
        return commands.dispatch(new CreateAccountCommand(SecuritySupport.currentUser(), request.role(),
                request.username(), request.displayName(), request.secret()));
    }

    @PatchMapping("/{id}")
    public AccountView update(@PathVariable UUID id, @RequestBody UpdateAccountRequest request) {
        return commands.dispatch(new UpdateAccountCommand(SecuritySupport.currentUser(), id, request.displayName(),
                request.active()));
    }

    @PostMapping("/{id}/reset-secret")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetSecret(@PathVariable UUID id, @Valid @RequestBody ResetSecretRequest request) {
        commands.dispatch(new ResetAccountSecretCommand(SecuritySupport.currentUser(), id, request.secret()));
    }
}
