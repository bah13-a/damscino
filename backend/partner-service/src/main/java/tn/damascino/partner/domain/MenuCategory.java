package tn.damascino.partner.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Menu category defined by Damascino (plats, boissons, desserts, ...). */
@Entity
@Table(name = "menu_category")
public class MenuCategory {

    @Id
    private String code;

    private String label;

    protected MenuCategory() {
    }

    public MenuCategory(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }
}
