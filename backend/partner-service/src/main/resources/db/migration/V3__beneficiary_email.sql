-- optional address: the activation code is sent there too, in addition to the SMS
alter table beneficiary add column email varchar(254);
