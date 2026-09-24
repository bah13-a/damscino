package tn.damascino.identity.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.security.Role;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.identity.application.AuthResult;
import tn.damascino.identity.application.ClientPolicy;
import tn.damascino.identity.application.command.ChangePasswordCommand;
import tn.damascino.identity.application.command.LoginCommand;
import tn.damascino.identity.application.command.LogoutCommand;
import tn.damascino.identity.application.command.RefreshCommand;
import tn.damascino.identity.application.query.AccountView;
import tn.damascino.identity.application.query.MeQuery;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final CommandBus commands;
    private final QueryBus queries;
    private final ClientPolicy clientPolicy;

    public AuthController(CommandBus commands, QueryBus queries, ClientPolicy clientPolicy) {
        this.commands = commands;
        this.queries = queries;
        this.clientPolicy = clientPolicy;
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password, @NotNull Role space) {
    }

    public record RefreshRequest(String refreshToken) {
    }

    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank String newPassword) {
    }

    @PostMapping("/login")
    public AuthResult login(@Valid @RequestBody LoginRequest request,
                            @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
                            @RequestHeader(value = ClientPolicy.HEADER, required = false) String clientApp) {
        clientPolicy.checkLogin(request.space(), clientApp);
        return commands.dispatch(new LoginCommand(request.username(), request.password(), request.space(), userAgent));
    }

    @PostMapping("/refresh")
    public AuthResult refresh(@RequestBody RefreshRequest request,
                              @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        return commands.dispatch(new RefreshCommand(request.refreshToken(), userAgent));
    }

    @PostMapping("/logout")
    public void logout(@RequestBody RefreshRequest request) {
        commands.dispatch(new LogoutCommand(request.refreshToken()));
    }

    @PostMapping("/change-password")
    public AuthResult changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                     @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        return commands.dispatch(new ChangePasswordCommand(SecuritySupport.currentUser().accountId(),
                request.currentPassword(), request.newPassword(), userAgent));
    }

    @GetMapping("/me")
    public AccountView me() {
        return queries.ask(new MeQuery(SecuritySupport.currentUser().accountId()));
    }
}
