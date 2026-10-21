// Planning defaults only. This does not create awards or verify social metrics.
export const proposedArtistMilestones = [
 { level: 'First audience', metric: '1,000 verified organic views', bonusCents: 0, perk: 'Artist badge' },
 { level: 'Growing signal', metric: '10,000 verified organic views', bonusCents: 1000, perk: 'Featured campaign eligibility' },
 { level: 'Community builder', metric: '1,000 retained subscribers', bonusCents: 2500, perk: 'Creator tools' },
 { level: 'Breakthrough', metric: '10,000 retained subscribers', bonusCents: 10000, perk: 'Campaign spotlight' },
];
export function rewardPoolCents(realizedProfitCents: number, monthlyCapCents: number, alreadyReservedCents = 0) {
 for (const amount of [realizedProfitCents, monthlyCapCents, alreadyReservedCents]) {
  if (!Number.isSafeInteger(amount)) throw new Error('Use integer cents.');
 }
 if (monthlyCapCents < 0 || alreadyReservedCents < 0) throw new Error('Cap and commitments cannot be negative.');
 return Math.max(0, Math.min(Math.floor(Math.max(0, realizedProfitCents) / 10), monthlyCapCents) - alreadyReservedCents);
}
