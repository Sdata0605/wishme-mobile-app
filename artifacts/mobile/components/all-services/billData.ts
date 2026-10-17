import type { LucideIcon } from 'lucide-react-native';
import {
  Banknote,
  Car,
  CreditCard,
  Droplet,
  Flame,
  Phone,
  ShieldCheck,
  Smartphone,
  Tv,
  Wifi,
  Zap,
} from 'lucide-react-native';

export type BillKind =
  | 'electricity'
  | 'water'
  | 'gas'
  | 'broadband'
  | 'dth'
  | 'landline'
  | 'mobile'
  | 'creditCard'
  | 'loanEmi'
  | 'fastag'
  | 'insurance';

export type BillGroup = 'bills' | 'recharge' | 'finance';

export interface BillService {
  key: BillKind;
  title: string;
  desc: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  badge?: string;
  group: BillGroup;
}

export interface BillProvider {
  id: string;
  name: string;
  state?: string;
  hint: string;
}

export const BILL_SERVICES: BillService[] = [
  {
    key: 'electricity',
    title: 'Electricity',
    desc: 'Pay light bill for all major boards',
    Icon: Zap,
    color: '#D97706',
    bg: '#FFFBEB',
    badge: 'Popular',
    group: 'bills',
  },
  {
    key: 'water',
    title: 'Water',
    desc: 'Municipal & board water bills',
    Icon: Droplet,
    color: '#2563EB',
    bg: '#EFF6FF',
    group: 'bills',
  },
  {
    key: 'gas',
    title: 'Gas',
    desc: 'Piped gas & cylinder booking',
    Icon: Flame,
    color: '#F59E0B',
    bg: '#F5F0FF',
    group: 'bills',
  },
  {
    key: 'mobile',
    title: 'Mobile Recharge',
    desc: 'Prepaid recharge & postpaid bills',
    Icon: Smartphone,
    color: '#E8527A',
    bg: '#F5F3FF',
    badge: 'Fast',
    group: 'recharge',
  },
  {
    key: 'dth',
    title: 'DTH Recharge',
    desc: 'Airtel, Tata Play, Dish & more',
    Icon: Tv,
    color: '#374151',
    bg: '#F9FAFB',
    group: 'recharge',
  },
  {
    key: 'fastag',
    title: 'FASTag',
    desc: 'Recharge any FASTag instantly',
    Icon: Car,
    color: '#F59E0B',
    bg: '#F5F0FF',
    group: 'recharge',
  },
  {
    key: 'creditCard',
    title: 'Credit Card Bill',
    desc: 'Pay card dues with rewards',
    Icon: CreditCard,
    color: '#F59E0B',
    bg: '#F5F0FF',
    group: 'finance',
  },
  {
    key: 'loanEmi',
    title: 'Loan EMI',
    desc: 'Clear EMIs on time',
    Icon: Banknote,
    color: '#22C55E',
    bg: '#ECFDF5',
    group: 'finance',
  },
  {
    key: 'insurance',
    title: 'Insurance / LIC',
    desc: 'Premium & policy payments',
    Icon: ShieldCheck,
    color: '#22C55E',
    bg: '#ECFDF5',
    group: 'finance',
  },
  // Extra Paytm-style options (reachable from home icons / deep links)
  {
    key: 'broadband',
    title: 'Broadband',
    desc: 'Wi-Fi & fibre bill payments',
    Icon: Wifi,
    color: '#FF6B33',
    bg: '#F5F3FF',
    group: 'recharge',
  },
  {
    key: 'landline',
    title: 'Landline',
    desc: 'Pay landline phone bills',
    Icon: Phone,
    color: '#6B7280',
    bg: '#F9FAFB',
    group: 'recharge',
  },
];

/** Services shown on category landing screens (matches All Services cards) */
export const HUB_KEYS: Record<BillGroup, BillKind[]> = {
  bills: ['electricity', 'water', 'gas'],
  recharge: ['mobile', 'dth', 'fastag'],
  finance: ['creditCard', 'loanEmi', 'insurance'],
};

