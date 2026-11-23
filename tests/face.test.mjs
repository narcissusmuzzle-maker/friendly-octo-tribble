// Прогон циферблата в Node: вместо API часов подставляются заглушки, проверяется, что создаётся, какие цвета читаются и куда ведут нажатия.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'face-'))
fs.cpSync(path.join(root, 'watchface'), path.join(tmp, 'watchface'), { recursive: true })
fs.cpSync(path.join(root, 'shared'), path.join(tmp, 'shared'), { recursive: true })
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
// сборщик часов понимает импорт без расширения, Node — нет: в копиях дописываем .js
for (const f of [path.join(tmp, 'watchface', 'index.js'), path.join(tmp, 'shared', 'top.js')]) {
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/from '((?:\.\.?\/)(?:shared\/)?\w+)'/g, "from '$1.js'"))
}
const mod = (name, code) => {
  const d = path.join(tmp, 'node_modules', ...name.split('/'))
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name, type: 'module', main: 'index.js' }))
  fs.writeFileSync(path.join(d, 'index.js'), code)
}
mod('@zos/ui', `
export const widget = { FILL_RECT: 'FILL_RECT', BUTTON: 'BUTTON', TEXT: 'TEXT', WIDGET_DELEGATE: 'WIDGET_DELEGATE' }
export const prop = { TEXT: 'text', MORE: 'more' }
export const align = { CENTER_H: 1, CENTER_V: 2 }
export function createWidget(type, p) {
  const w = { type, p, setProperty(k, v) { if (k === 'more') Object.assign(w.p, v); else w.p[k] = v } }
  globalThis.__widgets.push(w)
  return w
}
`)
mod('@zos/router', `export function launchApp(a) { globalThis.__launched.push(a) }`)
mod('@zos/timer', `
export function createTimer(d, p, cb) { globalThis.__timers.push({ d, p, cb }); return globalThis.__timers.length }
export function stopTimer(id) { globalThis.__stopped.push(id) }
`)
// общее хранилище: данные задаются тестом (globalThis.__share = { typed: {...}, file: {...} | null })
mod('@zos/share-storage', `
export class TypedStorage {
  constructor(appId, scope) { this.m = (globalThis.__share.typed || {}); globalThis.__opened.push(['typed', appId, scope]) }
  getInt(k, d) { return k in this.m ? this.m[k] : d }
  getInt64(k, d) { return k in this.m ? this.m[k] : d }
}
export class LocalStorage {
  constructor(appId, file) { this.m = globalThis.__share.file; globalThis.__opened.push(['file', appId, file]) }
  isExisted() { return !!this.m }
  getItem(k, d) { return this.m && k in this.m ? this.m[k] : d }
}
`)

globalThis.__widgets = []
globalThis.__launched = []
globalThis.__timers = []
globalThis.__stopped = []
globalThis.__opened = []
globalThis.__share = { typed: {}, file: null }   // приложение ещё ничего не записало
let face = null
globalThis.WatchFace = (o) => { face = o }
await import(pathToFileURL(path.join(tmp, 'watchface', 'index.js')).href)
assert.ok(face && typeof face.build === 'function')
face.build()

const W = globalThis.__widgets
const rects = W.filter((w) => w.type === 'FILL_RECT')
const hitBtn = W.find((w) => w.type === 'BUTTON' && w.p.normal_src === 'hit.png')
const btns = W.filter((w) => w.type === 'BUTTON' && w.p.normal_src !== 'hit.png')
// чёрный фон на весь экран + 2 полоски по 3 сегмента
assert.equal(rects.length, 1 + 6)
assert.deepEqual([rects[0].p.w, rects[0].p.h, rects[0].p.color], [432, 514, 0])
const seg = rects.slice(1)
// данных ещё нет — все шесть серые, тем же серым, что в U613 Stat
for (const r of seg) assert.equal(r.p.color, 0x3a3a3a)
// геометрия верхних полосок такая же, как у приложения U613 Stat: 125 + 125 + 124, высота 36, между полосками 18, верх на 48
assert.deepEqual(seg.slice(0, 3).map((r) => r.p.w), [125, 125, 124])
assert.deepEqual(seg.slice(3).map((r) => r.p.w), [125, 125, 124])
assert.deepEqual(seg.slice(0, 3).map((r) => r.p.x), [26, 154, 282])
assert.equal(seg[0].p.y, 48)
assert.equal(seg[3].p.y, 48 + 36 + 18)
for (const r of seg) assert.equal(r.p.h, 36)
// четыре кнопки 2 x 2 под полосками, с правильными картинками
assert.equal(btns.length, 4)
assert.deepEqual(btns.map((b) => b.p.normal_src), ['b1.png', 'b2.png', 'b3.png', 'b4.png'])
assert.deepEqual(btns.map((b) => b.p.press_src), ['b1p.png', 'b2p.png', 'b3p.png', 'b4p.png'])
for (const b of btns) assert.ok(b.p.y >= 138 && b.p.y + b.p.h <= 514)
for (const b of btns) for (const f of [b.p.normal_src, b.p.press_src]) {
  assert.ok(fs.existsSync(path.join(root, 'assets', 'default.w432-s', f)), f)
}
// 📊 открывает U613 Stat, 🧩 — «Задачи 2», 🍀 и 🥗 — заглушки
btns[0].p.click_func()
assert.deepEqual(globalThis.__launched.pop(), { appId: 1061613, native: false, url: 'page/index' })
btns[1].p.click_func()
assert.deepEqual(globalThis.__launched.pop(), { appId: 1061365, native: false, url: 'page/index' })
btns[2].p.click_func()
btns[3].p.click_func()
assert.equal(globalThis.__launched.length, 0)

