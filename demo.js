const {client} = require('tre-client')
const Fonts = require('.')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const setStyle = require('module-styles')('tre-fonts-demo')

setStyle(`
  body {
    --tre-selection-color: green;
    --tre-secondary-selection-color: yellow;
  }
  .tre-fonts-editor {
    max-width: 300px;
  }
`)

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const renderFont = Fonts()

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
})
