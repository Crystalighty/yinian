import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  TimeCapsule,
  deleteTimeCapsule,
  listTimeCapsules,
  openTimeCapsule,
} from '../db/database';
import { colors } from '../theme';

type RootStackParamList = {
  TimeCapsuleList: undefined;
  TimeCapsuleForm: { capsuleId?: number } | undefined;
  TimeCapsuleDetail: { capsuleId: number };
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysUntil(openDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(openDate + 'T00:00:00');
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function TimeCapsuleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);

  const refresh = useCallback(async () => {
    setCapsules(await listTimeCapsules());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleDelete = (capsule: TimeCapsule) => {
    Alert.alert('删除时间胶囊', `确定删除「${capsule.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteTimeCapsule(capsule.id);
          refresh();
        },
      },
    ]);
  };

  const handleOpen = async (capsule: TimeCapsule) => {
    if (!capsule.is_opened) {
      await openTimeCapsule(capsule.id);
      refresh();
    }
    navigation.navigate('TimeCapsuleDetail', { capsuleId: capsule.id });
  };

  const renderCapsule = ({ item }: { item: TimeCapsule }) => {
    const daysLeft = getDaysUntil(item.open_date);
    const isOpened = item.is_opened === 1;
    const canOpen = daysLeft <= 0;

    return (
      <Pressable
        style={[styles.capsuleCard, isOpened && styles.capsuleCardOpened]}
        onPress={() => handleOpen(item)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.capsuleHeader}>
          <Text style={[styles.capsuleTitle, isOpened && styles.capsuleTitleOpened]} numberOfLines={1}>
            {item.title}
          </Text>
          {isOpened ? (
            <Text style={styles.openedBadge}>✅ 已开启</Text>
          ) : canOpen ? (
            <Text style={styles.canOpenBadge}>🔓 可开启</Text>
          ) : (
            <Text style={styles.lockedBadge}>🔒 {daysLeft}天后开启</Text>
          )}
        </View>
        <View style={styles.capsuleMeta}>
          <Text style={styles.metaText}>📅 开启日期：{formatDate(item.open_date)}</Text>
          {item.content && <Text style={styles.previewText}>{item.content.slice(0, 50)}{item.content.length > 50 ? '...' : ''}</Text>}
          {item.audio_uri && <Text style={styles.audioHint}>🎤 包含语音</Text>}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.addBtn} onPress={() => navigation.navigate('TimeCapsuleForm')}>
        <Text style={styles.addBtnText}>＋ 新建时间胶囊</Text>
      </Pressable>

      <FlatList
        data={capsules}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCapsule}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyText}>还没有时间胶囊，创建一个给未来的自己吧</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  addBtn: {
    margin: 20,
    backgroundColor: colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  capsuleCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  capsuleCardOpened: {
    backgroundColor: colors.yellow,
    opacity: 0.9,
  },
  capsuleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  capsuleTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  capsuleTitleOpened: {
    textDecorationLine: 'line-through',
    color: colors.subtext,
  },
  openedBadge: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    marginLeft: 8,
  },
  canOpenBadge: {
    fontSize: 11,
    color: colors.orange,
    fontWeight: '600',
    marginLeft: 8,
  },
  lockedBadge: {
    fontSize: 11,
    color: colors.subtext,
    fontWeight: '600',
    marginLeft: 8,
  },
  capsuleMeta: {
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.subtext,
  },
  previewText: {
    fontSize: 12,
    color: colors.text,
    marginTop: 4,
  },
  audioHint: {
    fontSize: 11,
    color: colors.orange,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.subtext, textAlign: 'center' },
});
