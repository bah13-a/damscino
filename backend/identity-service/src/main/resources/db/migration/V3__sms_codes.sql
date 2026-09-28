-- one-time activation codes sent by SMS; only a hash of the code is stored
create table sms_code (
    id          uuid primary key,
    account_id  uuid        not null references account (id) on delete cascade,
    phone       varchar(20) not null,
    code_hash   varchar(64) not null,
    expires_at  timestamptz not null,
    attempts    int         not null default 0,
    consumed    boolean     not null default false,
    client_ip   varchar(64),
    created_at  timestamptz not null
);

create index idx_sms_code_phone on sms_code (phone, created_at desc);
