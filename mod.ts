type RequestInterceptor = (
  req: InterceptorConfig,
) => Omit<InterceptorConfig, "data"> | Promise<Omit<InterceptorConfig, "data">>;
type ResponseInterceptor<T = unknown> = (
  resp: Response,
) => T | Promise<T>;
interface FetherConfig extends RequestInit {
  params?: string[][] | Record<string, string> | string | URLSearchParams;
  data?: unknown;
  requestInterceptor?: RequestInterceptor;
  responseInterceptor?: ResponseInterceptor;
}
interface InterceptorConfig extends FetherConfig {
  url: string;
}
type EventType = "beforeRequest" | "afterResponse";
class InterceptorEvent extends Event {
  public config?: FetherConfig;
  data: Request | Response;
  constructor(
    eventType: EventType,
    data: Request | Response,
  ) {
    super(eventType);
    this.data = data;
  }
}
type RespLisener = (req: Response) => void;
type ReqLisener = (req: Request) => void;
type Listener = RespLisener | ReqLisener;
class SyncEventDispatcher {
  events: Record<string, Listener[]>;
  constructor() {
    this.events = {}; // 用来存储事件类型及对应的处理函数列表
  }
  addEventListener(eventName: "afterResponse", listener: RespLisener): void;
  addEventListener(eventName: "beforeRequest", listener: ReqLisener): void;
  /**
   * 添加事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} listener 事件处理函数
   */
  public addEventListener(eventName: EventType, listener: Listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
  }

  /**
   * 触发事件，同步执行所有监听该事件的处理函数
   * @param  eventName 事件名称
   */
  public dispatchEvent(event: InterceptorEvent) {
    const listeners = this.events[event.type];
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event.data.clone() as Request & Response); // 执行事件处理函数，可传入参数
        } catch (error) {
          console.error(
            `Error handling '${event.type}' event:`,
            error,
          );
        }
      }
    }
  }

  /**
   * 移除事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} [listener] 要移除的特定事件处理函数，如果不传则移除该事件的所有监听器
   */
  public removeEventListener(eventName: string, listener: Listener): void {
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
}
export class Fetcher extends SyncEventDispatcher {
  public baseURL: string;
  constructor(
    baseURL: string,
    public config: FetherConfig = {
      headers: {
        "Content-Type": "application/json",
      },
    },
  ) {
    super();
    if (baseURL.endsWith("/")) {
      this.baseURL = baseURL.slice(0);
    } else {
      this.baseURL = baseURL + "/";
    }
  }
  static concatURL(baseURL: string, url: string): string {
    if (!baseURL.endsWith("/")) {
      baseURL += "/";
    }
    if (url.startsWith("/")) {
      return baseURL + url.slice(1);
    }
    return baseURL + url;
  }
  private getFormatedURL(url: string) {
    return Fetcher.concatURL(this.baseURL, url);
  }
  /**
   * 如果options中存在data,那么会忽略body
   * @param url
   * @param options
   * @returns
   */
  public async request<T = unknown>(
    url: string,
    options: Omit<FetherConfig, "url"> = {},
  ): Promise<T> {
    let { params, data, body, requestInterceptor, responseInterceptor } =
      options;

    let req: Request;
    if (requestInterceptor) {
      const { url: originalURL, ...ops } = await requestInterceptor({
        url,
        ...options,
      });
      const urlObj = new URL(
        this.getFormatedURL(originalURL),
        location.href,
      );
      if (params) {
        if (params instanceof URLSearchParams) {
          urlObj.search = params.toString();
        } else {
          urlObj.search = new URLSearchParams(params).toString();
        }
      }
      const config = {
        body,
        ...this.config,
        ...ops,
      };
      req = new Request(urlObj, config);
    } else {
      if (data) {
        try {
          body = JSON.stringify(data);
        } catch (e) {
          console.error(
            "JSONization failure of data parameter:",
            e?.message,
          );
          return Promise.reject(e);
        }
      }
      const urlObj = new URL(this.getFormatedURL(url), location.href);
      if (params) {
        if (params instanceof URLSearchParams) {
          urlObj.search = params.toString();
        } else {
          urlObj.search = new URLSearchParams(params).toString();
        }
      }
      req = new Request(urlObj, {
        ...this.config,
        ...options,
        body,
      });
    }

    const e = new InterceptorEvent("beforeRequest", req);
    this.dispatchEvent(e);

    return fetch(req).then((resp) => {
      this.dispatchEvent(new InterceptorEvent("afterResponse", resp));
      if (responseInterceptor) {
        return responseInterceptor(resp) as T;
      }
      if (resp.ok) {
        return resp.json() as T;
      }
      return Promise.reject(resp);
    });
  }
  public get<T = unknown>(
    url: string,
    options: Omit<FetherConfig, "url" | "body" | "data"> = {},
  ): Promise<T> {
    return this.request<T>(url, {
      ...this.config,
      ...options,
      method: "GET",
    });
  }
  public post<T = unknown>(
    url: string,
    options: Omit<FetherConfig, "url"> = {},
  ): Promise<T> {
    return this.request<T>(url, {
      ...this.config,
      ...options,
      method: "POST",
    });
  }
  public options<T = unknown>(
    url: string,
    options: Omit<FetherConfig, "url"> = {},
  ): Promise<T> {
    return this.request<T>(url, {
      ...this.config,
      ...options,
      method: "OPTIONS",
    });
  }
}
export const createFetcher = (
  option: FetherConfig & { baseURL?: string },
): Fetcher => {
  const { baseURL = "/", ...ops } = option;
  return new Fetcher(baseURL, ops);
};
