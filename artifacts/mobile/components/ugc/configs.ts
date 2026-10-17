import type { FormConfig, Option } from './types';

const opts = (...labels: string[]): Option[] => labels.map(l => ({ value: l.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), label: l }));

const LANGUAGES = opts(
  'Hindi', 'English', 'Hinglish', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Odia',
);
const RATIOS: Option[] = [
  { value: '9:16', label: '9:16 vertical' },
  { value: '1:1', label: '1:1 square' },
  { value: '16:9', label: '16:9 wide' },
];
const NEEDED_BY = opts('No rush', 'Within 3 days', 'Within a week');
const SCRIPT_MODE: Option[] = [
  { value: 'write', label: 'Write it for me' },
  { value: 'own', label: "I'll write it" },
];

/** UGC Ads: a business orders a promo video for a product or brand. */
export const UGC_ADS_CONFIG: FormConfig = {
  id: 'ugc-ads',
  gradient: ['#B026FF', '#FF2E88'],
  accent: '#F2542D',
  defaults: {
    aspect_ratio: '9:16',
    length: '30s',
    captions: true,
    script_mode: 'write',
    hook_style: 'auto',
    presenter: 'auto',
    whatsapp_ok: true,
    needed_by: 'no_rush',
    images: [],
  },
  sections: [
    {
      key: 'product',
      title: 'Product & brand',
      icon: 'shopping-bag',
      fields: [
        { key: 'product_name', label: 'Product or service name', type: 'text', required: true, maxLength: 80, helper: 'Exactly as it should appear on screen', placeholder: 'e.g. GlowUp Vitamin C Serum' },
        { key: 'product_description', label: 'What is it?', type: 'multiline', required: true, maxLength: 300, helper: 'What it does and who it is for' },
        { key: 'images', label: 'Product images', type: 'images', max: 5, required: true, coverBadge: true, helper: 'Clear shots. The first one is the cover' },
        { key: 'brand_name', label: 'Brand name', type: 'text', maxLength: 60, helper: 'Leave empty if it is the same as the product' },
        { key: 'logo', label: 'Logo', type: 'images', max: 1, helper: 'PNG with a transparent background works best' },
        {
          key: 'category', label: 'Category', type: 'chips', helper: 'Helps us pick the setting and style',
          options: opts('Fashion', 'Beauty', 'Food & Beverage', 'Electronics', 'Home', 'Health & Fitness', 'Education', 'Finance', 'App', 'Jewellery', 'Local service', 'Other'),
        },
        { key: 'selling_points', label: 'Key selling points', type: 'multiline', maxLength: 400, helper: 'Your top 3 reasons to buy' },
        { key: 'offer', label: 'Offer or price', type: 'text', maxLength: 80, helper: 'e.g. ₹499 or 30% off till Diwali' },
        { key: 'link', label: 'Website, app or Instagram link', type: 'link', helper: 'Where viewers should go', placeholder: 'https://' },
      ],
    },
    {
      key: 'goal',
      title: 'Goal & audience',
      icon: 'zap',
      fields: [
        {
          key: 'goal', label: 'Campaign goal', type: 'chips', required: true, helper: 'We shape the script around this',
          options: opts('Sales', 'Awareness', 'App installs', 'Leads', 'Store visits', 'Launch'),
        },
        {
          key: 'audience', label: 'Target audience', type: 'chipsMulti', helper: 'Who should feel "this is for me"',
          options: opts('Gen Z', '25–34', 'Parents', 'Women', 'Men', 'Students', 'Professionals', 'Business owners'),
        },
        {
          key: 'region', label: 'Region', type: 'chipsMulti', helper: 'Shapes the slang and cultural cues',
          options: opts('Pan-India', 'North', 'South', 'East', 'West', 'Metros', 'Tier 2/3'),
        },
        {
          key: 'cta', label: 'Call to action', type: 'chips', helper: 'The final line of the video',
          options: opts('Shop now', 'Download app', 'Visit website', 'Call now', 'DM us', 'Visit store', 'Custom'),
        },
        { key: 'cta_custom', label: 'Your call to action', type: 'text', maxLength: 80, showIf: v => v.cta === 'custom', placeholder: 'e.g. Use code WISH20' },
      ],
    },
    {
      key: 'format',
      title: 'Platform & format',
      icon: 'video',
      fields: [
        {
          key: 'platforms', label: 'Where will it run?', type: 'chipsMulti', helper: 'Pick all that apply',
          options: opts('Reels', 'Shorts', 'YouTube', 'Facebook', 'WhatsApp Status', 'Website', 'TV / OTT'),
        },
        { key: 'aspect_ratio', label: 'Aspect ratio', type: 'chips', options: RATIOS, helper: 'Vertical suits most social apps' },
        { key: 'length', label: 'Length', type: 'chips', options: opts('15s', '30s', '45s', '60s'), helper: 'Shorter usually performs better' },
        { key: 'language', label: 'Language', type: 'chips', required: true, options: LANGUAGES, helper: 'Spoken language of the video' },
        { key: 'captions', label: 'Captions', type: 'toggle', helper: 'Burned-in subtitles for silent viewing' },
      ],
    },
    {
      key: 'script',
      title: 'Script & message',
      icon: 'edit-2',
      fields: [
        { key: 'script_mode', label: 'Script', type: 'chips', options: SCRIPT_MODE },
        { key: 'script', label: 'Your script', type: 'multiline', maxLength: 1500, showIf: v => v.script_mode === 'own', helper: 'We will polish timing, not your meaning' },
        {
          key: 'hook_style', label: 'Hook style', type: 'chips', helper: 'The first 3 seconds',
          options: [
            { value: 'auto', label: 'Let us choose' },
            { value: 'question', label: 'Question' },
            { value: 'bold_claim', label: 'Bold claim' },
            { value: 'problem_solution', label: 'Problem and solution' },
            { value: 'testimonial', label: 'Testimonial' },
            { value: 'curiosity', label: 'Curiosity' },
          ],
        },
        {
          key: 'tone', label: 'Tone', type: 'chipsMulti', max: 2, helper: 'Pick up to 2',
          options: opts('Energetic', 'Funny', 'Emotional', 'Premium', 'Trustworthy', 'Desi / relatable', 'Calm'),
        },
        { key: 'brief', label: 'Brief', type: 'multiline', maxLength: 600, helper: 'Anything to say, show or demo' },
        { key: 'must_say', label: 'Must-say words', type: 'text', maxLength: 120, helper: 'Tagline, promo code, hashtag' },
        { key: 'avoid', label: 'Avoid', type: 'text', maxLength: 160, helper: 'Competitor names, claims not to make' },
      ],
    },
    {
      key: 'presenter',
      title: 'Presenter & look',
      icon: 'users',
      fields: [
        {
          key: 'presenter', label: 'Presenter', type: 'chips',
          options: [
            { value: 'auto', label: 'Let us choose' },
            { value: 'celebrity', label: 'A celebrity' },
            { value: 'female', label: 'Female creator' },
            { value: 'male', label: 'Male creator' },
            { value: 'voiceover', label: 'Voice-over only' },
          ],
        },
        { key: 'celebrity', label: 'Celebrity', type: 'celebrity', showIf: v => v.presenter === 'celebrity', helper: 'Their price applies if they have one set' },
        { key: 'setting', label: 'Setting', type: 'chips', options: opts('Let us choose', 'Home', 'Studio', 'Outdoor', 'Office', 'Shop', 'Kitchen', 'Gym') },
        { key: 'music', label: 'Music mood', type: 'chips', options: opts('Upbeat', 'Trending', 'Emotional', 'Corporate', 'Festive', 'None') },
        { key: 'show_offer', label: 'Show the offer on screen', type: 'toggle', helper: 'Price or offer appears as a text overlay' },
      ],
    },
    {
      key: 'extras',
      title: 'References & notes',
      icon: 'link',
      fields: [
        { key: 'reference_video', label: 'Reference video', type: 'link', helper: 'An ad you like the style of', placeholder: 'https://' },
        { key: 'needed_by', label: 'Needed by', type: 'chips', options: NEEDED_BY, helper: 'We will try our best, but cannot promise exact dates' },
        { key: 'whatsapp_ok', label: 'OK to WhatsApp me with questions', type: 'toggle', helper: 'Speeds up production' },
        { key: 'extra_notes', label: 'Extra notes', type: 'multiline', maxLength: 600 },
      ],
    },
  ],
};

