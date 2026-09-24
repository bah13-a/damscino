-- Intégration caisse : canal du passage, n° de ticket, annulation
alter table redemption add column channel varchar(10) not null default 'SCANNER';
alter table redemption add column pos_terminal_id uuid;
alter table redemption add column ticket_id varchar(80);
alter table redemption add column dish_label varchar(200);
alter table redemption add column validation_code varchar(10);
alter table redemption add column cancelled_at timestamptz;
alter table redemption add column cancel_reason varchar(200);

-- Postes de caisse autorisés à appeler l'API (clé d'API hachée)
create table pos_terminal (
    id           uuid primary key,
    name         varchar(100) not null unique,
    key_prefix   varchar(20)  not null,
    key_hash     varchar(64)  not null unique,
    active       boolean      not null,
    created_at   timestamptz  not null,
    last_used_at timestamptz
);

-- Correspondance article de la caisse → catégorie Damascino
create table pos_product (
    sku        varchar(80) primary key,
    label      varchar(200),
    category   varchar(40) not null,
    updated_at timestamptz not null
);

-- Avantage réservé pendant que le ticket est ouvert en caisse
create table pos_reservation (
    id               uuid primary key,
    terminal_id      uuid          not null references pos_terminal (id),
    ticket_id        varchar(80)   not null,
    cashier          varchar(100),
    beneficiary_id   uuid          not null,
    partner_id       uuid          not null,
    qr_nonce         varchar(64)   not null unique,
    period_key       varchar(20)   not null,
    line_id          varchar(80),
    dish_label       varchar(200),
    dish_price       numeric(10, 3),
    discount_percent numeric(5, 2) not null,
    discount_amount  numeric(10, 3),
    status           varchar(12)   not null,
    reserved_until   timestamptz   not null,
    redemption_id    uuid,
    created_at       timestamptz   not null,
    updated_at       timestamptz   not null
);

-- une seule remise Damascino par ticket
create unique index ux_pos_reservation_ticket on pos_reservation (terminal_id, ticket_id)
    where status in ('RESERVED', 'CONFIRMED');
create index idx_pos_reservation_quota on pos_reservation (beneficiary_id, period_key, status);
