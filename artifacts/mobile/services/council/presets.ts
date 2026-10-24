import type { IconName } from '@/components/Icon';

/** A ready-made room the user can start from and then edit. */
export interface CouncilPreset {
  id: string;
  title: string;
  icon: IconName;
  blurb: string;
  scenario: string;
  agentCount: number;
  roles: string[];
  directorRole: string;
  userPart: string;
}

export const PRESETS: CouncilPreset[] = [
  {
    id: 'court',
    title: 'Courtroom',
    icon: 'award',
    blurb: 'Two lawyers argue a case before a judge, and a bench decides',
    scenario:
      'A tenant in Bengaluru stopped paying rent for three months after the landlord refused to fix a leaking roof that damaged the tenant\'s belongings. The landlord has filed for eviction and arrears; the tenant counter-claims for repairs and damages. Hear the case as an Indian civil court would.',
    agentCount: 4,
    roles: ['Counsel for the landlord', 'Counsel for the tenant', 'Judge', 'Decision bench'],
    directorRole: 'Court clerk: open the hearing, keep order, call each speaker',
    userPart: 'A law student watching from the gallery who may put questions to the room',
  },
  {
    id: 'medical',
    title: 'Medical board',
    icon: 'heart',
    blurb: 'Specialists discuss a case and the chief doctor settles the plan',
    scenario:
      'A 58-year-old man with diabetes and high blood pressure has had chest discomfort on exertion for two weeks. His ECG is borderline and troponin is normal. Discuss diagnosis, tests and a treatment plan. This is a teaching discussion, not advice for a real patient.',
    agentCount: 4,
    roles: ['Cardiologist', 'General physician', 'Endocrinologist', 'Chief doctor (decides the plan)'],
    directorRole: 'Board secretary: present the case, keep time, call each specialist',
    userPart: 'A medical student who may ask questions',
  },
  {
    id: 'startup',
    title: 'Investor pitch',
    icon: 'trending-up',
    blurb: 'A founder faces investors; a lead partner decides whether to fund',
    scenario:
      'A founder pitches a subscription app that delivers home-cooked regional meals to office workers in tier-2 Indian cities, asking for ₹3 crore to expand to five cities. Probe the unit economics, competition and the team, then decide.',
    agentCount: 4,
    roles: ['Founder', 'Sceptical investor', 'Growth-minded investor', 'Lead partner (makes the call)'],
    directorRole: 'Host: introduce the pitch, run the Q&A, hand over for the decision',
    userPart: 'An observer who may ask the panel anything',
  },
  {
    id: 'debate',
    title: 'Debate',
    icon: 'message-circle',
    blurb: 'Two sides debate a motion; a judge weighs the arguments',
    scenario: 'Motion: schools in India should replace board exams with continuous assessment. One side proposes, one opposes.',
    agentCount: 3,
    roles: ['For the motion', 'Against the motion', 'Adjudicator'],
    directorRole: 'Chair: state the motion, give each side its turns, call the adjudication',
    userPart: 'Audience member who may ask a question',
  },
  {
    id: 'family',
    title: 'Family decision',
    icon: 'users',
    blurb: 'A household talks through a big choice and settles it',
    scenario:
      'A family is deciding whether to sell their flat in Mumbai and move to Pune to be closer to ageing parents, with a 14-year-old child in a good school and both parents working in Mumbai.',
    agentCount: 4,
    roles: ['Parent one (wants to move)', 'Parent two (hesitant)', 'The teenager', 'Family elder (helps them decide)'],
    directorRole: 'Mediator: set the question, make sure everyone is heard, sum up',
    userPart: 'A relative listening in who may add a point',
  },
  {
    id: 'custom',
    title: 'My own',
    icon: 'sparkles',
    blurb: 'Describe any situation and the roles you want',
    scenario: '',
    agentCount: 3,
    roles: [],
    directorRole: 'Moderator: open the discussion, call each speaker, sum up at the end',
    userPart: 'Observer who may ask questions',
  },
];

export const MIN_AGENTS = 2;
export const MAX_AGENTS = 6;

export const ROOM_LANGUAGES = ['English', 'Hindi', 'Hinglish', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali'];

/** The phone's locale for each room language (its speech recogniser and its voices). */
export const ROOM_LOCALES: Record<string, string> = {
  English: 'en-IN', Hindi: 'hi-IN', Hinglish: 'hi-IN', Kannada: 'kn-IN', Tamil: 'ta-IN', Telugu: 'te-IN', Marathi: 'mr-IN', Bengali: 'bn-IN',
};
