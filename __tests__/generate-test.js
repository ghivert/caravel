const path = require('path')
const fs = require('fs')

const generate = require('../src/generate')
const helpers = require('../src/helpers')

const MIGRATIONS_PATH = path.resolve('db/migrations')
const CUSTOM_PATH = path.resolve('custom-migrations')
const NAME = 'create-user-table'

const migration = (path, name) => {
  return generate.migration(path, name, { verbose: false })
}

const deleteMigration = filename => {
  fs.unlinkSync(path.resolve(MIGRATIONS_PATH, filename))
}

const deleteMigrationsDirectory = () => {
  try {
    fs.accessSync(MIGRATIONS_PATH)
    const content = fs.readdirSync(MIGRATIONS_PATH)
    content.forEach(deleteMigration)
    fs.rmdirSync(MIGRATIONS_PATH)
    fs.rmdirSync(path.resolve(MIGRATIONS_PATH, '..'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(error)
    }
  }
}

const generateFilenameRegexp = name => {
  return `.*-${name}\\.(up|down)\\.sql`
}

const checkCorrectFileGenerated = (name, filename) => {
  return filename.match(new RegExp(generateFilenameRegexp(name))) ? 1 : 0
}

const checkFolderExists = path => {
  return helpers.access(path, fs.constants.F_OK | fs.constants.W_OK)
}

const generateFiles = migrationsPath => file => {
  const filePath = path.resolve(migrationsPath, file)
  helpers.writeFile(filePath, '')
}

const generateMigrationsFolderAndFiles = async (migrationsPath, filenames) => {
  await helpers.mkdir(migrationsPath, { recursive: true })
  if (filenames) {
    const filesName = helpers.generateUpAndDownFileNames(Date.now(), filenames)
    return Promise.all(filesName.map(generateFiles(migrationsPath)))
  }
}

const checkHowMuchFileGenerated = (dirContent, name) => {
  const reducer = (acc, val) => acc + checkCorrectFileGenerated(name, val)
  const matched = dirContent.reduce(reducer, 0)
  expect(matched).toEqual(2)
}

const unlinkFile = filename => {
  helpers.unlink(path.resolve(CUSTOM_PATH, filename))
}

describe('The migrations generation', () => {
  describe('When called', () => {
    beforeAll(deleteMigrationsDirectory)
    afterEach(deleteMigrationsDirectory)

    it('should generate two files with a timestamp in default folder and generating it', async () => {
      await migration(null, NAME)
      await checkFolderExists(MIGRATIONS_PATH)
      const dirContent = await helpers.readdir(MIGRATIONS_PATH)
      expect(dirContent.length).toEqual(2)
      checkHowMuchFileGenerated(dirContent, NAME)
    })

    it('should generate two files with a timestamp in default folder already existing', async () => {
      await generateMigrationsFolderAndFiles(MIGRATIONS_PATH)
      await migration(null, NAME)
      await checkFolderExists(MIGRATIONS_PATH)
      const dirContent = await helpers.readdir(MIGRATIONS_PATH)
      expect(dirContent.length).toEqual(2)
      checkHowMuchFileGenerated(dirContent, NAME)
    })

    it('should generate two files with a timestamp without deleting old files', async () => {
      const OTHER_FILENAMES = ['create-posts-table']
      await generateMigrationsFolderAndFiles(MIGRATIONS_PATH, OTHER_FILENAMES)
      await migration(null, NAME)
      const dirContent = await helpers.readdir(MIGRATIONS_PATH)
      expect(dirContent.length).toEqual(4)
      checkHowMuchFileGenerated(dirContent, NAME)
    })

    it('should generate two files with a timestamp in a custom folder', async () => {
      await migration(CUSTOM_PATH, NAME)
      await checkFolderExists(CUSTOM_PATH)
      const dirContent = await helpers.readdir(CUSTOM_PATH)
      expect(dirContent.length).toEqual(2)
      checkHowMuchFileGenerated(dirContent, NAME)
      await Promise.all(dirContent.map(unlinkFile))
      await helpers.rmdir(CUSTOM_PATH)
    })

    it('should not generate files if no filename given', async () => {
      try {
        await migration(null, '')
        await checkFolderExists(MIGRATIONS_PATH)
      } catch (error) {
        expect(error.code).toEqual('ENOENT')
      }
    })
  })
})
