import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  GlobalDayActivity,
  HabitLog,
  MemoirEntry,
  deleteArchivedItem,
  deleteHabitLog,
  deleteRecord,
  deleteOKRActivityLog,
  getAllOKRActivityDates,
  getAllOKRDayActivities,
  getHabitLogDates,
  getHabitLogsWithHabit,
  listMemoir,
  listMemoirByDate,
  listMemoirDates,
  unclearGame,
} from '../db/database';
import { colors } from '../theme';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

type AppFilter = 'all' | 'game' | 'okr' | 'habit' | 'box';

const APP_FILTERS: { key: AppFilter; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '📖' },
  { key: 'game', label: '游戏', icon: '🎮' },
  { key: 'okr', label: '目标', icon: '📋' },
  { key: 'habit', label: '习惯', icon: '✅' },
  { key: 'box', label: '盒子', icon: '🎁' },
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function entryDateKey(value: string): string { return value.slice(0, 10); }

function formatEntryTime(value: string): string | null {
  const match = value.match(/[T ](\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function formatDayHeading(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getMonth() + 1}月${date.getDate()}日  周${WEEKDAYS[date.getDay()]}`;
}

function entryTypeLabel(item: MemoirEntry): string {
  if (item.source_type === 'life') return '惊喜盒子';
  if (item.source_type === 'game_record') return '游玩记录';
  return '游戏通关';
}

function filterEntries(entries: MemoirEntry[], filter: AppFilter): MemoirEntry[] {
  switch (filter) {
    case 'game': return entries.filter((e) => e.source_type === 'game' || e.source_type === 'game_record');
    case 'box': return entries.filter((e) => e.source_type === 'life');
    case 'okr':
    case 'habit':
      return []; // OKR/habit don't have memoir list entries
    default: return entries;
  }
}

export default function MemoirScreen() {
  const [entries, setEntries] = useState<MemoirEntry[]>([]);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<AppFilter>('all');

  // Selected date detail
  const [okrActivities, setOkrActivities] = useState<GlobalDayActivity[]>([]);
  const [habitLogs, setHabitLogs] = useState<(HabitLog & { habit_name: string; habit_icon: string })[]>([]);
  const [dateEntries, setDateEntries] = useState<MemoirEntry[]>([]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const refresh = useCallback(async () => {
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const [memoirDates, okrDates, habitDates] = await Promise.all([
      listMemoirDates(appFilter === 'game' ? 'game' : appFilter === 'box' ? 'box' : undefined),
      getAllOKRActivityDates(monthStr),
      getHabitLogDates(monthStr),
    ]);

    let merged: string[];
    switch (appFilter) {
      case 'game':
        merged = memoirDates;
        break;
      case 'okr':
        merged = okrDates;
        break;
      case 'habit':
        merged = habitDates;
        break;
      case 'box':
        merged = memoirDates;
        break;
      default:
        merged = Array.from(new Set([...memoirDates, ...okrDates, ...habitDates])).sort();
    }
    setAllDates(merged.filter((date) => date.startsWith(monthStr)));

    if (selectedDate) {
      setDateEntries(await listMemoirByDate(selectedDate));
      setOkrActivities(await getAllOKRDayActivities(selectedDate));
      setHabitLogs(await getHabitLogsWithHabit(selectedDate));
    } else {
      const allEntries = await listMemoir();
      setEntries(filterEntries(allEntries, appFilter));
    }
  }, [currentYear, currentMonth, selectedDate, appFilter]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentYear, currentMonth + offset, 1));
    setSelectedDate(null);
  };
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(todayStr); };

  const selectDate = async (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setOkrActivities([]);
      setHabitLogs([]);
      setDateEntries([]);
      setEntries(filterEntries(await listMemoir(), appFilter));
    } else {
      setSelectedDate(dateStr);
      setDateEntries(await listMemoirByDate(dateStr));
      setOkrActivities(await getAllOKRDayActivities(dateStr));
      setHabitLogs(await getHabitLogsWithHabit(dateStr));
    }
  };

  const handleDeleteHabitLog = (logId: number, name: string) => {
    Alert.alert('删除记录', `确定删除「${name}」的打卡记录吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteHabitLog(logId);
          refresh();
        },
      },
    ]);
  };

  const handleDeleteOKRActivity = (keyResultId: number, title: string) => {
    if (!selectedDate) return;
    Alert.alert('删除记录', `确定删除「${title}」在 ${selectedDate} 的活动记录吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteOKRActivityLog(keyResultId, selectedDate);
          refresh();
        },
      },
    ]);
  };

  const handleDelete = (item: MemoirEntry) => {
    const consequence = item.source_type === 'game_record'
      ? '\n删除后，本次时长也会从游戏累计时长中扣除。'
      : item.source_type === 'game' ? '\n游戏状态将恢复为“在玩”。' : '';
    Alert.alert('删除记录', `确定从回忆录中删除「${item.title}」吗？${consequence}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const id = parseInt(item.key.split('-')[1]);
          if (item.source_type === 'life') {
            await deleteArchivedItem(id);
          } else if (item.source_type === 'game_record') {
            await deleteRecord(id);
          } else {
            await unclearGame(id);
          }
          refresh();
        },
      },
    ]);
  };

  // Group OKR activities by objective
  const groupedObjectives = okrActivities.reduce(
    (acc, act) => {
      const key = act.objective_id;
      if (!acc[key]) acc[key] = { title: act.objective_title, activities: [] };
      acc[key].activities.push(act);
      return acc;
    },
    {} as Record<number, { title: string; activities: GlobalDayActivity[] }>
  );

  // Calendar grid
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const dateSet = new Set(allDates);
  const todayStr = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const visibleDateEntries = dateEntries.filter((item) => {
    if (appFilter === 'game') return item.source_type === 'game' || item.source_type === 'game_record';
    if (appFilter === 'box') return item.source_type === 'life';
    return appFilter === 'all';
  });
  const showOKR = appFilter === 'all' || appFilter === 'okr';
  const showHabit = appFilter === 'all' || appFilter === 'habit';
  const selectedRecordCount = visibleDateEntries.length + (showHabit ? habitLogs.length : 0) + (showOKR ? okrActivities.length : 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* App Filter Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
        {APP_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, appFilter === f.key && styles.filterChipActive]}
            onPress={() => setAppFilter(f.key)}
          >
            <Text style={[styles.filterChipText, appFilter === f.key && styles.filterChipTextActive]}>
              {f.icon} {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Calendar */}
      <View style={styles.calendar}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={() => changeMonth(-1)}>
            <Text style={styles.navBtn}>◀</Text>
          </Pressable>
          <Pressable onPress={goToday}><Text style={styles.monthTitle}>
            {currentYear}年{currentMonth + 1}月
          </Text><Text style={styles.todayShortcut}>回到今天</Text></Pressable>
          <Pressable onPress={() => changeMonth(1)}>
            <Text style={styles.navBtn}>▶</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={styles.weekdayText}>{d}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((day, i) => {
            if (day === null) return <View key={i} style={styles.dayCell} />;
            const dateStr = formatDate(currentYear, currentMonth, day);
            const hasEntry = dateSet.has(dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === todayStr;

            return (
              <Pressable
                key={i}
                style={[styles.dayCell, isSelected && styles.daySelected, isToday && !isSelected && styles.dayToday]}
                onPress={() => selectDate(dateStr)}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected, isToday && !isSelected && styles.dayTextToday]}>
                  {day}
                </Text>
                {hasEntry ? <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.overviewRow}>
        <View><Text style={styles.overviewValue}>{dateSet.size}</Text><Text style={styles.overviewLabel}>本月有记录</Text></View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewText}><Text style={styles.overviewTitle}>{selectedDate ? formatDayHeading(selectedDate) : '生活时间线'}</Text><Text style={styles.overviewSub}>{selectedDate ? `共 ${selectedRecordCount} 条动态` : '选择日历日期查看当天详情'}</Text></View>
        {selectedDate && <Pressable style={styles.clearButton} onPress={() => selectDate(selectedDate)}><Text style={styles.clearFilter}>查看全部</Text></Pressable>}
      </View>

      {/* Selected date: 今日目标 + 今日记录 */}
      {selectedDate ? (
        <View>
          {/* 今日目标 */}
          {showOKR && Object.keys(groupedObjectives).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 今日目标</Text>
              {Object.values(groupedObjectives).map((obj, idx) => (
                <View key={idx} style={styles.objCard}>
                  <Text style={styles.objCardTitle}>{obj.title}</Text>
                  {obj.activities.map((act) => (
                    <Pressable key={act.key_result_id} style={styles.krRow} onLongPress={() => handleDeleteOKRActivity(act.key_result_id, act.title)}>
                      <Text style={styles.krTitle} numberOfLines={1}>{act.title}</Text>
                      <Text style={styles.krProgress}>
                        {act.task_type === 'progress'
                          ? `${act.activity_amount >= 0 ? '+' : ''}${act.activity_amount}${act.unit ? ' ' + act.unit : ''}`
                          : act.repeat_mode === 1
                          ? `${act.activity_count} 次`
                          : '✓ 已完成'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* 今日记录 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 今日记录</Text>

            {/* Habit check-ins */}
            {showHabit && habitLogs.length > 0 &&
              habitLogs.map((log) => (
                <Pressable key={log.id} onLongPress={() => handleDeleteHabitLog(log.id, log.habit_name)}>
                  <View style={styles.recordCard}>
                    <Text style={styles.recordIcon}>{log.habit_icon}</Text>
                    <View style={styles.recordMain}>
                      <Text style={styles.recordTitle}>{log.habit_name}</Text>
                      <Text style={styles.recordSub}>习惯打卡</Text>
                    </View>
                  </View>
                </Pressable>
              ))}

            {/* Memoir entries */}
            {visibleDateEntries.map((item) => (
                <Pressable key={item.key} onLongPress={() => handleDelete(item)}>
                  <View style={styles.recordCard}>
                    <Text style={styles.recordIcon}>{item.source_type === 'life' ? '🎯' : item.source_type === 'game_record' ? '🕹️' : '🎮'}</Text>
                    <View style={styles.recordMain}>
                      <Text style={styles.recordTitle}>{item.title}</Text>
                      <View style={styles.recordMetaRow}><Text style={styles.recordType}>{entryTypeLabel(item)}</Text>{formatEntryTime(item.date) && <Text style={styles.recordTime}>{formatEntryTime(item.date)}</Text>}</View>
                      {item.rating != null && (
                        <Text style={styles.recordSub}>⭐ {item.rating.toFixed(1)}</Text>
                      )}
                      {item.note ? <Text style={styles.recordNote} numberOfLines={2}>{item.note}</Text> : null}
                    </View>
                  </View>
                </Pressable>
              ))}

            {selectedRecordCount === 0 && <View style={styles.emptyCard}><Text style={styles.emptyIcon}>○</Text><Text style={styles.empty}>这一天没有此类记录</Text></View>}
          </View>
        </View>
      ) : (
        /* Full memoir list */
        <View style={styles.section}>
          {entries.map((item, index) => (
            <View key={item.key}>
              {(index === 0 || entryDateKey(entries[index - 1].date) !== entryDateKey(item.date)) && <View style={styles.timelineDay}><View style={styles.timelineDot}/><Text style={styles.timelineDayText}>{formatDayHeading(item.date)}</Text></View>}
            <Pressable onLongPress={() => handleDelete(item)}>
              <View style={styles.recordCard}>
                <Text style={styles.recordIcon}>{item.source_type === 'life' ? '🎯' : item.source_type === 'game_record' ? '🕹️' : '🎮'}</Text>
                <View style={styles.recordMain}>
                  <Text style={styles.recordTitle}>{item.title}</Text>
                  <View style={styles.recordMetaRow}><Text style={styles.recordType}>{entryTypeLabel(item)}</Text>{formatEntryTime(item.date) && <Text style={styles.recordTime}>{formatEntryTime(item.date)}</Text>}</View>
                  {item.rating != null && (
                    <Text style={styles.recordSub}>⭐ {item.rating.toFixed(1)}</Text>
                  )}
                  {item.note ? <Text style={styles.recordNote} numberOfLines={2}>{item.note}</Text> : null}
                </View>
              </View>
            </Pressable>
            </View>
          ))}
          {entries.length === 0 && (
            <Text style={styles.empty}>
              {appFilter === 'okr' || appFilter === 'habit'
                ? '该应用的数据只在日历中展示\n请在上方日历中选择日期查看'
                : appFilter === 'game'
                  ? '还没有游戏回忆\n游玩或通关一款游戏后会自动出现'
                  : appFilter === 'box'
                    ? '还没有惊喜盒子记录\n去盲盒里「✅ 搞定了」一些事情吧！'
                    : '回忆录还是空的。{"\n"}去盲盒里「✅ 搞定了」，或通关一款游戏吧！'}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Filter bar
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
    gap: 7,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.subtext,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  // Calendar
  calendar: {
    backgroundColor: colors.card,
    marginHorizontal: 14,
    marginTop: 9,
    marginBottom: 8,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navBtn: { fontSize: 15, color: colors.orange, paddingHorizontal: 12, paddingVertical: 5 },
  monthTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  todayShortcut: { fontSize: 9, color: colors.orange, textAlign: 'center', marginTop: 2 },
  weekdayRow: { flexDirection: 'row', marginBottom: 5 },
  weekdayText: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.subtext, fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  dayTextToday: { color: colors.orange, fontWeight: '700' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayToday: { backgroundColor: colors.bg, borderRadius: 999 },
  daySelected: { backgroundColor: colors.orange, borderRadius: 999 },
  dayDot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.orange },
  dayDotSelected: { backgroundColor: '#fff' },
  // Date header
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dateHeaderText: { fontSize: 15, fontWeight: '700', color: colors.text },
  clearFilter: { fontSize: 14, color: colors.orange, fontWeight: '600' },
  overviewRow: { marginHorizontal: 14, marginBottom: 5, padding: 12, borderRadius: 16, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryMuted, flexDirection: 'row', alignItems: 'center' },
  overviewValue: { fontSize: 20, fontWeight: '800', color: colors.orangeDark, textAlign: 'center' },
  overviewLabel: { fontSize: 9, color: colors.subtext, marginTop: 2 },
  overviewDivider: { width: 1, height: 34, backgroundColor: colors.primaryMuted, marginHorizontal: 12 },
  overviewText: { flex: 1 },
  overviewTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  overviewSub: { fontSize: 10, color: colors.subtext, marginTop: 3 },
  clearButton: { paddingHorizontal: 8, paddingVertical: 6 },
  // Sections
  section: { paddingHorizontal: 14, paddingTop: 8, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 1 },
  // Objective cards (今日目标)
  objCard: {
    backgroundColor: colors.card,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  objCardTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  krRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  krTitle: { flex: 1, fontSize: 13, color: colors.subtext, marginRight: 8 },
  krProgress: { fontSize: 12, fontWeight: '600', color: colors.orange },
  // Record cards (今日记录 / 全部)
  recordCard: {
    backgroundColor: colors.card,
    borderRadius: 15,
    padding: 13,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  recordIcon: { fontSize: 22, marginRight: 11 },
  recordMain: { flex: 1, gap: 3 },
  recordTitle: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 19 },
  recordMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordType: { fontSize: 10, color: colors.orangeDark, fontWeight: '700', backgroundColor: colors.primarySoft, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  recordTime: { fontSize: 10, color: colors.subtext },
  recordSub: { fontSize: 12, color: colors.orangeDark, fontWeight: '500' },
  recordNote: { fontSize: 13, color: colors.subtext, lineHeight: 18, marginTop: 2 },
  recordDate: { fontSize: 11, color: colors.subtext, marginTop: 4 },
  timelineDay: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 1, paddingLeft: 3 },
  timelineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange, marginRight: 7 },
  timelineDayText: { fontSize: 12, fontWeight: '800', color: colors.text },
  emptyCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', padding: 26 },
  emptyIcon: { fontSize: 25, color: colors.primaryMuted },
  // Empty
  empty: {
    textAlign: 'center',
    color: colors.subtext,
    marginTop: 24,
    lineHeight: 22,
    fontSize: 14,
  },
});