export function servicesForGroup(group: BillGroup) {
  const keys = new Set(HUB_KEYS[group]);
  return BILL_SERVICES.filter((s) => keys.has(s.key));
}

export function groupForKind(kind: BillKind): BillGroup {
  if (HUB_KEYS.bills.includes(kind)) return 'bills';
  if (HUB_KEYS.finance.includes(kind)) return 'finance';
  if (kind === 'broadband' || kind === 'landline') return 'recharge';
  return 'recharge';
}

export const ELECTRICITY_BOARDS: BillProvider[] = [
  { id: 'bescom', name: 'BESCOM', state: 'Karnataka', hint: 'Account / Consumer No.' },
  { id: 'bses-r', name: 'BSES Rajdhani', state: 'Delhi', hint: 'CA Number' },
  { id: 'bses-y', name: 'BSES Yamuna', state: 'Delhi', hint: 'CA Number' },
  { id: 'tneb', name: 'TNEB / TANGEDCO', state: 'Tamil Nadu', hint: 'Consumer Number' },
  { id: 'maha', name: 'MSEDCL', state: 'Maharashtra', hint: 'Consumer No.' },
  { id: 'uppcl', name: 'UPPCL', state: 'Uttar Pradesh', hint: 'Account Number' },
  { id: 'tsspdcl', name: 'TSSPDCL', state: 'Telangana', hint: 'Consumer Number' },
  { id: 'kseb', name: 'KSEB', state: 'Kerala', hint: 'Consumer Number' },
  { id: 'pspcl', name: 'PSPCL', state: 'Punjab', hint: 'Account Number' },
  { id: 'dhbvn', name: 'DHBVN', state: 'Haryana', hint: 'Account Number' },
];

export const WATER_PROVIDERS: BillProvider[] = [
  { id: 'bwssb', name: 'BWSSB', state: 'Bengaluru', hint: 'RR Number / Consumer No.' },
  { id: 'djb', name: 'Delhi Jal Board', state: 'Delhi', hint: 'K Number' },
  { id: 'mcgm', name: 'MCGM Water', state: 'Mumbai', hint: 'Consumer Number' },
  { id: 'hmwssb', name: 'HMWSSB', state: 'Hyderabad', hint: 'CAN Number' },
];

export const GAS_PROVIDERS: BillProvider[] = [
  { id: 'igl', name: 'Indraprastha Gas (IGL)', state: 'Delhi', hint: 'BP Number' },
  { id: 'mgl', name: 'Mahanagar Gas (MGL)', state: 'Mumbai', hint: 'Customer ID' },
  { id: 'gujarat', name: 'Gujarat Gas', state: 'Gujarat', hint: 'Customer Number' },
  { id: 'adani', name: 'Adani Gas', state: 'Multi-city', hint: 'Customer ID' },
];

export const CYLINDER_PROVIDERS: BillProvider[] = [
  { id: 'indane', name: 'Indane Gas', hint: 'Consumer No. / Mobile' },
  { id: 'hp', name: 'HP Gas', hint: 'Consumer No. / Mobile' },
  { id: 'bharat', name: 'Bharat Gas', hint: 'Consumer No. / Mobile' },
];

export const BROADBAND_PROVIDERS: BillProvider[] = [
  { id: 'airtel-bb', name: 'Airtel Xstream Fiber', hint: 'Registered Mobile / Account' },
  { id: 'jiofiber', name: 'JioFiber', hint: 'Service ID / Mobile' },
  { id: 'act', name: 'ACT Fibernet', hint: 'Account Number' },
  { id: 'bsnl-bb', name: 'BSNL Broadband', hint: 'Account Number' },
];

