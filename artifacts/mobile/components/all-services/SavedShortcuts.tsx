import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, Plus, RotateCcw, X } from 'lucide-react-native';
import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass } from './themed';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  MAX_SHORTCUTS,
  SHORTCUT_CATALOG,
  openShortcut,
  shortcutById,
  useSavedShortcuts,
  type ShortcutCategory,
  type ShortcutDef,
} from './shortcuts';

/** The round badge of a shortcut: the provider's wordmark when it has one (and `wordmark` is on), otherwise the icon. */
function Badge({ def, size = 56, wordmark = true }: { def: ShortcutDef; size?: number; wordmark?: boolean }) {
  const sc = useShortcutStyles();
  return (
    <View
      style={[
        sc.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: T(def.bg, 'bg') },
      ]}
    >
      {def.brand && wordmark ? (
        <Text style={[sc.badgeText, { color: T(def.color, 'fg') }]} numberOfLines={2}>
          {def.brand.replace(' ', '\n')}
        </Text>
      ) : (
        <def.Icon size={size * 0.4} color={T(def.color, 'fg')} />
      )}
    </View>
  );
}

type SheetMode = 'add' | 'manage';

function ShortcutSheet({
  mode,
  onClose,
  api,
}: {
  mode: SheetMode | null;
  onClose: () => void;
  api: ReturnType<typeof useSavedShortcuts>;
}) {
  const sh = useSheetStyles();
  const insets = useSafeAreaInsets();
  const { ids, add, remove, move, reset } = api;
  const saved = ids ?? [];

  const groups = useMemo(() => {
    const taken = new Set(saved);
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: SHORTCUT_CATALOG.filter((d) => d.category === cat && !taken.has(d.id)),
    })).filter((g) => g.items.length > 0);
  }, [saved]);

  return (
    <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sh.backdrop} onPress={onClose} />
      <View style={[sh.panel, { paddingBottom: insets.bottom + 14 }]}>
        <View style={sh.grab} />
        <View style={sh.head}>
          <Text style={sh.title}>{mode === 'manage' ? 'Manage shortcuts' : 'Add a shortcut'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Text style={sh.done}>{mode === 'manage' ? 'Done' : 'Cancel'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          {mode === 'manage' ? (
            <>
              {saved.length === 0 && <Text style={sh.empty}>No shortcuts yet. Add some or reset to the defaults.</Text>}
              {saved.map((id, i) => {
                const def = shortcutById(id);
                if (!def) return null;
                return (
                  <View key={id} style={sh.row}>
                    <Badge def={def} size={40} wordmark={false} />
                    <View style={sh.rowText}>
                      <Text style={sh.rowTitle} numberOfLines={1}>
                        {def.brand ? `${def.brand} ${def.sub}` : def.sub}
                      </Text>
                      <Text style={sh.rowSub}>{CATEGORY_LABEL[def.category]}</Text>
                    </View>
                    <TouchableOpacity
                      style={[sh.iconBtn, i === 0 && sh.iconBtnOff]}
                      disabled={i === 0}
                      onPress={() => move(id, -1)}
                      accessibilityLabel="Move up"
                    >
                      <ChevronUp size={18} color={T(C.textLight, 'fg')} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[sh.iconBtn, i === saved.length - 1 && sh.iconBtnOff]}
                      disabled={i === saved.length - 1}
                      onPress={() => move(id, 1)}
                      accessibilityLabel="Move down"
                    >
                      <ChevronDown size={18} color={T(C.textLight, 'fg')} />
                    </TouchableOpacity>
                    <TouchableOpacity style={sh.iconBtn} onPress={() => remove(id)} accessibilityLabel="Remove">
                      <X size={18} color={T(C.red, 'fg')} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              <TouchableOpacity style={sh.resetBtn} onPress={reset} activeOpacity={0.8}>
                <RotateCcw size={15} color={T(C.purple, 'fg')} />
                <Text style={sh.resetText}>Reset to defaults</Text>
              </TouchableOpacity>
            </>
          ) : (
            groups.map((g) => (
              <View key={g.cat}>
                <Text style={sh.groupTitle}>{CATEGORY_LABEL[g.cat as ShortcutCategory]}</Text>
                {g.items.map((def) => (
                  <TouchableOpacity
                    key={def.id}
                    style={sh.row}
                    activeOpacity={0.8}
                    onPress={() => {
                      add(def.id);
                      onClose();
                    }}
                  >
                    <Badge def={def} size={40} wordmark={false} />
                    <View style={sh.rowText}>
                      <Text style={sh.rowTitle} numberOfLines={1}>
                        {def.brand ? `${def.brand} ${def.sub}` : def.sub}
                      </Text>
                    </View>
                    <Plus size={20} color={T(C.purple, 'fg')} />
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** The user's own one-tap shortcuts. A filter chip narrows them to that category. */
export function SavedShortcuts({ filter }: { filter: ShortcutCategory | 'all' }) {
  const sc = useShortcutStyles();
  const api = useSavedShortcuts();
  const [sheet, setSheet] = useState<SheetMode | null>(null);

  const shown = (api.ids ?? [])
    .map(shortcutById)
    .filter((d): d is ShortcutDef => !!d && (filter === 'all' || d.category === filter));
  const full = (api.ids?.length ?? 0) >= MAX_SHORTCUTS;

  return (
    <View style={sc.section}>
      <View style={sc.head}>
        <Text style={sc.title}>Saved Shortcuts</Text>
        <TouchableOpacity onPress={() => setSheet('manage')} hitSlop={8}>
          <Text style={sc.manage}>Manage</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.row}>
        {shown.map((d) => (
          <TouchableOpacity key={d.id} style={sc.item} activeOpacity={0.8} onPress={() => openShortcut(d)}>
            <Badge def={d} />
            <Text style={sc.itemSub} numberOfLines={1}>
              {d.sub}
            </Text>
          </TouchableOpacity>
        ))}
        {api.ids !== null && !full && (
          <TouchableOpacity style={sc.item} activeOpacity={0.8} onPress={() => setSheet('add')}>
            <View style={sc.addBadge}>
              <Plus size={22} color={T(C.orange, 'fg')} />
            </View>
            <Text style={sc.itemSub}>Add New</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <ShortcutSheet mode={sheet} onClose={() => setSheet(null)} api={api} />
    </View>
  );
}

const make_sc = () => StyleSheet.create({
  section: {
    backgroundColor: T(C.white, 'bg'),
    marginTop: 16,
    marginHorizontal: 14,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    ...glass(22),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  manage: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.purpleLight, 'fg') },
  row: { paddingHorizontal: 14, gap: 16 },
  item: { alignItems: 'center', width: 60, gap: 6 },
  badge: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 11, lineHeight: 13, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  itemSub: {
    fontSize: 10,
    color: T(C.textLight, 'fg'),
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  addBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: T(C.orange, 'border'),
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
const useShortcutStyles = () => useThemedStyles(make_sc);

const make_sh = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    backgroundColor: T(C.white, 'bg'),
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: T(C.border, 'border'),
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '78%',
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T(C.border, 'border'),
    marginBottom: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  done: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: T(C.purpleLight, 'fg') },
  groupTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: T(C.textLight, 'fg'),
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  rowSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.lightGray, 'bg'),
  },
  iconBtnOff: { opacity: 0.35 },
  empty: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    paddingVertical: 18,
    textAlign: 'center',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
  },
  resetText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.purple, 'fg') },
});
const useSheetStyles = () => useThemedStyles(make_sh);
