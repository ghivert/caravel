require('dotenv').config()

const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const helpers = require('./helpers')
const { MIGRATIONS_FOLDER } = require('./constants')

const writeMigrationFile = options => filename => {
  if (options.verbose) {
    console.log(chalk.bold.green(`Creating ${filename}...`))
  }
  return helpers.writeFile(filename, '-- Your migration code here.')
}

const turnIntoAbsolutePath = migrationsPath => filename => {
  return path.resolve(migrationsPath, filename)
}

const handleAccessError = (migrationsPath, options) => error => {
  if (error.code === 'ENOENT') {
    if (options.verbose) {
      const str = 'No corresponding migration folder. Creating...'
      const message = chalk.bold.green(str)
      console.log(message)
    }
    return helpers.mkdir(migrationsPath, { recursive: true })
  } else {
    throw error
  }
}

const generateFiles = (migrationsPath, name, options) => () => {
  const writtenFiles = helpers
    .generateUpAndDownFileNames(Date.now(), name)
    .map(turnIntoAbsolutePath(migrationsPath))
    .map(writeMigrationFile(options))
  return Promise.all(writtenFiles)
}

const displayError = ({ verbose }) => error => {
  if (verbose) {
    console.error(error)
  }
}

const createMigrationsFolderAndFiles = (migrationsPath, name, options) => {
  return helpers
    .access(migrationsPath, fs.constants.F_OK | fs.constants.W_OK)
    .catch(handleAccessError(migrationsPath, options))
    .then(generateFiles(migrationsPath, name, options))
    .catch(displayError(options))
}

const migration = (migrationsFolder, name, options = { verbose: true }) => {
  if (name.length === 0) {
    if (options.verbose) {
      const str = 'You did not specified migration name. Aborting.'
      const message = chalk.bold.red(str)
      console.error(message)
      return false
    }
    return false
  } else {
    const migrationsPath = path.resolve(migrationsFolder || MIGRATIONS_FOLDER)
    const dashedName = name.replace(' ', '-')
    return createMigrationsFolderAndFiles(migrationsPath, dashedName, options)
  }
}

module.exports = {
  migration,
}
