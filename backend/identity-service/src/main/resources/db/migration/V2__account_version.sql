-- optimistic locking: a login must not overwrite a concurrent change (deactivation, password reset)
alter table account add column version bigint not null default 0;
