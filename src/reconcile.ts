import {
  IFiber,
  FreElement,
  FC,
  Attributes,
  HTMLElementEx,
  FreNode,
  IEffect,
} from './type'
import { createElement } from './dom'
import { resetCursor } from './hook'
import { schedule, shouldYield } from './schedule'
import { isArr, createText } from './h'
import { commit } from './commit'

let currentFiber: IFiber = null // 现在正在创建的fiber节点，只有hook用到了所以只需要在函数组件节点更新的时候记录下
let effectList: IFiber = null // effectList指的是最新的需要进行DOM操作的fiber节点
let deletions: any = []

export const enum TAG {
  UPDATE = 1 << 1,
  INSERT = 1 << 2,
  REMOVE = 1 << 3,
  SVG = 1 << 4,
  DIRTY = 1 << 5,
  NOWORK = 1 << 6,
}

// vnode为fre的虚拟节点，node为实际挂载的节点
export const render = (vnode: FreElement, node: Node): void => {
  // 新建一个fiber根节点
  const rootFiber = {
    node,
    props: { children: vnode },
  } as IFiber
  update(rootFiber)
}

// 以一个fiber节点为根节点开始进行fiber tree的建立或更新
export const update = (fiber?: IFiber) => {
  // 如果fiber存在并且fiber的lane优先级不为dirty
  if (fiber && !(fiber.lane & TAG.DIRTY)) {
    // 把这个被更新的fiber的lane改为update并且dirty，防止重复更新
    fiber.lane = TAG.UPDATE | TAG.DIRTY

    // 开始进行调度
    schedule(() => {
      effectList = fiber
      return reconcile(fiber)
    })
  }
}

// 协调即从一个fiber root开始建立/更新整个tree的过程，如果因为时间片的原因没有执行完，就返回剩下的reconcile方法的回调等下个时间片继续执行
const reconcile = (fiber?: IFiber): boolean => {
  // 只要有fiber或者分片时间没有到就一直capture
  while (fiber && !shouldYield()) fiber = capture(fiber)
  console.log('time up');
  // 如果时间到了但是还没有执行完就返回剩下的回调
  if (fiber) return reconcile.bind(null, fiber)
  return null
}

// 如果是函数组件就需要调用shouldUpdate判断是否需要更新
// 可以通过memo函数最fn进行包裹修改shouldUpdate的用法
const memo = (fiber) => {
  if ((fiber.type as FC).memo && fiber.oldProps) {
    let scu = (fiber.type as FC).shouldUpdate || shouldUpdate
    if (!scu(fiber.props, fiber.oldProps)) { // fast-fix
      return getSibling(fiber)
    }
  }
  return null
}

// 传入一个fiber节点，去扩展
const capture = (fiber: IFiber): IFiber | undefined => {
  // 通过是否是函数来判断是否是组件，因为fre只支持函数组件所有只判断函数即可
  fiber.isComp = isFn(fiber.type)
  if (fiber.isComp) {
    // 如果是函数组件的话可以定义
    // 如果没有发生变化不需要重新渲染的话就直接返回getSibling，把原来fiber tree中的节点直接返回不用再经历这个fiber节点以及所有的子节点重新比对构建fiber tree的过程
    const memoFiber = memo(fiber)
    if (memoFiber) {
      return memoFiber
    }
    updateHook(fiber)
  } else {
    updateHost(fiber)
  }
  if (fiber.child) return fiber.child
  const sibling = getSibling(fiber)
  return sibling
}

// 寻找一个fiber节点的sibling,如果在找sibling的过程中发现了dirty的fiber，就取消这个fiber的dirty然后提交更新并且返回null
// 目前项目中只有当前update的fiber节点上的lane上才会有DIRTY，所以当我们构建完了最后一个fiber节点后进入getSibing，一直迭代递归回到本次触发更新的fiber节点，就会执行commit方法
const getSibling = (fiber) => {
  while (fiber) {
    bubble(fiber)
    // 如果在寻找sibling的过程中发现了dirty的fiber
    if (fiber.lane & TAG.DIRTY) {
      // 单独取消dirty位
      fiber.lane &= ~TAG.DIRTY
      // commit提交DOM更新
      // 这里的fiber就是fiberRoot
      console.log('start commit')
      commit(fiber, deletions)
      // 找不到sibling
      return null
    }
    if (fiber.sibling) return fiber.sibling
    fiber = fiber.parent
  }
  return null
}

// 执行一个fiber的layout和effect
const bubble = fiber => {
  if (fiber.isComp) {
    if (fiber.hooks) {
      // 执行layout
      // 这里和react的实现有些区别，react中layout hook的执行是在DOM更新之后，这里跑到了DOM更新前
      // TODO: 可以把bubble的调用时机放在commit之后
      side(fiber.hooks.layout)
      // 排队调度执行effect
      schedule(() => side(fiber.hooks.effect))
    }
  }
}

