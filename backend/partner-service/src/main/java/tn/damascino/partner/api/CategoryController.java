package tn.damascino.partner.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.partner.application.command.DeleteCategoryCommand;
import tn.damascino.partner.application.command.SaveCategoryCommand;
import tn.damascino.partner.application.query.CategoryView;
import tn.damascino.partner.application.query.ListCategoriesQuery;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CommandBus commands;
    private final QueryBus queries;

    public CategoryController(CommandBus commands, QueryBus queries) {
        this.commands = commands;
        this.queries = queries;
    }

    public record CategoryRequest(String code, @NotBlank String label) {
    }

    @GetMapping
    public List<CategoryView> list() {
        return queries.ask(new ListCategoriesQuery());
    }

    @PostMapping
    public CategoryView save(@Valid @RequestBody CategoryRequest request) {
        return commands.dispatch(new SaveCategoryCommand(SecuritySupport.currentUser(), request.code(), request.label()));
    }

    @DeleteMapping("/{code}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String code) {
        commands.dispatch(new DeleteCategoryCommand(SecuritySupport.currentUser(), code));
    }
}
