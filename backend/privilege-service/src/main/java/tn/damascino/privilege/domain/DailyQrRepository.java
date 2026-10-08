package tn.damascino.privilege.domain;

import org.springframework.data.repository.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface DailyQrRepository extends Repository<DailyQr, UUID> {
    Optional<DailyQr> findByBeneficiaryIdAndQrDate(UUID beneficiaryId, LocalDate qrDate);
    void save(DailyQr dailyQr);
}
