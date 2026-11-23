/**
 * Циферблат U613. Часов на экране нет: чёрный экран, сверху две тонкие полоски статистики (по три сегмента: месяц / неделя / день,
 * без подписей), под ними четыре кнопки 2 x 2:
 *      📊 🧩
 *      🍀 🥗
 *  - 📊 открывает приложение «U613 Stat» (appId 1061613), 🧩 — «Задачи 2» (appId 1061365). 🍀 и 🥗 пока ЗАГЛУШКИ (ACTIONS ниже).
 *  - Две полоски — те же две верхние полоски, что в приложении U613 Stat (слова и все занятия), с теми же цветами и размерами.
 *    Цвета циферблат берёт НЕ у телефона, а из общего хранилища Zepp OS, куда их кладёт приложение U613 Stat (U613 Stat 1.0.6 и новее;
 *    оно обновляет цвета, когда открыто). Пока приложение ни разу не записало цвета — полоски серые, как «нет данных».
 *    Читается при построении циферблата, при каждом включении экрана и раз в несколько секунд, пока экран включён.
 * Положение всего задаётся в shared/layout.js, чтение данных — в shared/top.js, цвета — в shared/colors.js.
 */
import { createWidget, widget, prop, align } from '@zos/ui'
import * as router from '@zos/router'
import { TypedStorage, LocalStorage } from '@zos/share-storage'
import { createTimer, stopTimer } from '@zos/timer'
import * as lay from '../shared/layout'
import * as col from '../shared/colors'
import * as top from '../shared/top'

const REFRESH_MS = 5000          // как часто перечитывать общее хранилище, пока экран включён

const BLACK = 0x000000
const RED = 0xff4517

let errText = null

function showError(msg) {
  try {
    if (errText) { errText.setProperty(prop.TEXT, String(msg).slice(0, 60)); return }
  } catch (e) { /* пересоздадим */ }
  try {
    errText = createWidget(widget.TEXT, {
      x: lay.AREA_X, y: lay.stripsBottom() + 1, w: lay.AREA_W, h: 28, color: RED, text_size: 20,
      align_h: align.CENTER_H, align_v: align.CENTER_V, text: String(msg).slice(0, 60)
    })
  } catch (e) { /* показать нечем */ }
}

/**
 * Открыть приложение по его appId (из app.json этого приложения) и адресу страницы.
 * Если не получилось — короткая красная надпись между полосками и кнопками.
 */
function openApp(appId, url) {
  let why = ''
  try {
    if (router && typeof router.launchApp === 'function') {
      router.launchApp({ appId: appId, native: false, url: url })
      return
    }
    why = 'нет launchApp'
  } catch (e) { why = 'launchApp: ' + e }
  try {
    if (typeof hmApp !== 'undefined' && hmApp && typeof hmApp.startApp === 'function') {
      hmApp.startApp({ appid: appId, url: url, native: false })
      return
    }
  } catch (e) { why += ' startApp: ' + e }
  showError(why || 'не открылось')
}

function nothing() { /* кнопка пока не работает */ }

// ---- нажатие на две верхние полоски ----
// Нажатие — БЫСТРОЕ ОБНОВЛЕНИЕ: открывается страница page/quick приложения U613 Stat, на долю секунды показывает те же полоски, спрашивает телефон,
// записывает цвета для циферблата и сама закрывается — часы возвращаются сюда. Долгое нажатие — обычное открытие приложения U613 Stat (как кнопка 📊).
const QUICK_URL = 'page/quick'
const FULL_URL = 'page/index'
const REPEAT_MS = 1500       // повторное нажатие раньше этого срока после запуска игнорируется (чтобы не открыть приложение дважды)
const LONG_GUARD_MS = 15000  // после долгого нажатия «обычное» нажатие при отпускании пальца не считается
let lastOpenAt = 0
let longAt = 0

function openQuick() {
  const now = Date.now()
  if (longAt && now - longAt < LONG_GUARD_MS) { longAt = 0; return }   // отпускание пальца после долгого нажатия
  if (now - lastOpenAt < REPEAT_MS) return
  lastOpenAt = now
  openApp(top.STAT_APP_ID, QUICK_URL)
}

function openFull() {
  longAt = Date.now()
  lastOpenAt = longAt
  openApp(top.STAT_APP_ID, FULL_URL)
}

