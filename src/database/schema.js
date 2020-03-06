const { exec } = require('child_process')
const path = require('path')
const fs = require('fs').promises

const pgDump = async database => {
  const commandPath = path.resolve(__dirname, 'dump-schema.sh')
  const command = await fs.readFile(commandPath, 'utf8')
  const resolver = resolve => (err, out) => resolve(out.replace(/.*\n/, ''))
  return new Promise(resolve => {
    const correctCommand = command.replace('${database}', database)
    exec(correctCommand, resolver(resolve))
  })
}

const dump = async (folder, client) => {
  const database = client.database
  const res = await pgDump(database)
  return fs.writeFile(path.resolve(folder, '../schema.sql'), res)
}

module.exports = {
  dump,
}
