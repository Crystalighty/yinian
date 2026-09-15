import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAudioPlayer } from 'expo-audio';
import { getTimeCapsule, openTimeCapsule } from '../db/database';
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

export default function TimeCapsuleDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { capsuleId } = (route.params as any) || {};

  const [capsule, setCapsule] = useState<any>(null);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const player = useAudioPlayer();

  useEffect(() => {
    if (capsuleId) {
      loadCapsule();
    }
  }, [capsuleId]);

  const loadCapsule = async () => {
    if (!capsuleId) return;
    const data = await getTimeCapsule(capsuleId);
    if (data) {
      setCapsule(data);
      setDaysLeft(getDaysUntil(data.open_date));
    }
  };

  const handleOpen = async () => {
    if (capsule && !capsule.is_opened) {
      await openTimeCapsule(capsule.id);
      loadCapsule();
    }
  };

  // Play audio
  const playAudio = async () => {
    if (!capsule?.audio_uri) return;
    
    try {
      player.replace(capsule.audio_uri);
      await player.seekTo(0);
      player.play();
    } catch (err) {
      Alert.alert('错误', '播放失败');
      console.error(err);
    }
  };

  if (!capsule) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const isOpened = capsule.is_opened === 1;
  const canOpen = daysLeft <= 0;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{capsule.title}</Text>
        {!isOpened && canOpen ? (
          <Pressable style={styles.openBtn} onPress={handleOpen}>
            <Text style={styles.openBtnText}>🔓 开启胶囊</Text>
          </Pressable>
        ) : !isOpened ? (
          <View style={styles.countdownCard}>
            <Text style={styles.countdownNumber}>{daysLeft}</Text>
            <Text style={styles.countdownLabel}>天后开启</Text>
          </View>
        ) : null}
      </View>

      {/* Meta Info */}
      <View style={styles.metaSection}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>📅 创建日期：</Text>
          <Text style={styles.metaValue}>{formatDate(capsule.created_at)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>🎯 开启日期：</Text>
          <Text style={styles.metaValue}>{formatDate(capsule.open_date)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>状态：</Text>
          <Text style={[styles.metaValue, isOpened && styles.metaValueOpened]}>
            {isOpened ? '✅ 已开启' : daysLeft <= 0 ? '🔓 可开启' : '🔒 未到期'}
          </Text>
        </View>
      </View>

      {/* Content */}
      {(isOpened || canOpen) && capsule.content ? (
        <View style={styles.contentSection}>
          <Text style={styles.contentLabel}>💌 内容</Text>
          <Text style={styles.contentText}>{capsule.content}</Text>
        </View>
      ) : null}

      {/* Audio Section */}
      {capsule.audio_uri && (isOpened || canOpen) && (
        <View style={styles.audioSection}>
          <Text style={styles.audioLabel}>🎤 语音留言</Text>
          <Pressable style={styles.playAudioBtn} onPress={playAudio}>
            <Text style={styles.playAudioBtnText}>▶️ 播放语音</Text>
          </Pressable>
        </View>
      )}

      {/* Edit button */}
      {!isOpened && (
        <Pressable
          style={styles.editBtn}
          onPress={() => navigation.navigate('TimeCapsuleForm', { capsuleId })}
        >
          <Text style={styles.editBtnText}>✏️ 编辑</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingText: { textAlign: 'center', marginTop: 40, color: colors.subtext },
  scrollContent: { padding: 20 },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  openBtn: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  openBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  countdownCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  countdownNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.orange,
  },
  countdownLabel: {
    fontSize: 14,
    color: colors.subtext,
    marginTop: 4,
  },
  metaSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 14,
    color: colors.subtext,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  metaValueOpened: {
    color: colors.accent,
    fontWeight: '600',
  },
  contentSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  contentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  contentText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  audioSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  playAudioBtn: {
    backgroundColor: colors.orange,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  playAudioBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  editBtn: {
    backgroundColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  editBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
