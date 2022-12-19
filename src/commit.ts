import { IFiber, IRef } from './type'
import { updateElement } from './dom'
import { isFn, TAG } from './reconcile'

// 传入一个fiber节点，沿着这个fiber节点的next属性依次执行DOM操作
export const commit = (fiber: IFiber, deletions): void => {
  let current = fiber.next
  fiber.next = null
  do {
    op(current)
  } while ((current = current.next))

  // 最后进行删除操作
  deletions.forEach(op)
  console.log('commit end')
}

// 根据一个fiber节点的lane来判断操作
const op = (fiber: any) => {
  // 不需要做直接返回
  if (fiber.lane & TAG.NOWORK) {
    return
  }
  // 如果是移除那么移除了直接返回
  if (fiber.lane === TAG.REMOVE) {
    remove(fiber)
    return
  }
  // 如果属于insert操作
  if (fiber.lane & TAG.INSERT) {
    // 如果是函数节点
    if (fiber.isComp) {
      fiber.child.lane = fiber.lane
      fiber.child.after = fiber.after
      // 递归对孩子fiber节点来插入
      op(fiber.child)
      // 插入完了不要忘了改状态
      fiber.child.lane |= TAG.NOWORK
    } else {
      // 否则直接插入
      fiber.parentNode.insertBefore(fiber.node, fiber.after)
    }
  }
  if (fiber.lane & TAG.UPDATE) {
    // 如果是函数节点递归更新子节点
    if (fiber.isComp) {
      fiber.child.lane = fiber.lane
      op(fiber.child)
      fiber.child.lane |= TAG.NOWORK
    } else {
      updateElement(fiber.node, fiber.oldProps || {}, fiber.props)
    }
  }

  refer(fiber.ref, fiber.node)
}

// 将ref绑定到某一个DOM节点上
const refer = (ref: IRef, dom?: HTMLElement): void => {
  if (ref)
    isFn(ref) ? ref(dom) : ((ref as { current?: HTMLElement })!.current = dom)
}

// 传入kids，递归清空所有节点的ref绑定
const kidsRefer = (kids: any): void => {
  kids.forEach(kid => {
    kid.kids && kidsRefer(kid.kids)
    refer(kid.ref, null)
  })
}

// 删除一个fiber节点，解绑这棵子树上的所有ref,执行一次所有子树上的hook
const remove = fiber => {
  // 如果是函数节点
  if (fiber.isComp) {
    // 先执行hooks
    fiber.hooks && fiber.hooks.list.forEach(e => e[2] && e[2]())
    // 然后递归remove所有孩子节点的hook
    fiber.kids.forEach(remove)
  } else {
    // 递归清空孩子ref绑定
    kidsRefer(fiber.kids)
    // 移除DOM
    fiber.parentNode.removeChild(fiber.node)
    // 清空自己的ref绑定
    refer(fiber.ref, null)
  }
  fiber.lane = 0
}