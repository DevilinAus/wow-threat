/**
 * Paladin Threat Configuration - WoW Forever
 *
 * Forever currently uses Era as its baseline, but Improved Righteous Fury no
 * longer increases threat. Forever talent effects must be based on explicit
 * WCL talent entries rather than Era talent-tree inference.
 */
import type { ClassThreatConfig, TalentModifierFn } from '@wow-threat/shared'

import {
  Spells,
  paladinConfig as eraPaladinConfig,
  hasRighteousFuryAura,
} from '../../era/classes/paladin'

export const ForeverSpells = {
  HolyStrikeR1: 679, // https://www.wowhead.com/forever/spell=679/
  HolyStrikeR2: 678, // https://www.wowhead.com/forever/spell=678/
  HolyStrikeR3: 1866, // https://www.wowhead.com/forever/spell=1866/
  HolyStrikeR4: 680, // https://www.wowhead.com/forever/spell=680/
  HolyStrikeR5: 2495, // https://www.wowhead.com/forever/spell=2495/
  HolyStrikeR6: 5569, // https://www.wowhead.com/forever/spell=5569/
  HolyStrikeR7: 10332, // https://www.wowhead.com/forever/spell=10332/
  HolyStrikeR8: 10333, // https://www.wowhead.com/forever/spell=10333/
  IronCreed: 1311034, // https://www.wowhead.com/forever/spell=1311034/
  InstrumentOfLaw: 1311085, // https://www.wowhead.com/forever/spell=1311085/
} as const

export const ForeverTalentEntries = {
  // TraitNode 110879; TraitDefinition 142631; Spell 1311034.
  IronCreed: 137877,
  // TraitNode 110880; TraitDefinition 142632; Spell 1311085.
  InstrumentOfLaw: 137878,
} as const

const HOLY_STRIKE_SPELL_IDS = new Set([
  ForeverSpells.HolyStrikeR1,
  ForeverSpells.HolyStrikeR2,
  ForeverSpells.HolyStrikeR3,
  ForeverSpells.HolyStrikeR4,
  ForeverSpells.HolyStrikeR5,
  ForeverSpells.HolyStrikeR6,
  ForeverSpells.HolyStrikeR7,
  ForeverSpells.HolyStrikeR8,
])

const ironCreedModifier: TalentModifierFn = (_ctx, rank) => {
  return {
    source: 'talent',
    name: `Iron Creed (Rank ${rank})`,
    value: 1 + rank * 0.05,
    spellIds: HOLY_STRIKE_SPELL_IDS,
  }
}

const instrumentOfLawModifier: TalentModifierFn = (ctx, rank) => {
  return {
    source: 'talent',
    name: `Instrument of Law (Rank ${rank})`,
    value: hasRighteousFuryAura(ctx.sourceAuras) ? 1 : 1 - rank * 0.1,
  }
}

// Copy Era's modifiers so the shared baseline is not mutated.
const auraModifiers: ClassThreatConfig['auraModifiers'] = {
  ...eraPaladinConfig.auraModifiers,
}

delete auraModifiers[Spells.ImprovedRighteousFuryR1]
delete auraModifiers[Spells.ImprovedRighteousFuryR2]
delete auraModifiers[Spells.ImprovedRighteousFuryR3]

export const foreverPaladinConfig: ClassThreatConfig = {
  ...eraPaladinConfig,
  auraModifiers,

  talentModifiers: {
    [ForeverTalentEntries.IronCreed]: {
      spellId: ForeverSpells.IronCreed,
      maxRank: 5,
      modifier: ironCreedModifier,
    },
    [ForeverTalentEntries.InstrumentOfLaw]: {
      spellId: ForeverSpells.InstrumentOfLaw,
      maxRank: 2,
      modifier: instrumentOfLawModifier,
    },
  },

  // Forever reports exact talent entry ranks, so do not use Era's tree-point
  // guesses to synthesize rank-specific talent auras.
  talentImplications: () => [],
}
