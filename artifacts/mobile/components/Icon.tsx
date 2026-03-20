import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

type RenderFn = (c: string, sz: number) => React.ReactElement;

const sw = 2;
const lc = 'round' as const;
const lj = 'round' as const;

function p(color: string) {
  return { stroke: color, strokeWidth: sw, strokeLinecap: lc, strokeLinejoin: lj, fill: 'none' } as const;
}

const ICONS = {
  home: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...p(c)} />
      <Polyline points="9,22 9,12 15,12 15,22" {...p(c)} />
    </Svg>
  ),
  phone: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.12 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" {...p(c)} />
    </Svg>
  ),
  'credit-card': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Rect x={1} y={4} width={22} height={16} rx={2} ry={2} {...p(c)} />
      <Line x1={1} y1={10} x2={23} y2={10} {...p(c)} />
    </Svg>
  ),
  calendar: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} {...p(c)} />
      <Line x1={16} y1={2} x2={16} y2={6} {...p(c)} />
      <Line x1={8} y1={2} x2={8} y2={6} {...p(c)} />
      <Line x1={3} y1={10} x2={21} y2={10} {...p(c)} />
    </Svg>
  ),
  heart: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" {...p(c)} />
    </Svg>
  ),
  'shopping-bag': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" {...p(c)} />
      <Line x1={3} y1={6} x2={21} y2={6} {...p(c)} />
      <Path d="M16 10a4 4 0 0 1-8 0" {...p(c)} />
    </Svg>
  ),
  'message-circle': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...p(c)} />
    </Svg>
  ),
  users: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...p(c)} />
      <Circle cx={9} cy={7} r={4} {...p(c)} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" {...p(c)} />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...p(c)} />
    </Svg>
  ),
  music: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18V5l12-2v13" {...p(c)} />
      <Circle cx={6} cy={18} r={3} {...p(c)} />
      <Circle cx={18} cy={16} r={3} {...p(c)} />
    </Svg>
  ),
  image: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} {...p(c)} />
      <Circle cx={8.5} cy={8.5} r={1.5} {...p(c)} />
      <Polyline points="21,15 16,10 5,21" {...p(c)} />
    </Svg>
  ),
  star: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24">
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={c} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj} fill={c} />
    </Svg>
  ),
  'star-outline': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" {...p(c)} />
    </Svg>
  ),
  video: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polygon points="23,7 16,12 23,17 23,7" {...p(c)} />
      <Rect x={1} y={5} width={15} height={14} rx={2} ry={2} {...p(c)} />
    </Svg>
  ),
  briefcase: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={7} width={20} height={14} rx={2} ry={2} {...p(c)} />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" {...p(c)} />
    </Svg>
  ),
  mail: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" {...p(c)} />
      <Polyline points="22,6 12,13 2,6" {...p(c)} />
    </Svg>
  ),
  zap: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...p(c)} />
    </Svg>
  ),
  search: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={8} {...p(c)} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} {...p(c)} />
    </Svg>
  ),
  'share-2': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={3} {...p(c)} />
      <Circle cx={6} cy={12} r={3} {...p(c)} />
      <Circle cx={18} cy={19} r={3} {...p(c)} />
      <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} {...p(c)} />
      <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} {...p(c)} />
    </Svg>
  ),
  'trending-up': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polyline points="23,6 13.5,15.5 8.5,10.5 1,18" {...p(c)} />
      <Polyline points="17,6 23,6 23,12" {...p(c)} />
    </Svg>
  ),
  gift: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polyline points="20,12 20,22 4,22 4,12" {...p(c)} />
      <Rect x={2} y={7} width={20} height={5} {...p(c)} />
      <Line x1={12} y1={22} x2={12} y2={7} {...p(c)} />
      <Path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" {...p(c)} />
      <Path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" {...p(c)} />
    </Svg>
  ),
  bell: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...p(c)} />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" {...p(c)} />
    </Svg>
  ),
  settings: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} {...p(c)} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" {...p(c)} />
    </Svg>
  ),
  'log-out': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...p(c)} />
      <Polyline points="16,17 21,12 16,7" {...p(c)} />
      <Line x1={21} y1={12} x2={9} y2={12} {...p(c)} />
    </Svg>
  ),
  x: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={18} y1={6} x2={6} y2={18} {...p(c)} />
      <Line x1={6} y1={6} x2={18} y2={18} {...p(c)} />
    </Svg>
  ),
  check: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polyline points="20,6 9,17 4,12" {...p(c)} />
    </Svg>
  ),
  'check-circle': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" {...p(c)} />
      <Polyline points="22,4 12,14.01 9,11.01" {...p(c)} />
    </Svg>
  ),
  circle: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} {...p(c)} />
    </Svg>
  ),
  'alert-circle': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} {...p(c)} />
      <Line x1={12} y1={8} x2={12} y2={12} {...p(c)} />
      <Line x1={12} y1={16} x2={12.01} y2={16} {...p(c)} />
    </Svg>
  ),
  'arrow-left': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={19} y1={12} x2={5} y2={12} {...p(c)} />
      <Polyline points="12,19 5,12 12,5" {...p(c)} />
    </Svg>
  ),
  'arrow-right': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={12} x2={19} y2={12} {...p(c)} />
      <Polyline points="12,5 19,12 12,19" {...p(c)} />
    </Svg>
  ),
  'arrow-down-left': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={17} y1={7} x2={7} y2={17} {...p(c)} />
      <Polyline points="17,17 7,17 7,7" {...p(c)} />
    </Svg>
  ),
  'arrow-up-right': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={7} y1={17} x2={17} y2={7} {...p(c)} />
      <Polyline points="7,7 17,7 17,17" {...p(c)} />
    </Svg>
  ),
  eye: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" {...p(c)} />
      <Circle cx={12} cy={12} r={3} {...p(c)} />
    </Svg>
  ),
  'eye-off': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" {...p(c)} />
      <Line x1={1} y1={1} x2={23} y2={23} {...p(c)} />
    </Svg>
  ),
  lock: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} {...p(c)} />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" {...p(c)} />
    </Svg>
  ),
  menu: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={3} y1={12} x2={21} y2={12} {...p(c)} />
      <Line x1={3} y1={6} x2={21} y2={6} {...p(c)} />
      <Line x1={3} y1={18} x2={21} y2={18} {...p(c)} />
    </Svg>
  ),
  sliders: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={21} x2={4} y2={14} {...p(c)} />
      <Line x1={4} y1={10} x2={4} y2={3} {...p(c)} />
      <Line x1={12} y1={21} x2={12} y2={12} {...p(c)} />
      <Line x1={12} y1={8} x2={12} y2={3} {...p(c)} />
      <Line x1={20} y1={21} x2={20} y2={16} {...p(c)} />
      <Line x1={20} y1={12} x2={20} y2={3} {...p(c)} />
      <Line x1={1} y1={14} x2={7} y2={14} {...p(c)} />
      <Line x1={9} y1={8} x2={15} y2={8} {...p(c)} />
      <Line x1={17} y1={16} x2={23} y2={16} {...p(c)} />
    </Svg>
  ),
  'play-circle': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} {...p(c)} />
      <Polygon points="10,8 16,12 10,16 10,8" {...p(c)} />
    </Svg>
  ),
  pause: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={4} width={4} height={16} fill={c} rx={1} />
      <Rect x={14} y={4} width={4} height={16} fill={c} rx={1} />
    </Svg>
  ),
  'volume-x': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" {...p(c)} />
      <Line x1={23} y1={9} x2={17} y2={15} {...p(c)} />
      <Line x1={17} y1={9} x2={23} y2={15} {...p(c)} />
    </Svg>
  ),
  'volume-2': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" {...p(c)} />
      <Path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" {...p(c)} />
    </Svg>
  ),
  'edit-2': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" {...p(c)} />
    </Svg>
  ),
  edit: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" {...p(c)} />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" {...p(c)} />
    </Svg>
  ),
  key: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" {...p(c)} />
    </Svg>
  ),
  'phone-call': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.12 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" {...p(c)} />
    </Svg>
  ),
  'phone-off': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.12 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" {...p(c)} />
      <Line x1={1} y1={1} x2={23} y2={23} {...p(c)} />
    </Svg>
  ),
  mic: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" {...p(c)} />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" {...p(c)} />
      <Line x1={12} y1={19} x2={12} y2={23} {...p(c)} />
      <Line x1={8} y1={23} x2={16} y2={23} {...p(c)} />
    </Svg>
  ),
  camera: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...p(c)} />
      <Circle cx={12} cy={13} r={4} {...p(c)} />
    </Svg>
  ),
  upload: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...p(c)} />
      <Polyline points="17,8 12,3 7,8" {...p(c)} />
      <Line x1={12} y1={3} x2={12} y2={15} {...p(c)} />
    </Svg>
  ),
  download: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...p(c)} />
      <Polyline points="7,10 12,15 17,10" {...p(c)} />
      <Line x1={12} y1={15} x2={12} y2={3} {...p(c)} />
    </Svg>
  ),
  plus: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} {...p(c)} />
      <Line x1={5} y1={12} x2={19} y2={12} {...p(c)} />
    </Svg>
  ),
  minus: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={12} x2={19} y2={12} {...p(c)} />
    </Svg>
  ),
  'trash-2': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polyline points="3,6 5,6 21,6" {...p(c)} />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...p(c)} />
      <Line x1={10} y1={11} x2={10} y2={17} {...p(c)} />
      <Line x1={14} y1={11} x2={14} y2={17} {...p(c)} />
    </Svg>
  ),
  info: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} {...p(c)} />
      <Line x1={12} y1={16} x2={12} y2={12} {...p(c)} />
      <Line x1={12} y1={8} x2={12.01} y2={8} {...p(c)} />
    </Svg>
  ),
  shield: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...p(c)} />
    </Svg>
  ),
  award: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={7} {...p(c)} />
      <Polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88" {...p(c)} />
    </Svg>
  ),
  'bar-chart-2': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={18} y1={20} x2={18} y2={10} {...p(c)} />
      <Line x1={12} y1={20} x2={12} y2={4} {...p(c)} />
      <Line x1={6} y1={20} x2={6} y2={14} {...p(c)} />
    </Svg>
  ),
  copy: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={9} width={13} height={13} rx={2} ry={2} {...p(c)} />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...p(c)} />
    </Svg>
  ),
  send: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Line x1={22} y1={2} x2={11} y2={13} {...p(c)} />
      <Polygon points="22,2 15,22 11,13 2,9 22,2" {...p(c)} />
    </Svg>
  ),
  play: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polygon points="5,3 19,12 5,21 5,3" {...p(c)} />
    </Svg>
  ),
  user: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...p(c)} />
      <Circle cx={12} cy={7} r={4} {...p(c)} />
    </Svg>
  ),
  'chevron-right': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Polyline points="9,18 15,12 9,6" {...p(c)} />
    </Svg>
  ),
  sun: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={5} {...p(c)} />
      <Line x1={12} y1={1} x2={12} y2={3} {...p(c)} />
      <Line x1={12} y1={21} x2={12} y2={23} {...p(c)} />
      <Line x1={4.22} y1={4.22} x2={5.64} y2={5.64} {...p(c)} />
      <Line x1={18.36} y1={18.36} x2={19.78} y2={19.78} {...p(c)} />
      <Line x1={1} y1={12} x2={3} y2={12} {...p(c)} />
      <Line x1={21} y1={12} x2={23} y2={12} {...p(c)} />
      <Line x1={4.22} y1={19.78} x2={5.64} y2={18.36} {...p(c)} />
      <Line x1={18.36} y1={5.64} x2={19.78} y2={4.22} {...p(c)} />
    </Svg>
  ),
  moon: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...p(c)} />
    </Svg>
  ),
  globe: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} {...p(c)} />
      <Line x1={2} y1={12} x2={22} y2={12} {...p(c)} />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {...p(c)} />
    </Svg>
  ),
  'help-circle': (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} {...p(c)} />
      <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" {...p(c)} />
      <Line x1={12} y1={17} x2={12.01} y2={17} {...p(c)} />
    </Svg>
  ),
  clock: (c, sz) => (
    <Svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} {...p(c)} />
      <Polyline points="12,6 12,12 16,14" {...p(c)} />
    </Svg>
  ),
} satisfies Record<string, RenderFn>;

const ALIASES = {
  'music-2': 'music',
  'sparkles': 'zap',
  'wallet': 'credit-card',
  'mail-check': 'check-circle',
} as const satisfies Record<string, keyof typeof ICONS>;

export type IconName = keyof typeof ICONS | keyof typeof ALIASES;

export function Icon({ name, size = 20, color = '#000' }: IconProps) {
  const resolved: keyof typeof ICONS =
    (ALIASES as Record<string, keyof typeof ICONS>)[name as string] ??
    (name as keyof typeof ICONS);
  const render = ICONS[resolved];
  if (!render) return null;
  return render(color, size);
}
