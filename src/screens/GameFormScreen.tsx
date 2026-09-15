import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  addGame,
  addGlobalTag,
  GameItem,
  GameStatus,
  getGame,
  getTagsForModule,
  updateGame,
} from '../db/database';
import { pickImageFromLibrary, takePhoto } from '../utils/imageStorage';
import { colors } from '../theme';
import DateTimePicker from '@react-native-community/datetimepicker';

const STATUS_OPTIONS: { key: GameStatus; label: string }[] = [
  { key: 'playing', label: '在玩' },
  { key: 'wish', label: '想玩' },
  { key: 'cleared', label: '已通关' },
  { key: 'dropped', label: '弃玩' },
];

function StarRating({ rating, onChange, size = 24 }: { rating: number; onChange?: (v: number) => void; size?: number }) {
  const starCount = 5;
  const gap = 6;
  const clamped = Math.max(0, Math.min(rating, starCount));
  const starWidths = useRef<Record<number, number>>({});

  const handlePress = (starIndex: number, locationX: number) => {
    if (!onChange) return;
    const w = starWidths.current[starIndex] || size;
    const isHalf = locationX < w / 2;
    onChange(isHalf ? starIndex + 0.5 : starIndex + 1);
  };

  return (
    <View style={{ flexDirection: 'row', gap }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = clamped >= i ? 1 : clamped >= i - 0.5 ? 0.5 : 0;
        return (
          <Pressable
            key={i}
            onPress={(e) => handlePress(i - 1, e.nativeEvent.locationX)}
            onLayout={(e) => { starWidths.current[i - 1] = e.nativeEvent.layout.width; }}
          >
            <Text style={{ fontSize: size, color: fill > 0 ? '#FBBF24' : '#D1D5DB' }}>
              {fill === 0.5 ? '⯪' : '★'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type RootStackParamList = {
  GameList: undefined;
  GameDetail: { gameId: number };
  GameForm: { gameId?: number };
};

const parseTags = (raw: string): string[] =>
  raw
    .split(/[,，#\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

function shiftDate(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export default function GameFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const gameId = (route.params as { gameId?: number })?.gameId;
  const isEdit = !!gameId;

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [playTimeInput, setPlayTimeInput] = useState('');
  const [sharpComment, setSharpComment] = useState('');
  const [lastPlayedDate, setLastPlayedDate] = useState<Date | null>(null);
  const [showLastPlayedPicker, setShowLastPlayedPicker] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>([]);

  useEffect(() => {
    getTagsForModule('game').then(setExistingTags);
    getTagsForModule('game_platform').then(setPlatforms);
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleSave}>
          <Text style={{ color: colors.orange, fontSize: 16, fontWeight: '600' }}>
            {isEdit ? '保存' : '完成'}
          </Text>
        </Pressable>
      ),
    });
  }, [name, platform, status, imageUri, rating, tagInput, playTimeInput, sharpComment, lastPlayedDate, isEdit, gameId]);

  useEffect(() => {
    if (gameId) {
      getGame(gameId).then((g) => {
        if (g) {
          setName(g.name);
          setPlatform(g.platform);
          setStatus(g.status);
          setImageUri(g.image_uri);
          setRating(g.rating ?? 0);
          setTagInput(g.tags.join(', '));
          const pt = g.play_time ?? 0;
          if (pt > 0) {
            setPlayTimeInput((pt / 3600).toFixed(1));
          }
          setSharpComment(g.sharp_comment ?? '');
          if (g.last_played) {
            setLastPlayedDate(new Date(g.last_played + 'T00:00:00'));
          }
        }
      });
    }
  }, [gameId]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '游戏名称不能为空');
      return;
    }
    const finalRating = rating > 0 ? rating : null;
    const tags = parseTags(tagInput);
    // Parse play time input (hours)
    let playTimeSeconds = 0;
    if (playTimeInput.trim()) {
      const hours = parseFloat(playTimeInput.trim());
      if (!isNaN(hours) && hours > 0) {
        playTimeSeconds = Math.round(hours * 3600);
      }
    }
    // Register new tags to global_tags
    for (const t of tags) {
      await addGlobalTag(t, 'game');
    }
    const lastPlayedStr = lastPlayedDate
      ? `${lastPlayedDate.getFullYear()}-${String(lastPlayedDate.getMonth() + 1).padStart(2, '0')}-${String(lastPlayedDate.getDate()).padStart(2, '0')}`
      : null;
    if (isEdit && gameId) {
      await updateGame(gameId, name.trim(), platform, status, imageUri, finalRating, tags, playTimeSeconds, sharpComment.trim() || null, lastPlayedStr);
    } else {
      await addGame(name.trim(), platform, status, imageUri, finalRating, tags, playTimeSeconds, sharpComment.trim() || null, lastPlayedStr);
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
      <Text style={styles.fieldLabel}>游戏名称</Text>
      <TextInput
        style={styles.input}
        placeholder="输入游戏名称（必填）"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={styles.fieldLabel}>封面图片（选填）</Text>
      <View style={styles.imageRow}>
        {imageUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <Pressable style={styles.previewRemove} onPress={() => setImageUri(null)}>
              <Text style={styles.previewRemoveText}>×</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable style={styles.imageBtn} onPress={async () => setImageUri(await takePhoto())}>
          <Text style={styles.imageBtnText}>📷 拍照</Text>
        </Pressable>
        <Pressable style={styles.imageBtn} onPress={async () => setImageUri(await pickImageFromLibrary())}>
          <Text style={styles.imageBtnText}>🖼️ 相册</Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>平台（可多选）</Text>
      <View style={styles.chipRow}>
        {platforms.length === 0 ? (
          <Text style={{ color: colors.subtext, fontSize: 13 }}>加载中…</Text>
        ) : (
          platforms.map((p) => {
            const isSelected = platform.includes(p);
            return (
              <Pressable
                key={p}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setPlatform(isSelected ? platform.filter((x) => x !== p) : [...platform, p])}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{p}</Text>
              </Pressable>
            );
          })
        )}
      </View>

      <Text style={styles.fieldLabel}>状态</Text>
      <View style={styles.chipRow}>
        {STATUS_OPTIONS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.chip, status === s.key && styles.chipActive]}
            onPress={() => setStatus(s.key)}
          >
            <Text style={[styles.chipText, status === s.key && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>标签（选填，多个用逗号分隔）</Text>
      <TextInput
        style={styles.input}
        placeholder="例如: RPG, 独立, 双人"
        value={tagInput}
        onChangeText={setTagInput}
      />
      {existingTags.length > 0 ? (
        <View style={styles.tagSuggestRow}>
          {existingTags
            .filter((t) => !parseTags(tagInput).includes(t))
            .slice(0, 8)
            .map((t) => (
              <Pressable
                key={t}
                style={styles.tagSuggestChip}
                onPress={() => setTagInput(tagInput ? `${tagInput} ${t}` : t)}
              >
                <Text style={styles.tagSuggestText}>{t}</Text>
              </Pressable>
            ))}
        </View>
      ) : null}

      <Text style={styles.fieldLabel}>评分（点击星星）</Text>
      <View style={{ marginVertical: 4 }}>
        <StarRating rating={rating} onChange={setRating} size={28} />
      </View>

      <Text style={styles.fieldLabel}>游戏时长（累计，单位：小时）</Text>
      <TextInput
        style={styles.input}
        placeholder="例如: 2.5 表示2小时30分钟"
        value={playTimeInput}
        onChangeText={setPlayTimeInput}
        keyboardType="decimal-pad"
      />

      <Text style={styles.fieldLabel}>锐评（选填，会显示在游戏列表）</Text>
      <TextInput
        style={styles.input}
        placeholder="一句话评价这款游戏…"
        value={sharpComment}
        onChangeText={setSharpComment}
      />

      <Text style={styles.fieldLabel}>最后游玩（选填）</Text>
      <Pressable style={styles.dateBtn} onPress={() => setShowLastPlayedPicker(true)}>
        <Text style={styles.dateBtnText}>
          {lastPlayedDate
            ? `${lastPlayedDate.getFullYear()}-${String(lastPlayedDate.getMonth() + 1).padStart(2, '0')}-${String(lastPlayedDate.getDate()).padStart(2, '0')}`
            : '未设置'}
        </Text>
        <Text style={styles.dateBtnIcon}>📅</Text>
      </Pressable>
      {showLastPlayedPicker && (
        <DateTimePicker
          value={lastPlayedDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'compact' : 'default'}
          onChange={(_event: any, selectedDate?: Date) => {
            setShowLastPlayedPicker(false);
            if (selectedDate) {
              setLastPlayedDate(selectedDate);
            }
          }}
        />
      )}
      {lastPlayedDate && (
        <Pressable onPress={() => setLastPlayedDate(null)} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          <Text style={{ fontSize: 13, color: colors.danger }}>清除日期</Text>
        </Pressable>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110, gap: 12 },
  fieldLabel: { fontSize: 13, color: colors.subtext, marginTop: 4 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  tagSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4 },
  tagSuggestChip: {
    backgroundColor: colors.amber,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagSuggestText: { fontSize: 12, color: colors.orange },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  imageBtn: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  imageBtnText: { fontSize: 13, color: colors.text },
  previewWrap: { position: 'relative' },
  preview: { width: 64, height: 64, borderRadius: 12 },
  previewRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.danger,
    borderRadius: 999,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemoveText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dateBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateBtnText: { fontSize: 15, color: colors.text },
  dateBtnIcon: { fontSize: 16 },
  dateAdjustRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -4 },
  dateAdjBtn: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dateAdjText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  dateClearBtn: { backgroundColor: colors.danger + '15', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dateClearText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
});
