import { X } from 'lucide-react';
import type { LegalDocument } from '../types';

const documents: Record<LegalDocument, { title: string; intro: string; sections: Array<[string, string]> }> = {
  terms: {
    title: 'Terms of Use',
    intro: 'Effective September 4, 2026. Sistrum is a private-beta service operated as an NRN / SEYDANIC project.',
    sections: [
      ['Beta service', 'Features may change, experience interruptions, or have limited availability while Sistrum is in beta. Do not use Sistrum as the only copy of an audio master or artwork.'],
      ['Your account', 'Use accurate information, protect your password, and do not share or automate access in a way that harms the service. You are responsible for activity under your account.'],
      ['Your uploads', 'You keep ownership of your work. You give Sistrum a non-exclusive license to store, reproduce, transcode, display, and stream uploaded material only as needed to operate and promote the service.'],
      ['Rights confirmation', 'Only upload music, artwork, names, and other material you created or have permission to use. Do not upload uncleared samples, impersonations, unlawful content, malware, spam, or abusive material.'],
      ['Enforcement', 'Sistrum may remove content, restrict accounts, or preserve evidence when reasonably necessary to protect users, rights holders, or the service.'],
      ['Disclaimers', 'The beta is provided as available without a promise of uninterrupted operation. To the extent allowed by law, Sistrum is not responsible for indirect losses or lost files.'],
      ['Ending use', 'You may stop using Sistrum at any time and can permanently delete your account from the profile menu. Some records may be retained when legally required or needed to resolve reports.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'Effective September 4, 2026. This notice explains the data used to operate the Sistrum private beta.',
    sections: [
      ['Data collected', 'Sistrum processes your email, account profile, authentication records, uploaded audio and artwork, track metadata, comments, likes, reposts, follows, playlists, reports, and basic service logs.'],
      ['How it is used', 'Data is used to provide accounts and streaming, secure the service, enforce limits, respond to reports, diagnose failures, and understand aggregate product usage. Sistrum does not sell personal information.'],
      ['Service providers', 'Supabase provides authentication, database, and file storage. Vercel provides hosting and basic analytics. These providers process data under their own security and privacy commitments.'],
      ['Public information', 'Public tracks, profile details, artwork, comments, and public playlists can be seen by anyone. Your email and NRN Catalog ownership, publishing, master, and split information are not made public by Sistrum.'],
      ['Retention and deletion', 'Account data is kept while your account is active. The in-app deletion control removes your account and associated database records; backups and abuse-prevention records may take additional time to expire.'],
      ['Your choices', 'You can avoid optional profile fields, remove your content, sign out, or delete your account. Contact the project operator through the official Sistrum or SEYDANIC contact channel for access or correction requests.'],
      ['Security', 'Sistrum uses authenticated sessions, row-level database policies, least-privilege access, upload limits, and encrypted transport. No online service can guarantee absolute security.'],
    ],
  },
  community: {
    title: 'Community Guidelines',
    intro: 'Sistrum is built for original sound and constructive artist-to-listener connection.',
    sections: [
      ['Create honestly', 'Credit collaborators and do not present another person’s identity, recordings, artwork, or audience activity as your own.'],
      ['Respect people', 'No targeted harassment, threats, hate, exploitation, sexual content involving minors, or attempts to expose private information.'],
      ['Respect the platform', 'No spam, deceptive engagement, malicious files, automated scraping, artificial metrics, or attempts to bypass account and upload limits.'],
      ['Report responsibly', 'Use reporting for genuine safety, copyright, harassment, or spam concerns. Knowingly false or abusive reports may lead to account limits.'],
      ['Consequences', 'Content or accounts may be restricted or removed based on severity, repetition, legal requirements, and risk to the community.'],
    ],
  },
  copyright: {
    title: 'Copyright & Takedown',
    intro: 'Creators should only publish material they own or are authorized to use.',
    sections: [
      ['Reporting', 'Use the Report control on a track and choose Copyright. Include identification of the protected work, the Sistrum track, your contact information, a good-faith statement, and a statement that the report is accurate.'],
      ['Review', 'Sistrum may temporarily restrict material while reviewing a sufficiently detailed claim and may contact the uploader for a response.'],
      ['Counter-notices', 'An uploader who believes removal was mistaken may provide identification of the removed work, a good-faith explanation, contact information, and any legally required statements.'],
      ['Repeat infringement', 'Accounts associated with repeated or serious infringement may be terminated.'],
    ],
  },
};

interface LegalModalProps {
  document: LegalDocument | null;
  onClose: () => void;
}

export function LegalModal({ document, onClose }: LegalModalProps) {
  if (!document) return null;
  const content = documents[document];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl"
      >
        <div className="sticky top-0 mb-5 flex items-start justify-between bg-neutral-950 pb-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-[#ff5500]">Sistrum beta</div>
            <h2 id="legal-title" className="mt-1 text-2xl font-black text-white">{content.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-6 text-sm leading-6 text-neutral-300">{content.intro}</p>
        <div className="space-y-5">
          {content.sections.map(([title, body]) => (
            <section key={title}>
              <h3 className="mb-1 text-sm font-black text-white">{title}</h3>
              <p className="text-sm leading-6 text-neutral-400">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
