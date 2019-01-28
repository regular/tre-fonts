const pull = require('pull-stream')

module.exports = {
  importFiles,
  factory
}

function importFiles(ssb, files, opts, cb) {
  opts = opts || {}
  const prototypes = opts.prototypes || {}
  files = !Array.isArray(files) ? [files] : files
  const {onProgress} = opts

  pull(
    pull.values(files),
    pull.filter(file => {
      if (/^font\//.test(file.type)) return true
      if (/^application\/x-font/.test(file.type)) return true
      if (/\.otf|.ttf$/.test(file.name)) return true
      return false
    }),
    pull.asyncMap( (file, cb) => {
      console.log('file', file)
      pull(
        file.source(),
        ssb.blobs.add( (err, hash) => {
          if (onProgress) onProgress(file, err)
          if (err) return cb(err)
          
          // Object.assign does not work with file objects
          const result = {
            lastModified: file.lastModified,
            name: file.name,
            size: file.size,
            type: file.type,
            link: hash
          }
          cb(null, result)
        })
      )
    }),
    pull.collect( (err, files) => {
      if (err) return cb(err)
      if (files.length == 0) return cb(true)
      const name = titleize(files[0].name)
      const content = {
        type: 'font',
        prototype: prototypes.font,
        name,
        files,
        'font-family': name
      }
      return cb(null, content)
    })
  )
}

function titleize(filename) {
  return filename.replace(/\.\w{3,4}$/, '').replace(/-/g, ' ')
}

function factory(config) {
  const type = 'font'
  return {
    type,
    i18n: {
      'en': 'Font'
    },
    prototype: function() {
      return {
        type,
        schema: {
          description: 'A Font (various file formats, including ttf and otf)',
          type: 'object',
          required: ['type', 'font'],
          properties: {
            type: { "const": type },
            'font-family': { type: 'string' },
          }
        }
      }
    },
    content: function() {
      return {
        type,
        prototype: config.tre.prototypes[type],
        name: 'unnamed',
        'font-family': 'unnamed'
      }
    }
  }
}
