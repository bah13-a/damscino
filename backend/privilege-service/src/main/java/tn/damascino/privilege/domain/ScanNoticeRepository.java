package tn.damascino.privilege.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface ScanNoticeRepository extends JpaRepository<ScanNotice, UUID> {

    /** One row per beneficiary, replaced by every scan (an upsert: two tills scanning at once cannot collide). */
    @Modifying
    @Query(value = """
            insert into scan_notice (beneficiary_id, status, reason, message, staff_name, discount_percent, dish_price,
                                     discount_amount, scanned_at)
            values (:beneficiaryId, :status, :reason, :message, :staffName, :discountPercent, :dishPrice,
                    :discountAmount, :scannedAt)
            on conflict (beneficiary_id) do update set status = excluded.status, reason = excluded.reason,
                message = excluded.message, staff_name = excluded.staff_name,
                discount_percent = excluded.discount_percent, dish_price = excluded.dish_price,
                discount_amount = excluded.discount_amount, scanned_at = excluded.scanned_at
            """, nativeQuery = true)
    void record(UUID beneficiaryId, String status, String reason, String message, String staffName,
                BigDecimal discountPercent, BigDecimal dishPrice, BigDecimal discountAmount, Instant scannedAt);
}
