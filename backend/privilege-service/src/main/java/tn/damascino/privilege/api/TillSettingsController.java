package tn.damascino.privilege.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.privilege.settings.TillSettings;
import tn.damascino.privilege.settings.TillSettingsHandlers;

@RestController
public class TillSettingsController {

    private final CommandBus commands;
    private final QueryBus queries;

    public TillSettingsController(CommandBus commands, QueryBus queries) {
        this.commands = commands;
        this.queries = queries;
    }

    public record SettingsRequest(String discountLabel, TillSettings.ApplyMode applyMode, boolean priceRequired) {
    }

    /** Read by the staff scanner to tell the cashier how to enter the discount in the till. */
    @GetMapping("/api/privileges/settings")
    public TillSettingsHandlers.View settings() {
        return queries.ask(new TillSettingsHandlers.GetSettings());
    }

    @PutMapping("/api/pos-settings")
    public TillSettingsHandlers.View update(@RequestBody SettingsRequest request) {
        return commands.dispatch(new TillSettingsHandlers.UpdateSettings(SecuritySupport.currentUser(),
                request.discountLabel(), request.applyMode(), request.priceRequired()));
    }
}
