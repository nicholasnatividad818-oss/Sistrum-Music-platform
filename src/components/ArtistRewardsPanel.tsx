import { proposedArtistMilestones } from '../services/artistRewards';
export function ArtistRewardsPanel() {
 return <section className="rounded-2xl border border-violet-500/30 bg-neutral-900 p-6">
  <p className="text-xs uppercase tracking-wider text-violet-300">Platform-funded artist achievements</p>
  <h2 className="mt-2 text-xl font-bold">Build your audience. Unlock new levels.</h2>
  <p className="mt-3 text-sm leading-6 text-neutral-400">Proposed pilot · not accepting claims yet. These example bonuses are separate from artist-funded campaign fees. Awards require verified organic growth, operator approval, and a funded reward pool.</p>
  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{proposedArtistMilestones.map(m => <div key={m.level} className="rounded-xl border border-neutral-700 p-4"><h3 className="font-bold">{m.level}</h3><p className="mt-2 text-xs text-neutral-400">{m.metric}</p><p className="mt-3 font-black text-violet-300">{m.bonusCents ? `$${m.bonusCents / 100} proposed bonus` : 'Badge unlock'}</p><p className="mt-2 text-xs">{m.perk}</p></div>)}</div>
  <p className="mt-4 text-xs leading-5 text-neutral-500">Suggested funding: up to 10% of realized contribution profit, with a monthly cap. Cash is reserved before award approval. One-time milestones per verified artist; subscriber milestones require retention. Monthly batched payouts begin after reaching a published minimum balance.</p>
 </section>;
}
