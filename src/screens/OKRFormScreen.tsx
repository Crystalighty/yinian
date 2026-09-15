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
import {
  addOKRObjective,
  Box,
  GameItem,
  Habit,
  listBoxes,
  listAllGames,
  listHabits,
  getObjective,
  updateObjective,
} from '../db/database';
import { colors } from '../theme';
import DateTimePicker from '@react-native-community/datetimepicker';

function shiftDate(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type AppOption = { key: string; label: string };
const APP_OPTIONS: AppOption[] = [
  { key: 'game', label: '游戏殿堂' },
  { key: 'box', label: '惊喜盒子' },
  { key: 'habit', label: '习惯打卡' },
];

export default function OKRFormScreen() {
  const navigation = useNavigation();

  // Get objectiveId from route params (edit mode)
  const route = useRoute<any>();
  const { objectiveId } = route.params || {};
  const isEdit = !!objectiveId;

  // Form fields
  const [title, setTitle] = useState('');
  const [dateEnabled, setDateEnabled] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [notes, setNotes] = useState('');

  // Project linking
  const [projectEnabled, setProjectEnabled] = useState(false);
  const [appType, setAppType] = useState<string | null>(null);
  const [appIdOpen, setAppIdOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');

  // Data for dropdowns
  const [games, setGames] = useState<GameItem[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    listAllGames().then(setGames);
    listBoxes().then(setBoxes);
    listHabits().then(setHabits);

    // Load existing objective data if in edit mode
    if (objectiveId) {
      getObjective(objectiveId).then((obj) => {
        if (obj) {
          setTitle(obj.title);
          setDateEnabled(!!(obj.start_date && obj.end_date));
          if (obj.start_date) setStartDate(new Date(obj.start_date + 'T00:00:00'));
          if (obj.end_date) setEndDate(new Date(obj.end_date + 'T00:00:00'));
          setNotes(obj.notes || '');
          setProjectEnabled(!!(obj.project_type && obj.project_id));
          setAppType(obj.project_type);
          setSelectedItemId(obj.project_id);
        }
      });
    }
  }, [objectiveId]);

  const items: { id: number; name: string }[] = (() => {
    if (appType === 'game') return games.map((g) => ({ id: g.id, name: g.name }));
    if (appType === 'box') return boxes.map((b) => ({ id: b.id, name: b.name }));
    if (appType === 'habit') return habits.map((h) => ({ id: h.id, name: h.name }));
    return [];
  })();

  const filteredItems = searchText
    ? items.filter((i) => i.name.toLowerCase().includes(searchText.toLowerCase()))
    : items;

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '目标名称不能为空');
      return;
    }
    if (isEdit && objectiveId) {
      await updateObjective(objectiveId, title.trim(), {
        startDate: dateEnabled ? fmtDate(startDate) : null,
        endDate: dateEnabled ? fmtDate(endDate) : null,
        notes: notes.trim() || null,
        projectType: projectEnabled ? appType : null,
        projectId: projectEnabled ? selectedItemId : null,
      });
    } else {
      await addOKRObjective(title.trim(), {
        startDate: dateEnabled ? fmtDate(startDate) : null,
        endDate: dateEnabled ? fmtDate(endDate) : null,
        notes: notes.trim() || null,
        projectType: projectEnabled ? appType : null,
        projectId: projectEnabled ? selectedItemId : null,
      });
    }
    navigation.goBack();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: isEdit ? '编辑目标' : '新建目标',
      headerRight: () => (
        <Pressable onPress={handleSave}>
          <Text style={{ color: colors.orange, fontSize: 16, fontWeight: '600' }}>{isEdit ? '保存' : '完成'}</Text>
        </Pressable>
      ),
    });
  }, [title, dateEnabled, startDate, endDate, notes, projectEnabled, appType, selectedItemId, isEdit]);

  const handleSelectApp = (key: string) => {
    setAppType(key);
    setAppIdOpen(false);
    setSelectedItemId(null);
    setSearchText('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
        <View style={styles.formIntro}>
          <Text style={styles.formEyebrow}>{isEdit ? 'EDIT GOAL' : 'NEW GOAL'}</Text>
          <Text style={styles.formIntroTitle}>{isEdit ? '调整目标' : '从一个清晰目标开始'}</Text>
          <Text style={styles.formIntroText}>名称是必填项，其余信息可以稍后补充。</Text>
        </View>
        {/* Title */}
        <Text style={styles.label}>目标名称</Text>
        <TextInput
          style={styles.input}
          placeholder="输入目标名称…"
          value={title}
          onChangeText={setTitle}
          autoFocus
        />

        {/* Date toggle */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>目标日期</Text>
          <Switch
            value={dateEnabled}
            onValueChange={setDateEnabled}
            trackColor={{ false: colors.border, true: colors.orange + '60' }}
            thumbColor={dateEnabled ? colors.orange : colors.subtext}
          />
        </View>
        {dateEnabled && (
          <View style={styles.dateSection}>
            <Text style={styles.subLabel}>开始日期</Text>
            <Pressable style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.dateBtnText}>{fmtDate(startDate)}</Text>
              <Text style={styles.dateBtnIcon}>📅</Text>
            </Pressable>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                onChange={(_event: any, selectedDate?: Date) => {
                  setShowStartPicker(false);
                  if (selectedDate) setStartDate(selectedDate);
                }}
              />
            )}
            <Text style={styles.subLabel}>结束日期</Text>
            <Pressable style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.dateBtnText}>{fmtDate(endDate)}</Text>
              <Text style={styles.dateBtnIcon}>📅</Text>
            </Pressable>
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                onChange={(_event: any, selectedDate?: Date) => {
                  setShowEndPicker(false);
                  if (selectedDate) setEndDate(selectedDate);
                }}
              />
            )}
          </View>
        )}

        {/* Notes */}
        <Text style={styles.label}>备注</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="添加备注（可选）…"
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />

        {/* Project toggle */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>关联项目</Text>
          <Switch
            value={projectEnabled}
            onValueChange={(v) => {
              setProjectEnabled(v);
              if (!v) {
                setAppType(null);
                setSelectedItemId(null);
                setSearchText('');
              }
            }}
            trackColor={{ false: colors.border, true: colors.orange + '60' }}
            thumbColor={projectEnabled ? colors.orange : colors.subtext}
          />
        </View>
        {projectEnabled && (
          <View style={styles.projectSection}>
            {/* App selection dropdown */}
            <Text style={styles.subLabel}>应用选择</Text>
            <Pressable style={styles.dropdownBtn} onPress={() => setAppIdOpen(!appIdOpen)}>
              <Text style={styles.dropdownText}>
                {appType ? APP_OPTIONS.find((o) => o.key === appType)?.label : '请选择应用…'}
              </Text>
              <Text style={styles.dropdownArrow}>{appIdOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {appIdOpen && (
              <View style={styles.dropdownList}>
                {APP_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.key}
                    style={[styles.dropdownItem, appType === opt.key && styles.dropdownItemActive]}
                    onPress={() => handleSelectApp(opt.key)}
                  >
                    <Text style={[styles.dropdownItemText, appType === opt.key && styles.dropdownItemTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Item selection */}
            {appType && (
              <>
                <Text style={styles.subLabel}>选择项目</Text>
                <TextInput
                  style={styles.input}
                  placeholder="搜索…"
                  value={searchText}
                  onChangeText={setSearchText}
                />
                <View style={styles.itemList}>
                  {filteredItems.length === 0 ? (
                    <Text style={styles.emptyHint}>没有匹配的项目</Text>
                  ) : (
                    filteredItems.map((item) => (
                      <Pressable
                        key={item.id}
                        style={[styles.itemRow, selectedItemId === item.id && styles.itemRowActive]}
                        onPress={() => setSelectedItemId(selectedItemId === item.id ? null : item.id)}
                      >
                        <Text style={[styles.itemText, selectedItemId === item.id && styles.itemTextActive]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {selectedItemId === item.id && <Text style={styles.itemCheck}>✓</Text>}
                      </Pressable>
                    ))
                  )}
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110 },
  formIntro: { backgroundColor: colors.primarySoft, borderRadius: 20, padding: 18, marginBottom: 22, borderWidth: 1, borderColor: colors.primaryMuted },
  formEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: colors.orange, marginBottom: 6 },
  formIntroTitle: { fontSize: 21, fontWeight: '800', color: colors.text },
  formIntroText: { fontSize: 12, color: colors.orangeDark, marginTop: 6, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subLabel: { fontSize: 13, color: colors.subtext, marginBottom: 6, marginTop: 12, fontWeight: '500' },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  multilineInput: { minHeight: 80 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: colors.card,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Date section
  dateSection: { marginTop: 8, backgroundColor: colors.primarySoft, borderRadius: 16, padding: 14 },
  dateBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateBtnText: { fontSize: 15, color: colors.text },
  dateBtnIcon: { fontSize: 16 },
  dateAdjustRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dateAdjBtn: { backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dateAdjText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  // Project section
  projectSection: { marginTop: 8, backgroundColor: colors.primarySoft, borderRadius: 16, padding: 14 },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownText: { fontSize: 15, color: colors.text },
  dropdownArrow: { fontSize: 12, color: colors.subtext },
  dropdownList: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemActive: { backgroundColor: colors.orange + '15' },
  dropdownItemText: { fontSize: 14, color: colors.text },
  dropdownItemTextActive: { color: colors.orange, fontWeight: '600' },
  itemList: { marginTop: 8, gap: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemRowActive: { backgroundColor: colors.orange + '15' },
  itemText: { flex: 1, fontSize: 14, color: colors.text },
  itemTextActive: { color: colors.orange, fontWeight: '600' },
  itemCheck: { fontSize: 14, color: colors.orange, fontWeight: '700', marginLeft: 8 },
  emptyHint: { fontSize: 13, color: colors.subtext, textAlign: 'center', paddingVertical: 12 },
});
