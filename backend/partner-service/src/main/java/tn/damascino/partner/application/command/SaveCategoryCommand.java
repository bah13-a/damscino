package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.partner.application.query.CategoryView;

public record SaveCategoryCommand(AuthenticatedUser actor, String code, String label) implements Command<CategoryView> {
}
