const stonebraker = require('stonebraker')
const path = require('path')
const client = require('./client')
const schema = require('./schema')

const createMigrationsTable = queries => async () => {
  const { rows } = await queries.checkIfMigrationsTableExists()
  const [{ exists }] = rows
  if (!exists) {
    console.log('🔧 No migration table found, creating...')
    await queries.createMigrationsTable()
    console.log('👌 Migrations table created')
  } else {
    console.log('👌 Migration table exists')
  }
}

const getAllMigrations = queries => async () => {
  console.log('📈 Getting all migrations in table...')
  const { rows } = await queries.getAllMigrations()
  return rows
}

const initialize = async configFilePath => {
  const dbClient = client.create(configFilePath)
  const connected = await client.connect(dbClient)
  const converter = stonebraker.convert(dbClient)
  const queries = converter(path.resolve(__dirname, './queries.sql'))
  const createMigrationsTableIfNeeded = createMigrationsTable(queries)
  const getAllMigrationsFromTable = getAllMigrations(queries)
  return {
    client: dbClient,
    queries: {
      ...queries,
      createMigrationsTableIfNeeded,
      getAllMigrationsFromTable,
    },
    connected,
    schema,
  }
}

const close = async ({ client }) => {
  await client.end()
}

module.exports = {
  initialize,
  close,
}
