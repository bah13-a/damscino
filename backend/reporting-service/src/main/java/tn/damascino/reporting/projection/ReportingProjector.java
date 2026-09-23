package tn.damascino.reporting.projection;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.events.AccountActivated;
import tn.damascino.common.events.AuditRecorded;
import tn.damascino.common.events.BeneficiaryChanged;
import tn.damascino.common.events.EventEnvelope;
import tn.damascino.common.events.EventTypes;
import tn.damascino.common.events.PartnerChanged;
import tn.damascino.common.events.RedemptionConfirmed;
import tn.damascino.common.events.RedemptionRejected;
import tn.damascino.common.messaging.EventReader;
import tn.damascino.common.time.Zones;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;

/** Projects every integration event into the reporting tables. All writes are idempotent upserts. */
@Component
public class ReportingProjector {

    private final NamedParameterJdbcTemplate jdbc;
    private final EventReader reader;

    public ReportingProjector(NamedParameterJdbcTemplate jdbc, EventReader reader) {
        this.jdbc = jdbc;
        this.reader = reader;
    }

    @RabbitListener(queues = ReportingMessagingConfig.QUEUE)
    @Transactional
    public void on(String message) {
        EventEnvelope envelope = reader.envelope(message);
        switch (envelope.type()) {
            case EventTypes.PARTNER_CHANGED -> partner(reader.payload(envelope, PartnerChanged.class));
            case EventTypes.BENEFICIARY_CHANGED -> beneficiary(reader.payload(envelope, BeneficiaryChanged.class));
            case EventTypes.ACCOUNT_ACTIVATED -> activated(reader.payload(envelope, AccountActivated.class));
            case EventTypes.REDEMPTION_CONFIRMED -> usage(reader.payload(envelope, RedemptionConfirmed.class));
            case EventTypes.REDEMPTION_REJECTED -> rejection(envelope, reader.payload(envelope, RedemptionRejected.class));
            case EventTypes.AUDIT_RECORDED -> audit(envelope, reader.payload(envelope, AuditRecorded.class));
            default -> {
                // not interested
            }
        }
    }

    private void partner(PartnerChanged e) {
        jdbc.update("""
                insert into rpt_partner (id, name, active, convention_start, convention_end, discount_percent)
                values (:id, :name, :active, :start, :end, :percent)
                on conflict (id) do update set name = excluded.name, active = excluded.active,
                    convention_start = excluded.convention_start, convention_end = excluded.convention_end,
                    discount_percent = excluded.discount_percent
                """, new MapSqlParameterSource()
                .addValue("id", e.partnerId()).addValue("name", e.name()).addValue("active", e.active())
                .addValue("start", e.conventionStart()).addValue("end", e.conventionEnd())
                .addValue("percent", e.discountPercent()));
        // keep denormalised partner names of the usage log up to date
        jdbc.update("update rpt_usage set partner_name = :name where partner_id = :id and partner_name <> :name",
                new MapSqlParameterSource().addValue("id", e.partnerId()).addValue("name", e.name()));
    }

    private void beneficiary(BeneficiaryChanged e) {
        jdbc.update("""
                insert into rpt_beneficiary (id, partner_id, first_name, last_name, phone, active, created_at)
                values (:id, :partner, :first, :last, :phone, :active, :created)
                on conflict (id) do update set partner_id = excluded.partner_id, first_name = excluded.first_name,
                    last_name = excluded.last_name, phone = excluded.phone, active = excluded.active,
                    created_at = coalesce(rpt_beneficiary.created_at, excluded.created_at)
                """, new MapSqlParameterSource()
                .addValue("id", e.beneficiaryId()).addValue("partner", e.partnerId())
                .addValue("first", e.firstName()).addValue("last", e.lastName()).addValue("phone", e.phone())
                .addValue("active", e.active()).addValue("created", ts(e.createdAt())));
    }

    private void activated(AccountActivated e) {
        jdbc.update("""
                insert into rpt_beneficiary (id, activated_at) values (:id, :at)
                on conflict (id) do update set activated_at = excluded.activated_at
                """, new MapSqlParameterSource().addValue("id", e.beneficiaryId()).addValue("at", ts(e.activatedAt())));
    }

    private void usage(RedemptionConfirmed e) {
        jdbc.update("""
                insert into rpt_usage (id, beneficiary_id, beneficiary_name, partner_id, partner_name, staff_account_id,
                    staff_name, validated_at, local_date, dish_price, discount_percent, discount_amount)
                values (:id, :beneficiary, :beneficiaryName, :partner, :partnerName, :staff, :staffName, :at, :day,
                    :price, :percent, :amount)
                on conflict (id) do nothing
                """, new MapSqlParameterSource()
                .addValue("id", e.redemptionId())
                .addValue("beneficiary", e.beneficiaryId()).addValue("beneficiaryName", e.beneficiaryName())
                .addValue("partner", e.partnerId()).addValue("partnerName", e.partnerName())
                .addValue("staff", e.staffAccountId()).addValue("staffName", e.staffName())
                .addValue("at", ts(e.validatedAt())).addValue("day", localDate(e.validatedAt()))
                .addValue("price", e.dishPrice()).addValue("percent", e.discountPercent())
                .addValue("amount", e.discountAmount()));
    }

    private void rejection(EventEnvelope envelope, RedemptionRejected e) {
        jdbc.update("""
                insert into rpt_rejection (id, beneficiary_id, beneficiary_name, partner_id, partner_name,
                    staff_account_id, staff_name, reason, stage, occurred_at)
                values (:id, :beneficiary, :beneficiaryName, :partner, :partnerName, :staff, :staffName, :reason,
                    :stage, :at)
                on conflict (id) do nothing
                """, new MapSqlParameterSource()
                .addValue("id", envelope.eventId())
                .addValue("beneficiary", e.beneficiaryId()).addValue("beneficiaryName", e.beneficiaryName())
                .addValue("partner", e.partnerId()).addValue("partnerName", e.partnerName())
                .addValue("staff", e.staffAccountId()).addValue("staffName", e.staffName())
                .addValue("reason", e.reason()).addValue("stage", e.stage()).addValue("at", ts(e.occurredAt())));
    }

    private void audit(EventEnvelope envelope, AuditRecorded e) {
        jdbc.update("""
                insert into rpt_audit (id, actor_id, actor_name, action, target_type, target_id, details, source,
                    occurred_at)
                values (:id, :actor, :actorName, :action, :targetType, :targetId, :details, :source, :at)
                on conflict (id) do nothing
                """, new MapSqlParameterSource()
                .addValue("id", envelope.eventId()).addValue("actor", e.actorId()).addValue("actorName", e.actorName())
                .addValue("action", e.action()).addValue("targetType", e.targetType())
                .addValue("targetId", e.targetId()).addValue("details", e.details())
                .addValue("source", envelope.source()).addValue("at", ts(e.occurredAt())));
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static LocalDate localDate(Instant instant) {
        return instant.atZone(Zones.TUNIS).toLocalDate();
    }
}
