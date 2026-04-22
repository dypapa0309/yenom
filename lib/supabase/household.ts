import { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIES } from '@/types'

export interface HouseholdContext {
  householdId: string | null
  memberIds: string[]           // 본인 포함 모든 멤버
  partnerIds: string[]          // 파트너만
  // partnerId → 공유된 카테고리 목록 (없으면 전체 공유)
  partnerVisibility: Record<string, string[]>
}

// 현재 유저의 household 컨텍스트 반환
// memberIds: 데이터 쿼리에 쓸 user_id 배열 (본인 + 파트너)
// partnerVisibility: 파트너별로 허용된 카테고리 목록
export async function getHouseholdContext(
  supabase: SupabaseClient,
  userId: string
): Promise<HouseholdContext> {
  const none: HouseholdContext = {
    householdId: null,
    memberIds: [userId],
    partnerIds: [],
    partnerVisibility: {},
  }

  // 속한 household 찾기
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) return none

  const householdId = membership.household_id

  // 모든 멤버 조회
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)

  if (!members || members.length <= 1) return { ...none, householdId }

  const partnerIds = members.map(m => m.user_id).filter(id => id !== userId)

  // 파트너별 공유 카테고리 조회 (visible=true인 것만)
  const { data: visibilityRows } = await supabase
    .from('household_visibility')
    .select('user_id, category, visible')
    .eq('household_id', householdId)
    .in('user_id', partnerIds)

  const partnerVisibility: Record<string, string[]> = {}
  for (const partnerId of partnerIds) {
    const rows = visibilityRows?.filter(r => r.user_id === partnerId) ?? []
    if (rows.length === 0) {
      // 설정 없으면 전체 공유
      partnerVisibility[partnerId] = [...CATEGORIES]
    } else {
      partnerVisibility[partnerId] = rows.filter(r => r.visible).map(r => r.category)
    }
  }

  return {
    householdId,
    memberIds: [userId, ...partnerIds],
    partnerIds,
    partnerVisibility,
  }
}
