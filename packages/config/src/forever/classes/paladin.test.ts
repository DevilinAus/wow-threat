/**
 * Tests for the WoW Forever Paladin threat configuration.
 */
import { processEvents } from '@wow-threat/engine'
import {
  type Actor,
  type Enemy,
  createCombatantInfoEvent,
  createDamageEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wow-threat/shared/src/types'
import { SpellSchool } from '@wow-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { Spells } from '../../era/classes/paladin'
import { foreverConfig } from '../index'
import {
  ForeverSpells,
  ForeverTalentEntries,
  foreverPaladinConfig,
} from './paladin'

const IMPROVED_RIGHTEOUS_FURY_ENTRY_ID = 130358
const paladinActor: Actor = { id: 1, name: 'Devilin', class: 'paladin' }
const enemy: Enemy = { id: 2, name: 'TestEnemy', instance: 0 }

const HOLY_STRIKE_SPELL_IDS = [
  ForeverSpells.HolyStrikeR1,
  ForeverSpells.HolyStrikeR2,
  ForeverSpells.HolyStrikeR3,
  ForeverSpells.HolyStrikeR4,
  ForeverSpells.HolyStrikeR5,
  ForeverSpells.HolyStrikeR6,
  ForeverSpells.HolyStrikeR7,
  ForeverSpells.HolyStrikeR8,
] as const

function createMockContext(righteousFuryActive = true): ThreatContext {
  return {
    event: createDamageEvent(),
    amount: 100,
    spellSchoolMask: SpellSchool.Holy,
    sourceAuras: new Set(righteousFuryActive ? [Spells.RighteousFury] : []),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'Devilin', class: 'paladin' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
  }
}

function createTalentContext(): TalentImplicationContext {
  return {
    event: {
      timestamp: 0,
      type: 'combatantinfo',
      sourceID: 1,
      targetID: 1,
      talentTree: [
        {
          nodeID: 105634,
          id: IMPROVED_RIGHTEOUS_FURY_ENTRY_ID,
          rank: 3,
        },
      ],
    },
    sourceActor: { id: 1, name: 'Devilin', class: 'paladin' },
    talentPoints: [],
    talentRanks: new Map([[IMPROVED_RIGHTEOUS_FURY_ENTRY_ID, 3]]),
    specId: 1486,
  }
}

describe('WoW Forever Paladin config', () => {
  it('keeps base Righteous Fury at 1.6x Holy threat', () => {
    const modifier =
      foreverPaladinConfig.auraModifiers[Spells.RighteousFury]!(
        createMockContext(),
      )

    expect(modifier.value).toBe(1.6)
    expect(modifier.schoolMask).toBe(SpellSchool.Holy)
  })

  it('removes Era Improved Righteous Fury threat modifiers', () => {
    expect(
      foreverPaladinConfig.auraModifiers[Spells.ImprovedRighteousFuryR1],
    ).toBeUndefined()
    expect(
      foreverPaladinConfig.auraModifiers[Spells.ImprovedRighteousFuryR2],
    ).toBeUndefined()
    expect(
      foreverPaladinConfig.auraModifiers[Spells.ImprovedRighteousFuryR3],
    ).toBeUndefined()
  })

  it('does not infer threat modifiers from the reported Forever talent entry', () => {
    const impliedAuras = foreverPaladinConfig.talentImplications!(
      createTalentContext(),
    )

    expect(impliedAuras).toEqual([])
  })

  it.each([
    [1, 1.05],
    [2, 1.1],
    [3, 1.15],
    [4, 1.2],
    [5, 1.25],
  ])(
    'maps WCL Iron Creed rank %i to a Holy Strike-only %f modifier',
    (rank, expectedModifier) => {
      const talent =
        foreverPaladinConfig.talentModifiers![ForeverTalentEntries.IronCreed]!
      const modifier = talent.modifier(createMockContext(), rank)

      expect(talent.spellId).toBe(ForeverSpells.IronCreed)
      expect(talent.maxRank).toBe(5)
      expect(modifier.value).toBe(expectedModifier)
      expect(modifier.spellIds).toEqual(
        new Set([
          ForeverSpells.HolyStrikeR1,
          ForeverSpells.HolyStrikeR2,
          ForeverSpells.HolyStrikeR3,
          ForeverSpells.HolyStrikeR4,
          ForeverSpells.HolyStrikeR5,
          ForeverSpells.HolyStrikeR6,
          ForeverSpells.HolyStrikeR7,
          ForeverSpells.HolyStrikeR8,
        ]),
      )
    },
  )

  it('applies Iron Creed to every Holy Strike rank through the threat engine', () => {
    const result = processEvents({
      rawEvents: [
        createCombatantInfoEvent({
          sourceID: paladinActor.id,
          targetID: paladinActor.id,
          auras: [],
          talentTree: [
            {
              nodeID: 110879,
              id: ForeverTalentEntries.IronCreed,
              rank: 3,
            },
          ],
        }),
        ...HOLY_STRIKE_SPELL_IDS.map((abilityGameID) =>
          createDamageEvent({
            sourceID: paladinActor.id,
            targetID: enemy.id,
            abilityGameID,
            amount: 100,
          }),
        ),
      ],
      actorMap: new Map([[paladinActor.id, paladinActor]]),
      enemies: [enemy],
      config: foreverConfig,
    })
    const damageEvents = result.augmentedEvents.filter(
      (event) => event.type === 'damage',
    )

    expect(damageEvents).toHaveLength(HOLY_STRIKE_SPELL_IDS.length)
    damageEvents.forEach((event) => {
      expect(event.threat?.calculation.modifiedThreat).toBeCloseTo(115)
      expect(event.threat?.calculation.modifiers).toContainEqual(
        expect.objectContaining({
          source: 'talent',
          sourceId: ForeverSpells.IronCreed,
          name: 'Iron Creed (Rank 3)',
          value: 1.15,
        }),
      )
    })
  })

  it.each([
    [1, 0.9],
    [2, 0.8],
  ])(
    'maps WCL Instrument of Law rank %i to an all-threat %f modifier while RF is off',
    (rank, expectedModifier) => {
      const talent =
        foreverPaladinConfig.talentModifiers![
          ForeverTalentEntries.InstrumentOfLaw
        ]!
      const modifier = talent.modifier(createMockContext(false), rank)

      expect(talent.spellId).toBe(ForeverSpells.InstrumentOfLaw)
      expect(talent.maxRank).toBe(2)
      expect(modifier.value).toBe(expectedModifier)
      expect(modifier.spellIds).toBeUndefined()
      expect(modifier.schoolMask).toBeUndefined()
    },
  )

  it('disables Instrument of Law threat reduction while RF is active', () => {
    const talent =
      foreverPaladinConfig.talentModifiers![
        ForeverTalentEntries.InstrumentOfLaw
      ]!
    const modifier = talent.modifier(createMockContext(), 2)

    expect(modifier.value).toBe(1)
  })
})
