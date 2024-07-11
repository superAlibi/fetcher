import { SyncEventDispatcher } from "./sync-event-dispatcher.ts";
import { deepMerge } from '@cross/deepmerge'


export type RequestInterceptor = (
  req: InterceptorConfig,
) => Omit<InterceptorConfig, "data"> | Promise<Omit<InterceptorConfig, "data">>;

export type ResponseInterceptor<T = unknown> = (
  resp: Response,
) => T | Promise<T>;
export interface FetherConfig extends RequestInit {


}
export interface InterceptorConfig extends FetherConfig {
  params?: ConstructorParameters<typeof URLSearchParams>[number];
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
export class Fetcher extends SyncEventDispatcher<{
  request: [InterceptorConfig];
  response: [Response, InterceptorConfig];
}> {
  constructor(
    public baseURL: string,
    public config: FetherConfig,
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

    const { params, url, ...otherCustomConfig } = customConfig

    const urlObj = new URL(
      this.getFormatedURL(url),
      location?.href || 'http://localhost',
    );
    if (params) {
      if (params instanceof URLSearchParams) {
        urlObj.search = params.toString();
      } else {
        urlObj.search = new URLSearchParams(params).toString();
      }
    }


    return new Request(urlObj, otherCustomConfig)
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
   * 如果options中存在那么会忽略body
   * @param url
   * @param options
   * @returns
   */
  public async request<T = Response>(
    url: string,
    options: FetherConfig = {},
  ): Promise<T> {
    // 合并配置
    const mergedFetchConfig = deepMerge(defaultConfig, options);

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
  public POST = this.post
  /**
   * method为 head的请求
   * @param url 
   * @param options 
   * @returns 
   */
  public head(url: string, options: Omit<FetherConfig, "body"> = {}): Promise<Response> {
    return this.request(url, {
      ...this.config,
      ...options,
      method: 'HEAD',
    })
  }
  public HEAD = this.head
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
 * 辅助创建Fetcher工具函数
 * @param option 
 * @returns 
 */
export const createFetcher = (
  option: FetherConfig & {
    baseURL?: string,
    requestInterceptor?: RequestInterceptor[] | RequestInterceptor;
    responseInterceptor?: ResponseInterceptor[] | ResponseInterceptor;
  } = { baseURL: '/' },
): Fetcher => {
  const { baseURL = "/", requestInterceptor, responseInterceptor, ...ops } = option;

  const fetcher = new Fetcher(baseURL, ops);
  if (requestInterceptor) {
    if (Array.isArray(requestInterceptor)) {
      requestInterceptor.forEach((interceptor) => {

        fetcher.addEventListener('request', interceptor)
      })
    } else {
      fetcher.addEventListener('request', requestInterceptor)

    }
  }
  if (responseInterceptor) {
    if (Array.isArray(responseInterceptor)) {
      responseInterceptor.forEach((interceptor) => {
        fetcher.addEventListener('response', interceptor)
      })
    } else {

      fetcher.addEventListener('response', responseInterceptor)
    }
  }
  return fetcher
};
