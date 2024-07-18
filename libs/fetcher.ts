import { SyncEventDispatcher } from "./sync-event-dispatcher.ts";
import { deepMerge } from '@cross/deepmerge'

/**
 * 请求拦截器
 * @param req 请求配置
 * @returns 
 */
export type RequestInterceptor = (
  req: InterceptorConfig,
) => InterceptorConfig | void | Promise<InterceptorConfig | void>;
/**
 * 响应拦截器
 * @param resp 原始响应对象
 * @param reqconfig 请求配置
 */
export type ResponseInterceptor = (
  resp: unknown, reqconfig: InterceptorConfig
) => unknown | Promise<unknown>;


/**
 * 请求配置
 */
export interface FetherConfig extends Omit<RequestInit, 'body'> {
  params?: ConstructorParameters<typeof URLSearchParams>[number];
  body?: BodyInit | Record<string | number, unknown>
}
/**
 * 请求拦截器配置
 */
interface InterceptorConfig extends FetherConfig {
  url: string;
}
/**
 * 全局默认配置
 * 仅仅配置了content-type=application/json
 */
export const defaultConfig: FetherConfig = {
  headers: {
    "Content-Type": "application/json",
  },
};
/**
 * 发送请求核心class对象
 * @example
  * ```typescript
  * const fetcher = createFetcher({
  *   baseURL:"https://examp.com",
  *   requestInterceptor(req) {
  *     req.headers={
  *       "Authorization": "Bearer bar"
  *     }
  *   }
  *   responseInterceptor(resp, requconfig) {
  *     const content = resp.text()
  *     console.log(requconfig.url, requconfig.method, content);
  *     return content
  *   }
  * })
  *  
  * fetcher.options('/api/login',{param:{q:"123"},body:{password:"123"}})
  * 
  * ```
  * 这样，fetcher会使用baseURL+url拼接 成为 pathname,同时自动将param自动拼接成为search参数
  * 请求体会自动将body自动转换为json字符串
 */
