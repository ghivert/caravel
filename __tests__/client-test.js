const path = require('path')
const fs = require('fs')

const { initialize, close } = require('../src/database')

const TMP_PATH = path.resolve('./tmp')
const CONFIG_NAME = path.resolve(TMP_PATH, 'config.json')
const ENV_FILE = path.resolve('./.env')

const DB_USER = 'doctor'
const DB_HOST = 'localhost'
const DB_PORT = 5432
const DB_NAME = 'caravel_test'
const LOCALHOST = 'localhost'

const generateDatabaseURL = () => {
  return `postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
}

const createTmpDirectory = () => {
  fs.mkdirSync(TMP_PATH)
  fs.writeFileSync(
    CONFIG_NAME,
    JSON.stringify({
      user: DB_USER,
      database: DB_NAME,
      port: DB_PORT,
      host: DB_HOST,
    })
  )
}

const deleteTmpDirectory = () => {
  fs.unlinkSync(CONFIG_NAME)
  fs.rmdirSync(TMP_PATH)
}

const testClient = client => {
  expect(client.user).toEqual(DB_USER)
  expect(client.database).toEqual(DB_NAME)
  expect(client.port).toEqual(DB_PORT)
  expect(client.host).toEqual(DB_HOST)
  expect(client.password).toBeNull()
}

describe('The database client, during creation', () => {
  beforeAll(createTmpDirectory)
  afterAll(deleteTmpDirectory)

  it('should be able to read a config file', async () => {
    const { client } = await initialize('./tmp/config.json')
    testClient(client)
    await close({ client })
  })

  it('should be able to read a global DATABASE_URL variable', async () => {
    process.env.DATABASE_URL = generateDatabaseURL()
    const { client } = await initialize()
    testClient(client)
    delete process.env.DATABASE_URL
    await close({ client })
  })

  it('should be able to read a local DATABASE_URL variable in a .env file', async () => {
    fs.writeFileSync(ENV_FILE, `DATABASE_URL = ${generateDatabaseURL()}`)
    // Here because require('dotenv').config() is loaded during require.
    require('dotenv').config()
    const { client } = await initialize()
    testClient(client)
    delete process.env.DATABASE_URL
    fs.unlinkSync(ENV_FILE)
    await close({ client })
  })

  it('should be able to read config from global environment', async () => {
    const { client } = await initialize()
    const { PGUSER, PGDATABASE, PGPORT, PGHOST, PGPASSWORD, USER } = process.env
    expect(client.user).toEqual(PGUSER || USER)
    expect(client.database).toEqual(PGDATABASE || USER)
    expect(client.port).toEqual(PGPORT || 5432)
    expect(client.host).toEqual(PGHOST || LOCALHOST)
    expect(client.password).toEqual(PGPASSWORD || null)
    await close({ client })
  })
})
