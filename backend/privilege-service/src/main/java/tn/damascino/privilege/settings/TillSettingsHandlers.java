package tn.damascino.privilege.settings;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.Command;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.cqrs.Query;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.events.AuditRecorded;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.web.ApiException;

import java.time.Clock;
import java.time.Instant;

/** Read and update of the till settings ("remise assistée" mode). */
public final class TillSettingsHandlers {

    private TillSettingsHandlers() {
    }

    public record View(String discountLabel, TillSettings.ApplyMode applyMode, boolean priceRequired, Instant updatedAt) {

        static View of(TillSettings s) {
            return new View(s.getDiscountLabel(), s.getApplyMode(), s.isPriceRequired(), s.getUpdatedAt());
        }
    }

    public record GetSettings() implements Query<View> {
    }

    public record UpdateSettings(AuthenticatedUser actor, String discountLabel, TillSettings.ApplyMode applyMode,
                                 boolean priceRequired) implements Command<View> {
    }

    @Component
    static class GetHandler implements QueryHandler<GetSettings, View> {
        private final TillSettingsRepository settings;

        GetHandler(TillSettingsRepository settings) {
            this.settings = settings;
        }

        @Override
        @Transactional(readOnly = true)
        public View handle(GetSettings query) {
            return View.of(settings.current());
        }
    }

    @Component
    static class UpdateHandler implements CommandHandler<UpdateSettings, View> {
        private final TillSettingsRepository settings;
        private final EventPublisher events;
        private final Clock clock;

        UpdateHandler(TillSettingsRepository settings, EventPublisher events, Clock clock) {
            this.settings = settings;
            this.events = events;
            this.clock = clock;
        }

        @Override
        @Transactional
        public View handle(UpdateSettings command) {
            String label = command.discountLabel() == null ? "" : command.discountLabel().trim();
            if (label.isEmpty() || label.length() > 100) {
                throw ApiException.badRequest("INVALID_LABEL", "Nom de la remise obligatoire (100 caractères max.)");
            }
            if (command.applyMode() == null) {
                throw ApiException.badRequest("INVALID_MODE", "Mode d'application obligatoire");
            }
            Instant now = clock.instant();
            TillSettings current = settings.current();
            current.update(label, command.applyMode(), command.priceRequired(), now);
            events.publish(new AuditRecorded(command.actor().accountId(), command.actor().displayName(),
                    "TILL_SETTINGS_UPDATED", "SETTINGS", "till",
                    "%s · %s · prix %s".formatted(label, command.applyMode(),
                            command.priceRequired() ? "obligatoire" : "facultatif"), now));
            return View.of(current);
        }
    }
}