// 把某个fiber节点加入commit联调
const append = function (fiber) {
  effectList.next = fiber
  effectList = fiber
}

// 默认的shouldUpdate方法，如果新旧props有变化就需要更新
const shouldUpdate = (a, b) => {
  for (let i in a) if (!(i in b)) return true
  for (let i in b) if (a[i] !== b[i]) return true
}

const updateHook = <P = Attributes>(fiber: IFiber): any => {
  resetCursor()
  currentFiber = fiber
  // 在执行的时候传入了对应的props属性
  let children = (fiber.type as FC<P>)(fiber.props)
  diffKids(fiber, simpleVnode(children))
}

const updateHost = (fiber: IFiber): void => {
  // 找到fiber tree上的父亲fiber节点上的dom节点
  fiber.parentNode = (getParentNode(fiber) as any) || {}
  // 如果没有dom节点
  if (!fiber.node) {
    // 如果是svg图片 lane为svg
    if (fiber.type === 'svg') fiber.lane |= TAG.SVG
    // 新建DOM节点
    fiber.node = createElement(fiber) as HTMLElementEx
  }
  // 挂载node节点上的childNodes到fiber节点上
  fiber.childNodes = Array.from(fiber.node.childNodes || [])
  // diff对比
  // 这里的fiber实际上还是没有被扩展的freEle，如果这个fiber clone了之前的fiber才会带上其他的fiber属性
  // 在上述的情况下：
  // fiber.props.children放的是新的调用了h方法生成的最新的freELe节点
  // fiber.kids是上次生成的旧的freNodes节点
  // 如果没有clone:
  // 那么fiber.kids为空，props.children存放的是了h方法生成的最新的freNodes节点
  diffKids(fiber, fiber.props.children)
}

// 如果一个freEle节点只有str或者number,转换为textNode,否则返回自身
const simpleVnode = (type: any) =>
  isStr(type) ? createText(type as string) : type

  // 获取最近的不是函数组件父节点上的DOM节点
const getParentNode = (fiber: IFiber): HTMLElement | undefined => {
  while ((fiber = fiber.parent)) {
    if (!fiber.isComp) return fiber.node
  }
}

// 传一个已有的fiber节点,将这个老fiber节点上的kids属性和新的children属性对比diff
// 从而扩展/更新这个fiber节点的子节点扩充fiber tree
const diffKids = (fiber: any, children: FreNode): void => {
  let isMount = !fiber.kids,
    aCh = fiber.kids || [],
    bCh = (fiber.kids = arrayfy(children) as any), // 把新的children赋值给fiber.kids并且赋值给bCh
    aHead = 0,
    bHead = 0,
    aTail = aCh.length - 1,
    bTail = bCh.length - 1

  // 从前向后对比
  while (aHead <= aTail && bHead <= bTail) {
    // 如果这两个节点不相等直接break
    if (!same(aCh[aHead], bCh[bHead])) break
    // 如果相等就把a的值赋值给b以免重新生成node节点或者feEle节点
    clone(aCh[aHead++], bCh[bHead++], TAG.UPDATE)
  }

  // 从后往前对比
  while (aHead <= aTail && bHead <= bTail) {
    if (!same(aCh[aTail], bCh[bTail])) break
    clone(aCh[aTail--], bCh[bTail--], TAG.UPDATE)
  }

  // 通过对新老freEle数组的对比，返回diff操作数组，diff中的每一项代表应该对bCh做的操作
  // 即：应该如何对bCh进行操作将bCh中的每个freEle变成一个fiber节点
  const { diff, keymap } = LCSdiff(bCh, aCh, bHead, bTail, aHead, aTail)


  for (let i = 0, aIndex = aHead, bIndex = bHead, mIndex; i < diff.length; i++) {
    const op = diff[i]
    const after = fiber.node?.childNodes[aIndex]
    if (op === TAG.UPDATE) {
      if (!same(aCh[aIndex], bCh[bIndex])) {
        bCh[bIndex].lane = TAG.INSERT
        bCh[bIndex].after = after
        aCh[aIndex].lane = TAG.REMOVE
        deletions.push(aCh[aIndex])
        append(bCh[bIndex])
      } else {
        clone(aCh[aIndex], bCh[bIndex], TAG.UPDATE)
      }
      aIndex++
      bIndex++
    } else if (op === TAG.INSERT) {
      let c = bCh[bIndex]
      mIndex = c.key != null ? keymap[c.key] : null
      if (mIndex != null) {
        c.after = after
        clone(aCh[mIndex], c, TAG.INSERT)
        aCh[mIndex] = undefined
      } else {
        c.after = isMount ? null : after
        c.lane = TAG.INSERT
        append(c)
      }
      bIndex++
    } else if (op === TAG.REMOVE) {
      aIndex++
    }
  }

  for (let i = 0, aIndex = aHead; i < diff.length; i++) {
    let op = diff[i]
    if (op === TAG.UPDATE) {
      aIndex++
    } else if (op === TAG.REMOVE) {
      let c = aCh[aIndex]
      if (c !== undefined) {
        c.lane = TAG.REMOVE
        deletions.push(c)
      }
      aIndex++
    }
  }

  for (let i = 0, prev = null, len = bCh.length; i < len; i++) {
    const child = bCh[i]
    if (fiber.lane & TAG.SVG) {
      child.lane |= TAG.SVG
    }
    child.parent = fiber
    if (i > 0) {
      prev.sibling = child
    } else {
      fiber.child = child
    }
    prev = child
  }
}

