package tn.damascino.privilege.pos;

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
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Administration of the tills (API keys) and of the article → category mapping (commands and queries). */
public final class PosAdministration {

    private PosAdministration() {
    }

    public record TerminalView(UUID id, String name, String keyPrefix, boolean active, Instant createdAt,
                               Instant lastUsedAt, String counterCode) {

        static TerminalView of(PosTerminal t) {
            return new TerminalView(t.getId(), t.getName(), t.getKeyPrefix(), t.isActive(), t.getCreatedAt(),
                    t.getLastUsedAt(), t.getCounterCode());
        }
    }

    /** The API key is returned only here, once: it is stored hashed. */
    public record TerminalWithKey(TerminalView terminal, String apiKey) {
    }

    public record ProductView(String sku, String label, String category, Instant updatedAt) {
    }

    public record ProductInput(String sku, String label, String category) {
    }

    public record CreateTerminal(AuthenticatedUser actor, String name) implements Command<TerminalWithKey> {
    }

    public record RotateKey(AuthenticatedUser actor, UUID terminalId) implements Command<TerminalWithKey> {
    }

    public record RenewCounterCode(AuthenticatedUser actor, UUID terminalId) implements Command<TerminalView> {
    }

    public record SetTerminalActive(AuthenticatedUser actor, UUID terminalId, boolean active) implements Command<TerminalView> {
    }

    public record SaveProducts(AuthenticatedUser actor, List<ProductInput> products) implements Command<Integer> {
    }

    public record DeleteProduct(AuthenticatedUser actor, String sku) implements Command<Void> {
    }

    public record ListTerminals() implements Query<List<TerminalView>> {
    }

    public record ListProducts() implements Query<List<ProductView>> {
    }

    @Component
    static class Support {
        final PosTerminalRepository terminals;
        final PosProductRepository products;
        final EventPublisher events;
        final Clock clock;

        Support(PosTerminalRepository terminals, PosProductRepository products, EventPublisher events, Clock clock) {
            this.terminals = terminals;
            this.products = products;
            this.events = events;
            this.clock = clock;
        }

        PosTerminal terminal(UUID id) {
            return terminals.findById(id).orElseThrow(() -> ApiException.notFound("Caisse"));
        }

        void audit(AuthenticatedUser actor, String action, String targetType, Object target, String details) {
            events.publish(new AuditRecorded(actor.accountId(), actor.displayName(), action, targetType,
                    target == null ? null : target.toString(), details, clock.instant()));
        }
    }

    @Component
    static class CreateTerminalHandler implements CommandHandler<CreateTerminal, TerminalWithKey> {
        private final Support s;

        CreateTerminalHandler(Support s) {
            this.s = s;
        }

        @Override
        @Transactional
        public TerminalWithKey handle(CreateTerminal command) {
            String name = command.name() == null ? "" : command.name().trim();
            if (name.isEmpty() || name.length() > 100) {
                throw ApiException.badRequest("INVALID_NAME", "Nom de caisse obligatoire (100 caractères max.)");
            }
            if (s.terminals.existsByNameIgnoreCase(name)) {
                throw ApiException.conflict("TERMINAL_EXISTS", "Une caisse porte déjà ce nom");
            }
            PosApiKeys.NewKey key = PosApiKeys.generate();
            PosTerminal terminal = s.terminals.save(new PosTerminal(name, key.prefix(), key.hash(), s.clock.instant()));
            s.audit(command.actor(), "POS_TERMINAL_CREATED", "POS_TERMINAL", terminal.getId(), name);
            return new TerminalWithKey(TerminalView.of(terminal), key.key());
        }
    }

    @Component
    static class RotateKeyHandler implements CommandHandler<RotateKey, TerminalWithKey> {
        private final Support s;

        RotateKeyHandler(Support s) {
            this.s = s;
        }

        @Override
        @Transactional
        public TerminalWithKey handle(RotateKey command) {
            PosTerminal terminal = s.terminal(command.terminalId());
            PosApiKeys.NewKey key = PosApiKeys.generate();
            terminal.rotateKey(key.prefix(), key.hash());
            s.audit(command.actor(), "POS_KEY_ROTATED", "POS_TERMINAL", terminal.getId(), terminal.getName());
            return new TerminalWithKey(TerminalView.of(terminal), key.key());
        }
    }

