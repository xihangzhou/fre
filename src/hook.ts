import { update, isFn, getCurrentFiber } from "./reconcile"
import {
  DependencyList,
  Reducer,
  IFiber,
  Dispatch,
  SetStateAction,
  EffectCallback,
  HookTypes,
  RefObject,
  IEffect,
  FreNode,
} from "./type"

const EMPTY_ARR = []

let cursor = 0 // 用于指向当前正在处理的函数fiber节点的第几个hook

// 设置cursor为0
export const resetCursor = () => {
  cursor = 0
}

// useState其实就是redusur不传的useReducer
export const useState = <T>(initState: T): [T, Dispatch<SetStateAction<T>>] => {
  return useReducer(null, initState)
}

export const useReducer = <S, A>(
  reducer?: Reducer<S, A>,
  initState?: S
): [S, Dispatch<A>] => {
  const [hook, current]: [any, IFiber] = getHook<S>(cursor++)
  // 如果list hook的长度为0代表这是第一次调用
  if (hook.length === 0) {
    // 初始化hook[0]为initState，也为当前的值
    hook[0] = initState
    // hook[1]为dispatch，用于分发一个action,执行reducer，把返回结果作为新的hook[0]然后开启新的update
    hook[1] = (value: A | Dispatch<A>) => {
      hook[0] = reducer
        ? reducer(hook[0], value as any)
        : isFn(value)
          ? value(hook[0])
          : value
        console.log('nowhook[0]',hook[0]);
      update(current)
    }
  }
  return hook
}

export const useEffect = (cb: EffectCallback, deps?: DependencyList): void => {
  return effectImpl(cb, deps!, "effect")
}

export const useLayout = (cb: EffectCallback, deps?: DependencyList): void => {
  return effectImpl(cb, deps!, "layout")
}

const effectImpl = (
  cb: EffectCallback,
  deps: DependencyList,
  key: HookTypes
): void => {
  // 获取当前正在处理的fiber节点和hooks.list
  const [hook, current] = getHook(cursor++)
  // 如果deps发生了变化
  if (isChanged(hook[1], deps)) {
    // 更新cb到hook[0]
    hook[0] = cb
    // 更新deps到hook[1]
    hook[1] = deps
    // 再把这个hooks.list中的effect/layout hook放到hooks.effect/layout中
    current.hooks[key].push(hook)
  }
}

// 和上面的实现的思路类似
export const useMemo = <S = Function>(
  cb: () => S,
  deps?: DependencyList
): S => {
  const hook = getHook<S>(cursor++)[0]
  if (isChanged(hook[1], deps!)) {
    hook[1] = deps
    return (hook[0] = cb())
  }
  return hook[0]
}

// 就是用useMemo来实现的
export const useCallback = <T extends (...args: any[]) => void>(
  cb: T,
  deps?: DependencyList
): T => {
  return useMemo(() => cb, deps)
}

// useRef返回一个含有current
// 也可以用useState来实现
export const useRef = <T>(current: T): RefObject<T> => {
  return useMemo(() => ({ current }), [])
}

// 返回一个数组，第一项为当前的list hook，第二项为当前正在构建的fiber节点
export const getHook = <S = Function | undefined, Dependency = any>(
  cursor: number
): [[S, Dependency], IFiber] => {
  const current: IFiber<any> = getCurrentFiber()
  // 获取当前正在构建的fiber节点的hooks
  const hooks =
    current.hooks || (current.hooks = { list: [], effect: [], layout: [] })
  // 如果cursor大于等于list加一个
  if (cursor >= hooks.list.length) {
    hooks.list.push([] as IEffect)
  }
  return [(hooks.list[cursor] as unknown) as [S, Dependency], current]
}

export type ContextType<T> = {
  ({ value, children }: { value: T, children: FreNode }): FreNode;
  initialValue: T;
}

type SubscriberCb = () => void;

// 
export const createContext = <T>(initialValue: T): ContextType<T> => {
  const contextComponent: ContextType<T> = ({ value, children }) => {
    const valueRef = useRef(value)
    const subscribers = useMemo(() => new Set<SubscriberCb>(), EMPTY_ARR)

    if (valueRef.current !== value) {
      valueRef.current = value;
      subscribers.forEach((subscriber) => subscriber())
    }

    return children
  }
  contextComponent.initialValue = initialValue;
  return contextComponent;
}

export const useContext = <T>(contextType: ContextType<T>): T => {
  let subscribersSet: Set<Function>

  const triggerUpdate = useReducer(null, null)[1] as SubscriberCb

  useEffect(() => {
    return () => subscribersSet && subscribersSet.delete(triggerUpdate)
  }, EMPTY_ARR);

  let contextFiber = getCurrentFiber().parent
  while (contextFiber && contextFiber.type !== contextType) {
    contextFiber = contextFiber.parent
  }

  if (contextFiber) {
    const hooks = contextFiber.hooks.list as unknown as [[RefObject<T>], [Set<SubscriberCb>]]
    const [[value], [subscribers]] = hooks;

    subscribersSet = subscribers.add(triggerUpdate)

    return value.current
  } else {
    return contextType.initialValue
  }
}

// 判断两个数组是否一致
// 如果a为空 || ab长度不等 || b中的某一个值和a中同一个位置的值经过Object.is返回为false 表示经过了改变返回true
export const isChanged = (a: DependencyList, b: DependencyList) => {
  return !a || a.length !== b.length || b.some((arg, index) => !Object.is(arg, a[index]))
}
