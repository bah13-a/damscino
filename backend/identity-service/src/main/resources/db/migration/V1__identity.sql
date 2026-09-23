create table account (
    id                   uuid primary key,
    username             varchar(100) not null unique,
    password_hash        varchar(100) not null,
    role                 varchar(20)  not null,
    display_name         varchar(200) not null,
    beneficiary_id       uuid unique,
    partner_id           uuid,
    active               boolean      not null,
    must_change_password boolean      not null,
    failed_attempts      int          not null default 0,
    locked_until         timestamptz,
    session_version      bigint       not null default 0,
    activated_at         timestamptz,
    last_login_at        timestamptz,
    created_at           timestamptz  not null
);

create index idx_account_role on account (role);

create table refresh_session (
    id          uuid primary key,
    account_id  uuid         not null references account (id) on delete cascade,
    token_hash  varchar(64)  not null unique,
    expires_at  timestamptz  not null,
    created_at  timestamptz  not null,
    user_agent  varchar(300)
);

create index idx_refresh_session_account on refresh_session (account_id);

create table outbox_event (
    id           uuid primary key,
    event_type   varchar(100) not null,
    envelope     text         not null,
    created_at   timestamptz  not null,
    published_at timestamptz
);

create index idx_outbox_pending on outbox_event (created_at) where published_at is null;
