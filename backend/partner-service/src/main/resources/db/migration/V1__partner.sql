create table menu_category (
    code  varchar(40)  primary key,
    label varchar(100) not null
);

insert into menu_category (code, label) values
    ('PLATS', 'Plats'),
    ('ENTREES', 'Entrées'),
    ('BOISSONS', 'Boissons'),
    ('DESSERTS', 'Desserts');

create table partner (
    id                  uuid primary key,
    name                varchar(150)  not null unique,
    contact_name        varchar(150),
    contact_phone       varchar(30),
    contact_email       varchar(150),
    active              boolean       not null,
    convention_start    date          not null,
    convention_end      date          not null,
    discount_percent    numeric(5, 2) not null,
    eligible_categories varchar(500)  not null,
    excluded_categories varchar(500)  not null,
    usages_per_period   int           not null,
    usage_period        varchar(10)   not null,
    created_at          timestamptz   not null,
    updated_at          timestamptz   not null
);

create table beneficiary (
    id                      uuid primary key,
    partner_id              uuid         not null references partner (id),
    first_name              varchar(100) not null,
    last_name               varchar(100) not null,
    phone                   varchar(20)  not null unique,
    active                  boolean      not null,
    pending_password_cipher varchar(200),
    credentials_issued_at   timestamptz,
    activated_at            timestamptz,
    created_at              timestamptz  not null,
    updated_at              timestamptz  not null
);

create index idx_beneficiary_partner on beneficiary (partner_id);
create index idx_beneficiary_names on beneficiary (lower(last_name), lower(first_name));

create table outbox_event (
    id           uuid primary key,
    event_type   varchar(100) not null,
    envelope     text         not null,
    created_at   timestamptz  not null,
    published_at timestamptz
);

create index idx_outbox_pending on outbox_event (created_at) where published_at is null;
