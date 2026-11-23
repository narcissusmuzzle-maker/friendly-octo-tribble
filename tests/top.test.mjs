import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// сборщик часов понимает импорт без расширения, Node — нет: в копии дописываем .js
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'top-'))
fs.cpSync(path.join(root, 'shared'), path.join(tmp, 'shared'), { recursive: true })
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
const tf = path.join(tmp, 'shared', 'top.js')
fs.writeFileSync(tf, fs.readFileSync(tf, 'utf8').replace(/from '(\.\/\w+)'/g, "from '$1.js'"))
const top = await import(pathToFileURL(tf).href)

const six = [0x43a857, 0x9cc24b, 0xe0c441, 0xd1544e, 0xe38b3f, 0x3a3a3a]
function typedMock(m) { return { getInt64: (k, d) => (k in m ? m[k] : d), getInt: (k, d) => (k in m ? m[k] : d) } }
function typedData(colors, at) { const m = { at }; colors.forEach((c, i) => { m['c' + i] = c }); return m }
function fileMock(m, existed = true) { return { isExisted: () => existed, getItem: (k, d) => (k in m ? m[k] : d) } }

// у приложения U613 Stat appId 1061613, как в его app.json
assert.equal(top.STAT_APP_ID, 1061613)
assert.equal(top.SCOPE, 'u613stat')
assert.equal(top.FILE, 'u613stat.json')

// TypedStorage
assert.deepEqual(top.fromTyped(typedMock(typedData(six, 5000))), { colors: six, at: 5000 })
assert.equal(top.fromTyped(typedMock({})), null, 'приложение ещё не записывало')
assert.equal(top.fromTyped(typedMock(typedData(six.slice(0, 5), 5000))), null, 'не хватает цвета')
// файл
assert.deepEqual(top.fromFile(fileMock({ top: six, at: 7000 })), { colors: six, at: 7000 })
assert.equal(top.fromFile(fileMock({ top: six, at: 7000 }, false)), null, 'файла нет')
assert.equal(top.fromFile(fileMock({ top: [1, 2], at: 7000 })), null)
assert.equal(top.fromFile(fileMock({ top: six })), null, 'нет времени записи')

// readTop: берётся то, что записано позже
const other = [1, 2, 3, 4, 5, 6]
let r = top.readTop({ typed: () => typedMock(typedData(six, 5000)), file: () => fileMock({ top: other, at: 9000 }) })
assert.deepEqual(r.colors, other); assert.equal(r.at, 9000); assert.equal(r.apiDown, false); assert.equal(r.errs, '')
r = top.readTop({ typed: () => typedMock(typedData(six, 9500)), file: () => fileMock({ top: other, at: 9000 }) })
assert.deepEqual(r.colors, six)
// одно место не открылось — работает второе
r = top.readTop({ typed: () => { throw new Error('нет такого API') }, file: () => fileMock({ top: other, at: 9000 }) })
assert.deepEqual(r.colors, other); assert.equal(r.apiDown, false); assert.ok(r.errs.indexOf('typed') === 0)
// ни одно — apiDown
r = top.readTop({ typed: () => { throw new Error('a') }, file: () => { throw new Error('b') } })
assert.equal(r.colors, null); assert.equal(r.apiDown, true)
// данных нет, но API работает — серые, без ошибки
r = top.readTop({ typed: () => typedMock({}), file: () => fileMock({}, false) })
assert.equal(r.colors, null); assert.equal(r.apiDown, false)
console.log('top: ok')