export const DTH_PROVIDERS: BillProvider[] = [
  { id: 'tata', name: 'Tata Play', hint: 'Subscriber ID' },
  { id: 'airtel-dth', name: 'Airtel Digital TV', hint: 'Customer ID' },
  { id: 'dish', name: 'Dish TV', hint: 'Viewing Card No.' },
  { id: 'sun', name: 'Sun Direct', hint: 'Smart Card No.' },
];

export const LANDLINE_PROVIDERS: BillProvider[] = [
  { id: 'airtel-ll', name: 'Airtel Landline', hint: 'Landline Number' },
  { id: 'bsnl-ll', name: 'BSNL Landline', hint: 'Landline Number' },
  { id: 'mtnl', name: 'MTNL', hint: 'Telephone Number' },
];

export const MOBILE_OPS: BillProvider[] = [
  { id: 'jio', name: 'Jio', hint: 'Mobile Number' },
  { id: 'airtel', name: 'Airtel', hint: 'Mobile Number' },
  { id: 'vi', name: 'Vi (Vodafone Idea)', hint: 'Mobile Number' },
  { id: 'bsnl', name: 'BSNL', hint: 'Mobile Number' },
];

export const FASTAG_PROVIDERS: BillProvider[] = [
  { id: 'paytm-ft', name: 'Paytm FASTag', hint: 'Vehicle / Tag ID' },
  { id: 'hdfc-ft', name: 'HDFC FASTag', hint: 'Tag ID / Vehicle No.' },
  { id: 'icici-ft', name: 'ICICI FASTag', hint: 'Tag ID' },
  { id: 'sbi-ft', name: 'SBI FASTag', hint: 'Vehicle Number' },
];

export const CREDIT_CARD_BANKS: BillProvider[] = [
  { id: 'hdfc-cc', name: 'HDFC Bank', hint: 'Card last 4 digits / Mobile' },
  { id: 'sbi-cc', name: 'SBI Card', hint: 'Card Number / Mobile' },
  { id: 'icici-cc', name: 'ICICI Bank', hint: 'Card ending digits' },
  { id: 'axis-cc', name: 'Axis Bank', hint: 'Card Number' },
];

export const LOAN_PROVIDERS: BillProvider[] = [
  { id: 'hdfc-loan', name: 'HDFC Bank Loan', hint: 'Loan Account No.' },
  { id: 'sbi-loan', name: 'SBI Loan', hint: 'Loan Account No.' },
  { id: 'bajaj', name: 'Bajaj Finserv', hint: 'Agreement No.' },
  { id: 'home-credit', name: 'Home Credit', hint: 'Contract Number' },
];

export const INSURANCE_PROVIDERS: BillProvider[] = [
  { id: 'lic', name: 'LIC of India', hint: 'Policy Number' },
  { id: 'hdfc-life', name: 'HDFC Life', hint: 'Policy Number' },
  { id: 'sbi-life', name: 'SBI Life', hint: 'Policy Number' },
  { id: 'icici-pru', name: 'ICICI Prudential', hint: 'Policy Number' },
];

export function providersFor(
  kind: BillKind,
  opts?: { gasMode?: 'piped' | 'cylinder' },
): BillProvider[] {
  switch (kind) {
    case 'electricity':
      return ELECTRICITY_BOARDS;
    case 'water':
      return WATER_PROVIDERS;
    case 'gas':
      return opts?.gasMode === 'cylinder' ? CYLINDER_PROVIDERS : GAS_PROVIDERS;
    case 'broadband':
      return BROADBAND_PROVIDERS;
    case 'dth':
      return DTH_PROVIDERS;
    case 'landline':
      return LANDLINE_PROVIDERS;
    case 'mobile':
      return MOBILE_OPS;
    case 'fastag':
      return FASTAG_PROVIDERS;
    case 'creditCard':
      return CREDIT_CARD_BANKS;
    case 'loanEmi':
      return LOAN_PROVIDERS;
    case 'insurance':
      return INSURANCE_PROVIDERS;
  }
}

export function serviceMeta(kind: BillKind) {
  return BILL_SERVICES.find((s) => s.key === kind)!;
}
