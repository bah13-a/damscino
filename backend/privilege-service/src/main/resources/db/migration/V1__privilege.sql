-- Local read models of the partner service (fed by events)
create table partner_view (
    id                  uuid primary key,
    name                varchar(150)  not null,
    active              boolean       not null,
    convention_start    date          not null,
    convention_end      date          not null,
    discount_percent    numeric(5, 2) not null,
    eligible_categories varchar(500)  not null,
    excluded_categories varchar(500)  not null,
    usages_per_period   int           not null,
    usage_period        varchar(10)   not null
);

create table beneficiary_view (
    id              uuid primary key,
    partner_id      uuid,
    first_name      varchar(100),
    last_name       varchar(100),
    phone           varchar(20),
    active          boolean not null default false,
    session_version bigint  not null default 0
);

-- Write model: one row per validated passage
create table redemption (
    id               uuid primary key,
    beneficiary_id   uuid          not null,
    partner_id       uuid          not null,
    staff_account_id uuid          not null,
    staff_name       varchar(200)  not null,
    period_key       varchar(20)   not null,
    qr_nonce         varchar(64)   not null unique,
    dish_price       numeric(10, 3),
    discount_percent numeric(5, 2) not null,
    discount_amount  numeric(10, 3),
    validated_at     timestamptz   not null
);

create index idx_redemption_quota on redemption (beneficiary_id, period_key);
create index idx_redemption_history on redemption (beneficiary_id, validated_at desc);

create table outbox_event (
    id           uuid primary key,
    event_type   varchar(100) not null,
    envelope     text         not null,
    created_at   timestamptz  not null,
    published_at timestamptz
);

create index idx_outbox_pending on outbox_event (created_at) where published_at is null;
