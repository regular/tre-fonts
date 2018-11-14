const crypto = require('crypto')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const prettyBytes = require('pretty-bytes')
const blobFiles = require('ssb-blob-files')
const setStyle = require('module-styles')('tre-fonts')
const Str = require('tre-string')

setStyle(`
  .drop-zone {
    width: min-content;
    min-width: 400px;
    height: min-content;
    min-height: 50px;
    border-radius: 20px;
    border: 8px dashed #eee;
    padding: 1em;
    margin: 1em;
  }
  .drop-zone.drag {
    border-radius: 20px;
    border: 8px dashed #777;
  }
  .drag * {
    pointer-events: none;
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

function dropZone(opts, children) {
  const el = h('div.drop-zone', {
    'ev-dragenter': e => {
      e.target.classList.add('drag')
      e.stopPropagation()
    },
    'ev-dragleave': e => {
      e.target.classList.remove('drag')
      e.stopPropagation()
    },
    'ev-dragover': e => {
      e.dataTransfer.dropEffect = 'all'
      e.preventDefault()
      e.stopPropagation()
    },
    'ev-drop': e => {
      e.preventDefault()
      e.stopPropagation()
      el.classList.remove('drag')
      const files = [].slice.apply(
        e.dataTransfer.files
      )
      console.log(files)
      if (opts.on_drop) {
        files.forEach(opts.on_drop)
      }
    }
  }, children)
  return el
}

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
      const sources = content.files.map( f => {
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
  return function renderEditor(kv, ctx) {
    const content = kv.value && kv.value.content
    const files = MutantArray(content.files || [])
    const stati = MutantArray() 
    const name = Value(content.name)

    renderStr = Str({
      save: text => {
        name.set(text)
        console.log('new name', text)
      }
    })

    function removeButton(file) {
      return h('button', {
        'ev-click': e => {
          const entry = files.find( f => f.name == file.name) 
          console.log('entry', entry)
          if (entry) files.delete(entry)
        }
      }, 'remove')
    }
    
    function renderItem(file) {
      const i = files.indexOf(file)
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

    const renderList = function(arr) {
      const placeholder = h('span.placeholder', 'Drag font files here')

      const entries = computed(arr, a => {
        return a.length ? h('.list', 
          MutantMap(arr, renderItem)) :
          placeholder
      })
      return entries
    }

    return h('.tre-fonts-editor', [
      h('h1', renderStr(computed(name, n => n ? n : 'No Name'))),
      h('p.description', `
        Change the name above by clicking on it. Then drag font files to the box below. You can provide multiple files, but you don't have to. If you do, they all should be the same fornt in different file formats (ttf, woff, ..). You will see a preview of the font below. Click 'Apply' to save your changes.
      `),
      dropZone({
        on_drop: file => {
          if (!name()) name.set(titleize(file.name))
          files.push(file)
        }
      }, [renderList(files)]),
      renderPreview(files),
      h('button', {
        'ev-click': e => {
          importFiles(ssb, files(), stati, (err, results) => {
            if (err) return console.error(err)
            const content = {
              type: 'font',
              name: name(),
              "font-family": name(),
              files: results.map( ({result}) => result)
            }
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

    if (ctx.where == 'editor') {
      return renderEditor(kv, ctx)
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

function importFiles(ssb, files, stati, cb) {
  const n = files.length
  if (!n) return cb(null)
  stati.set(Array(n).map(x => Value(false)))
  let i=0
  const results = []
  let err = null
  blobFiles(files, ssb, (_err, result) => {
    if (_err) stat.put(i, _err)
    else stati.put(i, true)
    if (_err) err = _err
    results.push({_err, result})
    if (++i == n) cb(err, results)
  })
}
