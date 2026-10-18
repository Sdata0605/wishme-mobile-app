/**
 * The voice model sometimes SAYS it did something ("I have opened the screen") without calling the tool, so nothing
 * happened. Seen on a phone on 2026-10-18: the user said "Show me his pictures", the assistant answered that it had opened
 * it, and there was no show_pictures call in the log at all.
 *
 * When a finished answer claims an action and the user had asked for pictures or news and no tool was called in that
 * turn, the model is told, in a hidden message, that nothing happened and to call the tool now. Pure, so it is checked
 * offline (scripts/assistantExtras.selfcheck.ts).
 */

export interface MissedTool {
  tool: string;
  /** The hidden message that goes to the model. */
  nudge: string;
}

const ASKED_PICTURES = /\b(pictures?|photos?|photographs?|images?|pics?|selfies?)\b|फोटो|तस्वीर|चित्र|फ़ोटो/i;
const ASKED_NEWS = /\b(news|headlines?)\b|समाचार|खबर|ख़बर/i;
// "I have opened the screen", "here are the pictures", "I've pulled them up", "it's on your screen", "done".
const CLAIMS_DONE = /\b(open(ed|ing)?|shown|showing|here\s+(are|is)|pulled?\s+(them\s+)?up|put\s+(them\s+)?up|display(ed|ing)?|done|on\s+(your|the)\s+screen)\b|खोल\s*(दिया|दी|ा)|दिखा\s*(दिया|दी|रहा|रही)/i;

/** What the model said, what the user said, and how many tools were called in the same turn. */
export function missedTool(said: string, heard: string, toolsCalled: number): MissedTool | null {
  if (toolsCalled > 0) return null;
  const spoken = said.replace(/\s+/g, ' ').trim();
  if (spoken.length < 4 || !CLAIMS_DONE.test(spoken)) return null;
  if (ASKED_PICTURES.test(heard)) {
    return {
      tool: 'show_pictures',
      nudge:
        '[System: you said it was done, but you did not call show_pictures, so NOTHING opened. Call show_pictures now with the full name of the person or thing the user meant (for example "Virat Kohli", never "his" or "him"), then say one short sentence.]',
    };
  }
  if (ASKED_NEWS.test(heard)) {
    return {
      tool: 'show_news',
      nudge:
        '[System: you said it was done, but you did not call show_news, so no headlines are showing. Call show_news now (pass the topic if there was one), then say one short line.]',
    };
  }
  return null;
}
