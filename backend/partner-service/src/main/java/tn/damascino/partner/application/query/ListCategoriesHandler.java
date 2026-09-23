package tn.damascino.partner.application.query;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.partner.domain.MenuCategoryRepository;

import java.util.List;

@Component
public class ListCategoriesHandler implements QueryHandler<ListCategoriesQuery, List<CategoryView>> {

    private final MenuCategoryRepository categories;

    public ListCategoriesHandler(MenuCategoryRepository categories) {
        this.categories = categories;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryView> handle(ListCategoriesQuery query) {
        return categories.findAllByOrderByLabelAsc().stream().map(c -> new CategoryView(c.getCode(), c.getLabel())).toList();
    }
}
