import {
  SpellSchool,
  type ThreatContext,
  createMockActorContext,
} from '@wow-threat/shared'
import type { DamageEvent, EnergizeEvent } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import { getActiveModifiers, getActiveTalentModifiers } from './utils'

// Mock context factory
function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  return {
    event: { type: 'damage', abilityGameID: 100 } as DamageEvent,
    amount: 100,
    spellSchoolMask: SpellSchool.Physical,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestPlayer', class: 'warrior' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  }
}

describe('getActiveModifiers', () => {
  it('returns active modifiers based on source auras', () => {
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
    })

    const modifiers = {
      10: () => ({ name: 'Mod1', value: 1.1, source: 'buff' as const }),
      20: () => ({ name: 'Mod2', value: 1.2, source: 'buff' as const }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Mod1')
  })

  it('filters modifiers by spellIds if present - matched', () => {
    // Current event ability is 100
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      event: { type: 'damage', abilityGameID: 100 } as DamageEvent,
    })

    const modifiers = {
      10: () => ({
        name: 'Mod1',
        value: 1.1,
        source: 'buff' as const,
        spellIds: new Set([100, 101]), // Matches 100
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Mod1')
  })

  it('filters modifiers by spellIds if present - not matched', () => {
    // Current event ability is 100
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      event: { type: 'damage', abilityGameID: 100 } as DamageEvent,
    })

    const modifiers = {
      10: () => ({
        name: 'Mod1',
        value: 1.1,
        source: 'buff' as const,
        spellIds: new Set([102, 103]), // Does NOT match 100
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(0)
  })

  it('excludes modifiers with spellIds if event has no ability', () => {
    // Current event has no ability
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      event: { type: 'energize' } as EnergizeEvent,
    })

    const modifiers = {
      10: () => ({
        name: 'Mod1',
        value: 1.1,
        source: 'buff' as const,
        spellIds: new Set([100]),
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(0)
  })

  it('includes modifiers without spellIds regardless of event ability', () => {
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      event: { type: 'damage', abilityGameID: 100 } as DamageEvent,
    })

    const modifiers = {
      10: () => ({
        name: 'Mod1',
        value: 1.1,
        source: 'buff' as const,
        // No spellIds
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(1)
  })

  it('filters modifiers by schoolMask if present - matched', () => {
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      spellSchoolMask: SpellSchool.Holy,
    })

    const modifiers = {
      10: () => ({
        name: 'Holy Mod',
        value: 1.3,
        source: 'buff' as const,
        schoolMask: SpellSchool.Holy,
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Holy Mod')
    expect(result[0]?.schoolMask).toBe(SpellSchool.Holy)
  })

  it('matches schoolMask when modifier includes multiple schools', () => {
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      spellSchoolMask: SpellSchool.Nature,
    })

    const modifiers = {
      10: () => ({
        name: 'Nature or Arcane Mod',
        value: 1.2,
        source: 'buff' as const,
        schoolMask: SpellSchool.Nature | SpellSchool.Arcane,
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Nature or Arcane Mod')
  })

  it('filters modifiers by schoolMask if present - not matched', () => {
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      spellSchoolMask: SpellSchool.Physical,
    })

    const modifiers = {
      10: () => ({
        name: 'Holy Mod',
        value: 1.3,
        source: 'buff' as const,
        schoolMask: SpellSchool.Holy,
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(0)
  })

  it('excludes schoolMask-scoped modifiers when event school is unknown', () => {
    const ctx = createMockContext({
      sourceAuras: new Set([10]),
      spellSchoolMask: 0,
    })

    const modifiers = {
      10: () => ({
        name: 'Holy Mod',
        value: 1.3,
        source: 'buff' as const,
        schoolMask: SpellSchool.Holy,
      }),
    }

    const result = getActiveModifiers(ctx, modifiers)
    expect(result).toHaveLength(0)
  })
})

describe('getActiveTalentModifiers', () => {
  it('uses the reported rank and real talent spell ID', () => {
    const ctx = createMockContext()
    const result = getActiveTalentModifiers(ctx, new Map([[5000, 3]]), {
      5000: {
        spellId: 6000,
        maxRank: 5,
        modifier: (_ctx, rank) => ({
          source: 'talent',
          name: `Ranked Talent ${rank}`,
          value: 1 + rank * 0.05,
        }),
      },
    })

    expect(result).toEqual([
      {
        source: 'talent',
        sourceId: 6000,
        name: 'Ranked Talent 3',
        value: 1.15,
      },
    ])
  })

  it('ignores absent talents and clamps ranks to the configured maximum', () => {
    const ctx = createMockContext()
    const talentModifiers = {
      5000: {
        spellId: 6000,
        maxRank: 2,
        modifier: (_ctx: ThreatContext, rank: number) => ({
          source: 'talent' as const,
          name: `Ranked Talent ${rank}`,
          value: rank,
        }),
      },
    }

    expect(getActiveTalentModifiers(ctx, new Map(), talentModifiers)).toEqual(
      [],
    )
    expect(
      getActiveTalentModifiers(ctx, new Map([[5000, 99]]), talentModifiers)[0]
        ?.value,
    ).toBe(2)
  })

  it('applies the same spell filters used by aura modifiers', () => {
    const talentModifiers = {
      5000: {
        spellId: 6000,
        maxRank: 1,
        modifier: () => ({
          source: 'talent' as const,
          name: 'Scoped Talent',
          value: 1.1,
          spellIds: new Set([100]),
        }),
      },
    }

    expect(
      getActiveTalentModifiers(
        createMockContext(),
        new Map([[5000, 1]]),
        talentModifiers,
      ),
    ).toHaveLength(1)
    expect(
      getActiveTalentModifiers(
        createMockContext({
          event: { type: 'damage', abilityGameID: 101 } as DamageEvent,
        }),
        new Map([[5000, 1]]),
        talentModifiers,
      ),
    ).toHaveLength(0)
  })
})
