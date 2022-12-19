export type Key = FreText
export interface RefObject<T> {
  current: T
}

export type RefCallback<T> = {
  bivarianceHack(instance: T | null): void
}['bivarianceHack']
export type Ref<T = any> = RefCallback<T> | RefObject<T> | null

export interface Attributes extends Record<string, any> {
  key?: Key
  children?: FreNode
  ref?: Ref
}

export interface FC<P extends Attributes = {}> {
  (props: P): FreElement<P> | null
  fiber?: IFiber
  type?: string
  memo?: boolean
  shouldUpdate?: (newProps: P, oldProps: P) => boolean
}

export interface FreElement<P extends Attributes = any, T = string> {
  type: T
  props: P
  key: string
}

export type HookTypes = 'list' | 'effect' | 'layout'

export interface IHook {
  list: IEffect[]
  layout: IEffect[]
  effect: IEffect[]
}

export type IRef = (
  e: HTMLElement | undefined
) => void | { current?: HTMLElement }

// IFiber节点，这个节点在fre中是由对应的freEle节点扩展来的，所以自带了对应freEle上的所有属性
export interface IFiber<P extends Attributes = any> {
  key?: string // 和freEle一样，来自freEle
  type: string | FC<P> // 和freEle一样，来自freEle
  parentNode: HTMLElementEx // 父DOM节点
  childNodes: any // 把一个fiber节点对应的DOM节点的childNodes属性挂载到fiber上，对于DOM孩子节点
  node: HTMLElementEx // 一个fiber节点对应的DOM节点
  // 一个fiber节点的孩子freEle节点，如果这个fiber节点是函数节点，那么这个节点的kids是函数节点运行的返回值
  // 主意这个kids代表的是当前视图对应的孩子freEle节点
  kids?: any 
  parent?: IFiber<P> // 一个fiber节点的父fiber节点
  sibling?: IFiber<P> // 一个fiber节点的兄弟fiber节点
  child?: IFiber<P> // 一个fiber节点的第一个子fiber节点
  done?: () => void
  ref: IRef // 和freEle一样，来自freEle
  hooks: IHook
  oldProps: P // 上次的老的pros属性
  after: any // 上一次渲染的DOM节点
  // 和freEle一样，来自freEle,其中有标签上的属性比如href,src,onClick等等
  // 注意会有一个children属性是在h的时候从参数添加的(如果是fiberRoot是在render方法中添加的)，是对应freEle节点的孩子freELe节点
  // 并且这个props上的children属性是运行了h函数的最新的fiber
  props: P 
  lane: number
  time: number
  next: IFiber // 指向下一个需要commit DOM更新的fiber节点
  dirty: boolean
  isComp: boolean // freEle是否是函数组件
}

export type HTMLElementEx = HTMLElement & { last: IFiber | null }
export type IEffect = [Function?, number?, Function?]

export type FreText = string | number
export type FreNode =
  | FreText
  | FreElement
  | FreNode[]
  | boolean
  | null
  | undefined
export type SetStateAction<S> = S | ((prevState: S) => S)
export type Dispatch<A> = (value: A, resume?: boolean) => void
export type Reducer<S, A> = (prevState: S, action: A) => S
export type IVoidCb = () => void
export type EffectCallback = () => void | (IVoidCb | undefined)
export type DependencyList = Array<any>

export interface PropsWithChildren {
  children?: FreNode
}

export type ITaskCallback = ((time: boolean) => boolean) | null

export interface ITask {
  callback?: ITaskCallback
  fiber: IFiber
}

export type DOM = HTMLElement | SVGElement
