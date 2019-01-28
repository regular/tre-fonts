const crypto = require('crypto')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const prettyBytes = require('pretty-bytes')
const setStyle = require('module-styles')('tre-fonts')
const Str = require('tre-string')
const dropzone = require('tre-dropzone')
const FileSource = require('tre-file-importer/file-source')
const {importFiles} = require('./common')

module.exports = function(ssb, opts) {
  opts = opts || {}
  const {prototypes} = opts
  if (!prototypes) throw new Error('need prototypes!')

  styles()
  const blobPrefix = Value()
  ssb.ws.getAddress((err, address) => {
    if (err) return console.error(err)
    address = address.replace(/^ws:\/\//, 'http://').replace(/~.*$/, '/blobs/get/')
    blobPrefix.set(address)
  })

  return function render(kv, ctx) {
    ctx = ctx || {}
    const content = kv.value && kv.value.content
    if (content.type !== 'font') return

    function renderTile(kv, ctx) {
      const content = kv.value && kv.value.content
      if (!content) return
      return h('div', {
        style: { 
          'font-family': content['font-family'],
          'font-size': '45px'
        }
      }, [
        renderStyleTag(kv),
        'Aa'
      ])
    }

    if (ctx.where == 'editor') {
      return renderEditor(kv, ctx)
    } else if (ctx.where == 'thumbnail') {
      return renderTile(kv, ctx)
    }
    return renderStyleTag(kv, ctx)
  }


  function sourceFromFile(file) {
    if (file.link) {
      return computed(blobPrefix, bp => {
        return `src: url("${bp + encodeURIComponent(file.link)}");`
      })
    } else {
      const src = Value('')
      dataUri(file, (err, uri) => {
        if (err) return console.error(err.message)
        src.set(`src: url("${uri}");`)
      })
      return src
    }
  }
  function sourcesFromFiles(files) {
    console.log('files',files)
    return computed(files.map(sourceFromFile), (...args) => {
      return args.join('\n')
    })
  }

  function cssFromContent(content) {
    const sources = sourcesFromFiles(content.files)
    return computed(sources, (...sources) => {
      return `
        @font-face {
          font-family: "${content['font-family']}";
          ${sources.join('\n')}
        }
      `
    })
  }

  function renderStyleTag(kv, ctx) {
    const content = kv.value && kv.value.content
    if (!content) return

    return h('style', {
      attributes: {
        "data-key": kv.key
      }
    }, cssFromContent(content)) 
  }

  function renderPreview(files) {
    const font_id = 'font-' + crypto.randomBytes(8).toString('hex')
    const sources = sourcesFromFiles(files)
    const css = computed(sources, (...sources) => {
      return `
        @font-face {
          font-family: "${font_id}";
          ${sources.join('\n')}
        }
      `
    })
    return h('div.font-preview', {
      attributes: {
        style: `font-family: "${font_id}";`,
      }
    }, [
      h('style', css),
      [7,10,16,24].map( pt => {
        return h('div', {
          attributes: {
            style: `font-size: ${pt}pt;`
          }
        }, `${pt}pt: The quick brown fox jumps over the lazy dog.`)
      })
    ])
  }

  function renderEditor(kv, ctx) {
    ctx = ctx || {}
    const content = kv.value && kv.value.content
    if (!content) return
    const contentObs = ctx.contentObs || Value(content)
    const name = computed(contentObs, c => c.name)
    const files = computed(contentObs, c => c.files || [])
    const stati = MutantArray() 
    const uploadDisabled = computed(files, files =>{
      return !files.find(f => !f.link) 
    })

    function set(o) {
      contentObs.set(Object.assign({}, contentObs(), o))
    }

    renderStr = Str({
      save: text => {
        set({name: text})
        console.log('new name', text)
      }
    })

    function removeButton(file) {
      return h('button', {
        'ev-click': e => {
          const f = files().filter(f=> f.name !== file.name)
          set({files: f})
        }
      }, 'remove')
    }
    
    function renderItem(file) {
      const i = files().indexOf(file)
      const status = computed(stati, s => {
        return s[i] ? s[i] :  ''
      })
      return [
        removeButton(file),
        h('span', status),
        h('span', file.name),
        h('span', file.type),
        h('span', prettyBytes(file.size))
      ]
    }

    const renderList = function() {
      return computed(files, f => {
        updateStati()
        if (!f.length) return h('span.placeholder', 'Drag font files here')
        return h('.list', MutantMap(files, renderItem))
      })
    }

    return h('.tre-fonts-editor', [
      h('h1', renderStr(computed(name, n => n ? n : 'No Name'))),
      h('p.description', `
        Change the name above by clicking on it. Then drag font files to the box below. You can provide multiple files, but you don't have to. If you do, they all should be the same fornt in different file formats (ttf, woff, ..). You will see a preview of the font below. Click 'Apply' to save your changes.
      `),
      dropzone({
        on_file_drop: file => {
          if (!name()) set({name: titleize(file.name)})
          const f = files()
          f.push(file)
          set({files: f})
        }
      }, [renderList()]),
      computed(files, files => files.length ? renderPreview(files) : []),
      h('button', {
        disabled: uploadDisabled,
        'ev-click': e => {
          const sourceFiles = files().map(file=>{
            if (!file.link) {
              file.source = opts => FileSource(file, opts)
            }
            return file
          })
          importFonts(sourceFiles, stati, prototypes, (err, content) => {
            if (err) return console.error(err)
            if (opts.save) opts.save(content)
          })
        }
      }, 'Upload')
    ])

    function updateStati() {
      const n = files.length
      if (stati().length !== n) {
        stati.set(files().map(f => Value(Boolean(f.link))))
      }
    }

    function importFonts(files, stati, prototypes, cb) {
      const n = files.length
      if (!n) return cb(null)
      updateStati()
      const newFiles = files.filter(f => !f.link)
      const oldFiles = files.filter(f => f.link)
      oldFiles.forEach(f => onProgress(f, true))

      importFiles(ssb, newFiles, {prototypes, onProgress}, (err, content) => {
        if (err) return cb(err)
        set({files: content.files.concat(oldFiles)})
      })

      function onProgress(file, err) {
        let i = files.indexOf(file)
        console.log('progress', file, i, err)
        if (err) stati.put(i, err)
        else stati.put(i, true)
      }
    }
  }

}

// -- utils

function titleize(filename) {
  return filename.replace(/\.\w{3,4}$/, '').replace(/-/g, ' ')
}

function dataUri(file, cb) {
  const reader = new global.FileReader()
  reader.onload = e => cb(null, e.target.result)
  reader.readAsDataURL(file)
}


function styles() {
  setStyle(`
    .tre-fonts-editor .tre-dropzone {
      min-width: 400px;
      min-height: 50px;
      border-radius: 20px;
      border: 8px dashed #ccc;
      padding: 1em;
      margin: 1em;
    }
    .tre-fonts-editor .tre-dropzone.drag {
      border-color: #777;
    }
    .tre-fonts-editor .list {
      display: grid; 
      grid-template-columns: 4em 3em 1fr 5em 4em; 
      width: min-content;
    }
    .tre-fonts-editor .list > * {
      margin: .1em .2em;
    }
    .tre-fonts-editor .placeholder {
      color: #555;
    }
  `)
}
