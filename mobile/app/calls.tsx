import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { StateTransition } from '@/components/ui/state-transition';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { CALLS, type CallRecord } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Tab = 'all' | 'missed';
type Bucket = 'today' | 'yesterday' | 'earlier';

function bucketOf(timestamp: string): Bucket {
  if (timestamp.startsWith('Today')) return 'today';
  if (timestamp.startsWith('Yesterday')) return 'yesterday';
  return 'earlier';
}

function timeOf(timestamp: string): string {
  const comma = timestamp.indexOf(', ');
  return comma === -1 ? timestamp : timestamp.slice(comma + 2);
}

const BUCKET_LABEL: Record<Bucket, string> = {
  today: t('chat.today'),
  yesterday: t('chat.yesterday'),
  earlier: t('calls.earlier'),
};

export default function CallsScreen() {
  const { colors, isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('all');

  const sections = useMemo(() => {
    const rows = tab === 'missed' ? CALLS.filter((c) => c.direction === 'missed') : CALLS;
    const order: Bucket[] = ['today', 'yesterday', 'earlier'];
    return order
      .map((bucket) => ({
        bucket,
        title: BUCKET_LABEL[bucket],
        data: rows.filter((c) => bucketOf(c.timestamp) === bucket),
      }))
      .filter((s) => s.data.length > 0);
  }, [tab]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel={t('auth.back')}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('calls.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.tabs}>
        {(['all', 'missed'] as const).map((key) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[
                styles.tab,
                { backgroundColor: active ? colors.primary : colors.surfaceMuted },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.onPrimary : colors.textSecondary },
                ]}
              >
                {key === 'all' ? t('calls.tab_all') : t('calls.tab_missed')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <StateTransition transitionKey={tab} style={styles.flex}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CallRow call={item} />}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: colors.textSecondary, backgroundColor: colors.background }]}>
              {section.title}
            </Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={sections.length === 0 ? styles.emptyList : styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'missed' ? 'checkmark-circle-outline' : 'call-outline'}
              title={tab === 'missed' ? t('calls.empty_missed') : t('calls.empty_all')}
              description={t('calls.empty_hint')}
            />
          }
        />
      </StateTransition>
    </SafeAreaView>
  );
}

function CallRow({ call }: { call: CallRecord }) {
  const { colors } = useTheme();
  const missed = call.direction === 'missed';
  const label =
    call.direction === 'incoming'
      ? t('calls.incoming')
      : call.direction === 'outgoing'
        ? t('calls.outgoing')
        : t('calls.missed');

  const callBack = () => router.push(`/call/${call.chatId}?mode=${call.type}`);

  return (
    <Pressable
      onPress={() => router.push(`/chat/${call.chatId}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
      accessibilityRole="button"
    >
      <Image
        source={{ uri: call.avatarUri }}
        style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}
        contentFit="cover"
      />
      <View style={styles.rowText}>
        <Text
          style={[styles.name, { color: missed ? colors.danger : colors.text }]}
          numberOfLines={1}
        >
          {call.name}
        </Text>
        <View style={styles.meta}>
          <Ionicons
            name={call.direction === 'outgoing' ? 'arrow-up' : 'arrow-down'}
            size={13}
            color={missed ? colors.danger : colors.success}
          />
          <Ionicons
            name={call.type === 'video' ? 'videocam' : 'call'}
            size={12}
            color={colors.textMuted}
          />
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
      <Text style={[styles.time, { color: colors.textMuted }]}>{timeOf(call.timestamp)}</Text>
      <Pressable
        onPress={callBack}
        hitSlop={8}
        style={({ pressed }) => [
          styles.callBtn,
          { backgroundColor: colors.surfaceMuted },
          pressed && { opacity: 0.6 },
        ]}
        accessibilityLabel={t('calls.callback', { name: call.name })}
      >
        <Ionicons
          name={call.type === 'video' ? 'videocam' : 'call'}
          size={19}
          color={colors.primary}
        />
      </Pressable>
    </Pressable>
  );
}

const AVATAR = 50;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.h3 },

  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  tab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
  },
  tabText: { ...Typography.caption, fontWeight: '700' },

  list: { paddingBottom: Spacing.xl },
  emptyList: { flexGrow: 1 },

  sectionHeader: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: Radii.pill,
  },
  rowText: { flex: 1, gap: 3 },
  name: { ...Typography.body, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.caption, flex: 1 },
  time: { ...Typography.micro },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
