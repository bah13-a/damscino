package tn.damascino.partner.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.web.ApiException;
import tn.damascino.partner.application.Audit;
import tn.damascino.partner.application.query.CategoryView;
import tn.damascino.partner.domain.MenuCategory;
import tn.damascino.partner.domain.MenuCategoryRepository;

import java.text.Normalizer;
import java.util.Locale;

@Component
public class SaveCategoryHandler implements CommandHandler<SaveCategoryCommand, CategoryView> {

    private final MenuCategoryRepository categories;
    private final Audit audit;

    public SaveCategoryHandler(MenuCategoryRepository categories, Audit audit) {
        this.categories = categories;
        this.audit = audit;
    }

    @Override
    @Transactional
    public CategoryView handle(SaveCategoryCommand command) {
        String label = PartnerCommandSupport.required(command.label(), "Le libellé");
        String code = toCode(command.code() == null || command.code().isBlank() ? label : command.code());
        if (code.isEmpty() || code.length() > 40) {
            throw ApiException.badRequest("INVALID_CODE", "Code de catégorie invalide");
        }
        MenuCategory category = categories.findById(code).orElseGet(() -> new MenuCategory(code, label));
        category.setLabel(label);
        categories.save(category);
        audit.record(command.actor(), "CATEGORY_SAVED", "CATEGORY", code, label);
        return new CategoryView(category.getCode(), category.getLabel());
    }

    static String toCode(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
    }
}
