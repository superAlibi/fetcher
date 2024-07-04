import { SyncEventDispatcher } from "./sync-event-dispatcher.ts";
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
export type RequestInterceptor = (
  req: InterceptorConfig,
) => Omit<InterceptorConfig, "data"> | Promise<Omit<InterceptorConfig, "data">>;
export type ResponseInterceptor<T = unknown> = (
  resp: Response,
) => T | Promise<T>;
export interface FetherConfig extends RequestInit {
  params?: string[][] | Record<string, string> | string | URLSearchParams;
  data?: unknown;
  requestInterceptor?: RequestInterceptor;
  responseInterceptor?: ResponseInterceptor;
}
export interface InterceptorConfig extends FetherConfig {
  url: string;
}

export class Fetcher extends SyncEventDispatcher<{
  beforeRequest: InterceptorEvent;
  afterResponse: InterceptorEvent;
}> {
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
  /**
   * 
   * @param url 相对config.baseURL 中的路径
   * @param options 
   * @returns 
   * @example
   * ```ts
   * const fetcher = createFetcher({baseURL:"https://examp.com"})
   * fetcher.options('/api/login',{param:{q:"123"},data:{password:"123"}})
   * 
   * ```
   * 这样，fetcher会使用baseURL+url拼接 成为 pathname,同时自动将param自动拼接成为search参数
   * 请求体会自动将data自动转换为json字符串
   */
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
