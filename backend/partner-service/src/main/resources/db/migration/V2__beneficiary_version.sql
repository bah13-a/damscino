-- optimistic locking between administration commands and the account activation listener
alter table beneficiary add column version bigint not null default 0;