// 把a的所有属性复制到b上然后再append b准备执行b的efferts
function clone(a, b, lane) {
  b.hooks = a.hooks
  b.ref = a.ref
  b.node = a.node
  b.oldProps = a.props
  b.lane = lane
  b.kids = a.kids
  append(b)
}

// a,b两个fiber节点，如果key相同，type也相同，那么就视为一样的fiber节点
const same = (a, b) => {
  return a && b && a.key === b.key && a.type === b.type
}

// 返回一个array
export const arrayfy = arr => (!arr ? [] : isArr(arr) ? arr : [arr])

// 传入effect或者是layout执行
const side = (effects: IEffect[]): void => {
  // 先执行e[2]
  effects.forEach(e => e[2] && e[2]())
  // 再把e[0]的返回结果给e[2]等下次执行
  effects.forEach(e => (e[2] = e[0]()))
  effects.length = 0
}

// b为新，a为旧
function LCSdiff(
  bArr,
  aArr,
  bHead = 0, // 新的数组开始的头部
  bTail = bArr.length - 1, 
  aHead = 0,
  aTail = aArr.length - 1
) {
  let keymap = {},
    unkeyed = [],
    idxUnkeyed = 0, // 没有key的index
    ch,
    item,
    k,
    idxInOld,
    key

  let newLen = bArr.length
  let oldLen = aArr.length
  let minLen = Math.min(newLen, oldLen)
  let tresh = Array(minLen + 1) // 为新旧数组最小长度 + 1
  tresh[0] = -1 // 首位用-1占位

  // 用旧的长度去占位tresh
  for (var i = 1; i < tresh.length; i++) {
    tresh[i] = aTail + 1
  }
  let link = Array(minLen)

  // 遍历旧数组，把带有key的以key为key保存在keymap中，value为下标
  for (i = aHead; i <= aTail; i++) {
    item = aArr[i]
    key = item.key
    if (key != null) {
      keymap[key] = i
    } else {
      unkeyed.push(i)
    }
  }

  for (i = bHead; i <= bTail; i++) {
    ch = bArr[i]
    // 如果有key，就去找旧的里面有相同的key的下标，没有就从unkeyed中找
    idxInOld = ch.key == null ? unkeyed[idxUnkeyed++] : keymap[ch.key]
    if (idxInOld != null) {
      k = bs(tresh, idxInOld)
      if (k >= 0) {
        tresh[k] = idxInOld
        link[k] = { newi: i, oldi: idxInOld, prev: link[k - 1] }
      }
    }
  }

  k = tresh.length - 1
  while (tresh[k] > aTail) k--

  let ptr = link[k]
  let diff = Array(oldLen + newLen - k)
  let curNewi = bTail,
    curOldi = aTail
  let d = diff.length - 1
  while (ptr) {
    const { newi, oldi } = ptr
    while (curNewi > newi) {
      diff[d--] = TAG.INSERT
      curNewi--
    }
    while (curOldi > oldi) {
      diff[d--] = TAG.REMOVE
      curOldi--
    }
    diff[d--] = TAG.UPDATE
    curNewi--
    curOldi--
    ptr = ptr.prev
  }
  while (curNewi >= bHead) {
    diff[d--] = TAG.INSERT
    curNewi--
  }
  while (curOldi >= aHead) {
    diff[d--] = TAG.REMOVE
    curOldi--
  }
  return {
    diff,
    keymap,
  }
}

function bs(ktr, j) {
  let lo = 1
  let hi = ktr.length - 1
  while (lo <= hi) {
    let mid = (lo + hi) >>> 1
    if (j < ktr[mid]) hi = mid - 1
    else lo = mid + 1
  }
  return lo
}

export const getCurrentFiber = () => currentFiber || null
export const isFn = (x: any): x is Function => typeof x === 'function'
export const isStr = (s: any): s is number | string =>
  typeof s === 'number' || typeof s === 'string'