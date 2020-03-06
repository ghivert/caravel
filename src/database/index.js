const stonebraker = require('stonebraker')
const path = require('path')
const client = require('./client')

const checkIfMigrationExists = queries => async tableName => {
  const { rows } = await queries.checkIfMigrationTableExists({ tableName })
  const [{ exists }] = rows
  if (!exists) {
    console.log('🔧 No migration table found, creating...')
    await queries.createMigrationsTable(client, tableName)
    console.log('👌 Migrations table created')
  } else {
    console.log('👌 Migration table exists')
  }
}

const getAllMigrations = queries => async tableName => {
  console.log('📈 Getting all migrations in table...')
  const { rows } = await queries.getAllMigrationsFromTable({ tableName })
  return rows
}

const initialize = async configFilePath => {
  const dbClient = client.create(configFilePath)
  await client.connect(dbClient)
  const converter = stonebraker.convert(dbClient)
  const queries = converter(path.resolve('./queries.sql'))
  const checkIfMigrationTableExists = checkIfMigrationExists(queries)
  const getAllMigrationsFromTable = getAllMigrations(queries)
  return {
    client,
    queries: {
      checkIfMigrationTableExists,
      getAllMigrationsFromTable,
    },
  }
}

module.exports = {
  initialize,
}
