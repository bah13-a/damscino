package tn.damascino.partner.application.query;

import tn.damascino.common.cqrs.Query;

import java.util.List;

public record ListCategoriesQuery() implements Query<List<CategoryView>> {
}
