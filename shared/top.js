/**
 * Чтение цветов двух верхних полосок из ОБЩЕГО хранилища Zepp OS (API_LEVEL 3.0+), куда их кладёт приложение U613 Stat (shared/share.js там).
 * Читатель получает «читалки» снаружи (в циферблате — настоящие классы из @zos/share-storage, в тестах — заглушки), поэтому здесь нет обращений к API часов.
 * Читаются оба места, которые пишет приложение, и берётся то, что записано позже.
 */
import * as col from './colors'

export const STAT_APP_ID = 1061613   // appId приложения U613 Stat (app.json)
export const SCOPE = 'u613stat'      // группа ShareTypedStorage
export const FILE = 'u613stat.json'  // файл ShareLocalStorage

/** Из TypedStorage: ints c0…c5 и int64 at (время записи, мс). Нет данных — null. */
export function fromTyped(typed) {
  const at = +typed.getInt64('at', 0) || 0
  if (!at) return null
  const raw = []
  for (let i = 0; i < col.COUNT; i++) raw.push(typed.getInt('c' + i, -1))
  const colors = col.cleanTop(raw)
  return colors ? { colors: colors, at: at } : null
}

/** Из общего файла (LocalStorage из @zos/share-storage): { top: [6 цветов], at }. Нет данных — null. */
export function fromFile(file) {
  if (typeof file.isExisted === 'function' && !file.isExisted()) return null
  const at = +file.getItem('at', 0) || 0
  const colors = col.cleanTop(file.getItem('top', null))
  return colors && at ? { colors: colors, at: at } : null
}

/**
 * Прочитать цвета. readers = { typed: () => TypedStorage, file: () => LocalStorage }.
 * Возвращает { colors, at, errs }: colors — шесть цветов или null (данных нет), errs — что не открылось (строка, '' — всё открылось).
 * apiDown = true, если не открылось ни одно из двух мест (хранилища на часах недоступны).
 */
export function readTop(readers) {
  let a = null
  let b = null
  let errs = ''
  let failed = 0
  try { a = fromTyped(readers.typed()) } catch (e) { failed++; errs += 'typed: ' + String(e).slice(0, 40) + ' ' }
  try { b = fromFile(readers.file()) } catch (e) { failed++; errs += 'file: ' + String(e).slice(0, 40) }
  const best = a && b ? (b.at > a.at ? b : a) : a || b
  return { colors: best ? best.colors : null, at: best ? best.at : 0, errs: errs, apiDown: failed >= 2 }
}
