-- Mode « remise assistée » : la remise est saisie dans la rubrique Remise de la caisse existante
create table till_settings (
    id             smallint primary key,
    discount_label varchar(100) not null,
    apply_mode     varchar(20)  not null,
    price_required boolean      not null,
    updated_at     timestamptz  not null
);

insert into till_settings (id, discount_label, apply_mode, price_required, updated_at)
values (1, 'Damascino Privilèges', 'LINE_PERCENT', false, now());