export class Fetcher extends SyncEventDispatcher<{
  request: Parameters<RequestInterceptor>;
  response: Parameters<ResponseInterceptor>;
}> {
  constructor(
    public baseURL: string,
    public config: FetherConfig = defaultConfig,
  ) {
    super();
  }
  /**
   * 拼接基本路径和业务逻辑
   * 主要就是/字符处理问题
   * @param baseURL 
   * @param pathname 
   * @returns 
   */
  static concatURL(baseURL: string, pathname: string): string {
    if (!baseURL.endsWith("/")) {
      baseURL += "/";
    }
    if (pathname.startsWith("/")) {
      return baseURL + pathname.slice(1);
    }
    return baseURL + pathname;
  }
  private getFormatedURL(pathname: string) {
    return Fetcher.concatURL(this.baseURL, pathname);
  }
  /**
   * 构建请求参数
   * @param config 
   * @returns 
   */
  private async buildRequest(config: InterceptorConfig): Promise<Request> {

    const customConfig = (await this.dispatchEvent('request', [config])) as InterceptorConfig;

    const { params, url, body, ...otherCustomConfig } = customConfig

    const urlObj = new URL(
      this.getFormatedURL(url),
      location?.href || 'http://localhost',
    );
    if (params) {
      if (params instanceof URLSearchParams) {
        urlObj.search = params.toString();
      } else {
        const formatedQuery = Object.fromEntries(
          Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
        )
        urlObj.search = new URLSearchParams(formatedQuery).toString();
      }
    }
    const { headers } = otherCustomConfig || {}
    const contentType = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]))['content-type'];
    let formatedbody: BodyInit | undefined
    if (contentType?.toLowerCase()?.includes('application/json')) {
      try {
        formatedbody = JSON.stringify(body)
      } catch {

        throw new Error(`body must be json stringify,but got ${typeof body}`)
      }
    }

    return new Request(urlObj, { ...otherCustomConfig, body: formatedbody })
  }
  /**
   * 构建响应体
   */
  private async buildResponse<T = Response>(
    resp: Response,
    config: InterceptorConfig,
  ): Promise<T> {
    const result = await this.dispatchEvent('response', [resp, config]) as T;
    return result
  }
  /**
   * 请求核心方法
   * 其他所有具名方法均调用此方法
   * @param url
   * @param options
   * @returns
   */
  public async request<T = Response>(
    url: string,
    options: FetherConfig = {},
  ): Promise<T> {
    // 合并配置
    const mergedFetchConfig = deepMerge(this.config, options);

    const req: Request = await this.buildRequest({ ...mergedFetchConfig, url });

    return fetch(req)
      .then((resp) => {
        return this.buildResponse<T>(resp, { ...mergedFetchConfig, url });
      });
  }
  /**
   * 发起 http methods=get的请求
   * @param url 相对baseURL的地址
   * @param options 请求选项
   * @returns 
   */
  public get<T = Response>(
    url: string,
    options: Omit<FetherConfig, "body"> = {},
  ): Promise<T> {
    return this.request<T>(url, {
      ...this.config,
      ...options,
      method: "GET",
    });
  }
  /**
   * @alias Fetcher.get
   */
  public GET = this.get
  /**
   * 发起http method=post的请求
   * @param url  相对baseURL的pathname
   * @param options 其他请求选项
   * @returns 
   */
  public post<T = Response>(
    url: string,
    options: FetherConfig = {},
  ): Promise<T> {
    return this.request<T>(url, {
      ...this.config,
      ...options,
      method: "POST",
    });
  }
  /**
   * @alias Fetcher.post
   */
  public POST = this.post
  /**
   * method为 head的请求
   * @param url 
   * @param options 
   * @returns 
   */
  public head<T = Response>(url: string, options: Omit<FetherConfig, "body"> = {}): Promise<T> {
    return this.request<T>(url, {
      ...this.config,
      ...options,
      method: 'HEAD',
    })
  }
  /**
   * @alias Fetcher.head
   */
  public HEAD = this.head
  /**
   * http method=options的请求
   * @param url 相对config.baseURL 中的路径
   * @param options 
   * @returns 
   */
  public options<T = Response>(
    url: string,
    options: FetherConfig = {},
  ): Promise<T> {
    return this.request<T>(url, {
      ...this.config,
      ...options,
      method: "OPTIONS",
    });
  }
}
/**
 * createFetch的参数类型
 */
export type CreateFetcherOptions = FetherConfig & {
  baseURL?: string,
  requestInterceptor?: RequestInterceptor[] | RequestInterceptor;
  responseInterceptor?: ResponseInterceptor[] | ResponseInterceptor;
}
/**
 * 辅助创建Fetcher工具函数
 * @param option 
 * @returns 
 * @example
 * ```
 * const fetcher = createFetcher({baseURL:"https://examp.com"})
 * fetcher.get("/api/login")
 * .then(async (resp)=>{
 *    console.log(await resp.text())
 * })
 * ```
 */
export const createFetcher = (
  option: CreateFetcherOptions = { ...defaultConfig, baseURL: '/' },
): Fetcher => {
  const { baseURL = "/", requestInterceptor, responseInterceptor, ...ops } = option;

  const fetcher = new Fetcher(baseURL, ops);

  if (Array.isArray(requestInterceptor)) {
    requestInterceptor.forEach((interceptor) => fetcher.addEventListener('request', interceptor))
  } else if (requestInterceptor) {
    fetcher.addEventListener('request', requestInterceptor)
  }

  if (Array.isArray(responseInterceptor)) {
    responseInterceptor.forEach((interceptor) => fetcher.addEventListener('response', interceptor))
  } else if (responseInterceptor) {
    fetcher.addEventListener('response', responseInterceptor)
  }

  return fetcher
};
