/**
 * Spoken answers are shown as captions. The model is told never to use markdown, but when it slips ("**bold**", "- item",
 * "[text](link)") the screen must not show the symbols. Done when the caption is drawn, not per chunk, because a chunk can end
 * in the middle of "**".
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(\*\*|__|~~)/g, '')
    .replace(/(^|\s)[*_`]+(?=\S)/g, '$1')
    .replace(/(?<=\S)[*_`]+(?=\s|$)/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}
