const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const database = require('./database')

const { MIGRATIONS_TABLE_NAME, MIGRATIONS_FOLDER } = require('./constants')

const hashMigration = content => {
  const hasher = crypto.createHash('sha512')
  hasher.update(content)
  return hasher.digest('utf8')
}

const readMigration = async filename => {
  const [version] = filename.split('-')
  const pathName = path.resolve(MIGRATIONS_FOLDER, filename)
  const sql = await fs.readFile(pathName, 'utf8')
  const hash = hashMigration(sql)
  return { version, filename, sql, hash }
}

const keepUpOrDown = upOrDown => filename => {
  const parts = filename.split('.').reverse()
  return parts.length >= 3 && parts[0] === 'sql' && parts[1] === upOrDown
}

const getAllMigrationsFromFolder = async migFolder => {
  console.log('📄 Getting all migrations from folder...')
  const folder = path.resolve(migFolder || MIGRATIONS_FOLDER)
  const migrationsPath = await fs.readdir(folder)
  const upMigrationsPath = migrationsPath.filter(keepUpOrDown('up'))
  const downMigrationsPath = migrationsPath.filter(keepUpOrDown('down'))
  const upMigrationsFiles = Promise.all(upMigrationsPath.map(readMigration))
  const downMigrationsFiles = Promise.all(downMigrationsPath.map(readMigration))
  return Promise.all([upMigrationsFiles, downMigrationsFiles])
}

const compareMigrations = async (fromDB, fromFS) => {
  const versions = fromDB.map(row => row.version)
  const includesVersion = ({ version }) => !versions.includes(version)
  const migrationsToExecute = fromFS.filter(includesVersion)
  return migrationsToExecute
}

const executeMigration = async (db, { sql, filename, ...migration }) => {
  const options = { tableName: MIGRATIONS_TABLE_NAME, ...migration }
  const { client, queries } = db
  await client.query('BEGIN')
  await client.query(sql)
  await queries.insertMigration(options)
  await client.query('END')
  console.log(`🚀 SUCCESS with migration ${filename}`)
}

const revertMigration = async (db, down, up) => {
  const { client, queries } = db
  if (down) {
    const options = {
      tableName: MIGRATIONS_TABLE_NAME,
      version: up.version,
    }
    await client.query('BEGIN')
    await client.query(down.sql)
    await queries.deleteMigration(options)
    await client.query('END')
  } else {
    throw new Error(`Migration ${up.version} do not have a down file.`)
  }
}

const stageMigrations = async (db, migrations) => {
  if (migrations.length === 0) {
    console.log('🙌 Database is up to date!')
    console.log('🤝 Migrations finished successfully !')
    return true
  } else {
    const [migration, ...next] = migrations
    try {
      await executeMigration(db, migration)
      return await stageMigrations(db, next)
    } catch (error) {
      console.error(`🚫 ERROR with migration ${migration.filename}`)
      console.error(error)
      return false
    }
  }
}

const revertOneByOne = async (db, remaining, rows, downFromFS) => {
  if (remaining <= 0 || rows.length === 0) {
    console.log('Reverting migrations done.')
    console.log('Reverting finished successfully.')
  } else {
    const [up, ...rest] = rows
    const isSameVersion = ({ version }) => version === up.version
    const down = downFromFS.find(isSameVersion)
    await revertMigration(db, down, up)
    console.log(`Success reverting the ${down.filename} migration.`)
    return revertOneByOne(db, remaining - 1, rest, downFromFS)
  }
}

const printUnconnected = client => {
  console.error(
    [
      'Unable to connect to your database.',
      'Are you sure it is up and running?',
      `You’re trying to connect to ${client.databaseURL()}`,
    ].join(' ')
  )
}

const connectAndGetMigrations = async (configFilePath, migrationsFolder) => {
  const db = await database.initialize(configFilePath)
  try {
    const { client, queries, connected } = db
    if (!connected) {
      printUnconnected(client)
    } else {
      await queries.createMigrationsTableIfNeeded()
      const fromDB = await queries.getAllMigrationsFromTable()
      const fromFS = await getAllMigrationsFromFolder(migrationsFolder)
      return { db, fromDB, fromFS }
    }
  } catch (error) {
    return db
  }
}

const run = async (configFilePath, migFolders) => {
  const results = await connectAndGetMigrations(configFilePath, migFolders)
  const { db, fromDB, fromFS } = results
  const migrationsToExecute = await compareMigrations(fromDB, fromFS[0])
  await stageMigrations(db, migrationsToExecute)
  await db.schema.dump(MIGRATIONS_FOLDER, db.client)
  await database.close(db)
}

const revertMigrations = (fromDB, db, remaining, fromFS) => {
  if (fromDB.length === 0) {
    return Promise.reject('You don’t have any migration made.')
  } else {
    const rows = fromDB.reverse()
    return revertOneByOne(db, remaining, rows, fromFS[1])
  }
}

const revert = async (configFilePath, migFolders, remaining) => {
  try {
    const results = await connectAndGetMigrations(configFilePath, migFolders)
    const { db, fromDB, fromFS } = results
    try {
      if (process.env.NODE_ENV !== 'production') {
        const values = await revertMigrations(fromDB, db, remaining, fromFS)
        await db.schema.dump(MIGRATIONS_FOLDER, db.client)
        await database.close(db)
        return values
      } else {
        return false
      }
    } catch (error) {
      console.error(error)
      console.log('Stopping...')
      await database.close(db)
    }
  } catch (error) {
    console.log('Connection error')
  }
}

module.exports = {
  run,
  revert,
}