/** UGC Videos: a personal creator-style video with a celebrity, for a person or occasion. */
export const UGC_VIDEOS_CONFIG: FormConfig = {
  id: 'ugc-videos',
  gradient: ['#FF2E88', '#FF5F1F'],
  accent: '#FF5F1F',
  defaults: {
    for_whom: 'other',
    language: '',
    length: '60s',
    script_mode: 'write',
    aspect_ratio: '9:16',
    title_card: true,
    keep_private: true,
    needed_by: 'no_rush',
    photos: [],
  },
  sections: [
    {
      key: 'who',
      title: 'Who and why',
      icon: 'heart',
      fields: [
        {
          key: 'for_whom', label: 'This is for', type: 'chips',
          options: [{ value: 'other', label: 'Someone else' }, { value: 'me', label: 'Me' }],
        },
        { key: 'name', label: 'Their name', type: 'text', required: true, maxLength: 60, showIf: v => v.for_whom !== 'me', helper: 'Shown and spoken in the video' },
        { key: 'pronunciation', label: 'How to pronounce it', type: 'text', maxLength: 60, showIf: v => v.for_whom !== 'me', helper: 'e.g. a-NUN-ya' },
        {
          key: 'pronoun', label: 'Pronoun', type: 'chips', showIf: v => v.for_whom !== 'me', helper: 'Needed for correct grammar',
          options: [{ value: 'he', label: 'He' }, { value: 'she', label: 'She' }, { value: 'they', label: 'They' }],
        },
        {
          key: 'relationship', label: 'Relationship', type: 'chips', showIf: v => v.for_whom !== 'me',
          options: opts('Mom', 'Dad', 'Partner', 'Friend', 'Sibling', 'Child', 'Colleague', 'Other'),
        },
        {
          key: 'occasion', label: 'Occasion', type: 'chips', required: true,
          options: opts('Birthday', 'Anniversary', 'Wedding', 'Congrats', 'Get well', 'Motivation', 'Festival', 'Farewell', 'Apology', 'Proposal', 'Just because'),
        },
        { key: 'needed_by', label: 'Needed by', type: 'chips', options: NEEDED_BY, helper: 'We will try our best, but cannot promise exact dates' },
      ],
    },
    {
      key: 'style',
      title: 'Celebrity and style',
      icon: 'star',
      fields: [
        { key: 'celebrity', label: 'Celebrity', type: 'celebrity', required: true, helper: 'The price depends on who you choose' },
        { key: 'language', label: 'Language', type: 'chips', required: true, options: LANGUAGES },
        {
          key: 'tone', label: 'Tone', type: 'chipsMulti', max: 2, helper: 'Pick up to 2',
          options: opts('Heartfelt', 'Funny', 'Hype', 'Filmy', 'Inspiring', 'Romantic', 'Light roast'),
        },
        { key: 'length', label: 'Length', type: 'chips', options: opts('30s', '60s', '90s') },
      ],
    },
    {
      key: 'message',
      title: 'Message',
      icon: 'edit-2',
      fields: [
        { key: 'script_mode', label: 'Script', type: 'chips', options: SCRIPT_MODE },
        { key: 'message', label: 'What should they say?', type: 'multiline', required: true, minLength: 10, maxLength: 800, helper: 'The heart of the message' },
        { key: 'details', label: 'Details to mention', type: 'multiline', maxLength: 500, helper: 'Nicknames, inside jokes, achievements' },
        { key: 'from', label: 'From', type: 'text', maxLength: 60, helper: "Sender name, e.g. 'From Rahul & family'" },
        { key: 'avoid', label: 'Avoid', type: 'text', maxLength: 160, helper: 'Topics or words to skip' },
      ],
    },
    {
      key: 'touch',
      title: 'Personal touch',
      icon: 'image',
      fields: [
        { key: 'photos', label: 'Their photos', type: 'images', max: 3, helper: 'Used as cutaways in the video' },
        { key: 'music', label: 'Music mood', type: 'chips', options: opts('Celebration', 'Emotional', 'Romantic', 'Filmy', 'None') },
        { key: 'setting', label: 'Setting', type: 'chips', options: opts('Let us choose', 'Home', 'Stage', 'Outdoor', 'Festive decor') },
        { key: 'title_card', label: 'Title card', type: 'toggle', helper: "Shows e.g. 'Happy Birthday, Ananya!'" },
        { key: 'captions', label: 'Captions', type: 'toggle' },
      ],
    },
    {
      key: 'delivery',
      title: 'Format and delivery',
      icon: 'video',
      fields: [
        { key: 'aspect_ratio', label: 'Aspect ratio', type: 'chips', options: RATIOS },
        { key: 'keep_private', label: 'Keep private', type: 'toggle', helper: 'Never used in WishMe showcases' },
        { key: 'extra_notes', label: 'Extra notes', type: 'multiline', maxLength: 600 },
      ],
    },
  ],
};
