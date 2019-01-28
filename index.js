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

setStyle(`
  .tre-fonts-editor .tre-dropzone {
    min-width: 400px;
    min-height: 50px;
    border-radius: 20px;
    border: 8px dashed #eee;
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

function RenderCSS(ssb) {
  const blobPrefix = Value()
  ssb.ws.getAddress((err, address) => {
    if (err) return console.error(err)
    address = address.replace(/^ws:\/\//, 'http://').replace(/~.*$/, '/blobs/get/')
    blobPrefix.set(address)
  })
  
  return function renderCSS(kv, ctx) {
    const content = kv.value && kv.value.content
    if (!content) return

    const css = computed(blobPrefix, bp => {
      const sources = (content.files || []).map( f => {
        return `src: url("${bp + encodeURIComponent(f.link)}");`
      }).join('\n')
      return `
        @font-face {
          font-family: "${content['font-family']}";
          ${sources}
        }
      `
    })

    return h('style', {
      attributes: {
        "data-key": kv.key
      }
    }, css) 
  }
}


function renderPreview(arr) {
  const font_id = 'font-' + crypto.randomBytes(8).toString('hex')

  const sources = MutantMap(arr, file => {
    const css = Value('')
    dataUri(file, (err, uri) => {
      if (err) return console.error(err.message)
      css.set(`src: url("${uri}");`)
    })
    return css
  })
  const css = computed(sources, s => {
    return `
      @font-face {
        font-family: "${font_id}";
        ${s.join('\n')}
      }
    `
  })
  return h('div.font-preview', {
    attributes: {
      style: `font-family: "${font_id}";`,
    }
  }, [
    h('style', css),
    [7,9,10,12,16,18,24].map( pt => {
      return h('div', {
        attributes: {
          style: `font-size: ${pt}pt;`
        }
      }, `${pt}pt: The quick brown fox jumps over the lazy dog.`)
    })
  ])
}

function RenderEditor(ssb, opts) {
  opts = opts || {}
  const {prototypes} = opts
  if (!prototypes) throw new Error('need prototypes!')
  
  return function renderEditor(kv, ctx) {
    ctx = ctx || {}
    const content = kv.value && kv.value.content
    if (!content) return
    const contentObs = ctx.contentObs || Value(content)
    const name = computed(contentObs, c => c.name)
    const files = computed(contentObs, c => c.files || [])
    const stati = MutantArray() 

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
          const entry = files().find( f => f.name == file.name) 
          console.log('entry', entry)
          if (entry) {
            const f = files()
            f.delete(entry)
            set({files: f})
          }
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
      renderPreview(files),
      h('button', {
        'ev-click': e => {
          const sourceFiles = files().map(file=>{
            file.source = opts => FileSource(file, opts)
            return file
          })
          importFonts(ssb, sourceFiles, stati, prototypes, (err, content) => {
            if (err) return console.error(err)
            if (opts.save) opts.save(content)
          })
        }
      }, 'Apply')
    ])
  }
}

module.exports = function(ssb, opts) {
  opts = opts || {}

  const renderEditor = RenderEditor(ssb, opts)
  const renderCSS = RenderCSS(ssb, opts)

  return function render(kv, ctx) {
    ctx = ctx || {}
    const content = kv.value && kv.value.content
    if (content.type !== 'font') return

    function renderTile(kv, ctx) {
      const content = kv.value && kv.value.content
      return h('div', {
        style: { 
          'font-family': content['font-family'],
          'font-size': '45px'
        }
      }, [
        renderCSS(kv),
        'Aa'
      ])
    }

    if (ctx.where == 'editor') {
      return renderEditor(kv, ctx)
    } else if (ctx.where == 'tile') {
      return renderTile(kv, ctx)
    }
    return renderCSS(kv, ctx)
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

function importFonts(ssb, files, stati, prototypes, cb) {
  const n = files.length
  if (!n) return cb(null)
  if (stati().length !== n) {
    stati.set(Array(n).map(x => Value(false)))
  }
  importFiles(ssb, files, {prototypes, onProgress}, cb)

  function onProgress(file, err) {
    let i = files.indexOf(file)
    console.log('progress', file, i, err)
    if (err) stat.put(i, err)
    else stati.put(i, true)
  }
}
