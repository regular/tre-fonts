const h = require('mutant/html-element')
const Value = require('mutant/value')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
//const List = require('tre-sortable-list')
const setStyle = require('module-styles')('tre-fonts')
const prettyBytes = require('pretty-bytes')

setStyle(`
  .drop-zone {
    width: min-content;
    min-width: 300px;
    height: min-content;
    min-height: 50px;
    border-radius: 20px;
    border: 8px dashed #eee;
    padding: 1em;
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
    grid-template-columns: 4em 1fr 5em 4em; 
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
      if (opts.on_drop) files.forEach(opts.on_drop)
    }
  }, children)
  return el
}

function renderCSS(kv, ctx) {
  const c = kv.value && kv.value.content
  return `
    @font-face {
      font-family: ${c['font-family']};
      src: url(${config.blobsRoot}/${c.src}) format("${c.format}");
    }
  `
}

function renderEditor(kv, ctx) {
  const content = kv.value && kv.value.content
  const sorterObv = Value(byName)
  const files = MutantArray(content.files || [])

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
    return [
      removeButton(file),
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
    h('h1', content.name),
    dropZone({
      on_drop: file => files.push(file)
    }, [renderList(files)]),
    h('button', 'Apply')
  ])
}

module.exports = function(opts) {
  opts = opts || {}

  return function render(kv, ctx) {
    const content = kv.value && kv.value.content
    if (content.type !== 'font') return

    if (ctx.where == 'editor') {
      return renderEditor(kv, ctx)
    }
    return renderCSS(kv, ctx)
  }
}

function byName(a, b) {
  const aname = a.name.toLowerCase()
  const bname = b.name.toLowerCase()
  if (aname == bname) return 0
  if (aname < bname) return -1
  return 1
}
