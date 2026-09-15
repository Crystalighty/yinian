import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { addKeyResult, getKeyResult, getObjective, updateKeyResult } from '../db/database';
import { colors } from '../theme';
import DateTimePicker from '@react-native-community/datetimepicker';

type TaskType = 'normal' | 'progress';
type Recurrence = 'none' | 'daily' | 'weekday' | 'weekend' | 'weekly' | 'monthly' | 'ebbinghaus';
type ResetCycle = 'none' | 'daily' | 'weekly' | 'monthly';

const RECURRENCE_OPTIONS: { key: Recurrence; label: string }[] = [
  { key: 'none', label: '无循环' },
  { key: 'daily', label: '每天' },
  { key: 'weekday', label: '每周工作日' },
  { key: 'weekend', label: '每周六周日' },
  { key: 'weekly', label: '每周特定日期' },
  { key: 'monthly', label: '每月特定日期' },
  { key: 'ebbinghaus', label: '艾宾浩斯记忆法' },
];

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const RESET_CYCLE_OPTIONS: { key: ResetCycle; label: string }[] = [
  { key: 'none', label: '不重置' },
  { key: 'daily', label: '每天' },
  { key: 'weekly', label: '每周' },
  { key: 'monthly', label: '每月' },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function calcDaysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

export default function OKRTaskFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { objectiveId, taskId, parentId } = route.params as { objectiveId: number; taskId?: number; parentId?: number };
  const isEdit = !!taskId;
  const isSubTask = !!parentId;

  // Objective dates for auto-fill
  const [objStartDate, setObjStartDate] = useState<string | null>(null);
  const [objEndDate, setObjEndDate] = useState<string | null>(null);

  // Task type
  const [taskType, setTaskType] = useState<TaskType>('normal');

  // Common fields
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  // Date fields
  const [useObjDates, setUseObjDates] = useState(false);
  const [dateEnabled, setDateEnabled] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default end date is 7 days later
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Recurrence (normal task)
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [selectedWeekDays, setSelectedWeekDays] = useState<Set<number>>(new Set());
  const [monthlyDays, setMonthlyDays] = useState('');

  // Progress fields (progress task)
  const [resetCycle, setResetCycle] = useState<ResetCycle>('none');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [startValue, setStartValue] = useState('0');
  const [minDailyAmount, setMinDailyAmount] = useState('');

  // Reminder
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  useEffect(() => {
    getObjective(objectiveId).then((obj) => {
      if (obj) {
        setObjStartDate(obj.start_date);
        setObjEndDate(obj.end_date);
        if (obj.start_date && obj.end_date) {
          setStartDate(new Date(obj.start_date + 'T00:00:00'));
          setEndDate(new Date(obj.end_date + 'T00:00:00'));
        }
      }
    });
    // Load existing task if editing
    if (taskId) {
      getKeyResult(taskId).then((kr) => {
        if (kr) {
          setTaskType((kr.task_type as TaskType) || 'normal');
          setTitle(kr.title);
          setNotes(kr.notes || '');
          
          // Date handling
          if (kr.start_date && kr.end_date) {
            // Has custom dates
            setUseObjDates(false);
            setDateEnabled(true);
            setStartDate(new Date(kr.start_date + 'T00:00:00'));
            setEndDate(new Date(kr.end_date + 'T00:00:00'));
          } else if (objStartDate && objEndDate) {
            // Using objective dates
            setUseObjDates(true);
            setDateEnabled(false);
          } else {
            // No dates
            setUseObjDates(false);
            setDateEnabled(false);
          }
          const rec = (kr.recurrence || 'none') as Recurrence;
          setRecurrence(rec);
          if (rec === 'weekly' && kr.recurrence_days) {
            setSelectedWeekDays(new Set(kr.recurrence_days.split(',').map(Number)));
          } else if (rec === 'monthly' && kr.recurrence_days) {
            setMonthlyDays(kr.recurrence_days);
          }
          setResetCycle((kr.reset_cycle as ResetCycle) || 'none');
          setTargetValue(String(kr.target_value || ''));
          setUnit(kr.unit || '');
          setStartValue(String(kr.current_value || 0));
          setMinDailyAmount(kr.min_daily_amount > 0 ? String(kr.min_daily_amount) : '');
          if (kr.reminder_time) {
            setReminderEnabled(true);
            const [h, m] = kr.reminder_time.split(':').map(Number);
            const rt = new Date();
            rt.setHours(h, m, 0, 0);
            setReminderTime(rt);
          }
        }
      });
    }
  }, [objectiveId, taskId]);

  // Auto-calc min daily amount
  useEffect(() => {
    if (taskType === 'progress' && targetValue && startDate && endDate) {
      const total = parseFloat(targetValue) || 0;
      const days = calcDaysBetween(fmtDate(startDate), fmtDate(endDate));
      const auto = total > 0 && days > 0 ? (total / days) : 0;
      setMinDailyAmount(auto > 0 ? auto.toFixed(1) : '');
    }
  }, [taskType, targetValue, startDate, endDate]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? '编辑任务' : '新建任务',
      headerRight: () => (
        <Pressable onPress={handleSave} hitSlop={8}>
          <Text style={{ color: colors.orange, fontSize: 16, fontWeight: '600' }}>{isEdit ? '保存' : '完成'}</Text>
        </Pressable>
      ),
    });
  });

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '任务名称不能为空');
      return;
    }
    // Date handling: if dateEnabled is true, use the current startDate/endDate values
    let sd: string | null = null;
    let ed: string | null = null;
    
    if (dateEnabled) {
      sd = fmtDate(startDate);
      ed = fmtDate(endDate);
    }
    // If dateEnabled is false, sd and ed remain null

    let recurrenceDays: string | null = null;
    if (recurrence === 'weekly' && selectedWeekDays.size > 0) {
      recurrenceDays = Array.from(selectedWeekDays).sort().join(',');
    } else if (recurrence === 'monthly' && monthlyDays.trim()) {
      recurrenceDays = monthlyDays.trim();
    }

    const repeatMode = recurrence !== 'none' ? 1 : 0;
    const tv = taskType === 'progress' ? (parseFloat(targetValue) || 1) : 1;
    const reminder = reminderEnabled
      ? `${pad(reminderTime.getHours())}:${pad(reminderTime.getMinutes())}`
      : null;

    if (isEdit && taskId) {
      await updateKeyResult(taskId, title.trim(), tv, taskType === 'progress' ? unit : '', null, null, repeatMode, {
        taskType,
        notes: notes.trim() || null,
        startDate: sd,
        endDate: ed,
        recurrence,
        recurrenceDays,
        reminderTime: reminder,
        resetCycle: taskType === 'progress' ? resetCycle : 'none',
        minDailyAmount: taskType === 'progress' ? (parseFloat(minDailyAmount) || 0) : 0,
      });
    } else {
      await addKeyResult(objectiveId, title.trim(), tv, taskType === 'progress' ? unit : '', null, null, repeatMode, parentId || null, {
        taskType,
        notes: notes.trim() || null,
        startDate: sd,
        endDate: ed,
        recurrence,
        recurrenceDays,
        reminderTime: reminder,
        resetCycle: taskType === 'progress' ? resetCycle : 'none',
        minDailyAmount: taskType === 'progress' ? (parseFloat(minDailyAmount) || 0) : 0,
      });
    }
    navigation.goBack();
  };

  const toggleWeekDay = (day: number) => {
    setSelectedWeekDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
        {/* Task type selector */}
        <Text style={styles.label}>任务类型</Text>
        <View style={styles.typeToggle}>
          <Pressable
            style={[styles.typeBtn, taskType === 'normal' && styles.typeBtnActive]}
            onPress={() => setTaskType('normal')}
          >
            <Text style={[styles.typeBtnText, taskType === 'normal' && styles.typeBtnTextActive]}>普通任务</Text>
          </Pressable>
          <Pressable
            style={[styles.typeBtn, taskType === 'progress' && styles.typeBtnActive]}
            onPress={() => setTaskType('progress')}
          >
            <Text style={[styles.typeBtnText, taskType === 'progress' && styles.typeBtnTextActive]}>进度条任务</Text>
          </Pressable>
        </View>

        {/* Name */}
        <Text style={styles.label}>名称</Text>
        <TextInput style={styles.input} placeholder="输入任务名称…" value={title} onChangeText={setTitle} autoFocus />

        {/* Notes */}
        <Text style={styles.label}>备注</Text>
        <TextInput style={[styles.input, styles.multilineInput]} placeholder="添加备注（可选）…" value={notes} onChangeText={setNotes} multiline textAlignVertical="top" />

        {/* Date section */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>使用目标时间</Text>
          <Switch 
            value={useObjDates} 
            onValueChange={(v) => {
              setUseObjDates(v);
              if (v && objStartDate && objEndDate) {
                // Sync objective dates to form and enable date editing
                setStartDate(new Date(objStartDate + 'T00:00:00'));
                setEndDate(new Date(objEndDate + 'T00:00:00'));
                setDateEnabled(true);
              }
            }} 
            trackColor={{ false: colors.border, true: colors.orange + '60' }} 
            thumbColor={useObjDates ? colors.orange : colors.subtext} 
          />
        </View>
        {!useObjDates && (
          <>
            <View style={styles.switchRow}>
              <Text style={styles.label}>设置日期</Text>
              <Switch value={dateEnabled} onValueChange={setDateEnabled} trackColor={{ false: colors.border, true: colors.orange + '60' }} thumbColor={dateEnabled ? colors.orange : colors.subtext} />
            </View>
            {dateEnabled && (
              <>
                <Text style={styles.subLabel}>开始日期</Text>
                <Pressable style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                  <Text style={styles.dateBtnText}>{fmtDate(startDate)}</Text>
                  <Text style={styles.dateBtnIcon}>📅</Text>
                </Pressable>
                {showStartPicker && (
                  <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'compact' : 'default'} onChange={(_e: any, d?: Date) => { setShowStartPicker(false); if (d) setStartDate(d); }} />
                )}
                <Text style={styles.subLabel}>结束日期</Text>
                <Pressable style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                  <Text style={styles.dateBtnText}>{fmtDate(endDate)}</Text>
                  <Text style={styles.dateBtnIcon}>📅</Text>
                </Pressable>
                {showEndPicker && (
                  <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'compact' : 'default'} onChange={(_e: any, d?: Date) => { setShowEndPicker(false); if (d) setEndDate(d); }} />
                )}
              </>
            )}
          </>
        )}
        {useObjDates && objStartDate && objEndDate && (
          <Text style={styles.hintText}>{objStartDate} ~ {objEndDate}</Text>
        )}
        {useObjDates && (!objStartDate || !objEndDate) && (
          <Text style={styles.hintText}>目标未设置日期，请先在目标中设置</Text>
        )}

        {/* Recurrence (normal task only) */}
        {taskType === 'normal' && (
          <>
            <Text style={styles.label}>循环</Text>
            <View style={styles.chipRow}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, recurrence === opt.key && styles.chipActive]}
                  onPress={() => setRecurrence(opt.key)}
                >
                  <Text style={[styles.chipText, recurrence === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            {recurrence === 'weekly' && (
              <View style={styles.weekDayRow}>
                {WEEKDAY_LABELS.map((label, idx) => (
                  <Pressable
                    key={idx}
                    style={[styles.weekDayBtn, selectedWeekDays.has(idx + 1) && styles.weekDayBtnActive]}
                    onPress={() => toggleWeekDay(idx + 1)}
                  >
                    <Text style={[styles.weekDayText, selectedWeekDays.has(idx + 1) && styles.weekDayTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {recurrence === 'monthly' && (
              <>
                <Text style={styles.subLabel}>每月日期（逗号分隔，如 1,15）</Text>
                <TextInput style={styles.input} placeholder="如 1,15" value={monthlyDays} onChangeText={setMonthlyDays} keyboardType="numbers-and-punctuation" />
              </>
            )}
            {recurrence === 'ebbinghaus' && (
              <Text style={styles.hintText}>按艾宾浩斯遗忘曲线：第1/2/4/7/15/30天复习</Text>
            )}
          </>
        )}

        {/* Progress task fields */}
        {taskType === 'progress' && (
          <>
            <Text style={styles.label}>进度重置周期</Text>
            <View style={styles.chipRow}>
              {RESET_CYCLE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, resetCycle === opt.key && styles.chipActive]}
                  onPress={() => setResetCycle(opt.key)}
                >
                  <Text style={[styles.chipText, resetCycle === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>目标值</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.flexInput]} placeholder="数量" value={targetValue} onChangeText={setTargetValue} keyboardType="decimal-pad" />
              <TextInput style={[styles.input, styles.flexInput]} placeholder="单位（可选）" value={unit} onChangeText={setUnit} />
            </View>

            <Text style={styles.label}>开始值</Text>
            <TextInput style={styles.input} placeholder="默认 0" value={startValue} onChangeText={setStartValue} keyboardType="decimal-pad" />

            <Text style={styles.label}>每天最低完成量</Text>
            <TextInput style={styles.input} placeholder="默认自动计算" value={minDailyAmount} onChangeText={setMinDailyAmount} keyboardType="decimal-pad" />
            <Text style={styles.hintText}>默认 = 目标值 ÷ 有效天数，可手动修改</Text>
          </>
        )}

        {/* Reminder */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>提醒</Text>
          <Switch value={reminderEnabled} onValueChange={setReminderEnabled} trackColor={{ false: colors.border, true: colors.orange + '60' }} thumbColor={reminderEnabled ? colors.orange : colors.subtext} />
        </View>
        {reminderEnabled && (
          <>
            <Pressable style={styles.dateBtn} onPress={() => setShowReminderPicker(true)}>
              <Text style={styles.dateBtnText}>{pad(reminderTime.getHours())}:{pad(reminderTime.getMinutes())}</Text>
              <Text style={styles.dateBtnIcon}>⏰</Text>
            </Pressable>
            {showReminderPicker && (
              <DateTimePicker value={reminderTime} mode="time" display={Platform.OS === 'ios' ? 'compact' : 'default'} onChange={(_e: any, d?: Date) => { setShowReminderPicker(false); if (d) setReminderTime(d); }} />
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 18 },
  subLabel: { fontSize: 13, color: colors.subtext, marginBottom: 6, marginTop: 12, fontWeight: '500' },
  input: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
  multilineInput: { minHeight: 80 },
  row: { flexDirection: 'row', gap: 10 },
  flexInput: { flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  hintText: { fontSize: 12, color: colors.subtext, marginTop: 6 },
  // Type toggle
  typeToggle: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  typeBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.orange },
  typeBtnText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  typeBtnTextActive: { color: colors.orangeDark, fontWeight: '700' },
  // Date
  dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  dateBtnText: { fontSize: 15, color: colors.text },
  dateBtnIcon: { fontSize: 16 },
  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.orange },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  chipTextActive: { color: colors.orangeDark, fontWeight: '700' },
  // Weekday
  weekDayRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  weekDayBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  weekDayBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  weekDayText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  weekDayTextActive: { color: '#fff', fontWeight: '700' },
});
