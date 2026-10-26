-- e-mail account entered by an administrator (Administration → Messagerie); takes precedence over the server
-- configuration (MAIL_* variables). A single row; the password is AES-GCM encrypted.
create table mail_settings (
    id              smallint     primary key,
    host            varchar(255) not null,
    port            int          not null,
    username        varchar(254) not null,
    password_cipher varchar(512) not null,
    from_address    varchar(254) not null,
    updated_at      timestamptz  not null,
    updated_by      varchar(100) not null
);
