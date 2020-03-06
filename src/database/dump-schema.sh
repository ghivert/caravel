if which pg_dump
then
  pg_dump --schema-only ${database} | awk 'RS="";/ADD CONSTRAINT[^;]*;|CREATE TABLE[^;]*;/'
fi
