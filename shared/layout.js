/**
 * Раскладка экрана (чистые функции — без обращений к API часов, проверяются тестами в Node).
 * Экран 432 x 514, чёрный. Сверху две тонкие полоски статистики (по три сегмента: месяц / неделя / день),
 * под ними четыре кнопки 2 x 2.
 * Горизонтальная полоса, в которой стоят все элементы, — x от 26 до 406 (ровно по центру экрана).
 */
export const SCREEN_W = 432
export const SCREEN_H = 514

export const AREA_X = 26         // левый край полосы (26 = ровно по центру экрана 432)
export const AREA_W = 380        // ширина полосы

// Полоски. Верхний край верхней полоски (STRIP_TOP) НЕ ДВИГАТЬ: это «верхний край экрана» для всей раскладки.
export const STRIP_TOP = 48      // y верхнего края верхней полоски (как было в v4)
export const STRIP_H = 36        // высота полоски (было 54, стало в 1,5 раза ниже)
export const STRIP_GAP = 18      // расстояние между полосками (было 54, стало в 3 раза меньше)
export const SEG_COUNT = 3       // сегментов в полоске: месяц / неделя / день
export const SEG_GAP = 3         // чёрный зазор между сегментами (0 — сплошная полоска, как на телефоне)

// Кнопки 2 x 2: 📊 🧩 / 🍀 🥗
export const BTN_W = 190         // ширина кнопки = половина полосы (картинки 190 x 150, эмодзи по центру; повёрнутый 🧩 шире 150)
export const BTN_H = 150         // высота кнопки
export const BTN_COLS = 2
export const BTN_ROWS = 2
export const BTN_ROW_GAP = 12    // зазор между рядами кнопок
export const BTN_TOP_GAP = 30    // от нижней полоски до первого ряда кнопок (остаток экрана — снизу)

// Область нажатия на полоски (невидимая кнопка поверх двух полосок): чуть шире полосок по высоте, файл картинки hit.png 380 x 98
export const HIT_PAD = 4         // на сколько область выступает выше верхней и ниже нижней полоски

/** Нижний край нижней полоски. */
export function stripsBottom() { return STRIP_TOP + 2 * STRIP_H + STRIP_GAP }

/**
 * Сегменты одной полоски: n штук с зазором gap по ширине w, начиная с x0. Расчёт тот же, что в приложении U613 Stat:
 * лишние пиксели достаются первым сегментам (для 380 px, трёх сегментов и зазора 3 это 125 + 125 + 124), поэтому полоски одинаковы до пикселя.
 */
export function segments(x0, w, n, gap) {
  const free = w - gap * (n - 1)
  const base = Math.floor(free / n)
  const extra = free - base * n
  const out = []
  let p = 0
  for (let i = 0; i < n; i++) {
    const l = base + (i < extra ? 1 : 0)
    out.push({ x: x0 + p, w: l })
    p += l + gap
  }
  return out
}

/** Невидимая кнопка поверх двух полосок: нажатие — быстро обновить, долгое нажатие — открыть приложение статистики. */
export function stripsHit() {
  return { x: AREA_X, y: STRIP_TOP - HIT_PAD, w: AREA_W, h: 2 * STRIP_H + STRIP_GAP + 2 * HIT_PAD }
}

/** Две полоски: верхняя стоит на STRIP_TOP, вторая ниже на STRIP_GAP. */
export function strips() {
  const segs = segments(AREA_X, AREA_W, SEG_COUNT, SEG_GAP)
  return [0, 1].map((k) => ({ y: STRIP_TOP + k * (STRIP_H + STRIP_GAP), h: STRIP_H, segs }))
}

/**
 * Четыре кнопки 2 x 2 в порядке чтения (слева направо, сверху вниз): 📊 🧩 / 🍀 🥗.
 * Кнопка занимает всю свою половину полосы (190 x 150 px; эмодзи нарисован по центру картинки), ряды — под полосками.
 */
export function buttons() {
  const y0 = stripsBottom() + BTN_TOP_GAP
  const out = []
  for (let r = 0; r < BTN_ROWS; r++) {
    for (let c = 0; c < BTN_COLS; c++) {
      out.push({
        x: AREA_X + c * BTN_W,
        y: y0 + r * (BTN_H + BTN_ROW_GAP),
        w: BTN_W,
        h: BTN_H
      })
    }
  }
  return out
}
