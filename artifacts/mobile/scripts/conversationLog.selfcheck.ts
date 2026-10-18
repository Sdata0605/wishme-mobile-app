/**
 * Self-check for the conversation log that feeds the long-term memory (no network):
 *
 *   node --experimental-strip-types scripts/conversationLog.selfcheck.ts
 */

import { endLine, logFragment, peekLineCount, takeSession } from '../services/assistant/conversationLog.ts';

let checks = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`);
}

check('nothing said: nothing to keep', takeSession() === null);

logFragment('assistant', 'Hello.');
check('a greeting alone is not a conversation', takeSession() === null);

logFragment('user', 'My sis');
logFragment('user', 'ter Anita is getting married.');
endLine();
logFragment('assistant', 'That is wonderful');
logFragment('assistant', ' news.');
endLine();
logFragment('assistant', 'Anything else?');
endLine();
logFragment('user', 'Remind me on Sunday.');
check('three pieces from one speaker are one line', peekLineCount() === 4, peekLineCount());
const s = takeSession();
check('the session is handed over', !!s && s.lines.length === 4);
check('pieces are joined', s!.lines[0].text === 'My sister Anita is getting married.', s!.lines[0]);
check('the answer is joined', s!.lines[1].text === 'That is wonderful news.', s!.lines[1]);
check('two answers in a row stay separate lines', s!.lines[2].text === 'Anything else?' && s!.lines[2].role === 'assistant');
check('each line has a time and the session has an id', s!.lines.every((l) => !Number.isNaN(Date.parse(l.at))) && s!.id.length > 6);
check('taking it clears it', takeSession() === null && peekLineCount() === 0);

for (let i = 0; i < 400; i++) {
  logFragment('user', `line ${i}`);
  endLine();
  logFragment('assistant', `reply ${i}`);
  endLine();
}
check('a very long conversation keeps the latest 300 lines', peekLineCount() === 300, peekLineCount());
const long = takeSession();
check('and the newest line is the last one', long!.lines[long!.lines.length - 1].text === 'reply 399');

console.log(`${checks} checks passed`);
