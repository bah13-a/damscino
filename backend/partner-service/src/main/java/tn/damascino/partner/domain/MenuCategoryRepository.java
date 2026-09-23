package tn.damascino.partner.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MenuCategoryRepository extends JpaRepository<MenuCategory, String> {

    List<MenuCategory> findAllByOrderByLabelAsc();
}