    @Component
    static class RenewCounterCodeHandler implements CommandHandler<RenewCounterCode, TerminalView> {
        private final Support s;

        RenewCounterCodeHandler(Support s) {
            this.s = s;
        }

        @Override
        @Transactional
        public TerminalView handle(RenewCounterCode command) {
            PosTerminal terminal = s.terminal(command.terminalId());
            terminal.renewCounterCode();
            s.audit(command.actor(), "POS_COUNTER_CODE_RENEWED", "POS_TERMINAL", terminal.getId(), terminal.getName());
            return TerminalView.of(terminal);
        }
    }

    @Component
    static class SetTerminalActiveHandler implements CommandHandler<SetTerminalActive, TerminalView> {
        private final Support s;

        SetTerminalActiveHandler(Support s) {
            this.s = s;
        }

        @Override
        @Transactional
        public TerminalView handle(SetTerminalActive command) {
            PosTerminal terminal = s.terminal(command.terminalId());
            terminal.setActive(command.active());
            s.audit(command.actor(), command.active() ? "POS_TERMINAL_ACTIVATED" : "POS_TERMINAL_DEACTIVATED",
                    "POS_TERMINAL", terminal.getId(), terminal.getName());
            return TerminalView.of(terminal);
        }
    }

    @Component
    static class SaveProductsHandler implements CommandHandler<SaveProducts, Integer> {
        private final Support s;

        SaveProductsHandler(Support s) {
            this.s = s;
        }

        @Override
        @Transactional
        public Integer handle(SaveProducts command) {
            if (command.products() == null || command.products().isEmpty()) {
                throw ApiException.badRequest("EMPTY", "Aucun article à enregistrer");
            }
            Instant now = s.clock.instant();
            for (ProductInput input : command.products()) {
                String sku = input.sku() == null ? "" : input.sku().trim();
                String category = input.category() == null ? "" : input.category().trim().toUpperCase(Locale.ROOT);
                if (sku.isEmpty() || sku.length() > 80 || category.isEmpty()) {
                    throw ApiException.badRequest("INVALID_PRODUCT",
                            "Chaque article doit avoir une référence (80 caractères max.) et une catégorie");
                }
                s.products.findById(sku).ifPresentOrElse(
                        p -> p.update(input.label(), category, now),
                        () -> s.products.save(new PosProduct(sku, input.label(), category, now)));
            }
            s.audit(command.actor(), "POS_PRODUCTS_SAVED", "POS_PRODUCT", null, command.products().size() + " article(s)");
            return command.products().size();
        }
    }

    @Component
    static class DeleteProductHandler implements CommandHandler<DeleteProduct, Void> {
        private final Support s;

        DeleteProductHandler(Support s) {
            this.s = s;
        }

        @Override
        @Transactional
        public Void handle(DeleteProduct command) {
            if (!s.products.existsById(command.sku())) {
                throw ApiException.notFound("Article");
            }
            s.products.deleteById(command.sku());
            s.audit(command.actor(), "POS_PRODUCT_DELETED", "POS_PRODUCT", command.sku(), null);
            return null;
        }
    }

    @Component
    static class ListTerminalsHandler implements QueryHandler<ListTerminals, List<TerminalView>> {
        private final Support s;

        ListTerminalsHandler(Support s) {
            this.s = s;
        }

        @Override
        @Transactional(readOnly = true)
        public List<TerminalView> handle(ListTerminals query) {
            return s.terminals.findAllByOrderByNameAsc().stream().map(TerminalView::of).toList();
        }
    }

    @Component
    static class ListProductsHandler implements QueryHandler<ListProducts, List<ProductView>> {
        private final Support s;

        ListProductsHandler(Support s) {
            this.s = s;
        }

        @Override
        @Transactional(readOnly = true)
        public List<ProductView> handle(ListProducts query) {
            return s.products.findAllByOrderByCategoryAscLabelAsc().stream()
                    .map(p -> new ProductView(p.getSku(), p.getLabel(), p.getCategory(), p.getUpdatedAt()))
                    .toList();
        }
    }
}
