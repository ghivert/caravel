const fs = require('fs')
const proms = fs.promises

const readFile = async (path, options) => {
  try {
    return await proms.readFile(path, options)
  } catch (error) {
    if (error.code === 'ENOENT') {
      const newError = `${path} does not exists.`
      throw newError
    } else {
      throw error
    }
  }
}

const readdir = async path => {
  try {
    return await proms.readdir(path)
  } catch (error) {
    if (error.code === 'ENOENT') {
      const newError = `${path} does not exists. Create the folder first.`
      throw newError
    } else {
      throw error
    }
  }
}

module.exports = {
  readFile,
  readdir,
}
