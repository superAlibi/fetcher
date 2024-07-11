# web api fetch 封装

## 关于本包

内部使用webapi fetch进行封装,参考了axios



## 动机
### 其一
我不喜欢axios使用xhr,我更喜欢web api的标准,
### 其二
而不想关心内部实现,标准原生的就很好.不想关心什么兼容性

### 其三
axios有个比较讨厌的点,在拦截器中无法拦截处理http状态码

最显然的特点就是http返回403或者500错误

但是我希望拦截器可以拦截到非200的状态码,因为即使是403错误,服务端也正常返回了响应体的

此时,axios直接不会经过拦截器,直接返回整个链路错误,表现为在业务层直接报错,我tm...

所以,我决定自己封装一个fetch

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
    headers: {
        'Content-Type': 'application/json'
    },
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
    headers: {
        'Content-Type': 'application/json'
    }
})

fetcher.addEventListener('request',(reqinit:InterceptorConfig)=>{
    reqinit.headers['Authorization'] = 'Digest username=un'
})
