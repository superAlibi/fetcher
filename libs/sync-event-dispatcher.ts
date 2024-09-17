
/**
 * 事件监听器类型
 * 或拦截器函数定义
 */
type Listener<T extends unknown[] = any[]> = ((...event: T) => Promise<unknown> | unknown);
/**
 * 同步事件分发器
 * 可以自定义事件类型 并获得类型提示
 */
export class SyncEventDispatcher<EventMap extends Record<string, unknown[]>> {
  private events: Record<keyof EventMap, Listener[]>;
  constructor() {
    this.events = {} as Record<keyof EventMap, Listener[]>; // 用来存储事件类型及对应的处理函数列表
  }
  /**
   * 添加事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} listener 事件处理函数 
   */
  public addEventListener<K extends keyof EventMap>(eventName: K, listener: Listener<EventMap[K]>) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
  }


  /**
   * 移除事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} [listener] 要移除的特定事件处理函数，如果不传则移除该事件的所有监听器
   */
  public removeEventListener(eventName: keyof EventMap, listener: Listener): void {
    if (this.events[eventName]) {
      if (listener) {
        this.events[eventName] = this.events[eventName].filter((l) =>
          l !== listener
        );
      } else {
        delete this.events[eventName];
      }
    }
  }
  /**
  * 触发事件，同步执行所有监听该事件的处理函数
  * @param  eventName 事件名称
  */
  public async dispatchEvent<T extends keyof EventMap, R = unknown>(type: T, data: EventMap[T]): Promise<unknown> {
    const listeners = this.events[type];
    if (!listeners || !listeners.length) {
      return data.at(0)

    }
    let result: unknown = data

    for (const listener of listeners) {
      try {
        result = await listener?.apply(null, data) ?? data; // 执行事件处理函数，可传入参数

      } catch (error) {

        console.error(
          `Error handling '${String(type)}' event:`,
          error,
        );
      }
    }
    return result as R

  }

}