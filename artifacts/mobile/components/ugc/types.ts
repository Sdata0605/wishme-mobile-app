import type { IconName } from '@/components/Icon';

export type Values = Record<string, any>;

export interface Option { value: string; label: string }

export interface CelebrityLite {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  service_prices: { general_wish?: number; ugc_ad?: number } | null;
}

interface FieldBase {
  key: string;
  label: string;
  helper?: string;
  required?: boolean;
  /** The field is only shown (and only validated) when this returns true. */
  showIf?: (values: Values) => boolean;
}

export type FieldDef = FieldBase & (
  | { type: 'text' | 'link'; placeholder?: string; maxLength?: number }
  | { type: 'multiline'; placeholder?: string; maxLength?: number; minLength?: number }
  | { type: 'chips'; options: Option[] }
  | { type: 'chipsMulti'; options: Option[]; max?: number }
  | { type: 'toggle' }
  | { type: 'images'; max: number; coverBadge?: boolean }
  | { type: 'celebrity' }
);

export interface SectionDef {
  key: string;
  title: string;
  icon: IconName;
  fields: FieldDef[];
}

export interface FormConfig {
  id: string;
  /** Gradient used for the header and primary button. */
  gradient: readonly [string, string];
  /** Accent for selected chips, numbers, links. */
  accent: string;
  sections: SectionDef[];
  defaults: Values;
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function visibleFields(section: SectionDef, values: Values): FieldDef[] {
  return section.fields.filter(f => !f.showIf || f.showIf(values));
}

export function missingRequired(config: FormConfig, values: Values): { section: SectionDef; field: FieldDef }[] {
  const out: { section: SectionDef; field: FieldDef }[] = [];
  for (const section of config.sections) {
    for (const field of visibleFields(section, values)) {
      if (!field.required) continue;
      const v = values[field.key];
      const bad = field.type === 'multiline' && field.minLength
        ? (typeof v !== 'string' || v.trim().length < field.minLength)
        : isEmptyValue(v);
      if (bad) out.push({ section, field });
    }
  }
  return out;
}

/** Readable text for one answered field, used in summaries and the review sheet. */
export function displayValue(field: FieldDef, value: unknown): string {
  if (isEmptyValue(value) && field.type !== 'toggle') return '';
  switch (field.type) {
    case 'chips':
      return field.options.find(o => o.value === value)?.label ?? String(value);
    case 'chipsMulti':
      return (value as string[]).map(v => field.options.find(o => o.value === v)?.label ?? v).join(', ');
    case 'toggle':
      return value ? 'Yes' : 'No';
    case 'images':
      return `${(value as string[]).length} photo${(value as string[]).length === 1 ? '' : 's'}`;
    case 'celebrity':
      return (value as CelebrityLite).name;
    default:
      return String(value);
  }
}

/** Everything the customer answered, in readable form, for the admin to see (chips as labels, photos as URL lists). */
export function buildDetails(config: FormConfig, values: Values): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const section of config.sections) {
    for (const field of visibleFields(section, values)) {
      const v = values[field.key];
      if (field.type === 'toggle') { out[field.key] = !!v; continue; }
      if (isEmptyValue(v)) continue;
      if (field.type === 'images') out[field.key] = v;
      else if (field.type === 'chipsMulti') out[field.key] = (v as string[]).map(x => field.options.find(o => o.value === x)?.label ?? x);
      else if (field.type === 'celebrity') out[field.key] = (v as CelebrityLite).name;
      else out[field.key] = displayValue(field, v);
    }
  }
  return out;
}
