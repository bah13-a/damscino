package tn.damascino.identity.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MailSettingsRepository extends JpaRepository<MailSettings, Short> {

    default Optional<MailSettings> current() {
        return findById(MailSettings.SINGLETON);
    }
}
