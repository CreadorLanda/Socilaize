import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { createChat } from '@/data/api/messages';
import { searchUsers } from '@/data/api/users';
import type { ApiUser } from '@/data/api/auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export default function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiUser[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const id = setTimeout(async () => {
      try { setResults(await searchUsers(query) ?? []); }
      catch { setResults([]); }
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const handleSelectUser = async (user: ApiUser) => {
    setBusy(true);
    try {
      const { chat_id } = await createChat(user.id);
      router.back();
      router.push(`/chat/${chat_id}`);
    } catch {
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
        <View style={[styles.field, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('discover.search_placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text }]}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.cancelBtn}>
          <Text style={[styles.cancel, { color: colors.primary }]}>{t('common.cancel')}</Text>
        </Pressable>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleSelectUser(item)}
            disabled={busy}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: colors.background },
              pressed && { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
              {item.avatar_uri ? (
                <Image source={{ uri: item.avatar_uri }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={24} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.text}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.display_name || item.username}
              </Text>
              <Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
          </Pressable>
        )}
        contentContainerStyle={results?.length === 0 ? styles.empty : undefined}
        ListEmptyComponent={
          query.length < 2 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('search.type_to_search')}
            </Text>
          ) : (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('search.no_results')}
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: Radii.pill,
  },
  input: { flex: 1, ...Typography.body, fontSize: 15, padding: 0 },
  cancelBtn: { paddingVertical: Spacing.xs },
  cancel: { ...Typography.bodyStrong },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: Radii.pill,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  text: { flex: 1 },
  name: { ...Typography.body, fontWeight: '600' },
  username: { ...Typography.caption, marginTop: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { ...Typography.body, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
