package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.domain.MenuCategoryRepository;
import tn.damascino.partner.domain.PartnerRepository;

@Component
public class DeleteCategoryHandler implements CommandHandler<DeleteCategoryCommand, Void> {

    private final MenuCategoryRepository categories;
    private final PartnerRepository partners;
    private final Audit audit;

    public DeleteCategoryHandler(MenuCategoryRepository categories, PartnerRepository partners, Audit audit) {
        this.categories = categories;
        this.partners = partners;
        this.audit = audit;
    }

    @Override
    @Transactional
    public Void handle(DeleteCategoryCommand command) {
        if (!categories.existsById(command.code())) {
            throw ApiException.notFound("Catégorie");
        }
        boolean used = partners.findAll().stream().anyMatch(p -> p.rule().eligibleCategories().contains(command.code())
                || p.rule().excludedCategories().contains(command.code()));
        if (used) {
            throw ApiException.conflict("CATEGORY_IN_USE", "Cette catégorie est utilisée par la règle d'un partenaire");
        }
        categories.deleteById(command.code());
        audit.record(command.actor(), "CATEGORY_DELETED", "CATEGORY", command.code(), null);
        return null;
    }
}
