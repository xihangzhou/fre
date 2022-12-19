import { ITask } from './type'

const queue: ITask[] = [] // 所有任务的任务队列
const threshold: number = 5000 // 间隔时间
const transitions = [] // 分片任务任务队列
let deadline: number = 0

// 向transitions数组中添加一个transition然后执行当前的transition，当前分片任务
export const startTransition = cb => {
  transitions.push(cb) && translate()
}

// 开始调度callback回调
export const schedule = (callback: any): void => {
  // 把cb加入任务队列
  queue.push({ callback } as any)
  // 开始transition
  startTransition(flush)
}

// 这个task传入pending值，返回一个执行transitions中第一个函数的函数
const task = (pending: boolean) => {
  // cb这个函数用于执行transitions数组中的第一个函数
  const cb = () => transitions.splice(0, 1).forEach(c => c())
  // // return ()=>requestIdleCallback(cb)
  // 如果pending为false并且当前环境支持queueMicrotask(把一个函数放入微任务队列)
  if (!pending && typeof queueMicrotask !== 'undefined') {
    // 返回对cb使用queueMicrotask执行
    return () => queueMicrotask(cb)
  }
  // 如果支持MessageChannel
  if (typeof MessageChannel !== 'undefined') {
    const { port1, port2 } = new MessageChannel()
    port1.onmessage = cb
    // 那就返回如下回调通过信息通道使用宏任务执行cb
    return () => port2.postMessage(null)
  }
  // 再不行就直接setTimeout
  return () => setTimeout(cb)
}

// 去执行分片任务队列中的第一个任务的函数，经过task函数包装，进入微/宏任务队列排队
let translate = task(false) // 当前的transition任务

// 执行任务队列中的任务直到到达最大的时间片,如果已经达到最大时间片但是还没有执行完的话就继续把这个flush
const flush = (): void => {
  // 获取最大可以到的时间
  deadline = getTime() + threshold
  let job = peek(queue)
  // 只要还有job并且还没有到本次时间片的截止时间
  while (job && !shouldYield()) {
    const { callback } = job as any
    job.callback = null 
    // 一个隐患在这里，如果一个callback会执行很长的时间，那么就会造成主进程的抢占从而引起卡顿
    // 对于fiber tree的重建这里会把每个fiber节点的建立进行拆分，每次最多只执行一个fiber节点的扩展
    const next = callback() 
    // 如果这个callback有返回值
    if (next) {
      // 接着执行这个返回值
      job.callback = next as any
    } else {
      queue.shift()
    }
    job = peek(queue)
  }
  // 如果没有执行完任务队列中的任务就把translate更新为新的task
  job && (translate = task(shouldYield())) && startTransition(flush)
}

// 是否已经超时
export const shouldYield = (): boolean => {
  return getTime() >= deadline
}

export const getTime = () => performance.now() // 获取当前时间的时间戳

const peek = (queue: ITask[]) => queue[0] // 取到队列第一个元素