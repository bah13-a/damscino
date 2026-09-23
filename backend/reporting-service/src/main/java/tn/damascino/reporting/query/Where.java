package tn.damascino.reporting.query;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.util.ArrayList;
import java.util.List;

/** Tiny builder of parameterised WHERE clauses (values are always bound, never concatenated). */
final class Where {

    private final List<String> conditions = new ArrayList<>();
    final MapSqlParameterSource params = new MapSqlParameterSource();

    Where and(String condition, String name, Object value) {
        conditions.add(condition);
        params.addValue(name, value);
        return this;
    }

    Where and(String condition) {
        conditions.add(condition);
        return this;
    }

    String sql() {
        return conditions.isEmpty() ? "" : " where " + String.join(" and ", conditions);
    }

    /** Same conditions with every column prefixed by a table alias. */
    String sql(String alias) {
        if (conditions.isEmpty()) {
            return "";
        }
        return " where " + String.join(" and ", conditions.stream()
                .map(c -> alias + "." + c).toList());
    }
}
