import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { parseApiError, supabaseFetch, SUPABASE_URL } from '@/constants/supabase';
import { useTheme } from '@/context/ThemeContext';
import type { CelebrityLite, FieldDef, Option, Values } from './types';

interface FieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  accent: string;
  invalid: boolean;
  token: string | null;
  authUid: string;
  /** Price shown on celebrity rows, already discounted. */
  celebrityPrice?: (c: CelebrityLite) => number | null;
}

const COLLAPSE_AFTER = 8;

export function Chips({
  options, value, onChange, multi, max, accent,
}: { options: Option[]; value: any; onChange: (v: any) => void; multi?: boolean; max?: number; accent: string }) {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const list = !expanded && options.length > COLLAPSE_AFTER + 1 ? options.slice(0, COLLAPSE_AFTER) : options;
  const hasMore = options.length > COLLAPSE_AFTER + 1;
  const selected: string[] = multi ? (Array.isArray(value) ? value : []) : value ? [value] : [];

  const toggle = (v: string) => {
    if (!multi) { onChange(selected[0] === v ? '' : v); return; }
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else if (!max || selected.length < max) onChange([...selected, v]);
  };

  return (
    <View style={s.chipRow}>
      {list.map(o => {
        const on = selected.includes(o.value);
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => toggle(o.value)}
            activeOpacity={0.8}
            style={[
              s.chip,
              on
                ? { backgroundColor: accent + (isDark ? '38' : '26'), borderColor: accent }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {multi && on && <Icon name="check" size={12} color={accent} />}
            <Text style={[s.chipText, { color: on ? accent : colors.foreground }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
      {hasMore && (
        <TouchableOpacity onPress={() => setExpanded(e => !e)} style={[s.chip, { borderColor: colors.border, backgroundColor: 'transparent' }]}>
          <Text style={[s.chipText, { color: colors.mutedForeground }]}>{expanded ? 'Less' : `+ ${options.length - COLLAPSE_AFTER} more`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ImageTiles({
  urls, max, onChange, accent, token, authUid, coverBadge,
}: { urls: string[]; max: number; onChange: (v: string[]) => void; accent: string; token: string | null; authUid: string; coverBadge?: boolean }) {
  const { colors } = useTheme();
  const [uploading, setUploading] = useState(0);

  const pick = async () => {
    if (!token || !authUid) return;
    const remaining = max - urls.length;
    if (remaining <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
    });
    if (res.canceled || res.assets.length === 0) return;
    setUploading(res.assets.length);
    const added: string[] = [];
    for (const asset of res.assets.slice(0, remaining)) {
      try {
        const blob = await (await fetch(asset.uri)).blob();
        const path = `${authUid}/ugc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const up = await supabaseFetch(
          `/storage/v1/object/promotional-content/${path}`,
          { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob },
          token,
        );
        if (!up.ok) throw new Error(await parseApiError(up));
        added.push(`${SUPABASE_URL}/storage/v1/object/public/promotional-content/${path}`);
      } catch (e) {
        console.warn('[ugc] photo upload failed', e);
        Alert.alert('Photo upload failed', e instanceof Error ? e.message : 'Please try again.');
      }
      setUploading(n => Math.max(0, n - 1));
    }
    setUploading(0);
    if (added.length) onChange([...urls, ...added]);
  };

  return (
    <View style={s.tileRow}>
      {urls.map((u, i) => (
        <View key={u} style={s.tile}>
          <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          {coverBadge && i === 0 && max > 1 && <View style={[s.cover, { backgroundColor: accent }]}><Text style={s.coverText}>Cover</Text></View>}
          <TouchableOpacity onPress={() => onChange(urls.filter(x => x !== u))} hitSlop={8} style={s.remove} accessibilityLabel="Remove photo">
            <Icon name="x" size={12} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
      {urls.length < max && (
        <TouchableOpacity onPress={pick} disabled={uploading > 0} activeOpacity={0.8} style={[s.tile, s.tileEmpty, { borderColor: colors.border }]}>
          {uploading > 0 ? <ActivityIndicator color={accent} /> : (
            <>
              <Icon name="plus" size={20} color={colors.mutedForeground} />
              <Text style={[s.tileCount, { color: colors.mutedForeground }]}>{urls.length}/{max}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function CelebrityPicker({
  value, onChange, accent, token, invalid, priceFor,
}: { value: CelebrityLite | null; onChange: (c: CelebrityLite) => void; accent: string; token: string | null; invalid: boolean; priceFor?: (c: CelebrityLite) => number | null }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [list, setList] = useState<CelebrityLite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const term = search.trim().replace(/[%,()*]/g, ' ');
        const nameFilter = term ? `&name=ilike.*${encodeURIComponent(term)}*` : '';
        const res = await supabaseFetch(
          `/rest/v1/celebrities?select=id,name,category,image_url,service_prices&is_active=eq.true&or=(consent_status.neq.rejected,consent_status.is.null)${nameFilter}&order=name.asc&limit=48`,
          {},
          token,
        );
        if (res.ok) setList(await res.json() as CelebrityLite[]);
      } catch {
        // keep the previous list
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, search, token]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={[s.input, s.celebRow, { borderColor: invalid ? '#EF4444' : colors.border, backgroundColor: colors.card }]}
      >
        {value?.image_url ? (
          <Image source={{ uri: value.image_url }} style={s.celebAvatar} contentFit="cover" />
        ) : (
          <View style={[s.celebAvatar, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="star" size={16} color={colors.mutedForeground} />
          </View>
        )}
        <Text style={{ flex: 1, color: value ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_500Medium' }} numberOfLines={1}>
          {value ? value.name : 'Choose a celebrity'}
        </Text>
        <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 24 : insets.top }}>
          <View style={s.pickHead}>
            <Text style={[s.pickTitle, { color: colors.foreground }]}>Choose a celebrity</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}><Icon name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search celebrities"
              placeholderTextColor={colors.mutedForeground}
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            />
          </View>
          {loading ? <ActivityIndicator style={{ marginTop: 28 }} color={accent} /> : (
            <FlatList
              data={list}
              keyExtractor={c => c.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 8 }}
              ListEmptyComponent={<Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 28 }}>No celebrities found</Text>}
              renderItem={({ item }) => {
                const p = priceFor?.(item) ?? null;
                return (
                  <TouchableOpacity
                    onPress={() => { onChange(item); setOpen(false); }}
                    activeOpacity={0.85}
                    style={[s.pickRow, { backgroundColor: colors.card, borderColor: value?.id === item.id ? accent : colors.border }]}
                  >
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={s.pickAvatar} contentFit="cover" cachePolicy="memory-disk" />
                    ) : (
                      <View style={[s.pickAvatar, { backgroundColor: colors.border }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{item.name}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>{item.category}</Text>
                    </View>
                    {p != null && <Text style={{ color: accent, fontFamily: 'Inter_700Bold' }}>₹{p.toLocaleString('en-IN')}</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

export function FieldRenderer({ field, value, onChange, accent, invalid, token, authUid, celebrityPrice }: FieldProps) {
  const { colors } = useTheme();
  const inputStyle = [s.input, { color: colors.foreground, borderColor: invalid ? '#EF4444' : colors.border, backgroundColor: colors.card }];

  return (
    <View style={s.field}>
      <View style={s.labelRow}>
        <Text style={[s.label, { color: colors.foreground }]}>{field.label}{field.required ? <Text style={{ color: '#EF4444' }}> *</Text> : null}</Text>
        {field.type === 'toggle' && (
          <Switch
            value={!!value}
            onValueChange={onChange}
            trackColor={{ false: colors.border, true: accent }}
            thumbColor="#fff"
          />
        )}
      </View>

      {field.type === 'chips' && <Chips options={field.options} value={value} onChange={onChange} accent={accent} />}
      {field.type === 'chipsMulti' && <Chips options={field.options} value={value} onChange={onChange} accent={accent} multi max={field.max} />}

      {(field.type === 'text' || field.type === 'link') && (
        <TextInput
          value={value ?? ''}
          onChangeText={t => onChange(field.maxLength ? t.slice(0, field.maxLength) : t)}
          placeholder={field.placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize={field.type === 'link' ? 'none' : 'sentences'}
          keyboardType={field.type === 'link' ? 'url' : 'default'}
          style={inputStyle}
        />
      )}

      {field.type === 'multiline' && (
        <>
          <TextInput
            value={value ?? ''}
            onChangeText={t => onChange(field.maxLength ? t.slice(0, field.maxLength) : t)}
            placeholder={field.placeholder}
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            style={[inputStyle, { minHeight: 96 }]}
          />
          {field.maxLength ? (
            <Text style={[s.counter, { color: colors.mutedForeground }]}>{(value ?? '').length} / {field.maxLength}</Text>
          ) : null}
        </>
      )}

      {field.type === 'images' && (
        <ImageTiles urls={value ?? []} max={field.max} onChange={onChange} accent={accent} token={token} authUid={authUid} coverBadge={field.coverBadge} />
      )}

      {field.type === 'celebrity' && (
        <CelebrityPicker value={value ?? null} onChange={onChange} accent={accent} token={token} invalid={invalid} priceFor={celebrityPrice} />
      )}

      {field.helper ? (
        <Text style={[s.helper, { color: invalid ? '#EF4444' : colors.mutedForeground }]}>
          {invalid ? `${field.label} is required. ` : ''}{field.helper}
        </Text>
      ) : invalid ? (
        <Text style={[s.helper, { color: '#EF4444' }]}>{field.label} is required</Text>
      ) : null}
    </View>
  );
}

export type { Values };

const s = StyleSheet.create({
  field: { marginTop: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  helper: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6, lineHeight: 16 },
  counter: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'right', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.2 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1f2937' },
  tileEmpty: { borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', gap: 2 },
  tileCount: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  cover: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  coverText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' },
  remove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  celebRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  celebAvatar: { width: 32, height: 32, borderRadius: 16 },
  pickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  pickTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1.2 },
  pickAvatar: { width: 46, height: 46, borderRadius: 23 },
});
