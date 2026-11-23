/**
 * Цвета двух верхних полосок. Сами цвета считает телефон (LuvU613), передаёт приложение U613 Stat, циферблат только рисует.
 * Формат: плоский список из шести чисел 0xRRGGBB: [полоска 1: месяц, неделя, день, полоска 2: месяц, неделя, день].
 * Нет данных — серый, тот же, что в приложении U613 Stat и в виджете на телефоне.
 */
export const COUNT = 6
export const GRAY = 0x3a3a3a

export function emptyTop() {
  const c = []
  for (let i = 0; i < COUNT; i++) c.push(GRAY)
  return c
}

function okColor(v) {
  return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 0xffffff && Math.floor(v) === v
}

/** Проверить список из шести цветов. Возвращает чистую копию или null. */
export function cleanTop(c) {
  if (!c || c.length !== COUNT) return null
  const out = []
  for (let i = 0; i < COUNT; i++) {
    if (!okColor(c[i])) return null
    out.push(c[i])
  }
  return out
}

export function sameTop(a, b) {
  if (!a || !b) return false
  for (let i = 0; i < COUNT; i++) if (a[i] !== b[i]) return false
  return true
}
