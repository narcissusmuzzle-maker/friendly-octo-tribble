import assert from 'node:assert/strict'
import * as col from '../shared/colors.js'

assert.equal(col.COUNT, 6)
// нет данных — серый, как в U613 Stat и в виджете на телефоне
assert.equal(col.GRAY, 0x3a3a3a)
assert.deepEqual(col.emptyTop(), [0x3a3a3a, 0x3a3a3a, 0x3a3a3a, 0x3a3a3a, 0x3a3a3a, 0x3a3a3a])
const good = [0x43a857, 0x9cc24b, 0xe0c441, 0xd1544e, 0xe38b3f, 0x000000]
assert.deepEqual(col.cleanTop(good), good)
assert.notEqual(col.cleanTop(good), good, 'возвращается копия')
// битое не принимается
assert.equal(col.cleanTop(null), null)
assert.equal(col.cleanTop(good.slice(1)), null)
assert.equal(col.cleanTop([...good.slice(0, 5), 'red']), null)
assert.equal(col.cleanTop([...good.slice(0, 5), 0x1000000]), null)
assert.equal(col.cleanTop([...good.slice(0, 5), -1]), null)
assert.equal(col.cleanTop([...good.slice(0, 5), 1.5]), null)
assert.equal(col.sameTop(good, [...good]), true)
assert.equal(col.sameTop(good, col.emptyTop()), false)
assert.equal(col.sameTop(null, good), false)
console.log('colors: ok')
