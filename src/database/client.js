require('dotenv').config()

const path = require('path')
const { Client } = require('pg')

const createClientFromEnv = () => {
  const { DATABASE_URL } = process.env
  if (DATABASE_URL) {
    return new Client({ connectionString: DATABASE_URL })
  } else {
    return null
  }
}

const createClientFromConfigFile = configFilePath => {
  if (configFilePath) {
    const filePath = path.resolve(configFilePath)
    const config = require(filePath)
    return new Client(config)
  } else {
    return null
  }
}

const create = configFilePath => {
  return (
    createClientFromConfigFile(configFilePath) ||
    createClientFromEnv() ||
    new Client()
  )
}

const connect = async client => {
  try {
    await client.connect()
    console.log('🎆  Connected to DB.')
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

function clientGenerateURL() {
  const { user, password, host, port, database } = this
  const passwordPart = password ? `:${password}` : ''
  return `postgres://${user}${passwordPart}@${host}:${port}/${database}`
}

Client.prototype.databaseURL = Client.prototype.databaseURL || clientGenerateURL

module.exports = {
  create,
  connect,
}
