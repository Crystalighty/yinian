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
import { useFocusEffect } from '@react-navigation/native';
import {
  Habit,
  addHabit,
  checkInHabit,
  deleteHabit,
  getHabitCheckInCounts,
  getHabitHistory,
  getHabitStreak,
  listHabits,
  updateHabitStatus,
  undoHabitCheckIn,
} from '../db/database';
import { colors } from '../theme';

const HABIT_ICONS = ['✅', '🏃', '📖', '💧', '🧘', '🎵', '💪', '🌅', '📝', '🍎', '😴', '🧹', '💊', '🌿', '🎨', '📚'];

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getToday(): string {
  const d = new Date();
  return formatDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function HabitScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkInCounts, setCheckInCounts] = useState<Record<number, number>>({});
  const [streaks, setStreaks] = useState<Record<number, number>>({});
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('✅');
  const [checkedSet, setCheckedSet] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<Record<number, string[]>>({});

  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - index));
    return { date: formatDateStr(d.getFullYear(), d.getMonth(), d.getDate()), label: ['日','一','二','三','四','五','六'][d.getDay()] };
  });

  const refresh = useCallback(async () => {
    const h = await listHabits();
    setHabits(h);
    const counts = await getHabitCheckInCounts();
    setCheckInCounts(counts);
    setCheckedSet(new Set(Object.keys(counts).map(Number)));
    setHistory(await getHabitHistory(recentDays[0].date, recentDays[6].date));
    
    // Load streaks for all habits
    const streakData: Record<number, number> = {};
    for (const habit of h) {
      streakData[habit.id] = await getHabitStreak(habit.id);
    }
    setStreaks(streakData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleToggleCheckIn = async (habit: Habit) => {
    if (checkedSet.has(habit.id)) await undoHabitCheckIn(habit.id, getToday());
    else await checkInHabit(habit.id, getToday());
    await refresh();
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      Alert.alert('提示', '给习惯起个名字吧');
      return;
    }
    await addHabit(newName.trim(), newIcon);
    setNewName('');
    setNewIcon('✅');
    setAddVisible(false);
    refresh();
  };

  const handleDelete = (habit: Habit) => {
    Alert.alert('删除习惯', `确定删除「${habit.name}」吗？所有打卡记录将被清除。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteHabit(habit.id);
          refresh();
        },
      },
    ]);
  };

  const handlePauseHabit = async (habit: Habit) => {
    const newStatus = habit.status === 'paused' ? 'active' : 'paused';
    const actionText = newStatus === 'paused' ? '暂停' : '继续';
    Alert.alert(`${actionText}习惯`, `确定${actionText}「${habit.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: actionText,
        onPress: async () => {
          await updateHabitStatus(habit.id, newStatus);
          refresh();
        },
      },
    ]);
  };

  const handleCompleteHabit = (habit: Habit) => {
    Alert.alert('结束习惯', `确定结束「${habit.name}」吗？结束后将无法再打卡。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '结束',
        style: 'destructive',
        onPress: async () => {
          await updateHabitStatus(habit.id, 'completed');
          refresh();
        },
      },
    ]);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Add button */}
      <Pressable style={styles.addBtn} onPress={() => setAddVisible(true)}>
        <Text style={styles.addBtnText}>＋ 新建习惯</Text>
      </Pressable>

      {/* Habit grid */}
      {habits.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyText}>还没有习惯，创建一个开始坚持吧</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {habits.map((habit) => {
            const isChecked = checkedSet.has(habit.id);
            const count = checkInCounts[habit.id] || 0;
            const streak = streaks[habit.id] || 0;
            const isPaused = habit.status === 'paused';
            const isCompleted = habit.status === 'completed';
            
            return (
              <Pressable
                key={habit.id}
                style={[styles.habitCard, isChecked && styles.habitCardDone, isPaused && styles.habitCardPaused, isCompleted && styles.habitCardCompleted]}
                onPress={() => !isPaused && !isCompleted && handleToggleCheckIn(habit)}
                onLongPress={() => {
                  if (!isCompleted) {
                    Alert.alert(habit.name, '选择操作', [
                      { text: '取消', style: 'cancel' },
                      { text: isPaused ? '▶️ 继续' : '⏸ 暂停', onPress: () => handlePauseHabit(habit) },
                      { text: '✅ 结束', onPress: () => handleCompleteHabit(habit) },
                      { text: '🗑️ 删除', style: 'destructive', onPress: () => handleDelete(habit) },
                    ]);
                  }
                }}
              >
                <Text style={[styles.habitIcon, isChecked && styles.habitIconDone, isPaused && styles.habitIconPaused]}>
                  {habit.icon}
                </Text>
                <Text style={[styles.habitName, isPaused && styles.habitNamePaused, isCompleted && styles.habitNameCompleted]} numberOfLines={1}>
                  {habit.name}
                </Text>
                {/* Status badge */}
                {isPaused && <Text style={styles.statusBadge}>⏸ 已暂停</Text>}
                {isCompleted && <Text style={styles.statusBadge}>✅ 已结束</Text>}
                {/* Streak display */}
                {!isCompleted && streak > 0 && (
                  <Text style={styles.streakText}>🔥 坚持{streak}天</Text>
                )}
                {/* Check-in status */}
                {!isPaused && !isCompleted && (
                  isChecked ? (
                    <Text style={styles.habitDoneText}>✓ 已打卡 · 点击撤销</Text>
                  ) : count > 0 ? (
                    <Text style={styles.habitCount}>今日 {count} 次</Text>
                  ) : (
                    <Text style={styles.habitHint}>点击打卡</Text>
                  )
                )}
                {!isCompleted && <View style={styles.historyRow}>{recentDays.map((day) => { const hit = (history[habit.id] || []).includes(day.date); return <View key={day.date} style={styles.historyDay}><View style={[styles.historyDot, hit && styles.historyDotDone]}/><Text style={styles.historyLabel}>{day.label}</Text></View>; })}</View>}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>

    {/* Add Habit Modal */}
    <Modal visible={addVisible} transparent animationType="fade">
      <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.dialog}>
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogTitle}>新建习惯</Text>
            <Pressable onPress={() => { setAddVisible(false); setNewName(''); setNewIcon('✅'); }}>
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.dialogInput}
            placeholder="习惯名称（如：早起、喝水）"
            value={newName}
            onChangeText={setNewName}
            autoFocus
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Text style={styles.iconLabel}>选择图标</Text>
          <View style={styles.iconGrid}>
            {HABIT_ICONS.map((icon) => (
              <Pressable
                key={icon}
                style={[styles.iconItem, newIcon === icon && styles.iconItemActive]}
                onPress={() => setNewIcon(icon)}
              >
                <Text style={styles.iconItemText}>{icon}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.dialogActions}>
            <Pressable
              style={styles.dialogCancelBtn}
              onPress={() => { setAddVisible(false); setNewName(''); setNewIcon('✅'); }}
            >
              <Text style={styles.dialogCancelText}>取消</Text>
            </Pressable>
            <Pressable style={styles.dialogSaveBtn} onPress={handleAdd}>
              <Text style={styles.dialogSaveText}>创建</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  // Add button
  addBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  addBtnText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  // Empty state
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: colors.subtext, textAlign: 'center' },
  // Habit grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  habitCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  habitCardDone: {
    backgroundColor: colors.yellow,
    shadowColor: colors.accent,
    shadowOpacity: 0.12,
  },
  habitCardPaused: {
    opacity: 0.6,
    backgroundColor: colors.bg,
  },
  habitCardCompleted: {
    opacity: 0.5,
    backgroundColor: colors.card,
  },
  habitIcon: { fontSize: 36, marginBottom: 8 },
  habitIconDone: { transform: [{ scale: 1.1 }] },
  habitIconPaused: { opacity: 0.5 },
  habitName: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  habitNamePaused: { textDecorationLine: 'line-through', color: colors.subtext },
  habitNameCompleted: { textDecorationLine: 'line-through', color: colors.subtext },
  statusBadge: {
    fontSize: 11,
    color: colors.subtext,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.bg,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 12,
    color: colors.orange,
    fontWeight: '700',
    marginTop: 4,
  },
  habitDoneText: { fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 6 },
  habitCount: { fontSize: 12, color: colors.subtext, marginTop: 6 },
  habitHint: { fontSize: 12, color: colors.orange, marginTop: 6, fontWeight: '500' },
  historyRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.border },
  historyDay: { alignItems: 'center', gap: 3 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  historyDotDone: { backgroundColor: colors.orange },
  historyLabel: { fontSize: 8, color: colors.subtext },
  // Modal
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dialogTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  closeBtn: { fontSize: 24, color: colors.subtext, fontWeight: '300', lineHeight: 26 },
  dialogInput: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  iconLabel: { fontSize: 13, color: colors.subtext, marginTop: 4 },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
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
});
