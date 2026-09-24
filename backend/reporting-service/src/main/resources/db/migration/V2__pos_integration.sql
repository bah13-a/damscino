alter table rpt_usage add column channel varchar(10) not null default 'SCANNER';
alter table rpt_usage add column pos_terminal varchar(100);
alter table rpt_usage add column ticket_id varchar(80);
alter table rpt_usage add column dish_label varchar(200);
alter table rpt_usage add column validation_code varchar(10);
alter table rpt_usage add column cancelled_at timestamptz;
alter table rpt_usage add column cancel_reason varchar(200);
create index idx_rpt_usage_ticket on rpt_usage (ticket_id);
