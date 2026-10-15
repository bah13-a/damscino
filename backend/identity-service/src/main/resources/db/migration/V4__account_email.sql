-- optional address copied from the partner list: the activation code is sent there too, in addition to the SMS
alter table account add column email varchar(254);
