import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  deleteGame,
  GameItem,
  GameStatus,
  listAllGames,
  listDrawableGames,
  listGames,
} from '../db/database';
import { colors } from '../theme';

const STATUS_TABS: { key: GameStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'playing', label: '在玩' },
  { key: 'wish', label: '想玩' },
  { key: 'cleared', label: '已通关' },
  { key: 'dropped', label: '弃玩' },
];

function StarDisplay({ rating, size = 12 }: { rating: number; size?: number }) {
  const clamped = Math.max(0, Math.min(rating, 5));
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = clamped >= i ? 1 : clamped >= i - 0.5 ? 0.5 : 0;
        return (
          <Text key={i} style={{ fontSize: size, color: fill > 0 ? '#FBBF24' : '#D1D5DB' }}>
            {fill === 0.5 ? '⯪' : '★'}
          </Text>
        );
      })}
    </View>
  );
}

type RootStackParamList = {
  GameList: undefined;
  GameDetail: { gameId: number };
  GameForm: { gameId?: number } | undefined;
};

export default function GameScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<GameStatus | 'all'>('playing');
  const [sortBy, setSortBy] = useState<'updated' | 'playtime'>('updated');
  const [searchText, setSearchText] = useState('');
  const [games, setGames] = useState<GameItem[]>([]);
  const [drawn, setDrawn] = useState<GameItem | null>(null);
  const [drawVisible, setDrawVisible] = useState(false);

  const refresh = useCallback(async () => {
    if (tab === 'all') {
      setGames(await listAllGames());
    } else {
      setGames(await listGames(tab));
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleSort = () => setSortBy((s) => (s === 'updated' ? 'playtime' : 'updated'));

  const displayGames = useMemo(() => {
    let filtered = games;
    if (searchText.trim()) {
      const query = searchText.toLowerCase().trim();
      filtered = games.filter((g) =>
        g.name.toLowerCase().includes(query) ||
        (g.tags && g.tags.some((t) => t.toLowerCase().includes(query)))
      );
    }
    if (sortBy === 'playtime') {
      return [...filtered].sort((a, b) => (b.play_time ?? 0) - (a.play_time ?? 0));
    }
    return filtered;
  }, [games, sortBy, searchText]);

  const maxPlayTime = useMemo(() => {
    return Math.max(...displayGames.map((g) => g.play_time ?? 0), 1);
  }, [displayGames]);

  const handleLongPress = (game: GameItem) => {
    Alert.alert(game.name, '选择操作', [
      { text: '编辑', onPress: () => navigation.navigate('GameForm', { gameId: game.id }) },
      { text: '删除', style: 'destructive' as const, onPress: async () => { await deleteGame(game.id); refresh(); } },
      { text: '取消', style: 'cancel' as const },
    ]);
  };

  const drawTonight = async () => {
    const pool = await listDrawableGames();
    if (pool.length === 0) {
      Alert.alert('没有可抽的游戏', '先添加几款「想玩」或「在玩」的游戏吧');
      return;
    }
    setDrawn(pool[Math.floor(Math.random() * pool.length)]);
    setDrawVisible(true);
  };

  const redraw = async () => {
    const pool = await listDrawableGames();
    if (pool.length <= 1) return;
    let next = drawn;
    while (next?.id === drawn?.id) {
      next = pool[Math.floor(Math.random() * pool.length)];
    }
    setDrawn(next);
  };

  const formatPlayHours = (seconds: number): string => {
    const s = Number(seconds) || 0;
    const h = s / 3600;
    return h < 1 ? `${Math.round(s / 60)}m` : `${h.toFixed(1)}h`;
  };

  const formatShortDate = (iso: string): string => {
    if (!iso) return '';
    const normalized = iso.slice(0, 10).replace(/\//g, '-');
    const [year, month, day] = normalized.split('-');
    if (year && month && day) return `${year}/${month}/${day}`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const getBarColor = (ratio: number): string => {
    if (ratio > 0.7) return colors.orangeDark;
    if (ratio > 0.4) return colors.orange;
    if (ratio > 0.15) return colors.accent;
    return colors.subtext;
  };

  const renderGameList = ({ item }: { item: GameItem }) => {
    const playTime = item.play_time ?? 0;
    const ratio = playTime / maxPlayTime;
    const barWidth = Math.max(ratio * 160, 4);
    const barColor = getBarColor(ratio);
    return (
      <Pressable
        style={styles.listCard}
        onPress={() => navigation.navigate('GameDetail', { gameId: item.id })}
        onLongPress={() => handleLongPress(item)}
      >
        {item.image_uri ? (
          <Image source={{ uri: item.image_uri }} style={styles.listCover} />
        ) : (
          <View style={styles.listCoverPlaceholder}>
            <Text style={styles.listCoverText}>{item.name.slice(0, 1)}</Text>
          </View>
        )}
        <View style={styles.listInfo}>
          <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          {item.sharp_comment ? (
            <Text style={styles.listSharp} numberOfLines={1}>{item.sharp_comment}</Text>
          ) : null}
          <View style={styles.listBarRow}>
            <Text style={styles.listPlayTime}>{formatPlayHours(playTime)}</Text>
            <View style={styles.listBarBg}>
              <View style={[styles.listBarFill, { width: barWidth, backgroundColor: barColor }]} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderGame = ({ item }: { item: GameItem }) => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('GameDetail', { gameId: item.id })}
      onLongPress={() => handleLongPress(item)}
    >
      {item.image_uri ? (
        <Image source={{ uri: item.image_uri }} style={styles.coverImage} />
      ) : (
        <View style={styles.cover}>
          <Text style={styles.coverText}>{item.name.slice(0, 1)}</Text>
        </View>
      )}
      <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
      {item.rating != null && item.rating > 0 ? (
        <StarDisplay rating={item.rating} size={11} />
      ) : null}
      {item.last_played ? (
        <Text style={styles.lastPlayed}>最后 {formatShortDate(item.last_played)}</Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.drawButton} onPress={drawTonight}>
          <Text style={styles.drawButtonText}>🎲 今天玩哪个</Text>
        </Pressable>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('GameForm')}>
          <Text style={styles.addButtonText}>＋ 新增游戏</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {STATUS_TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search bar + sort (same row) */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 搜索游戏..."
          value={searchText}
          onChangeText={setSearchText}
          clearButtonMode="while-editing"
        />
        <Pressable style={styles.sortBtn} onPress={toggleSort}>
          <Text style={styles.sortBtnText}>
            {sortBy === 'updated' ? '🕐 最近更新' : '⏱ 游戏时长'}
          </Text>
        </Pressable>
      </View>

      {sortBy === 'playtime' ? (
        <FlatList
          key="list-playtime"
          data={displayGames}
          keyExtractor={(g) => String(g.id)}
          renderItem={renderGameList}
          contentContainerStyle={styles.listSingle}
          ListEmptyComponent={<Text style={styles.empty}>这个分类还没有游戏 🎮</Text>}
        />
      ) : (
        <FlatList
          key="grid-updated"
          data={displayGames}
          keyExtractor={(g) => String(g.id)}
          renderItem={renderGame}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>这个分类还没有游戏 🎮</Text>}
        />
      )}

      <Modal visible={drawVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.drawCard}>
            <Pressable style={styles.drawCloseBtn} onPress={() => setDrawVisible(false)}>
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
            <Text style={styles.drawTitle}>🎮 今天就玩…</Text>
            <Text style={styles.drawName}>{drawn?.name}</Text>
            <Text style={styles.drawSub}>
              {drawn?.platform.join(', ') ?? ''} ·{' '}
              {STATUS_TABS.find((s) => s.key === drawn?.status)?.label ?? ''}
            </Text>
            <View style={styles.drawActions}>
              <Pressable style={styles.drawCancelBtn} onPress={redraw}>
                <Text style={styles.drawCancelText}>🔁 换一个</Text>
              </Pressable>
              <Pressable style={styles.drawSaveBtn} onPress={() => setDrawVisible(false)}>
                <Text style={styles.drawSaveText}>就它了</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 10 },
  drawButton: {
    flex: 1,
    backgroundColor: colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  drawButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  addButton: {
    backgroundColor: colors.yellow,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addButtonText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabItem: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabItemActive: { backgroundColor: colors.orange },
  tabText: { color: colors.subtext, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  sortBtn: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortBtnText: { fontSize: 13, color: colors.orange, fontWeight: '600' },
  list: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  listSingle: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  row: { gap: 10 },
  empty: {
    textAlign: 'center',
    color: colors.subtext,
    marginTop: 40,
    fontSize: 14,
  },
  card: {
    width: '31%',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverText: { fontSize: 24, fontWeight: '700', color: colors.text },
  coverImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text, paddingHorizontal: 8 },
  lastPlayed: { fontSize: 11, color: colors.subtext, paddingHorizontal: 8 },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  listCover: { width: 90, height: 56, borderRadius: 10 },
  listCoverPlaceholder: {
    width: 90,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCoverText: { fontSize: 22, fontWeight: '700', color: colors.text },
  listInfo: { flex: 1, gap: 4 },
  listName: { fontSize: 15, fontWeight: '600', color: colors.text },
  listBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listPlayTime: { fontSize: 13, color: colors.orange, fontWeight: '600', width: 42 },
  listBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  listBarFill: { height: '100%', borderRadius: 3 },
  listSharp: { fontSize: 12, color: colors.subtext },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: { fontSize: 24, color: colors.subtext, fontWeight: '300', lineHeight: 26 },
  drawCloseBtn: { position: 'absolute', top: 12, right: 16, zIndex: 1 },
  drawCard: {
    backgroundColor: colors.card,
    alignSelf: 'stretch',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  drawTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 10 },
  drawName: { fontSize: 24, fontWeight: '700', color: colors.text },
  drawSub: { fontSize: 14, color: colors.subtext, marginTop: 6 },
  drawActions: { flexDirection: 'row', gap: 12, marginTop: 20, alignSelf: 'stretch' },
  drawCancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  drawCancelText: { color: colors.text, fontWeight: '600' },
  drawSaveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.orange,
  },
  drawSaveText: { color: '#fff', fontWeight: '700' },
});
