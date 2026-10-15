/** Catalogue constants shared by the celebrity screens. Celebrity rows themselves come from Supabase (see hooks/useCelebrities). */

export { type Celebrity } from '@/hooks/useCelebrities';

/** Filter chips on the Home tab, in display order. 'All' clears the filter. */
export const CATEGORIES = ['All', 'Actors', 'Singers', 'Athletes', 'Comedians', 'Influencers', 'TV Stars'];
