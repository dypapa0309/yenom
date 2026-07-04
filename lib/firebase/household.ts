import { adminDb } from './admin'
import { CATEGORIES } from '@/types'

export interface HouseholdContext {
  householdId: string | null
  memberIds: string[]
  partnerIds: string[]
  partnerVisibility: Record<string, string[]>
}

export async function getHouseholdContext(userId: string): Promise<HouseholdContext> {
  const none: HouseholdContext = {
    householdId: null,
    memberIds: [userId],
    partnerIds: [],
    partnerVisibility: {},
  }

  try {
    // 속한 household 찾기
    const memberSnap = await adminDb
      .collection('household_members')
      .where('user_id', '==', userId)
      .limit(1)
      .get()

    if (memberSnap.empty) return none

    const householdId = memberSnap.docs[0].data().household_id

    // 모든 멤버 조회
    const allMembersSnap = await adminDb
      .collection('household_members')
      .where('household_id', '==', householdId)
      .get()

    if (allMembersSnap.size <= 1) return { ...none, householdId }

    const partnerIds = allMembersSnap.docs
      .map(d => d.data().user_id)
      .filter(id => id !== userId)

    if (partnerIds.length === 0) return { ...none, householdId }

    // 파트너별 공유 카테고리 조회
    const visibilitySnap = await adminDb
      .collection('household_visibility')
      .where('household_id', '==', householdId)
      .where('user_id', 'in', partnerIds)
      .get()

    const partnerVisibility: Record<string, string[]> = {}
    for (const partnerId of partnerIds) {
      const rows = visibilitySnap.docs
        .map(d => d.data())
        .filter(r => r.user_id === partnerId)

      if (rows.length === 0) {
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
  } catch {
    return none
  }
}
