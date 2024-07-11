import { createFetcher } from "~/libs/fetcher.ts";
import { assertEquals } from "$std/assert/mod.ts";

const urlObj = new URL('https://xjm.deno.dev/api/joke', "http://localhost:300/api/joke")

Deno.test('test fetcher', async (t) => {
  const fetcher = createFetcher({
    baseURL: 'https://xjm.deno.dev',

  })

  fetcher.addEventListener("request", (event) => {
    event.headers = {
      Authorization: 'Digest username=un'
    }
    return event
  })
  fetcher.addEventListener("response", (event, v) => {
    return event.text()

  })
  await t.step('test joke api ', async () => {
    const str = await fetcher.get<string>('/api/joke')

    assertEquals(typeof str, 'string')
  })
  await t.step('url obj test', () => {
    assertEquals(urlObj.hostname, 'xjm.deno.dev')
    assertEquals(urlObj.pathname, '/api/joke')
  })
})