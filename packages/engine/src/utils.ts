import type {
  AppliedThreatModifier,
  TalentModifiers,
  ThreatContext,
  ThreatModifier,
} from '@wow-threat/shared'

function modifierApplies(
  ctx: ThreatContext,
  modifier: ThreatModifier,
): boolean {
  if (modifier.spellIds) {
    const eventAbilityId =
      'abilityGameID' in ctx.event ? ctx.event.abilityGameID : undefined
    if (!eventAbilityId || !modifier.spellIds.has(eventAbilityId)) {
      return false
    }
  }

  if (
    modifier.schoolMask !== undefined &&
    (ctx.spellSchoolMask & modifier.schoolMask) === 0
  ) {
    return false
  }

  return true
}

/**
 * Gets all active modifiers from a list of aura modifier configs
 */
export function getActiveModifiers(
  ctx: ThreatContext,
  auraModifiers: Record<number, (ctx: ThreatContext) => ThreatModifier>,
): AppliedThreatModifier[] {
  const modifiers: AppliedThreatModifier[] = []

  for (const [spellIdStr, modifierFn] of Object.entries(auraModifiers)) {
    const spellId = parseInt(spellIdStr, 10)
    if (ctx.sourceAuras.has(spellId)) {
      const modifier = modifierFn(ctx)

      if (!modifierApplies(ctx, modifier)) {
        continue
      }

      modifiers.push({
        ...modifier,
        sourceId: spellId,
      })
    }
  }

  return modifiers
}

/** Get rank-aware modifiers for talents explicitly reported by WCL. */
export function getActiveTalentModifiers(
  ctx: ThreatContext,
  talentRanks: ReadonlyMap<number, number>,
  talentModifiers: TalentModifiers,
): AppliedThreatModifier[] {
  const modifiers: AppliedThreatModifier[] = []

  for (const [talentEntryIdString, config] of Object.entries(talentModifiers)) {
    const talentEntryId = Number.parseInt(talentEntryIdString, 10)
    const reportedRank = talentRanks.get(talentEntryId) ?? 0
    const rank = Math.max(0, Math.min(config.maxRank, Math.trunc(reportedRank)))
    if (rank === 0) {
      continue
    }

    const modifier = config.modifier(ctx, rank)
    if (!modifierApplies(ctx, modifier)) {
      continue
    }

    modifiers.push({
      ...modifier,
      sourceId: config.spellId,
    })
  }

  return modifiers
}

/**
 * Calculates the total multiplier from a list of modifiers
 */
export function getTotalMultiplier(modifiers: ThreatModifier[]): number {
  return modifiers.reduce((acc, mod) => acc * mod.value, 1)
}
