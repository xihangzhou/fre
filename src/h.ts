import { isStr, arrayfy } from './reconcile'
import { FC, FreElement } from './type'

// for jsx2
// 类似createNode去创建一个虚拟节点
// type为函数组件或者html元素，props为元素上的属性，kids为子元素
export const h = (type, props: any, ...kids) => {
  props = props || {}
  kids = flat(arrayfy(props.children || kids))

  if (kids.length) props.children = kids.length === 1 ? kids[0] : kids

  // 存储key和ref
  const key = props.key || null
  const ref = props.ref || null

  if (key) props.key = undefined
  if (ref) props.ref = undefined

  return createVnode(type, props, key, ref)
}

// x非空
const some = (x: unknown) => x != null && x !== true && x !== false

// 把vnode扁平化，并且把string类型的节点变为textNode
const flat = (arr: any[], target = []) => {
  arr.forEach(v => {
    isArr(v)
      ? flat(v, target)
      : some(v) && target.push(isStr(v) ? createText(v) : v)
  })
  return target
}

export const createVnode = (type, props, key, ref) => ({
  type,
  props,
  key,
  ref,
})

// 创建一个Text节点
export const createText = (vnode: any) =>
  ({ type: '#text', props: { nodeValue: vnode + '' } } as FreElement)

export function Fragment(props) {
  return props.children
}

export function memo<T extends object>(fn: FC<T>, compare?: FC<T>['shouldUpdate']) {
  fn.memo = true
  fn.shouldUpdate = compare
  return fn
}

export const isArr = Array.isArray
