-- Daily QR codes: one QR per beneficiary per day, renewed at midnight
create table daily_qr (
    id              uuid primary key,
    beneficiary_id  uuid           not null,
    qr_code         text           not null,
    qr_date         date           not null,
    generated_at    timestamptz    not null,
    used_at         timestamptz,
    unique (beneficiary_id, qr_date)
);

create index idx_daily_qr_beneficiary_date on daily_qr (beneficiary_id, qr_date);
