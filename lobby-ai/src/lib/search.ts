export interface SearchResult {
  title: string
  link: string
  snippet: string
  date?: string
  source?: string
}

export async function webSearch(
  query: string,
  type: 'web' | 'news' = 'news',
): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    throw new Error('SERPER_API_KEY ortam değişkeni ayarlanmamış. serper.dev adresinden ücretsiz API anahtarı alın.')
  }

  const endpoint =
    type === 'news'
      ? 'https://google.serper.dev/news'
      : 'https://google.serper.dev/search'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'tr',
      hl: 'tr',
      num: 10,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Serper API hatası: ${response.status} ${body}`)
  }

  const data = await response.json()

  if (type === 'news') {
    return ((data.news as unknown[]) || []).map((item) => {
      const r = item as Record<string, string>
      return {
        title: r.title ?? '',
        link: r.link ?? '',
        snippet: r.snippet ?? '',
        date: r.date,
        source: r.source,
      }
    })
  }

  return ((data.organic as unknown[]) || []).map((item) => {
    const r = item as Record<string, string>
    return {
      title: r.title ?? '',
      link: r.link ?? '',
      snippet: r.snippet ?? '',
      source: r.displayLink,
    }
  })
}
