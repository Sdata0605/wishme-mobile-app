/**
 * Self-check for the News screens' page reading (no network):
 *
 *   node --experimental-strip-types scripts/newsExtract.selfcheck.ts
 */

import * as x from '../services/home/newsExtract.ts';

let checks = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`);
}

const bs = String.fromCharCode(92);
check('entities decode', x.decodeEntities('Tom &amp; Jerry &#39;s &#x2019; &rsquo;') === "Tom & Jerry 's ’ ’");
check('a publisher link is kept', x.publisherAddress('https://www.thehindu.com/a/b') === 'https://www.thehindu.com/a/b');
check('a Google link is not a publisher link', x.publisherAddress('https://news.google.com/rss/articles/abc') === null);
check('junk is not a link', x.publisherAddress('not a url') === null && x.publisherAddress('javascript:alert(1)') === null);

const answer = `[["wrb.fr","Fbv4je","[${bs}"garturlresp${bs}",null,${bs}"https://example.com/news/story?id${bs}u003d5${bs}u0026ref${bs}u003dgn${bs}"]",null,null,null,"generic"]]`;
check('address decoded from Google answer', x.addressFromAnswer(answer) === 'https://example.com/news/story?id=5&ref=gn', x.addressFromAnswer(answer));
check('a Google address in the answer is refused', x.addressFromAnswer(`${bs}"https://news.google.com/x${bs}"`) === null);
check('no address in the answer', x.addressFromAnswer('[]') === null);

const html = `<html><head>
<meta property="og:image" content="/img/top.jpg?a=1&amp;b=2">
<meta name="description" content="Short &amp; sweet summary">
</head><body><nav><p>Menu that is long enough to be a paragraph but sits inside the navigation block.</p></nav>
<article>
<p>The first real paragraph of the story, long enough to be kept as article text for the reader.</p>
<p>Subscribe to our newsletter and never miss another story from our desk, every single morning.</p>
<p>The second real paragraph carries on with the facts of the story and gives some more detail.</p>
<p>Short.</p>
<p>The first real paragraph of the story, long enough to be kept as article text for the reader.</p>
</article><footer><p>Copyright notice that is long enough to count as a paragraph by length alone, honest.</p></footer></body></html>`;
const a = x.extractArticle(html, 'https://example.com/news/1');
check('image is made absolute and decoded', a.image === 'https://example.com/img/top.jpg?a=1&b=2', a.image);
check('description', a.description === 'Short & sweet summary', a.description);
check('two clean paragraphs: no menu, junk, short, duplicate or footer', a.paragraphs.length === 2 && a.paragraphs[0].startsWith('The first real') && a.paragraphs[1].startsWith('The second real'), a.paragraphs);
check('a page with no meta has no image', x.headInfo('<html></html>', 'https://e.com').image === null);
check('a non-web image address is refused', x.imageOf('<meta property="og:image" content="data:image/png;base64,AAA">', 'https://e.com') === null);
const cap = x.extractArticle(`<article>${'<p>' + 'word '.repeat(60) + '</p>'.repeat(1)}${'<p>' + 'more '.repeat(60) + '</p>'}</article>`, 'https://e.com', 400);
check('text is capped', cap.paragraphs.length >= 1 && cap.paragraphs.join('').length <= 600, cap.paragraphs.join('').length);

console.log(`${checks} checks passed`);
