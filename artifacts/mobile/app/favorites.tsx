import { router } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CelebCard } from '@/components/CelebCard';
import { Icon } from '@/components/Icon';
import { CELEBRITIES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [favs, setFavs] = useState(CELEBRITIES.slice(0, 6));
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Favorites</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={favs}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={{ position: 'relative' }}>
            <CelebCard celebrity={item} width={(W - 52) / 2} />
            <TouchableOpacity
              onPress={() => setFavs((prev) => prev.filter((f) => f.id !== item.id))}
              style={[styles.removeBtn, { backgroundColor: '#EF4444' }]}
            >
              <Icon name="x" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="heart" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No favorites yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Save your favorite celebrities here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  removeBtn: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
