# web api fetch 封装

## 关于本包

内部使用webapi fetch进行封装,参考了axios



## 动机
### 其一
我不喜欢axios使用xhr,我更喜欢web api的标准,
### 其二
而不想关心内部实现,标准原生的就很好.不想关心什么兼容性

### 其三
axios有个比较讨厌的点,在拦截器中无法拦截处理非200的http状态码

常见的http返回400系列或者500系列错误

但是我希望拦截器可以拦截到非200的状态码,即使是403错误,服务器也有可能返回了正确的提示

例如,服务器方返回http状态码:503,同时返回业务消息体
```json
{
    "description": "服务器升级维护,预计需要10分钟,请稍后重试",
    "message": "服务器维护中"
}
```
以上消息,本来在拦截器都可以处理的问题,

但是axios不经过拦截器,而是跳过了拦截器,直接返回到业务层报错,

我tm...

由此,决定自己封装一个fetch

## 使用

1. 基本使用

```typescript
import {createFetcher} from 'jsr:@advance/fetcher'
const fetcher = createFetcher({
    baseUrl: 'http://domain.exmaple',
    headers: {
        'Content-Type': 'application/json'
    }
})
fetcher.get('/api/user/info').then(res => {
    console.log(res)
})
```

2. 拦截器

可以直接在createFetcher中传入拦截器
```typescript
import {createFetcher} from 'jsr:@advance/fetcher'

const fetcher = createFetcher({
    baseUrl: 'http://domain.exmaple',
    requestInterceptor:(reqinit:InterceptorConfig)=>{
        reqinit.headers['Authorization'] = 'Digest username=un'
    }
})


```


或者使用监听器的方式添加拦截器


```typescript
import {createFetcher} from 'jsr:@advance/fetcher'

const fetcher = createFetcher({
    baseUrl: 'http://domain.exmaple',
})

fetcher.addEventListener('request',(reqinit:InterceptorConfig)=>{
    reqinit.headers['Authorization'] = 'Digest username=un'
})
