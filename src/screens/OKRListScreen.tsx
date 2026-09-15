import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  deleteObjectiveOKR,
  getAllObjectivesWithProgress,
  incrementKR,
  listKeyResults,
  updateKRProgress,
  updateObjective,
} from '../db/database';
import { colors } from '../theme';

const OBJ_COLORS = ['#6FA58A', '#7FA7A0', '#8E9FB8', '#A68FA8', '#C49A79', '#829A75', '#9B9E78'];

function getObjColor(index: number): string {
  return OBJ_COLORS[index % OBJ_COLORS.length];
}

type RootStackParamList = {
  OKRList: undefined;
  OKRForm: undefined;
  OKRDetail: { objectiveId: number; objectiveTitle: string };
};

function getRemainingDays(endDateStr: string): number {
  if (!endDateStr) return 0;
  const end = new Date(endDateStr + 'T23:59:59');
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function OKRListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [allObjectives, setAllObjectives] = useState<any[]>([]);
  const [editObjVisible, setEditObjVisible] = useState(false);
  const [editObjId, setEditObjId] = useState<number | null>(null);
  const [editObjTitle, setEditObjTitle] = useState('');
  const [incrVisible, setIncrVisible] = useState(false);
  const [incrObjId, setIncrObjId] = useState<number | null>(null);
  const [incrAmount, setIncrAmount] = useState('1');
  const [showCompleted, setShowCompleted] = useState(false);

  const refresh = useCallback(async () => {
    const objs = await getAllObjectivesWithProgress();
    setAllObjectives(objs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const confirmDeleteObjective = (id: number, title: string) => {
    Alert.alert('删除目标', `确定删除「${title}」及其所有任务吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteObjectiveOKR(id);
          refresh();
        },
      },
    ]);
  };

  const openEditObjModal = (id: number, title: string) => {
    setEditObjId(id);
    setEditObjTitle(title);
    setEditObjVisible(true);
  };

  const handleEditObjective = async () => {
    if (!editObjTitle.trim() || !editObjId) {
      Alert.alert('提示', '目标名称不能为空');
      return;
    }
    await updateObjective(editObjId, editObjTitle.trim());
    setEditObjVisible(false);
    setEditObjId(null);
    setEditObjTitle('');
    refresh();
  };

  const handleIncrement = async () => {
    const amount = parseInt(incrAmount, 10);
    if (!amount || amount <= 0 || !incrObjId) {
      Alert.alert('提示', '请输入有效的数量');
      return;
    }
    const krs = await listKeyResults(incrObjId);
    let remaining = amount;
    for (const kr of krs) {
      if (remaining <= 0) break;
      const canAdd = kr.target_value - kr.current_value;
      if (canAdd > 0) {
        const add = Math.min(canAdd, remaining);
        for (let i = 0; i < add; i++) {
          await incrementKR(kr.id);
        }
        remaining -= add;
      }
    }
    setIncrVisible(false);
    setIncrObjId(null);
    setIncrAmount('1');
    refresh();
  };

  const handleDecrementOne = async (objectiveId: number) => {
    const krs = await listKeyResults(objectiveId);
    const task = [...krs].reverse().find((kr) => Number(kr.current_value) > 0);
    if (!task) return;
    await updateKRProgress(task.id, Math.max(0, Number(task.current_value) - 1));
    refresh();
  };

  const activeObjectives = allObjectives.filter((o) => o.status !== 'completed');
  const completedObjectives = allObjectives.filter((o) => o.status === 'completed');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pageHeader}>
          <View style={styles.pageHeading}>
            <Text style={styles.pageEyebrow}>MY GOALS</Text>
            <Text style={styles.pageTitle}>目标管理</Text>
            <Text style={styles.pageSubtitle}>{activeObjectives.length} 个进行中 · {completedObjectives.length} 个已达成</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]} onPress={() => navigation.navigate('OKRForm')}>
            <Text style={styles.createBtnText}>＋</Text>
          </Pressable>
        </View>

        {/* All Objectives */}
        {activeObjectives.length === 0 && completedObjectives.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>还没有目标，点击上方按钮创建一个吧</Text>
          </View>
        ) : (
          <>
            {activeObjectives.length === 0 ? null : (
          <View style={{ gap: 10 }}>
            {activeObjectives.map((obj, idx) => {
              const remaining = getRemainingDays(obj.period_end_date);
              const allDone = obj.kr_done === obj.kr_count && obj.kr_count > 0;
              const color = getObjColor(idx);
              const progress = obj.progress ?? 0;

              return (
                <Pressable
                  key={obj.id}
                  style={styles.objCard}
                  onPress={() => navigation.navigate('OKRDetail', { objectiveId: obj.id, objectiveTitle: obj.title })}
                  onLongPress={() => confirmDeleteObjective(obj.id, obj.title)}
                >
                  {/* Period name badge */}
                  <View style={styles.objPeriodRow}>
                    <View style={styles.periodTag}>
                      <Text style={styles.periodTagText}>{obj.period_name}</Text>
                    </View>
                    {obj.period_end_date && obj.period_end_date !== '2099-12-31' && (
                      <View style={styles.remainingBadge}>
                        <Text style={[styles.remainingText, remaining === 0 && styles.remainingUrgent]}>
                          {remaining > 0 ? `剩余 ${remaining}d` : '已到期'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Title row */}
                  <View style={styles.objTitleRow}>
                    <Text style={styles.objTitle} numberOfLines={1}>
                      {allDone ? '🎉 ' : ''}{obj.title}
                    </Text>
                  </View>

                  {/* Task count row */}
                  <View style={styles.taskCountRow}>
                    <Text style={styles.taskCountText}>
                      {obj.kr_done}/{obj.kr_count} 任务已完成
                    </Text>
                  </View>

                  {/* Notes (if any) */}
                  {obj.notes ? (
                    <Text style={styles.objNotes} numberOfLines={2}>
                      {obj.notes}
                    </Text>
                  ) : null}

                  {/* Progress bar */}
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
                      <Text style={[styles.progressPercentOverlay, { color: progress > 40 ? '#fff' : color }]}>
                        {progress.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.progressStepActions}>
                    <Pressable
                      accessibilityLabel={`减少${obj.title}的进度`}
                      style={[styles.incrBtn, { borderColor: colors.border }]}
                      onPress={() => handleDecrementOne(obj.id)}
                      hitSlop={6}
                    >
                      <Text style={[styles.incrBtnText, { color: colors.subtext }]}>－</Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`增加${obj.title}的进度`}
                      style={[styles.incrBtn, { borderColor: color }]}
                      onPress={() => { setIncrObjId(obj.id); setIncrAmount('1'); setIncrVisible(true); }}
                      hitSlop={6}
                    >
                      <Text style={[styles.incrBtnText, { color }]}>＋</Text>
                    </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
            )}

            {/* Completed objectives toggle */}
            {completedObjectives.length > 0 && (
              <Pressable
                style={styles.completedToggle}
                onPress={() => setShowCompleted(!showCompleted)}
              >
                <Text style={styles.completedToggleText}>
                  🏆 已达成目标（{completedObjectives.length}）
                </Text>
                <Text style={[styles.completedArrow, showCompleted && styles.completedArrowOpen]}>
                  ⌄
                </Text>
              </Pressable>
            )}

            {/* Completed objectives list */}
            {showCompleted && completedObjectives.length > 0 && (
              <View style={{ gap: 10, marginTop: 10 }}>
                {completedObjectives.map((obj, idx) => {
                  const color = getObjColor(idx);
                  const progress = obj.progress ?? 0;
                  return (
                    <Pressable
                      key={obj.id}
                      style={[styles.objCard, styles.completedCard]}
                      onPress={() => navigation.navigate('OKRDetail', { objectiveId: obj.id, objectiveTitle: obj.title })}
                      onLongPress={() => confirmDeleteObjective(obj.id, obj.title)}
                    >
                      <View style={styles.objTitleRow}>
                        <Text style={[styles.objTitle, styles.completedTitle]} numberOfLines={1}>
                          🎉 {obj.title}
                        </Text>
                      </View>
                      <View style={styles.taskCountRow}>
                        <Text style={styles.taskCountText}>
                          {obj.kr_done}/{obj.kr_count} 任务已完成
                        </Text>
                      </View>
                      <View style={styles.progressRow}>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
                          <Text style={[styles.progressPercentOverlay, { color: progress > 40 ? '#fff' : colors.accent }]}>
                            {progress.toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Edit Objective Modal */}
      <Modal visible={editObjVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.form}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>编辑目标</Text>
              <Pressable onPress={() => { setEditObjVisible(false); setEditObjId(null); setEditObjTitle(''); }}>
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.formInput}
              placeholder="目标名称"
              value={editObjTitle}
              onChangeText={setEditObjTitle}
              autoFocus
            />
            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setEditObjVisible(false); setEditObjId(null); setEditObjTitle(''); }}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleEditObjective}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Increment Modal */}
      <Modal visible={incrVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.form}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>增加进度</Text>
              <Pressable onPress={() => { setIncrVisible(false); setIncrObjId(null); setIncrAmount('1'); }}>
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: colors.subtext }}>输入要完成的任务数量</Text>
            <TextInput
              style={styles.formInput}
              placeholder="默认 1"
              value={incrAmount}
              onChangeText={setIncrAmount}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setIncrVisible(false); setIncrObjId(null); setIncrAmount('1'); }}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleIncrement}>
                <Text style={styles.saveBtnText}>确认</Text>
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
  content: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 28 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  pageHeading: { flex: 1 },
  pageEyebrow: { fontSize: 10, color: colors.orange, fontWeight: '800', letterSpacing: 1.6, marginBottom: 5 },
  pageTitle: { fontSize: 22, color: colors.text, fontWeight: '800', letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 11, color: colors.subtext, marginTop: 3 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  // Create button
  createBtn: {
    backgroundColor: colors.orange,
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  createBtnText: { color: '#fff', fontSize: 24, fontWeight: '400', lineHeight: 26 },
  // Empty states
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyText: { fontSize: 14, color: colors.subtext, textAlign: 'center' },
  // Objective card
  objCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  objPeriodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  periodTag: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  periodTagText: { fontSize: 10, color: colors.orange, fontWeight: '600' },
  objTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  objTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  objActionIcon: { padding: 4 },
  objActionIconText: { fontSize: 15 },
  remainingBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  remainingText: { fontSize: 10, color: colors.subtext, fontWeight: '500' },
  remainingUrgent: { color: colors.danger },
  taskCountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  taskCountText: { fontSize: 11, color: colors.subtext },
  objNotes: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 8,
    lineHeight: 18,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  progressStepActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  incrBtn: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incrBtnText: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
  progressTrack: {
    flex: 1,
    height: 20,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressPercentOverlay: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.bg,
    marginLeft: 18,
    marginRight: 18,
  },
  // Modal
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  form: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  formTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 4 },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeBtn: { fontSize: 24, color: colors.subtext, fontWeight: '300', lineHeight: 26 },
  formInput: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  cancelBtnText: { color: colors.text, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.orange,
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  // Completed section
  completedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  completedToggleText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  completedArrow: {
    fontSize: 20,
    color: colors.subtext,
    fontWeight: '700',
    transform: [{ rotate: '-90deg' }],
  },
  completedArrowOpen: { transform: [{ rotate: '0deg' }] },
  completedCard: {
    opacity: 0.75,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  completedTitle: { color: colors.subtext },
});
