package tn.damascino.privilege.settings;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TillSettingsRepository extends JpaRepository<TillSettings, Short> {

    default TillSettings current() {
        return findById(TillSettings.SINGLETON).orElseThrow(() -> new IllegalStateException("till_settings row missing"));
    }
}
