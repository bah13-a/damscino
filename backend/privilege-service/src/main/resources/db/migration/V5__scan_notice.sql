-- Last scan of each beneficiary's QR code, shown live in the beneficiary's app (scanned, refused, validated)
create table scan_notice (
    beneficiary_id   uuid primary key,
    status           varchar(20)   not null,
    reason           varchar(40),
    message          varchar(200)  not null,
    staff_name       varchar(150),
    discount_percent numeric(5, 2),
    dish_price       numeric(10, 3),
    discount_amount  numeric(10, 3),
    scanned_at       timestamptz   not null
);
