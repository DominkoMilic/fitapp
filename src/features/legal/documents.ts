/**
 * Legal texts shown in the app. The version is stored with every consent (EXPO_PUBLIC_LEGAL_VERSION);
 * bump it whenever these texts change. Written for the V1 data flows; have them reviewed by a
 * qualified person before public store release (docs/release/checklist.md).
 */
import { envResult } from '@/config/env';

export type LegalDocId = 'privacy' | 'terms' | 'disclaimer' | 'licences';

export const LEGAL_UPDATED = '24 November 2026';

const supportEmail = envResult.ok ? envResult.env.supportEmail : undefined;
/** How to reach the operator; the store listings always carry a support contact too. */
export const CONTACT = supportEmail
  ? `email ${supportEmail}`
  : 'use the support contact on PACE’s App Store or Google Play page';

type Doc = { title: string; sections: { heading: string; body: string }[] };

export const LEGAL_DOCS: Record<LegalDocId, Doc> = {
  privacy: {
    title: 'Privacy policy',
    sections: [
      {
        heading: 'Who we are',
        body: `PACE is a personal fitness app. The developer named on PACE’s App Store and Google Play pages is the controller of your personal data. To contact us about privacy, ${CONTACT}. Last updated ${LEGAL_UPDATED}.`,
      },
      {
        heading: 'What we collect',
        body: 'Your account email and password (stored hashed by our authentication provider). Profile details you enter: name, date of birth, sex, height, weight, goal, activity level, sports, schedule and equipment. What you log: weights, body measurements, daily check-ins, workouts, and walks, runs and rides with their GPS routes. Optional health information (injuries, conditions, pain). Your reminder settings and timezone. We do not collect contacts, photos, advertising identifiers or your location outside a recording.',
      },
      {
        heading: 'Why we use it, and on what basis',
        body: 'Only to provide PACE to you: calculating your targets, planning training around your schedule and injuries, recording activities, and showing progress, reviews and reports. Legal bases (GDPR): performing our contract with you; your explicit consent for health information (Art. 9(2)(a)); and your consent, given through your phone’s permission prompt, for location. We do not sell your data, show ads, profile you for marketing, or use analytics or tracking tools.',
      },
      {
        heading: 'Health information',
        body: 'Injuries, conditions and pain are special-category data. PACE stores them only after you agree, uses them only to adapt your plan and coaching, and you can delete all of it at any time in Profile → Health and injuries without deleting your account.',
      },
      {
        heading: 'Location',
        body: 'PACE reads your location only while you record a walk, run or ride. With your permission it keeps recording while the screen is locked, and your phone shows that it is in use. Routes are stored privately in your account, are never public, and are never sent to analytics or logs. You can delete a route (keeping the distance and time) or the whole activity. To show a route on a map, your phone loads map tiles from Apple Maps or Google Maps, which sees the map area requested.',
      },
      {
        heading: 'Social features (optional)',
        body: 'Social is off until you turn it on. When you do, people can find you by your handle and see your name, handle, colour, short bio and number of friends. Your friends see only the types of activity you choose to share (all off at first), as a short summary: for a workout its name, type, duration and number of sets (and lifted volume if you choose); for a walk, run or ride its distance, moving time and pace, and, only if you turn on “Share route shape”, the line of the route drawn without a map (scaled so it can’t be placed on a map, with no coordinates); or a milestone’s title. Friends can cheer and comment; comments are visible to you and your friends. Comments are checked automatically against a list of words: slurs and hateful words are refused, and if a comment on your post contains swearing we may alert you so you can keep or remove it (the alert never shows the comment text, and you can turn it off). You can remove any comment on your posts or turn comments off for a post. Weight, body measurements, goals, check-ins, pain, injuries, health, notes, maps and locations of your routes, and the time of day you train are never shared. When you send a friend request, block someone or report something, we store that so the feature works and to keep people safe; reports are reviewed by us within 24 hours. You can turn social off (your friends are kept) or delete your social profile (handle, friends and requests are removed) at any time in Settings → Social and privacy, and deleting your account removes all of it.',
      },
      {
        heading: 'Where your data is stored and who processes it',
        body: 'Your data is stored by Supabase (database, sign-in and file storage) in the European Union, acting as our processor. Reminders are local notifications created on your phone. If you use social features, notifications about cheers, comments and friend requests are delivered through Expo and Google Firebase Cloud Messaging, acting as our processors; they carry only a name, the kind of event and a link inside the app, never your training numbers or health information. You can turn each type off in Settings → Social and privacy.',
      },
      {
        heading: 'Security',
        body: 'Connections are encrypted. Every table is protected so that only your account can read or change your data (apart from the social profile and friend requests you choose to create, see Social features), and route files are kept in a private folder per account. Notifications never show weight or health details on the lock screen.',
      },
      {
        heading: 'How long we keep it',
        body: 'Until you delete it or your account. Deleting your account removes your data immediately; copies in our hosting provider’s backups expire according to its backup retention period, after which they are gone.',
      },
      {
        heading: 'Your rights',
        body: `You can see and correct your data in the app; export all of it (Profile → Your data → Export); delete health information or your whole account (Profile → Your data); and withdraw consent at any time. You can also ask us about your data, object to processing, or complain to your data protection authority. To exercise a right, ${CONTACT}.`,
      },
      {
        heading: 'Age',
        body: 'PACE is for people aged 18 and over. We do not knowingly collect data from children.',
      },
      {
        heading: 'Changes',
        body: 'If we change this policy we update the date above and, for significant changes, tell you in the app. The version you agreed to is recorded with your consent.',
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    sections: [
      {
        heading: 'Agreement',
        body: `By creating an account you agree to these terms. Last updated ${LEGAL_UPDATED}.`,
      },
      { heading: 'Eligibility', body: 'You must be 18 or older to use PACE.' },
      {
        heading: 'Not medical advice',
        body: 'PACE gives general fitness guidance. It is not a medical device and does not diagnose, treat or prevent any condition. Read the health disclaimer before you start.',
      },
      {
        heading: 'Estimates',
        body: 'Calories burned, goal dates, training load and GPS distances are estimates and can be inaccurate for you.',
      },
      {
        heading: 'Training and outdoor safety',
        body: 'You exercise at your own risk. Warm up, stop if you feel pain, and follow any restrictions from a professional. When recording outdoors, stay aware of traffic and your surroundings; do not look at your phone while cycling.',
      },
      {
        heading: 'Your account and content',
        body: 'Keep your password secure. What you log belongs to you. You allow us to store and process it only to provide PACE to you. You can export it or delete your account at any time.',
      },
      {
        heading: 'Acceptable use',
        body: 'Do not misuse PACE: no attempts to access other people’s data, overload or interfere with the service, or use it for anything unlawful.',
      },
      {
        heading: 'Community rules',
        body: 'If you use social features: be kind and respectful. No harassment, hate, threats, sexual content, spam, impersonation or sharing other people’s private information, and no offensive handles, names or bios. Comments with slurs or hateful words are refused; the owner of a post may remove comments on it. Do not pressure anyone to train through pain or to lose weight. You can block or report anyone; we review reports within 24 hours and may remove content, suspend social features for an account, or end an account that breaks these rules.',
      },
      {
        heading: 'Availability and changes',
        body: 'We work to keep PACE available and your data safe, but cannot guarantee uninterrupted service. Features may change; we will tell you about significant changes in the app.',
      },
      {
        heading: 'Liability',
        body: 'To the extent the law allows, PACE is provided “as is” and we are not liable for indirect losses or for injury resulting from exercise or diet choices. Nothing in these terms limits rights you have as a consumer that cannot be limited by law.',
      },
      {
        heading: 'Ending',
        body: `You can stop using PACE and delete your account at any time. We may suspend accounts that break these terms. Questions: ${CONTACT}.`,
      },
    ],
  },
  disclaimer: {
    title: 'Health disclaimer',
    sections: [
      {
        heading: 'Please read',
        body: 'PACE is not a medical device and does not diagnose or treat injuries or medical conditions. Its recommendations are general fitness guidance, not personal medical advice.',
      },
      {
        heading: 'Stop and get help',
        body: 'Stop exercising and seek medical help if you feel chest pain or pressure, severe shortness of breath, dizziness, fainting, or sharp or worsening pain. PACE will never tell you to train through pain.',
      },
      {
        heading: 'Talk to a professional first if',
        body: 'you have a heart, lung, metabolic or other medical condition; an injury that has not been assessed; you are pregnant or have recently given birth; you are under medical supervision for your weight; or you have, or have had, an eating disorder. In these cases please talk to a professional before setting a weight goal or starting a new programme.',
      },
      {
        heading: 'Injuries',
        body: 'Marking an injury makes PACE leave out exercises that load that area. It cannot judge how serious an injury is. Follow your physiotherapist’s or doctor’s restrictions over anything PACE suggests.',
      },
    ],
  },
  licences: {
    title: 'Data sources and licences',
    sections: [
      {
        heading: 'Exercise energy (MET values)',
        body: 'Herrmann SD, et al. 2024 Adult Compendium of Physical Activities. Journal of Sport and Health Science, 2024. Used for calorie estimates.',
      },
      {
        heading: 'Formulas',
        body: 'Distances: the haversine formula.',
      },
      {
        heading: 'Maps',
        body: 'Apple Maps on iPhone and Google Maps on Android, under their providers’ terms.',
      },
      {
        heading: 'Open-source software',
        body: 'PACE is built with open-source software including React Native and Expo (MIT), Supabase client libraries (MIT), TanStack Query (MIT), Zustand (MIT), Zod (MIT), react-native-svg (MIT), react-native-maps (MIT) and Lucide icons (ISC). Full licence texts are included with each package.',
      },
    ],
  },
};
