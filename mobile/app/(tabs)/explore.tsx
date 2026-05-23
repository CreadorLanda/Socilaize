import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { FollowButton, formatCount } from '@/components/ui/follow-button';
import { TabScene } from '@/components/ui/tab-scene';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { CHANNELS, CHANNEL_CATEGORIES, type Channel, type ChannelCategory } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const [category, setCategory] = useState<ChannelCategory>('all');
  const [query, setQuery] = useState('');

  const channels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CHANNELS.filter((c) => {
      if (category !== 'all' && c.category !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  return (
    <TabScene>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChannelCard channel={item} />}
          contentContainerStyle={channels.length === 0 ? styles.emptyList : styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={[styles.searchField, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="search" size={17} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('discover.search_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {query.length > 0 ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {CHANNEL_CATEGORIES.map((cat) => {
                  const active = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.chip,
                        active
                          ? { backgroundColor: colors.primary }
                          : { backgroundColor: colors.surfaceMuted },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? colors.onPrimary : colors.textSecondary },
                        ]}
                      >
                        {t(`discover.cat_${cat}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {channels.length > 0 ? (
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t('discover.channels_header')}
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="compass-outline"
              title={t('discover.empty_title')}
              description={t('discover.empty_hint')}
            />
          }
        />
      </View>
    </TabScene>
  );
}

function ChannelCard({ channel }: { channel: Channel }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/channel/${channel.id}`)}
      style={({ pressed }) => [
        styles.card,
        { borderBottomColor: colors.divider },
        pressed && { backgroundColor: colors.surfaceMuted },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('discover.open_channel', { name: channel.name })}
    >
      <Image
        source={{ uri: channel.avatarUri }}
        style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}
        contentFit="cover"
      />
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.verified ? (
            <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          ) : null}
        </View>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {channel.handle} · {t('discover.members', { count: formatCount(channel.members) })}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {channel.description}
        </Text>
      </View>
      <FollowButton id={channel.id} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: Spacing.xxxl },
  emptyList: { flexGrow: 1 },

  header: {
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radii.pill,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 15,
    padding: 0,
  },
  chips: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
  },
  chipText: { ...Typography.caption, fontWeight: '700' },
  sectionTitle: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.lg,
  },
  cardBody: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { ...Typography.bodyStrong, flexShrink: 1 },
  meta: { ...Typography.micro },
  description: { ...Typography.caption, marginTop: 2 },
});