// читается хранилище именно приложения U613 Stat (appId 1061613), группа и файл как у него
assert.ok(globalThis.__opened.some((o) => o[0] === 'typed' && o[1] === 1061613 && o[2] === 'u613stat'))
assert.ok(globalThis.__opened.some((o) => o[0] === 'file' && o[1] === 1061613 && o[2] === 'u613stat.json'))
// нет данных — это не ошибка: красной надписи нет
assert.equal(W.filter((w) => w.type === 'TEXT').length, 0)

// невидимая кнопка поверх двух верхних полосок: не перекрывает кнопки внизу, файл картинки на месте
assert.ok(hitBtn, 'есть кнопка на полосках')
assert.deepEqual([hitBtn.p.x, hitBtn.p.y, hitBtn.p.w, hitBtn.p.h], [26, 44, 380, 98])
assert.ok(hitBtn.p.y <= 48 && hitBtn.p.y + hitBtn.p.h >= 48 + 36 + 18 + 36)
for (const b of btns) assert.ok(hitBtn.p.y + hitBtn.p.h <= b.p.y, 'не заходит на кнопки внизу')
assert.ok(fs.existsSync(path.join(root, 'assets', 'default.w432-s', 'hit.png')))
// нажатие — быстрое обновление (страница page/quick приложения U613 Stat), долгое — обычное открытие (page/index)
hitBtn.p.click_func()
assert.deepEqual(globalThis.__launched.pop(), { appId: 1061613, native: false, url: 'page/quick' })
hitBtn.p.click_func()                       // сразу второй раз — игнорируется (приложение уже запускается)
assert.equal(globalThis.__launched.length, 0)
hitBtn.p.longpress_func()
assert.deepEqual(globalThis.__launched.pop(), { appId: 1061613, native: false, url: 'page/index' })
hitBtn.p.click_func()                       // отпускание пальца после долгого нажатия — не считается
assert.equal(globalThis.__launched.length, 0)

// таймер и делегат экрана
assert.equal(globalThis.__timers.length, 1)
const delegate = W.find((w) => w.type === 'WIDGET_DELEGATE')
assert.ok(delegate && typeof delegate.p.resume_call === 'function' && typeof delegate.p.pause_call === 'function')

// приложение записало цвета в TypedStorage: по таймеру полоски перекрашиваются ровно в них
const six = [0x43a857, 0x9cc24b, 0xe0c441, 0xd1544e, 0xe38b3f, 0x555555]
const m = { at: 1000 }
six.forEach((c, i) => { m['c' + i] = c })
globalThis.__share.typed = m
globalThis.__timers[0].cb()
assert.deepEqual(seg.map((r) => r.p.color), six)
// размеры при перекраске не меняются
assert.deepEqual(seg.slice(0, 3).map((r) => r.p.w), [125, 125, 124])
assert.equal(seg[0].p.y, 48)

// экран погас — таймер остановлен; включился — снова запущен и сразу перечитано; новые цвета из общего файла (записаны позже)
delegate.p.pause_call()
assert.equal(globalThis.__stopped.length, 1)
const next = [1, 2, 3, 4, 5, 6]
globalThis.__share.file = { top: next, at: 2000 }
delegate.p.resume_call()
assert.deepEqual(seg.map((r) => r.p.color), next)
// после возвращения на циферблат нажатие снова работает (когда прошло достаточно времени)
globalThis.__realNow = Date.now; Date.now = () => globalThis.__realNow() + 5000
hitBtn.p.click_func()
assert.deepEqual(globalThis.__launched.pop(), { appId: 1061613, native: false, url: 'page/quick' })
Date.now = globalThis.__realNow
assert.equal(globalThis.__timers.length, 2)

// нет общего хранилища на часах (оба места бросают ошибку) — полоски остаются как были, под ними одна красная надпись
globalThis.__share = { get typed() { throw new Error('нет API') }, get file() { throw new Error('нет API') } }
delegate.p.resume_call()
delegate.p.resume_call()
assert.deepEqual(seg.map((r) => r.p.color), next)
assert.equal(W.filter((w) => w.type === 'TEXT').length, 1)
console.log('face: ok')
