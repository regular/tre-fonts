const {client} = require('tre-client')
const Fonts = require('.')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const setStyle = require('module-styles')('tre-fonts-demo')
const collectMutations = require('collect-mutations')
const pull = require('pull-stream')

setStyle(`
  body {
    --tre-selection-color: green;
    --tre-secondary-selection-color: yellow;
  }
  .tre-fonts-editor {
    max-width: 500px;
  }
`)

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const renderFont = Fonts(ssb, {
    save: content => {
      console.log('new content', content)
      ssb.publish(content)
    }
  })

  const kv = {
    key: 'fake-key',
    value: {
      content: {
        name: 'Dummy Font',
        type: 'font',
        files: []
      }
    }
  }

  document.body.appendChild(
    renderFont(kv, {
      where: 'editor'
    })
  )

  const fonts = MutantArray()
  const fontElements = MutantMap(fonts, kv=>{
    console.log('rendering', kv())
    return renderFont(kv())
  })
  document.head.appendChild(
    h('div.fonts', {}, fontElements)
  )

  pull(
    ssb.revisions.messagesByType('font'),
    collectMutations(fonts)
  )

})