// appId берётся из app.json каждого приложения (app.appId)
const STAT_APP_ID = top.STAT_APP_ID     // U613 Stat
const TASKS_APP_ID = 1061365            // U613 Tasks 2 (1.0.0)

// Что делает каждая кнопка, в порядке 📊 🧩 🍀 🥗. Для следующих приложений вместо nothing: () => openApp(<appId>, 'page/index')
const ACTIONS = [
  () => openApp(STAT_APP_ID, FULL_URL),
  () => openApp(TASKS_APP_ID, 'page/index'),
  nothing,
  nothing
]

// ---- две полоски ----
let cells = []            // cells[i] — { x, y, w, h } шести сегментов (сначала верхняя полоска, потом нижняя)
let rects = []            // нарисованные сегменты в том же порядке
let shown = col.emptyTop()
let readFails = 0
let timerId = null

function paint(next) {
  for (let i = 0; i < col.COUNT; i++) {
    if (shown[i] === next[i]) continue
    const c = cells[i]
    try { rects[i].setProperty(prop.MORE, { x: c.x, y: c.y, w: c.w, h: c.h, color: next[i] }) } catch (e) { /* не критично */ }
  }
  shown = next
}

const readers = {
  typed: () => new TypedStorage(top.STAT_APP_ID, top.SCOPE),
  file: () => new LocalStorage(top.STAT_APP_ID, top.FILE)
}

/** Перечитать цвета из общего хранилища и перекрасить то, что изменилось. Нет данных — ничего не меняется (остаётся показанное). */
function refresh() {
  let r
  try { r = top.readTop(readers) } catch (e) { return }
  if (r.apiDown) {
    // ни одно из двух мест не открылось: общее хранилище на часах недоступно — один раз покажем причину под полосками
    if (++readFails === 1) showError('нет общего хранилища')
    return
  }
  if (r.colors) paint(r.colors)
}

function startTimer() {
  if (timerId !== null) return
  try { timerId = createTimer(REFRESH_MS, REFRESH_MS, refresh, {}) } catch (e) { timerId = null }
}
function stopTimerNow() {
  if (timerId === null) return
  try { stopTimer(timerId) } catch (e) { /* ок */ }
  timerId = null
}

WatchFace({
  build() {
    // чёрный фон на весь экран
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: lay.SCREEN_W, h: lay.SCREEN_H, color: BLACK })

    // верх: две тонкие полоски по три сегмента (сначала серые, ниже сразу красятся тем, что записало приложение U613 Stat)
    const st = lay.strips()
    cells = []
    rects = []
    for (let s = 0; s < 2; s++) {
      for (let k = 0; k < 3; k++) {
        const c = { x: st[s].segs[k].x, y: st[s].y, w: st[s].segs[k].w, h: st[s].h }
        cells.push(c)
        rects.push(createWidget(widget.FILL_RECT, { x: c.x, y: c.y, w: c.w, h: c.h, color: col.GRAY }))
      }
    }
    shown = col.emptyTop()

    // невидимая кнопка поверх двух полосок: нажатие — быстро обновить, долгое нажатие — открыть приложение статистики
    const hit = lay.stripsHit()
    createWidget(widget.BUTTON, {
      x: hit.x, y: hit.y, w: hit.w, h: hit.h, text: '',
      normal_src: 'hit.png', press_src: 'hit.png', click_func: openQuick, longpress_func: openFull
    })

    // низ: четыре кнопки 2 x 2: 📊 🧩 / 🍀 🥗 (картинки b1..b4, при нажатии — затемнённые b1p..b4p)
    const bt = lay.buttons()
    for (let k = 0; k < 4; k++) {
      createWidget(widget.BUTTON, {
        x: bt[k].x, y: bt[k].y, w: bt[k].w, h: bt[k].h, text: '',
        normal_src: 'b' + (k + 1) + '.png', press_src: 'b' + (k + 1) + 'p.png', click_func: ACTIONS[k]
      })
    }

    // данные: сейчас, при каждом включении экрана и раз в несколько секунд, пока экран включён
    refresh()
    startTimer()
    try {
      createWidget(widget.WIDGET_DELEGATE, {
        resume_call: () => { longAt = 0; refresh(); startTimer() },
        pause_call: () => { stopTimerNow() }
      })
    } catch (e) { /* без делегата работает таймер */ }
  },
  onInit() {},
  onDestroy() { stopTimerNow() }
})
