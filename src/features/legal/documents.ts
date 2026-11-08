/**
 * Legal texts shown in the app. The version is stored with every consent (EXPO_PUBLIC_LEGAL_VERSION).
 * These are working drafts written for the V1 data flows; have them reviewed by a qualified person
 * before public store release (tracked in docs/decisions.md and the Phase 7 checklist).
 */
export type LegalDocId = 'privacy' | 'terms' | 'disclaimer';

export const LEGAL_DOCS: Record<
  LegalDocId,
  { title: string; sections: { heading: string; body: string }[] }
> = {
  privacy: {
    title: 'Privacy policy',
    sections: [
      {
        heading: 'Draft status',
        body: 'This policy is a draft for testing builds and will be reviewed before public release.',
      },
      {
        heading: 'What we collect',
        body: 'Account email; profile details you enter (name, date of birth, sex for metabolic calculations, height, weight, goals, activity level, equipment, schedule, nutrition preferences); optional injury and health information; and, in later versions, workouts, food logs and GPS routes you choose to record.',
      },
      {
        heading: 'Why',
        body: 'Only to provide PACE: calculating your targets, planning your training around your schedule and injuries, and showing your progress. We do not sell your data, show ads, or use third-party tracking.',
      },
      {
        heading: 'Health data',
        body: 'Injury and health details are special-category data. They are stored only with your explicit consent, used only to adapt your plan, and can be deleted at any time without deleting your account.',
      },
      {
        heading: 'Where it is stored',
        body: 'In a Supabase (PostgreSQL) database in the EU. Every table is protected by row-level security so only your account can read your data.',
      },
      {
        heading: 'Your rights',
        body: 'You can view and correct your data in the app, export it, withdraw consent, and permanently delete your account and all associated data from Profile. Backups held by our hosting provider expire according to their retention policy.',
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    sections: [
      {
        heading: 'Draft status',
        body: 'These terms are a draft for testing builds and will be reviewed before public release.',
      },
      { heading: 'Eligibility', body: 'PACE is for people aged 18 and over.' },
      {
        heading: 'Not medical advice',
        body: 'PACE provides general fitness and nutrition guidance. It is not a medical device and does not diagnose, treat or prevent any condition.',
      },
      {
        heading: 'Estimates',
        body: 'Calorie targets, energy expenditure, projections and calories burned are estimates and may be inaccurate for you.',
      },
      {
        heading: 'Your account',
        body: 'Keep your password secure. You can delete your account at any time.',
      },
    ],
  },
  disclaimer: {
    title: 'Health disclaimer',
    sections: [
      {
        heading: 'Please read',
        body: 'PACE is not a medical device and does not diagnose or treat injuries or medical conditions. Recommendations are general fitness guidance. Stop exercising if you feel pain, dizziness or chest discomfort, and consult a qualified healthcare professional about injuries, medical conditions or before starting a new programme.',
      },
    ],
  },
};
