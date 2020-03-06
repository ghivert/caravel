-- name: create_migration_table
-- keys: table_name
create table $table_name (version text primary key);

-- name: check_if_migrations_table_exists
-- keys: table_name
select exists (
  select 1
  from information_schema.tables
  where table_name = $table_name
);

-- name: get_all_migrations
-- keys: table_name
select * from $table_name order by version;
