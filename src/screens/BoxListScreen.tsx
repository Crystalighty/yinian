import React, { useCallback, useRef, useState } from 'react';
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Box,
  LifeItem,
  addBox,
  copyBox,
  deleteBox,
  listBoxes,
  listDrawableThoughtsByBox,
  toggleBoxTodoMode,
  updateBox,
} from '../db/database';
import { colors } from '../theme';

const BOX_ICONS = ['📦', '💡', '🎯', '🌟', '🎨', '🎮', '📚', '🎵', '🏃', '🍕', '✈️', '🌈', '🔥', '💎', '🎁', '🧩', '🌸', '🍀', '🌙', '⭐', '🎭', '🎲', '🧸', '🍄', '🐶', '🐼', '🏔️', '🚀', '💫', '🎶', '🎬', '☕', '💻', '🎧', '🏋️', '🧘', '📝', '🗓️', '💰'];

const SWIPE_THRESHOLD = 50;

function SwipeableBox({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
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

type RootStackParamList = {
  BoxList: undefined;
  BoxDetail: { boxId: number; boxName: string };
};

export default function BoxListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [createVisible, setCreateVisible] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxIcon, setNewBoxIcon] = useState('📦');

  // Quick-draw state
  const [drawn, setDrawn] = useState<LifeItem | null>(null);
  const [drawVisible, setDrawVisible] = useState(false);
  const [drawBoxId, setDrawBoxId] = useState<number | null>(null);

  // Edit box state
  const [editVisible, setEditVisible] = useState(false);
  const [editBoxId, setEditBoxId] = useState<number>(0);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('📦');

  const refresh = useCallback(async () => {
    setBoxes(await listBoxes());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleCreate = async () => {
    if (!newBoxName.trim()) {
      Alert.alert('提示', '给盒子起个名字吧');
      return;
    }
    await addBox(newBoxName.trim(), newBoxIcon);
    setNewBoxName('');
    setNewBoxIcon('📦');
    setCreateVisible(false);
    refresh();
  };

  const confirmDelete = (box: Box) => {
    Alert.alert('删除盒子', `确定删除「${box.name}」及其所有想法吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteBox(box.id);
          refresh();
        },
      },
    ]);
  };

  const openEdit = (box: Box) => {
    setEditBoxId(box.id);
    setEditName(box.name);
    setEditIcon(box.icon || '📦');
    setEditVisible(true);
  };

  const handleEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('提示', '盒子名称不能为空');
      return;
    }
    await updateBox(editBoxId, editName.trim(), editIcon);
    setEditVisible(false);
    refresh();
  };

  const handleCopy = async (box: Box) => {
    await copyBox(box.id);
    refresh();
  };

  const handleToggleTodoMode = async (box: Box) => {
    await toggleBoxTodoMode(box.id);
    refresh();
  };

  const quickDraw = async (box: Box) => {
    const thoughts = await listDrawableThoughtsByBox(box.id);
    if (thoughts.length === 0) {
      Alert.alert('盒子是空的', `「${box.name}」里没有可抽取的想法（可能都已禁用）`);
      return;
    }
    setDrawn(thoughts[Math.floor(Math.random() * thoughts.length)]);
    setDrawBoxId(box.id);
    setDrawVisible(true);
  };

  const redraw = async () => {
    if (!drawBoxId) return;
    const thoughts = await listDrawableThoughtsByBox(drawBoxId);
    if (thoughts.length <= 1) return;
    let next = drawn;
    while (next?.id === drawn?.id) {
      next = thoughts[Math.floor(Math.random() * thoughts.length)];
    }
    setDrawn(next);
  };

  const renderBox = ({ item }: { item: Box }) => {
    const isTodo = item.todo_mode === 1;
    return (
      <SwipeableBox
        actions={
          <>
            <Pressable style={[styles.swipeBtn, { backgroundColor: '#6366F1' }]} onPress={() => openEdit(item)}>
              <Text style={styles.swipeBtnIcon}>✏️</Text>
              <Text style={styles.swipeBtnText}>编辑</Text>
            </Pressable>
            <Pressable style={[styles.swipeBtn, { backgroundColor: colors.orange }]} onPress={() => handleCopy(item)}>
              <Text style={styles.swipeBtnIcon}>📋</Text>
              <Text style={styles.swipeBtnText}>复制</Text>
            </Pressable>
            <Pressable style={[styles.swipeBtn, { backgroundColor: '#EF4444' }]} onPress={() => confirmDelete(item)}>
              <Text style={styles.swipeBtnIcon}>🗑️</Text>
              <Text style={styles.swipeBtnText}>删除</Text>
            </Pressable>
          </>
        }
      >
        <Pressable
          style={styles.card}
          onPress={() =>
            navigation.navigate('BoxDetail', { boxId: item.id, boxName: item.name })
          }
        >
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>{item.icon || '📦'}</Text>
          </View>
          <View style={styles.cardMain}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardCount}>{item.thought_count} 条{isTodo ? '待办' : '想法'}</Text>
          </View>
          <Pressable
            style={[styles.switchTrack, isTodo ? styles.switchTrackOn : styles.switchTrackOff]}
            onPress={() => handleToggleTodoMode(item)}
            hitSlop={8}
          >
            <View style={[styles.switchThumb, isTodo ? styles.switchThumbOn : styles.switchThumbOff]}>
              <Text style={styles.switchLabel}>{isTodo ? '待办' : '随机'}</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.quickDrawBtn}
            onPress={() => quickDraw(item)}
            hitSlop={8}
          >
            <Text style={styles.quickDrawText}>🎲</Text>
          </Pressable>
        </Pressable>
      </SwipeableBox>
    );
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.createButton} onPress={() => setCreateVisible(true)}>
        <Text style={styles.createButtonText}>＋ 新建盒子</Text>
      </Pressable>

      <FlatList
        data={boxes}
        keyExtractor={(b) => String(b.id)}
        renderItem={renderBox}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>还没有盒子，创建一个开始装想法吧 ✨</Text>
        }
      />

      {/* Create box modal */}
      <Modal visible={createVisible} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>新建盒子</Text>
              <Pressable
                onPress={() => {
                  setCreateVisible(false);
                  setNewBoxName('');
                  setNewBoxIcon('📦');
                }}
              >
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.dialogInput}
              placeholder="盒子名称"
              value={newBoxName}
              onChangeText={setNewBoxName}
              autoFocus
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <Text style={styles.iconPickerLabel}>选择图标</Text>
            <View style={styles.iconGrid}>
              {BOX_ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  style={[styles.iconItem, newBoxIcon === icon && styles.iconItemActive]}
                  onPress={() => setNewBoxIcon(icon)}
                >
                  <Text style={styles.iconItemText}>{icon}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.iconPickerLabel}>或输入自定义表情</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="粘贴或输入任意 emoji，如 🎃"
              value={newBoxIcon.length > 2 ? newBoxIcon : ''}
              onChangeText={(t) => { if (t.trim()) setNewBoxIcon(t.trim().slice(0, 4)); }}
            />
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancelBtn}
                onPress={() => {
                  setCreateVisible(false);
                  setNewBoxName('');
                  setNewBoxIcon('📦');
                }}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.dialogSaveBtn} onPress={handleCreate}>
                <Text style={styles.dialogSaveText}>创建</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Quick draw modal */}
      <Modal visible={drawVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.drawCard}>
            <Pressable
              style={styles.drawCloseBtn}
              onPress={() => {
                setDrawVisible(false);
                setDrawn(null);
              }}
            >
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
                onPress={() => {
                  setDrawVisible(false);
                  setDrawn(null);
                }}
              >
                <Text style={styles.drawActionText}>🛋️ 改天再说</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit box modal */}
      <Modal visible={editVisible} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>编辑盒子</Text>
              <Pressable onPress={() => setEditVisible(false)}>
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.dialogInput}
              placeholder="盒子名称"
              value={editName}
              onChangeText={setEditName}
              autoFocus
              onSubmitEditing={handleEdit}
              returnKeyType="done"
            />
            <Text style={styles.iconPickerLabel}>选择图标</Text>
            <View style={styles.iconGrid}>
              {BOX_ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  style={[styles.iconItem, editIcon === icon && styles.iconItemActive]}
                  onPress={() => setEditIcon(icon)}
                >
                  <Text style={styles.iconItemText}>{icon}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.iconPickerLabel}>或输入自定义表情</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="粘贴或输入任意 emoji，如 🎃"
              value={editIcon.length > 2 ? editIcon : ''}
              onChangeText={(t) => { if (t.trim()) setEditIcon(t.trim().slice(0, 4)); }}
            />
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancelBtn}
                onPress={() => setEditVisible(false)}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.dialogSaveBtn} onPress={handleEdit}>
                <Text style={styles.dialogSaveText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  createButton: {
    backgroundColor: colors.yellow,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  createButtonText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  list: { padding: 20, paddingTop: 8 },
  empty: {
    textAlign: 'center',
    color: colors.subtext,
    marginTop: 60,
    lineHeight: 24,
    fontSize: 14,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIconText: { fontSize: 24 },
  cardMain: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', color: colors.text },
  cardCount: { fontSize: 13, color: colors.subtext, marginTop: 2 },
  switchTrack: {
    width: 64,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    marginRight: 8,
  },
  switchTrackOn: {
    backgroundColor: colors.accent,
  },
  switchTrackOff: {
    backgroundColor: '#D1D5DB',
  },
  switchThumb: {
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  switchThumbOn: {
    backgroundColor: '#fff',
    width: 44,
    marginLeft: 'auto',
  },
  switchThumbOff: {
    backgroundColor: '#fff',
    width: 44,
    marginRight: 'auto',
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  quickDrawBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  quickDrawText: { fontSize: 22 },
  // Modal shared
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  // Create dialog
  dialog: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  dialogTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  dialogInput: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  iconPickerLabel: { fontSize: 13, color: colors.subtext, marginTop: 4 },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  iconItem: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  iconItemActive: {
    backgroundColor: colors.orange,
  },
  iconItemText: { fontSize: 20 },
  dialogActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
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
  // Quick draw modal
  drawCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  drawTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  drawContent: { fontSize: 22, color: colors.text, textAlign: 'center', marginBottom: 12 },
  drawImage: { width: 180, height: 180, borderRadius: 14, marginBottom: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill: {
    backgroundColor: colors.amber,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { fontSize: 12, color: colors.text },
  drawActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  drawActionBtn: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  drawActionText: { color: colors.text, fontWeight: '600' },
  closeBtn: { fontSize: 24, color: colors.subtext, fontWeight: '300', lineHeight: 26 },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  drawCloseBtn: { position: 'absolute', top: 12, right: 16, zIndex: 1 },
  // Swipe action buttons
  swipeBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  swipeBtnIcon: { fontSize: 18 },
  swipeBtnText: { fontSize: 11, color: '#fff', fontWeight: '600' },
});

const swStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    borderRadius: 20,
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
    borderRadius: 20,
  },
});
