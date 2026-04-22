import { Category } from '@/types'

// Kakao Local API category_group_code → app category
const KAKAO_CATEGORY_MAP: Record<string, Category> = {
  MT1: '식비',        // 대형마트
  CS2: '카페/간식',   // 편의점
  PS3: '교육',        // 유치원/어린이집
  SC4: '교육',        // 학교
  AC5: '교육',        // 학원
  PK6: '교통',        // 주차장
  OL7: '교통',        // 주유소/충전소
  BK9: '금융/보험',   // 은행
  CT1: '여가/취미',   // 문화시설
  AT4: '여가/취미',   // 관광명소
  AD5: '여가/취미',   // 숙박
  FD6: '배달/외식',   // 음식점
  CE7: '카페/간식',   // 카페
  HP8: '의료/약국',   // 병원
  PM9: '의료/약국',   // 약국
  SW8: '쇼핑',        // 마트/슈퍼 계열 외 쇼핑
}

interface KakaoDocument {
  category_group_code: string
  category_group_name: string
  category_name: string
  place_name: string
}

interface KakaoSearchResponse {
  documents: KakaoDocument[]
  meta: { total_count: number }
}

const cache = new Map<string, Category | null>()

export async function lookupKakaoCategory(
  merchantName: string
): Promise<Category | null> {
  const key = merchantName.trim()
  if (cache.has(key)) return cache.get(key)!

  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(key)}&size=1`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) {
      cache.set(key, null)
      return null
    }

    const data: KakaoSearchResponse = await res.json()
    const doc = data.documents?.[0]
    if (!doc) {
      cache.set(key, null)
      return null
    }

    const category = KAKAO_CATEGORY_MAP[doc.category_group_code] ?? null
    cache.set(key, category)
    return category
  } catch {
    cache.set(key, null)
    return null
  }
}

export async function enrichWithKakao(
  items: { id: string; merchant_name: string | null; description: string }[]
): Promise<Map<string, Category>> {
  const result = new Map<string, Category>()

  // Deduplicate lookup names
  const uniqueNames = new Map<string, string[]>()
  for (const item of items) {
    const name = item.merchant_name ?? item.description.substring(0, 20)
    if (!uniqueNames.has(name)) uniqueNames.set(name, [])
    uniqueNames.get(name)!.push(item.id)
  }

  // Rate limit: 5 concurrent, ~50ms gap
  const entries = Array.from(uniqueNames.entries())
  const CONCURRENCY = 5

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async ([name, ids]) => {
        const category = await lookupKakaoCategory(name)
        if (category) {
          for (const id of ids) result.set(id, category)
        }
      })
    )
    if (i + CONCURRENCY < entries.length) {
      await new Promise(r => setTimeout(r, 50))
    }
  }

  return result
}
