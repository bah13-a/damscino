-- QR code stuck on the counter of each till: the customer scans it with the app to use the advantage
alter table pos_terminal add column counter_code varchar(40);
update pos_terminal set counter_code = substr(md5(random()::text || id::text), 1, 24) where counter_code is null;
alter table pos_terminal alter column counter_code set not null;
create unique index ux_pos_terminal_counter_code on pos_terminal (counter_code);
