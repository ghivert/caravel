const path = require('path')
const chalk = require('chalk')
const helpers = require('./helpers')
const client = require('./client')
const { MIGRATIONS_TABLE_NAME, MIGRATIONS_FOLDER } = require('./constants')

let globalClient

const createMigrationsTable = tableName => {
  return globalClient.query(
    `CREATE TABLE ${tableName} (version text PRIMARY KEY)`
  )
}

const checkIfMigrationTableExists = async () => {
  const response = await globalClient.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = '${MIGRATIONS_TABLE_NAME}'
    )`
  )
  const { exists } = response.rows[0]

  if (!exists) {
    console.log('🔧 No migration table found, creating...')
    await createMigrationsTable(MIGRATIONS_TABLE_NAME)
    console.log('👌 Migrations table created')
  } else {
    console.log('👌 Migration table exists')
  }
}

const readMigrationFileContent = async oneFileName => {
  const [ versionNumber ] = oneFileName.split('-')
  const pathName = path.resolve(MIGRATIONS_FOLDER, oneFileName)
  const fileContent = await helpers.readFile(pathName, "utf8")
  return {
    version: versionNumber,
    sql: fileContent,
  }
}

const isUp = filename => {
  const parts = filename.split('.').reverse()
  return (
    parts.length >= 3
    && parts[0] === 'sql'
    && parts[1] === 'up'
  )
}

const getAllMigrationsFromFolder = async (migrationsFolder) => {
  console.log('📄 Getting all migrations from folder...')
  const migrationsFileNames = await helpers.readdir(path.resolve(migrationsFolder || MIGRATIONS_FOLDER))
  const filteredMigrationsFileNames = migrationsFileNames.filter(isUp)
  const migrationsFiles = filteredMigrationsFileNames.map(readMigrationFileContent)
  return Promise.all(migrationsFiles)
}

const getAllMigrationsFromTable = async () => {
  console.log('📈 Getting all migrations in table...')
  const response = await globalClient.query(`SELECT * FROM ${MIGRATIONS_TABLE_NAME}`)
  return response.rows
}

const compareMigrations = async (migrationsRowsFromDB, migrationsFromFS) => {
  const tableVersions = migrationsRowsFromDB.map(oneRow => oneRow.version)
  const migrationsToExecute = migrationsFromFS.filter(oneMigration =>
    !tableVersions.includes(oneMigration.version)
  )
  return migrationsToExecute
}

const updateMigrationTable = (newVersion) => {
  return globalClient.query(
    `INSERT INTO ${MIGRATIONS_TABLE_NAME} (version) VALUES ($1)`,
    [ newVersion ]
  )
}

const stageMigrations = async (migrationsToExecute) => {
  if (migrationsToExecute.length === 0) {
    console.log('🙌 Database is up to date!')
    console.log('🤝 Migrations finished successfully !')
    return true
  } else {
    const [ currentMigration, ...nextMigrations ] = migrationsToExecute
    try {
      await executeMigrations(currentMigration)
      return await stageMigrations(nextMigrations)
    } catch (error) {
      console.error(
        '🚫 ERROR with migration, version: ',
        currentMigration.version,
      )
      console.error(error)
      return false
    }
  }
}

const executeMigrations = async (migration) => {
  await globalClient.query(migration.sql)
  console.log('🚀 SUCCESS with migration, version: ', migration.version)
  await updateMigrationTable(migration.version)
}

const createClientAndConnect = async (configFilePath) => {
  const pgClient = client.create(configFilePath)
  globalClient = pgClient
  return await client.connect(globalClient)
}

const printError = error => {
  console.error(chalk.bold.red('error: An error occured during migrate.'))
  console.error(chalk.bold.yellow(`  ${error}`))
  console.error()
  console.error(chalk.bold.green('information: Some informations to help you debug.'))
  console.error(chalk.bold.green(`  DATABASE_URL: ${globalClient.databaseURL()}`))
}

const runMigrations = async (configFilePath, migrationsFolder) => {
  try {
    const connected = await createClientAndConnect(configFilePath)
    if (connected) {
      await checkIfMigrationTableExists()
      const migrationsRowsFromDB = await getAllMigrationsFromTable()
      const migrationsFromFS = await getAllMigrationsFromFolder(migrationsFolder)
      const migrationsToExecute = await compareMigrations(
        migrationsRowsFromDB,
        migrationsFromFS,
      )
      await stageMigrations(migrationsToExecute)
    } else {
      console.error([
        'Unable to connect to your database.',
        'Are you sure it is up and running?',
        `You’re trying to connect to ${client.readDatabaseURL(globalClient)}`
      ].join(' '))
    }
  } catch (error) {
    printError(error)
  } finally {
    if (globalClient) {
      await globalClient.end()
    }
  }
}

module.exports = {
  runMigrations,
}
