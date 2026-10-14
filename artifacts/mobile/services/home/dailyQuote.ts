/**
 * The daily line on Home (Flutter: core/daily_quotes.dart). A motivational line rather than an inspirational one:
 * it asks for something (start, finish, decide) instead of something to nod at. Local and deterministic: it
 * rotates once a day, needs no network, and never repeats on consecutive days.
 */
const LINES = [
  'Do the hard one first. The rest of the day gets easier.',
  'Start before you feel ready — readiness comes from starting.',
  'One hour of real work beats a day of getting ready to work.',
  'The task you keep moving down the list is the one to do now.',
  'Finish something today. Anything.',
  'Send it. A good thing shipped beats a perfect thing waiting.',
  'Decide now. A made decision frees the mind a pending one occupies.',
  'You do not need motivation. You need the first five minutes.',
  'Pick the call you are dreading and make it.',
  'Close one open loop before you open another.',
  'Your future self is watching. Give them something to work with.',
  'Show up today whether you feel like it or not — that is the whole trick.',
  'The work you avoid is usually the work that pays.',
  'Say no to one thing today so you can finish another.',
  'Do it badly, then make it better. Nothing improves in your head.',
  'Two hard hours today are worth ten distracted ones tomorrow.',
  'The day is yours until someone else spends it. Spend it first.',
  'Stop planning it. Open it and begin.',
  'Momentum is built, not found. Build some before lunch.',
  'Answer the message you have been avoiding.',
  'Effort compounds quietly, then all at once.',
  'Do today what your excuses are saving for tomorrow.',
  'Small and finished beats big and imagined.',
  'Discipline is choosing what you want most over what you want now.',
  'Every day you delay, the task grows. Take it while it is small.',
];

export function todaysQuote(now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(2026, 0, 1).getTime()) / 86400000);
  return LINES[((days % LINES.length) + LINES.length) % LINES.length];
}

/** Three conversation starters for the time of day, as (chip label, what is asked). */
export function tryAsking(now = new Date()): { label: string; prompt: string }[] {
  const h = now.getHours();
  if (h < 12) {
    return [
      { label: 'Brief me for today', prompt: 'Give me my brief for today.' },
      { label: 'What is on my calendar?', prompt: 'What is on my calendar today?' },
      { label: 'Remind me tonight', prompt: 'Remind me tonight at 8 to plan tomorrow.' },
    ];
  }
  if (h < 17) {
    return [
      { label: 'What did I promise?', prompt: 'What have I promised anyone recently?' },
      { label: 'Any mail worth reading?', prompt: 'Any important mail I should know about?' },
      { label: 'Track an expense', prompt: 'I spent money today — note it for me.' },
    ];
  }
  return [
    { label: 'Summarise my day', prompt: 'Summarise what happened today for me.' },
    { label: 'What is tomorrow like?', prompt: 'What does my day tomorrow look like?' },
    { label: 'Write an email', prompt: 'I want to send an email — ask me the details.' },
  ];
}
