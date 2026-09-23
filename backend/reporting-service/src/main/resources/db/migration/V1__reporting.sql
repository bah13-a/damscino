-- Denormalised read models built from the events of every service (query side of CQRS)
create table rpt_partner (
    id               uuid primary key,
    name             varchar(150) not null,
    active           boolean      not null,
    convention_start date,
    convention_end   date,
    discount_percent numeric(5, 2)
);

create table rpt_beneficiary (
    id           uuid primary key,
    partner_id   uuid,
    first_name   varchar(100),
    last_name    varchar(100),
    phone        varchar(20),
    active       boolean not null default false,
    activated_at timestamptz,
    created_at   timestamptz
);

create index idx_rpt_beneficiary_partner on rpt_beneficiary (partner_id);

create table rpt_usage (
    id               uuid primary key,
    beneficiary_id   uuid          not null,
    beneficiary_name varchar(200),
    partner_id       uuid          not null,
    partner_name     varchar(150),
    staff_account_id uuid,
    staff_name       varchar(200),
    validated_at     timestamptz   not null,
    local_date       date          not null,
    dish_price       numeric(10, 3),
    discount_percent numeric(5, 2) not null,
    discount_amount  numeric(10, 3)
);

create index idx_rpt_usage_date on rpt_usage (local_date);
create index idx_rpt_usage_partner on rpt_usage (partner_id, local_date);
create index idx_rpt_usage_beneficiary on rpt_usage (beneficiary_id, local_date);

create table rpt_rejection (
    id               uuid primary key,
    beneficiary_id   uuid,
    beneficiary_name varchar(200),
    partner_id       uuid,
    partner_name     varchar(150),
    staff_account_id uuid,
    staff_name       varchar(200),
    reason           varchar(50)  not null,
    stage            varchar(20),
    occurred_at      timestamptz  not null
);

create index idx_rpt_rejection_date on rpt_rejection (occurred_at);

create table rpt_audit (
    id          uuid primary key,
    actor_id    uuid,
    actor_name  varchar(200),
    action      varchar(60)  not null,
    target_type varchar(40),
    target_id   varchar(60),
    details     text,
    source      varchar(60),
    occurred_at timestamptz  not null
);

create index idx_rpt_audit_date on rpt_audit (occurred_at desc);

create table outbox_event (
    id           uuid primary key,
    event_type   varchar(100) not null,
    envelope     text         not null,
    created_at   timestamptz  not null,
    published_at timestamptz
);
