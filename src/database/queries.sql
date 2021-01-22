-- name: create_migrations_table
create table __caravel_migrations (
  version text primary key,
  hash text not null
);

-- name: check_if_migrations_table_exists
select exists (
  select 1
  from information_schema.tables
  where table_name = '__caravel_migrations'
);

-- name: get_all_migrations
select *
from __caravel_migrations
order by version;

-- name: insert_migration
-- keys: version, hash
insert into __caravel_migrations (version, hash)
values ($version, $hash);

-- name: delete_migration
-- keys: version
delete from __caravel_migrations
where version = $version;

-- name: get_tables_name
select table_name
from information_schema.tables
where table_schema != 'pg_catalog'
and table_schema != 'information_schema';

-- name: get_all_columns_from_table
-- keys: table_name
select *
from information_schema.columns
where table_name = $table_name;
