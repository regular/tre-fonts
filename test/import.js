const test = require('tape')
const {importFile} = require('../common')
const pull = require('pull-stream')

const TYPE = 'font'

test('import single file', t => {

  let data
  const ssb = {blobs: {
    add: (cb)=> {
      return pull.collect( (err, _data) => {
        data = _data
        return cb(err, 'HASH')
      })
    }
  }}
  const file = {
    name: 'a-file-name.ttf',
    size: 20,
    type: 'font/whatever',
    lastModified: 2222
  }
  const source = () => pull.values(['Hello', 'World'])
  const opts = {
    prototypes: {
      [TYPE]: 'foo'
    }
  }
  file.source = source

  importFile(ssb, file, source, opts, (err, result) => {
    t.notOk(err, 'no error')
    console.log(result)
    t.equal(result.type, TYPE, 'has correct type')
    t.equal(result.prototype, 'foo', 'has correct prototype')
    delete file.source
    t.deepEqual(result.files[0], Object.assign({link: 'HASH'}, file), 'files[0] is our file')
    t.ok(result.name, 'has a name')
    t.ok(result['font-family'], 'has font family')
    t.equal(data.join(''), 'HelloWorld', 'streamed file content into blob')
    t.end()
  })
})

test('import multiple files', t => {

  let data = []
  const ssb = {blobs: {
    add: (cb)=> {
      return pull.collect( (err, _data) => {
        data.push(_data)
        return cb(err, 'HASH')
      })
    }
  }}
  const file1 = {
    name: 'a-file-name.ttf',
    size: 20,
    type: 'font/whatever',
    lastModified: 5555555,
    source: () => pull.values(['Hello', 'World'])
  }
  const file2 = {
    name: 'another-file-name.otf',
    size: 40,
    type: 'font/whatever',
    lastModified: 333333,
    source: () => pull.values(['foo', 'bar'])
  }
  const opts = {
    prototypes: {
      [TYPE]: 'foo'
    }
  }

  importFile(ssb, [file1, file2], null, opts, (err, result) => {
    t.notOk(err, 'no error')
    console.log(result)
    t.equal(result.type, TYPE, 'has correct type')
    t.equal(result.prototype, 'foo', 'has correct prototype')
    t.ok(result.name, 'has a name')
    t.ok(result['font-family'], 'has font family')
    t.equal(result.files.length, 2, 'has two files')
    delete file1.source
    t.deepEqual(result.files[0], Object.assign({link: 'HASH'}, file1), 'files[0] is our file')
    delete file2.source
    t.deepEqual(result.files[1], Object.assign({link: 'HASH'}, file2), 'files[1] is our file')
    t.equal(data[0].join(''), 'HelloWorld', 'streamed file1 content into blob')
    t.equal(data[1].join(''), 'foobar', 'streamed file2 content into blob')
    t.end()
  })
})
