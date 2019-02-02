const {client} = require('tre-client')
const Fonts = require('.')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const setStyle = require('module-styles')('tre-fonts-demo')
const collectMutations = require('collect-mutations')
const pull = require('pull-stream')
const Finder = require('tre-finder')
const Shell = require('tre-editor-shell')
const Importer = require('tre-file-importer')
const WatchMerged = require('tre-prototypes')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')

styles()

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const importer = Importer(ssb, config)
  importer.use(require('./common'))
  
  const renderFinder = Finder(ssb, {
    importer,
    skipFirstLevel: true,
    details: (kv, ctx) => {
      return kv && kv.meta && kv.meta["prototype-chain"] ? h('i', '(has proto)') : []
    }
  })

  const renderShell = Shell(ssb, {
    save: (kv, cb) => {
      ssb.publish(kv.value.content, cb)
    }
  })

  const renderFont = Fonts(ssb, {
    prototypes: config.tre.prototypes,
  })

  const where = Value('editor')

  document.body.appendChild(h('.tre-stylesheets-demo', [
    makeSplitPane({horiz: true}, [
      makePane('25%', [
        renderFinder(config.tre.branches.fonts || config.tre.branches.root)
      ]),
      makeDivider(),
      makePane('70%', [
        h('.bar', [
          h('select', {
            'ev-change': e => {
              where.set(e.target.value)
            }
          }, [
            h('option', 'editor'),
            h('option', 'stage'),
            h('option', 'thumbnail')
          ])
        ]),
        computed([where, renderFinder.primarySelectionObs], (where, kv) => {
          if (!kv) return []
          if (where !== 'editor') {
            return renderFont(kv, {where})  
          }
          return renderShell(kv, {
            renderEditor: (kv, ctx) => {
              return makeSplitPane({horiz: true}, [
                makePane('70%', [
                  renderFont(kv, Object.assign({}, ctx, {where}))
                ]),
                makeDivider(),
                makePane('auto', [
                  renderFont(kv, Object.assign({}, ctx, {where: 'thumbnail'}))
                ])
              ])
            }
          })
        })
      ])
    ])
  ]))
})

function content(kv) {
  return kv && kv.value && kv.value.content
}

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv && kv.key
}

function styles() {
  setStyle(`
    body, html, .tre-stylesheets-demo {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    body {
      --tre-selection-color: green;
      --tre-secondary-selection-color: yellow;
      font-family: sans-serif;
    }
    h1 {
      font-size: 18px;
    }
    .pane {
      background: #eee;
    }
    .tre-finder .summary select {
      font-size: 9pt;
      background: transparent;
      border: none;
      width: 50px;
    }
    .tre-finder summary {
      white-space: nowrap;
    }
    .tre-finder summary:focus {
      outline: 1px solid rgba(255,255,255,0.1);
    }
    .tre-fonts-editor {
      max-width: 500px;
    }
  `)
}
