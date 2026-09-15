import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import {
  addGlobalTag,
  addThought,
  Box,
  clearDailyDraw,
  completeLifeItem,
  deleteLifeItem,
  getBox,
  getDailyDraw,
  getTagsForModule,
  LifeItem,
  listCompletedByBox,
  listDrawableThoughtsByBox,
  listThoughtsByBox,
  resetLifeItem,
  saveDailyDraw,
  toggleThoughtDisabled,
  updateThought,
} from '../db/database';
import { pickImageFromLibrary, takePhoto } from '../utils/imageStorage';
import { colors } from '../theme';

type RootStackParamList = {
  BoxList: undefined;
  BoxDetail: { boxId: number; boxName: string };
};

const SWIPE_THRESHOLD = 50;

function SwipeableCard({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const [actionsW, setActionsW] = useState(0);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      const base = openRef.current ? -actionsW : 0;
      const next = Math.min(0, Math.max(-actionsW * 1.3, base + g.dx));
      translateX.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      const base = openRef.current ? -actionsW : 0;
      const final = base + g.dx;
      const shouldOpen = final < -SWIPE_THRESHOLD;
      Animated.timing(translateX, {
        toValue: shouldOpen ? -actionsW : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      openRef.current = shouldOpen;
    },
  });

  return (
    <View style={swStyles.wrapper}>
      <View style={swStyles.actions} onLayout={(e) => setActionsW(e.nativeEvent.layout.width)}>
        {actions}
      </View>
      <Animated.View
        style={[swStyles.content, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const swStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  content: {
    backgroundColor: colors.card,
  },
});

export default function BoxDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'BoxDetail'>>();
  const { boxId, boxName } = route.params;

  const [box, setBox] = useState<Box | null>(null);
  const [items, setItems] = useState<LifeItem[]>([]);
  const [completedItems, setCompletedItems] = useState<LifeItem[]>([]);
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [drawn, setDrawn] = useState<LifeItem | null>(null);
  const [drawVisible, setDrawVisible] = useState(false);
  const [dailyDraw, setDailyDraw] = useState<LifeItem | null>(null);

  // Edit modal state
  const [editItem, setEditItem] = useState<LifeItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);

  // Filter & shuffle
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [shuffled, setShuffled] = useState(false);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [items]);

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const filteredItems = useMemo(() => {
    let result = filterTag ? items.filter((i) => i.tags.includes(filterTag)) : items;
    return shuffled ? shuffle(result) : result;
  }, [items, filterTag, shuffled]);

  const visibleCompletedItems = useMemo(
    () => filterTag ? completedItems.filter((item) => item.tags.includes(filterTag)) : completedItems,
    [completedItems, filterTag]
  );

  const displayedItems = useMemo(
    () => box?.todo_mode === 1 ? [...filteredItems, ...visibleCompletedItems] : filteredItems,
    [box?.todo_mode, filteredItems, visibleCompletedItems]
  );

  useEffect(() => {
    setTagInput(filterTag ?? '');
  }, [filterTag]);

  const refresh = useCallback(async () => {
    setBox(await getBox(boxId));
    setItems(await listThoughtsByBox(boxId));
    setCompletedItems(await listCompletedByBox(boxId));
    setDailyDraw(await getDailyDraw());
    setExistingTags(await getTagsForModule('inspiration'));
  }, [boxId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const parseTags = (raw: string): string[] =>
    raw
      .split(/[,，#\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

  const closeForm = () => {
    setContent('');
    setTagInput(filterTag ?? '');
    setImageUri(null);
    setFormVisible(false);
  };

  const save = async () => {
    if (!content.trim()) {
      Alert.alert('提示', '先写点内容再存吧');
      return;
    }
    const tags = parseTags(tagInput);
    // Register new tags to global_tags
    for (const t of tags) {
      await addGlobalTag(t, 'inspiration');
    }
    await addThought(boxId, content.trim(), tags, imageUri);
    setContent('');
    setTagInput(filterTag ?? '');
    setImageUri(null);
    setFormVisible(false);
    refresh();
  };

  const openEdit = (item: LifeItem) => {
    setEditItem(item);
    setEditContent(item.content);
    setEditTagInput(item.tags.join(' '));
    setEditImageUri(item.image_uri);
  };

  const saveEdit = async () => {
    if (!editItem || !editContent.trim()) {
      Alert.alert('提示', '内容不能为空');
      return;
    }
    await updateThought(editItem.id, editContent.trim(), parseTags(editTagInput), editImageUri);
    setEditItem(null);
    refresh();
  };

  const handleToggleDisabled = async (item: LifeItem) => {
    await toggleThoughtDisabled(item.id);
    refresh();
  };

  const confirmDelete = (item: LifeItem) => {
    Alert.alert('删除想法', `确定删除「${item.content}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteLifeItem(item.id);
          refresh();
        },
      },
    ]);
  };

  const drawOne = async () => {
    let drawable = await listDrawableThoughtsByBox(boxId);
    if (filterTag) {
      drawable = drawable.filter((i) => i.tags.includes(filterTag));
    }
    if (drawable.length === 0) {
      if (items.length === 0) {
        Alert.alert('盒子是空的', '先存条想法再来抽吧');
      } else if (filterTag) {
        Alert.alert('没有可抽的', `标签「${filterTag}」下没有可抽的想法`);
      } else {
        Alert.alert('没有可抽的', '所有想法都已禁用，启用一些再来抽吧');
      }
      return;
    }
    const picked = drawable[Math.floor(Math.random() * drawable.length)];
    setDrawn(picked);
    setDrawVisible(true);
    if (box?.todo_mode === 1) {
      await saveDailyDraw(picked.id);
      setDailyDraw(picked);
    }
  };

  const redraw = async () => {
    let drawable = await listDrawableThoughtsByBox(boxId);
    if (filterTag) {
      drawable = drawable.filter((i) => i.tags.includes(filterTag));
    }
    if (drawable.length <= 1) return;
    let next = drawn;
    while (next?.id === drawn?.id) {
      next = drawable[Math.floor(Math.random() * drawable.length)];
    }
    setDrawn(next);
  };

  const completeDrawn = async () => {
    if (!drawn) return;
    if (box?.todo_mode === 1) {
      await completeLifeItem(drawn);
      await clearDailyDraw();
      setDailyDraw(null);
    } else {
      await resetLifeItem(drawn.id);
    }
    setDrawVisible(false);
    setDrawn(null);
    refresh();
  };

  const renderItem = ({ item }: { item: LifeItem }) => {
    const isDisabled = item.disabled === 1;
    return (
      <SwipeableCard
        actions={
          <>
            <Pressable style={[styles.swipeBtn, { backgroundColor: '#6366F1' }]} onPress={() => openEdit(item)}>
              <Text style={styles.swipeBtnIcon}>✏️</Text>
              <Text style={styles.swipeBtnLabel}>编辑</Text>
            </Pressable>
            <Pressable
              style={[styles.swipeBtn, { backgroundColor: isDisabled ? '#9CA3AF' : '#4F46E5' }]}
              onPress={() => handleToggleDisabled(item)}
            >
              <Text style={styles.swipeBtnIcon}>{isDisabled ? '👁️' : '🚫'}</Text>
              <Text style={styles.swipeBtnLabel}>{isDisabled ? '启用' : '禁用'}</Text>
            </Pressable>
            <Pressable style={[styles.swipeBtn, { backgroundColor: colors.danger }]} onPress={() => confirmDelete(item)}>
              <Text style={styles.swipeBtnIcon}>🗑️</Text>
              <Text style={styles.swipeBtnLabel}>删除</Text>
            </Pressable>
          </>
        }
      >
        <View style={[styles.card, isDisabled && styles.cardDisabled]}>
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <Text
                style={[styles.cardText, isDisabled && styles.cardTextDisabled]}
                numberOfLines={3}
              >
                {item.content}
              </Text>
              {isDisabled ? (
                <View style={styles.disabledBadge}>
                  <Text style={styles.disabledBadgeText}>已禁用</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.tagRow}>
              {item.tags.map((t) => (
                <View key={t} style={styles.tagPill}>
                  <Text style={styles.tagText}>#{t}</Text>
                </View>
              ))}
            </View>
          </View>
          {item.image_uri ? (
            <Image source={{ uri: item.image_uri }} style={styles.thumb} />
          ) : null}
        </View>
      </SwipeableCard>
    );
  };

  const copyCompletedItem = async (item: LifeItem) => {
    if (boxId == null) return;
    await addThought(boxId, item.content, item.tags, item.image_uri);
    refresh();
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hours}:${mins}`;
  };

  const restoreCompletedItem = async (item: LifeItem) => {
    await resetLifeItem(item.id);
    refresh();
  };

  const renderCompletedItem = ({ item }: { item: LifeItem }) => (
    <SwipeableCard
      actions={
        <>
          <Pressable
            style={[styles.swipeBtn, { backgroundColor: '#22C55E' }]}
            onPress={() => restoreCompletedItem(item)}
          >
            <Text style={styles.swipeBtnIcon}>↩️</Text>
            <Text style={styles.swipeBtnLabel}>恢复</Text>
          </Pressable>
          <Pressable
            style={[styles.swipeBtn, { backgroundColor: colors.danger }]}
            onPress={() => confirmDelete(item)}
          >
            <Text style={styles.swipeBtnIcon}>🗑️</Text>
            <Text style={styles.swipeBtnLabel}>删除</Text>
          </Pressable>
        </>
      }
    >
      <View style={styles.completedCard}>
        <View style={styles.completedMain}>
          <Text style={styles.completedText} numberOfLines={3}>{item.content}</Text>
          <View style={styles.tagRow}>
            {item.tags.map((t) => (
              <View key={t} style={styles.tagPill}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
          <View style={styles.completedFooter}>
            <Text style={styles.completedTime}>
              ✅ 完成于 {formatTime(item.completed_at)}
            </Text>
            <Pressable onPress={() => copyCompletedItem(item)}>
              <Text style={styles.copyBtn}>📋 复制</Text>
            </Pressable>
          </View>
        </View>
        {item.image_uri ? (
          <Image source={{ uri: item.image_uri }} style={styles.thumb} />
        ) : null}
      </View>
    </SwipeableCard>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable style={styles.drawButton} onPress={drawOne}>
        <Text style={styles.drawButtonText}>🎲 抽一个</Text>
      </Pressable>

      {/* Today's Draw - only in todo mode */}
      {box?.todo_mode === 1 && dailyDraw ? (
        <View style={styles.dailyCard}>
          <View style={styles.dailyHeader}>
            <Text style={styles.dailyLabel}>🎯 今日抽到</Text>
            <Pressable
              style={styles.dailyCompleteBtn}
              onPress={async () => {
                await completeLifeItem(dailyDraw);
                await clearDailyDraw();
                setDailyDraw(null);
                refresh();
              }}
            >
              <Text style={styles.dailyCompleteText}>✅ 搞定了</Text>
            </Pressable>
          </View>
          <Text style={styles.dailyContent}>{dailyDraw.content}</Text>
          {dailyDraw.image_uri ? (
            <Image source={{ uri: dailyDraw.image_uri }} style={styles.dailyImage} />
          ) : null}
          <View style={styles.tagRow}>
            {dailyDraw.tags.map((t) => (
              <View key={t} style={styles.tagPill}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Tag filter bar */}
      {allTags.length > 0 ? (
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            style={styles.filterScroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterBar}
          >
            <Pressable
              style={[styles.filterChip, filterTag === null && !shuffled && styles.filterChipActive]}
              onPress={() => { setFilterTag(null); setShuffled(false); }}
            >
              <Text style={[styles.filterChipText, filterTag === null && !shuffled && styles.filterChipTextActive]}>全部</Text>
            </Pressable>
            {allTags.map((tag) => (
              <Pressable
                key={tag}
                style={[styles.filterChip, filterTag === tag && styles.filterChipActive]}
                onPress={() => { setFilterTag(filterTag === tag ? null : tag); setShuffled(false); }}
              >
                <Text style={[styles.filterChipText, filterTag === tag && styles.filterChipTextActive]}>#{tag}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.filterChip, shuffled && styles.filterChipActive]}
              onPress={() => setShuffled(!shuffled)}
            >
              <Text style={[styles.filterChipText, shuffled && styles.filterChipTextActive]}>🔀 随机</Text>
            </Pressable>
          </ScrollView>
          <Text style={styles.resultCount}>{displayedItems.length} 条</Text>
        </View>
      ) : null}

      <FlatList
        style={styles.listView}
        data={displayedItems}
        keyExtractor={(i) => String(i.id)}
        renderItem={(props) => {
          const isCompleted = box?.todo_mode === 1 && completedItems.some((c) => c.id === props.item.id);
          return isCompleted ? renderCompletedItem(props) : renderItem(props);
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filterTag ? `「#${filterTag}」下还没有想法` : '盒子里还没有想法，点下方按钮写一条吧 ✍️'}
          </Text>
        }
      />

      <Pressable style={styles.addBtn} onPress={() => setFormVisible(true)}>
        <Text style={styles.addBtnText}>✏️ 写一条想法</Text>
      </Pressable>

      {/* Add modal */}
      <Modal visible={formVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalMask}>
            <ScrollView style={styles.editDialog} contentContainerStyle={styles.editDialogContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.editDialogHeader}>
                <Text style={styles.editDialogTitle}>新建想法</Text>
                <Pressable onPress={closeForm}>
                  <Text style={styles.closeBtn}>×</Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.editInput}
                placeholder="一个想法 / 小灵感…"
                value={content}
                onChangeText={setContent}
                multiline
              />
              <TextInput
                style={styles.editInput}
                placeholder="标签（空格分隔）"
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
              <View style={styles.editImageRow}>
                {imageUri ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: imageUri }} style={styles.preview} />
                    <Pressable
                      style={styles.previewRemove}
                      onPress={() => setImageUri(null)}
                    >
                      <Text style={styles.previewRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Pressable
                  style={styles.editImageBtn}
                  onPress={async () => setImageUri(await takePhoto())}
                >
                  <Text style={styles.editImageBtnText}>📷 拍照</Text>
                </Pressable>
                <Pressable
                  style={styles.editImageBtn}
                  onPress={async () => setImageUri(await pickImageFromLibrary())}
                >
                  <Text style={styles.editImageBtnText}>🖼️ 相册</Text>
                </Pressable>
              </View>
              <View style={styles.dialogActions}>
                <Pressable style={styles.dialogCancelBtn} onPress={closeForm}>
                  <Text style={styles.dialogCancelText}>取消</Text>
                </Pressable>
                <Pressable style={styles.dialogSaveBtn} onPress={save}>
                  <Text style={styles.dialogSaveText}>存入盒子</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={drawVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.drawCard}>
            <Pressable style={styles.drawCloseBtn} onPress={() => setDrawVisible(false)}>
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
            <Text style={styles.drawTitle}>🎁 命运抽中了…</Text>
            <Text style={styles.drawContent}>{drawn?.content}</Text>
            {drawn?.image_uri ? (
              <Image source={{ uri: drawn.image_uri }} style={styles.drawImage} />
            ) : null}
            <View style={styles.tagRow}>
              {drawn?.tags.map((t) => (
                <View key={t} style={styles.tagPill}>
                  <Text style={styles.tagText}>#{t}</Text>
                </View>
              ))}
            </View>
            <View style={styles.drawActions}>
              <Pressable style={styles.drawActionBtn} onPress={redraw}>
                <Text style={styles.drawActionText}>🔁 换一个</Text>
              </Pressable>
              <Pressable
                style={styles.drawActionBtn}
                onPress={() => setDrawVisible(false)}
              >
                <Text style={styles.drawActionText}>🛋️ 改天再说</Text>
              </Pressable>
              <Pressable
                style={[styles.drawActionBtn, styles.doneBtn]}
                onPress={completeDrawn}
              >
                <Text style={[styles.drawActionText, styles.doneBtnText]}>✅ 搞定了</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={!!editItem} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalMask}>
          <ScrollView style={styles.editDialog} contentContainerStyle={styles.editDialogContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.editDialogHeader}>
              <Text style={styles.editDialogTitle}>编辑想法</Text>
              <Pressable onPress={() => setEditItem(null)}>
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.editInput}
              placeholder="想法内容"
              value={editContent}
              onChangeText={setEditContent}
              multiline
            />
            <TextInput
              style={styles.editInput}
              placeholder="标签（空格分隔）"
              value={editTagInput}
              onChangeText={setEditTagInput}
            />
            <View style={styles.editImageRow}>
              {editImageUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: editImageUri }} style={styles.preview} />
                  <Pressable
                    style={styles.previewRemove}
                    onPress={() => setEditImageUri(null)}
                  >
                    <Text style={styles.previewRemoveText}>×</Text>
                  </Pressable>
                </View>
              ) : null}
              <Pressable
                style={styles.editImageBtn}
                onPress={async () => setEditImageUri(await takePhoto())}
              >
                <Text style={styles.editImageBtnText}>📷 拍照</Text>
              </Pressable>
              <Pressable
                style={styles.editImageBtn}
                onPress={async () => setEditImageUri(await pickImageFromLibrary())}
              >
                <Text style={styles.editImageBtnText}>🖼️ 相册</Text>
              </Pressable>
            </View>
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancelBtn}
                onPress={() => setEditItem(null)}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.dialogSaveBtn} onPress={saveEdit}>
                <Text style={styles.dialogSaveText}>保存</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  drawButton: {
    backgroundColor: colors.orange,
    margin: 20,
    marginBottom: 10,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.orangeDark,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  drawButtonText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  filterBar: {
    paddingLeft: 20,
    paddingRight: 8,
    height: 40,
    alignItems: 'center',
    gap: 8,
    flexDirection: 'row',
  },
  filterSection: {
    height: 48,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    zIndex: 2,
  },
  filterScroll: {
    flex: 1,
    height: 40,
  },
  resultCount: {
    minWidth: 50,
    paddingRight: 16,
    paddingLeft: 6,
    color: colors.subtext,
    fontSize: 11,
    textAlign: 'right',
  },
  filterChip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.orange,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listView: { flex: 1, overflow: 'hidden' },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardText: { fontSize: 16, color: colors.text, marginBottom: 6, flex: 1 },
  cardTextDisabled: { color: colors.subtext, textDecorationLine: 'line-through' },
  cardDisabled: { opacity: 0.5 },
  disabledBadge: {
    backgroundColor: colors.subtext,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  disabledBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  swipeBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  swipeBtnIcon: { fontSize: 18 },
  swipeBtnLabel: { fontSize: 11, color: '#fff', fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill: {
    backgroundColor: colors.amber,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { fontSize: 12, color: colors.text },
  thumb: { width: 48, height: 48, borderRadius: 10, marginLeft: 10 },
  addBtn: {
    backgroundColor: colors.orange,
    margin: 20,
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  previewWrap: { alignSelf: 'flex-start' },
  preview: { width: 64, height: 64, borderRadius: 10 },
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
  previewRemoveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  drawCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  drawTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  drawContent: { fontSize: 22, color: colors.text, textAlign: 'center', marginBottom: 12 },
  drawImage: { width: 180, height: 180, borderRadius: 14, marginBottom: 12 },
  drawActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  drawActionBtn: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  drawActionText: { color: colors.text, fontWeight: '600' },
  doneBtn: { backgroundColor: colors.orange },
  doneBtnText: { color: '#fff' },
  // Edit dialog
  editDialog: {
    width: '100%',
    maxHeight: '86%',
    backgroundColor: colors.card,
    borderRadius: 24,
  },
  editDialogContent: {
    padding: 24,
    gap: 12,
  },
  editDialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  editInput: {
    backgroundColor: colors.bg,
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
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagSuggestText: { fontSize: 12, color: colors.orange },
  editImageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  editImageBtn: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editImageBtnText: { fontSize: 13, color: colors.text },
  dialogActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  dialogCancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  dialogCancelText: { color: colors.text, fontWeight: '600' },
  dialogSaveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.orange,
  },
  dialogSaveText: { color: '#fff', fontWeight: '700' },
  closeBtn: { fontSize: 24, color: colors.subtext, fontWeight: '300', lineHeight: 26 },
  drawCloseBtn: { position: 'absolute', top: 12, right: 16, zIndex: 1 },
  editDialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dailyCard: {
    backgroundColor: colors.yellow,
    margin: 20,
    marginBottom: 10,
    borderRadius: 18,
    padding: 18,
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dailyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  dailyCompleteBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dailyCompleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  dailyContent: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  dailyImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginTop: 8,
  },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 6,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabBtnActive: {
    backgroundColor: colors.orange,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
  },
  tabTextActive: {
    color: '#fff',
  },
  completedCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  completedMain: { flex: 1 },
  completedText: {
    fontSize: 16,
    color: colors.subtext,
    marginBottom: 6,
    textDecorationLine: 'line-through',
  },
  completedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  completedTime: {
    fontSize: 12,
    color: colors.subtext,
  },
  copyBtn: {
    fontSize: 13,
    color: colors.orange,
    fontWeight: '600',
  },
});
