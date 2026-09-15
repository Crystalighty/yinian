import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import {
  OKRKeyResult,
  addKeyResult,
  addKRElapsed,
  deleteKeyResult,
  completeKRPermanently,
  postponeKR,
  getObjective,
  getOKRActivityCounts,
  incrementKR,
  listKeyResults,
  listSubKeyResults,
  syncAllKRForObjective,
  toggleKRRepeat,
  toggleKRToday,
  updateKRProgress,
  updateKRSortOrder,
  updateKRTarget,
  updateKeyResult,
  updateObjective,
  updateObjectiveStatus,
  calcTaskQuantity,
  calcTaskDone,
  addKRProgressRecord,
} from '../db/database';
import { formatElapsed } from '../utils/gameTimer';
import { colors } from '../theme';
import DateTimePicker from '@react-native-community/datetimepicker';

type RootStackParamList = {
  OKRList: undefined;
  OKRDetail: { objectiveId: number; objectiveTitle: string };
};

export default function OKRDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'OKRDetail'>>();
  const navigation = useNavigation();
  const { objectiveId, objectiveTitle } = route.params;

  const [title, setTitle] = useState(objectiveTitle);
  const [objStatus, setObjStatus] = useState<'active' | 'paused' | 'completed'>('active');
  const [objectiveEndDate, setObjectiveEndDate] = useState<string | null>(null);
  const [keyResults, setKeyResults] = useState<OKRKeyResult[]>([]);
  const [subTasks, setSubTasks] = useState<Record<number, OKRKeyResult[]>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [addVisible, setAddVisible] = useState(false);
  const [sortMode, setSortMode] = useState<'default' | 'name' | 'progress'>('default');
  // Custom action sheet state (Android Alert.alert caps at 3 buttons, so multi-option menus use a Modal)
  const [actionSheet, setActionSheet] = useState<{ title: string; subtitle?: string; options: { text: string; danger?: boolean; onPress: () => void }[] } | null>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<'tasks' | 'trends'>('tasks');

  // Trends / heatmap
  const [heatRange, setHeatRange] = useState<'week' | 'month' | 'year'>('month');
  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});

  // Task timer
  const [timerKRId, setTimerKRId] = useState<number | null>(null);
  const [timerStart, setTimerStart] = useState<number>(0);
  const [timerElapsed, setTimerElapsed] = useState<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Add task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskRepeat, setTaskRepeat] = useState(false);
  const [taskTarget, setTaskTarget] = useState('');
  const [taskUnit, setTaskUnit] = useState('');

  // Edit repeat target
  const [editTargetKR, setEditTargetKR] = useState<OKRKeyResult | null>(null);
  const [editTargetVal, setEditTargetVal] = useState('');
  const [progressKR, setProgressKR] = useState<OKRKeyResult | null>(null);
  const [progressDate, setProgressDate] = useState(new Date());
  const [progressSign, setProgressSign] = useState<1 | -1>(1);
  const [progressAmount, setProgressAmount] = useState('1');
  const [showProgressDatePicker, setShowProgressDatePicker] = useState(false);



  const refresh = useCallback(async () => {
    await syncAllKRForObjective(objectiveId);
    const obj = await getObjective(objectiveId);
    if (obj) {
      setTitle(obj.title);
      setObjStatus(obj.status as 'active' | 'paused' | 'completed');
      setObjectiveEndDate(obj.end_date);
    }
    const krs = await listKeyResults(objectiveId);
    setKeyResults(krs);
    // Load the task tree up to three levels (root + child + grandchild).
    const subMap: Record<number, OKRKeyResult[]> = {};
    // Subtask done-check (mirrors isKRDone): repeat tasks compare to target, others need value >= 1
    const isSubDone = (kr: OKRKeyResult) =>
      kr.repeat_mode === 1 ? kr.current_value >= kr.target_value : kr.current_value >= 1;
    const loadChildren = async (parents: OKRKeyResult[], level: number): Promise<void> => {
      if (level >= 3) return;
      for (const parent of parents) {
        const subs = await listSubKeyResults(parent.id);
        if (subs.length > 0) {
          // Incomplete subtasks first, completed last (stable sort keeps original order within each group)
          subMap[parent.id] = [...subs].sort((a, b) => Number(isSubDone(a)) - Number(isSubDone(b)));
          await loadChildren(subs, level + 1);
        }
      }
    };
    await loadChildren(krs, 1);
    setSubTasks(subMap);
  }, [objectiveId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Progress calculation
  const overallProgress = (() => {
    const allTasks = [...keyResults, ...Object.values(subTasks).flat()];
    const rootKrs = keyResults.filter((kr) => kr.parent_id === null);
    if (rootKrs.length === 0) return 0;

    let totalQuantity = 0;
    let totalDone = 0;
    for (const kr of rootKrs) {
      const quantity = calcTaskQuantity(kr, allTasks);
      const done = calcTaskDone(kr, allTasks);
      totalQuantity += quantity;
      totalDone += Math.min(done, quantity);
    }
    return totalQuantity > 0 ? Math.round((totalDone / totalQuantity) * 100) : 0;
  })();

  const allTaskCount = keyResults.length + Object.values(subTasks).reduce((sum, tasks) => sum + tasks.length, 0);
  const allTasks = [...keyResults, ...Object.values(subTasks).flat()];
  const krDoneCount = allTasks.filter((kr) => {
    const quantity = calcTaskQuantity(kr, allTasks);
    const done = calcTaskDone(kr, allTasks);
    return done >= quantity && quantity > 0;
  }).length;

  const isKRDone = (kr: OKRKeyResult) => {
    if (kr.task_type === 'progress') return kr.current_value >= kr.target_value;
    if (kr.repeat_mode === 1) return kr.current_value >= kr.target_value;
    return kr.current_value >= 1;
  };

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const handleToggleToday = async (kr: OKRKeyResult) => { await toggleKRToday(kr.id, today); await refresh(); };

  // Sort tasks based on sortMode
  const sortTasks = (tasks: OKRKeyResult[]) => {
    const sorted = [...tasks];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    } else if (sortMode === 'progress') {
      sorted.sort((a, b) => {
        const pa = a.target_value > 0 ? a.current_value / a.target_value : 0;
        const pb = b.target_value > 0 ? b.current_value / b.target_value : 0;
        return pb - pa;
      });
    }
    return sorted;
  };

  const incompleteTasks = sortTasks(keyResults.filter((kr) => !isKRDone(kr)));
  const completedTasks = sortTasks(keyResults.filter((kr) => isKRDone(kr)));

  const isInactive = objStatus === 'paused' || objStatus === 'completed';

  const deadlineInfo = (() => {
    if (!objectiveEndDate) return null;
    const end = new Date(`${objectiveEndDate}T00:00:00`);
    const nowDate = new Date();
    const todayDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const days = Math.round((end.getTime() - todayDate.getTime()) / 86400000);
    if (!Number.isFinite(days)) return null;
    if (days > 0) return { text: `剩余 ${days} 天`, overdue: false };
    if (days === 0) return { text: '今天截止', overdue: false };
    return { text: `已逾期 ${Math.abs(days)} 天`, overdue: true };
  })();

  // Cycle sort mode
  const cycleSortMode = () => {
    const modes: ('default' | 'name' | 'progress')[] = ['default', 'name', 'progress'];
    const idx = modes.indexOf(sortMode);
    setSortMode(modes[(idx + 1) % modes.length]);
  };

  const sortModeLabel = { default: '默认', name: '名称', progress: '进度' }[sortMode];

  // Move task up/down in sort order
  const moveTask = async (kr: OKRKeyResult, direction: -1 | 1) => {
    const idx = keyResults.findIndex((k) => k.id === kr.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= keyResults.length) return;
    const other = keyResults[newIdx];
    await updateKRSortOrder(kr.id, other.sort_order);
    await updateKRSortOrder(other.id, kr.sort_order);
    refresh();
  };

  // Objective actions
  const handlePauseResume = async () => {
    const newStatus = objStatus === 'paused' ? 'active' : 'paused';
    await updateObjectiveStatus(objectiveId, newStatus);
    setObjStatus(newStatus);
  };

  const handleComplete = async () => {
    Alert.alert('完成目标', `确定将「${title}」标记为已完成吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          await updateObjectiveStatus(objectiveId, 'completed');
          setObjStatus('completed');
        },
      },
    ]);
  };

  const handleDeleteObjective = async () => {
    Alert.alert('删除目标', `确定删除「${title}」及其所有任务吗？此操作不可恢复！`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const { deleteObjectiveOKR } = await import('../db/database');
          await deleteObjectiveOKR(objectiveId);
          navigation.goBack();
        },
      },
    ]);
  };

  // Top +1 button: increment first incomplete repeat task, or complete first normal task
  const handleTopIncrement = async () => {
    const firstProgress = incompleteTasks.find((kr) => kr.task_type === 'progress');
    if (firstProgress) {
      openProgressRecord(firstProgress);
      return;
    }
    const firstRepeat = incompleteTasks.find((kr) => kr.repeat_mode === 1);
    if (firstRepeat) {
      await incrementKR(firstRepeat.id);
      refresh();
      return;
    }
    const firstNormal = incompleteTasks.find((kr) => kr.repeat_mode !== 1);
    if (firstNormal) {
      await updateKRProgress(firstNormal.id, 1);
      refresh();
    }
  };

  const handleTopDecrement = async () => {
    const candidates = [...keyResults].reverse();
    const task = candidates.find((kr) => Number(kr.current_value) > 0);
    if (!task) return;
    if (task.task_type === 'progress') {
      openProgressRecord(task, -1);
      return;
    }
    await updateKRProgress(task.id, Math.max(0, Number(task.current_value) - 1));
    await refresh();
  };

  // Add task → navigate to dedicated form
  const openAddTask = () => {
    (navigation as any).navigate('OKRTaskForm', { objectiveId });
  };

  const handleAddTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('提示', '任务名称不能为空');
      return;
    }
    const target = taskRepeat ? (parseFloat(taskTarget) || 1) : 1;
    await addKeyResult(objectiveId, taskTitle.trim(), target, taskUnit, null, null, taskRepeat ? 1 : 0);
    setAddVisible(false);
    refresh();
  };

  // Toggle task expansion
  const toggleExpand = (krId: number) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(krId)) {
        next.delete(krId);
      } else {
        next.add(krId);
      }
      return next;
    });
  };

  // Add subtask
  const openAddSubTask = (parentId: number, parentLevel: number) => {
    if (parentLevel >= 3) {
      Alert.alert('最多支持 3 级任务', '第 3 级任务不能继续添加子任务');
      return;
    }
    // Navigate to OKRTaskForm with parentId
    (navigation as any).navigate('OKRTaskForm', { objectiveId, parentId });
  };

  // Edit objective
  const openEditObj = () => {
    (navigation as any).navigate('OKRForm', { objectiveId });
  };

  // Custom action sheet opener (unlimited options, works on Android & iOS)
  const openActionSheet = (
    sheetTitle: string,
    subtitle: string | undefined,
    options: { text: string; danger?: boolean; onPress: () => void }[]
  ) => {
    setActionSheet({ title: sheetTitle, subtitle, options });
  };

  // Objective actions menu (grouped under ⋯ at the card's top-right)
  const openObjMenu = () => {
    const options: { text: string; danger?: boolean; onPress: () => void }[] = [
      { text: '✏️ 编辑目标', onPress: openEditObj },
      { text: objStatus === 'paused' ? '▶️ 继续目标' : '⏸ 暂停目标', onPress: handlePauseResume },
    ];
    if (objStatus !== 'completed') {
      options.push({ text: '✅ 完成目标', onPress: handleComplete });
    }
    options.push({ text: '🗑️ 删除目标', danger: true, onPress: handleDeleteObjective });
    openActionSheet('目标操作', title, options);
  };



  // Edit task → navigate to dedicated form
  const openEditTask = (kr: OKRKeyResult) => {
    (navigation as any).navigate('OKRTaskForm', { objectiveId, taskId: kr.id });
  };

  // Edit repeat target
  const handleSaveTarget = async () => {
    if (!editTargetKR) return;
    const tv = parseFloat(editTargetVal);
    if (isNaN(tv) || tv <= 0) {
      Alert.alert('提示', '请输入有效的重复次数');
      return;
    }
    await updateKRTarget(editTargetKR.id, tv);
    setEditTargetKR(null);
    refresh();
  };

  // Delete task
  const confirmDeleteKR = (kr: OKRKeyResult) => {
    Alert.alert('删除任务', `确定删除「${kr.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteKeyResult(kr.id);
          refresh();
        },
      },
    ]);
  };

  // Permanently complete task
  const confirmCompletePermanently = (kr: OKRKeyResult) => {
    Alert.alert('永久完成', `将「${kr.title}」标记为永久完成？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          await completeKRPermanently(kr.id);
          refresh();
        },
      },
    ]);
  };

  // Postpone task by one day
  const confirmPostponeKR = (kr: OKRKeyResult) => {
    Alert.alert('顺延一天', `将「${kr.title}」推迟一天？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          await postponeKR(kr.id);
          refresh();
        },
      },
    ]);
  };

  const toggleTaskComplete = async (kr: OKRKeyResult) => {
    if (kr.repeat_mode === 1 || kr.task_type === 'progress') return;
    await updateKRProgress(kr.id, isKRDone(kr) ? 0 : 1);
    refresh();
  };

  const openProgressRecord = (kr: OKRKeyResult, sign: 1 | -1 = 1) => {
    setProgressKR(kr);
    setProgressDate(new Date());
    setProgressSign(sign);
    setProgressAmount('1');
    setShowProgressDatePicker(false);
  };

  const saveProgressRecord = async () => {
    if (!progressKR) return;
    const amount = Number(progressAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('提示', '请输入大于 0 的进度值');
      return;
    }
    const date = `${progressDate.getFullYear()}-${String(progressDate.getMonth() + 1).padStart(2, '0')}-${String(progressDate.getDate()).padStart(2, '0')}`;
    try {
      await addKRProgressRecord(progressKR.id, date, progressSign * amount);
      setProgressKR(null);
      await refresh();
    } catch (error) {
      Alert.alert('无法添加进度', error instanceof Error ? error.message : '请稍后再试');
    }
  };

  // Timer functions
  const handleStartTimer = (krId: number) => {
    // Stop existing timer first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const now = Date.now();
    setTimerKRId(krId);
    setTimerStart(now);
    setTimerElapsed(0);
    timerIntervalRef.current = setInterval(() => {
      setTimerElapsed(Math.floor((Date.now() - now) / 1000));
    }, 1000);
  };

  const handleStopTimer = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timerKRId && timerElapsed > 0) {
      await addKRElapsed(timerKRId, timerElapsed);
      refresh();
    }
    setTimerKRId(null);
    setTimerStart(0);
    setTimerElapsed(0);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Load heatmap data
  const loadHeatmap = useCallback(async () => {
    const now = new Date();
    let startDate: string;
    let endDate: string;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (heatRange === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      startDate = fmt(start);
      endDate = fmt(now);
    } else if (heatRange === 'month') {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      startDate = fmt(start);
      endDate = fmt(now);
    } else {
      const start = new Date(now);
      start.setDate(start.getDate() - 364);
      startDate = fmt(start);
      endDate = fmt(now);
    }
    const counts = await getOKRActivityCounts(objectiveId, startDate, endDate);
    setActivityCounts(counts);
  }, [objectiveId, heatRange]);

  useEffect(() => {
    if (activeTab === 'trends') {
      loadHeatmap();
    }
  }, [activeTab, loadHeatmap]);

  const renderSubTask = (task: OKRKeyResult, level: 2 | 3): React.ReactNode => {
    const children = subTasks[task.id] || [];
    const expanded = expandedTasks.has(task.id);
    const done = isKRDone(task);
    const childDone = children.filter(isKRDone).length;
    const isProgress = task.task_type === 'progress';

    return (
      <View key={task.id} style={[styles.subtaskBranch, level === 3 && styles.subtaskBranchLevel3]}>
        <View style={styles.subtaskRow}>
          <Pressable
            accessibilityLabel={isProgress ? '添加进度记录' : done ? '标记为未完成' : '标记为完成'}
            accessibilityRole="button"
            style={[styles.subCheckbox, isProgress && styles.progressAddButton, !isProgress && done && styles.subCheckboxDone]}
            onPress={() => isProgress ? openProgressRecord(task) : toggleTaskComplete(task)}
          >
            <Text style={[styles.subCheckboxText, isProgress && styles.progressAddText]}>{isProgress ? '+' : done ? '✓' : ''}</Text>
          </Pressable>
          <View style={styles.subtaskContent}>
            <Text style={[styles.subName, done && styles.subNameDone]} numberOfLines={2}>{task.title}</Text>
            <View style={styles.subtaskMeta}>
              {children.length > 0 && <Text style={styles.subtaskCount}>⌘ {childDone}/{children.length}</Text>}
              {level < 3 && (
                <Pressable onPress={() => openAddSubTask(task.id, level)} hitSlop={8}>
                  <Text style={styles.inlineAddSub}>＋ 子任务</Text>
                </Pressable>
              )}
            </View>
          </View>
          {children.length > 0 && (
            <Pressable style={styles.treeExpandBtn} onPress={() => toggleExpand(task.id)} hitSlop={10}>
              <Text style={[styles.treeExpandIcon, expanded && styles.treeExpandIconOpen]}>⌄</Text>
            </Pressable>
          )}
          <Pressable onPress={() => openActionSheet('子任务操作', task.title, [
            { text: task.today_date === today ? '移出今天' : '＋ 加入今天', onPress: () => handleToggleToday(task) },
            { text: '✏️ 编辑任务', onPress: () => openEditTask(task) },
            { text: '🗑️ 删除任务', danger: true, onPress: () => confirmDeleteKR(task) },
          ])} hitSlop={8}>
            <Text style={styles.taskMoreBtn}>⋯</Text>
          </Pressable>
        </View>
        {expanded && children.length > 0 && (
          <View style={styles.nestedChildren}>
            {children.map((child) => renderSubTask(child, 3))}
          </View>
        )}
      </View>
    );
  };

  // Render a root task card with an expandable task tree.
  const renderTask = (kr: OKRKeyResult) => {
    const isProgress = kr.task_type === 'progress';
    const isRepeat = kr.repeat_mode === 1 && !isProgress;
    const done = isKRDone(kr);
    const subs = subTasks[kr.id] || [];
    const isExpanded = expandedTasks.has(kr.id);
    const subDoneCount = subs.filter((s) => s.current_value >= 1).length;

    const handleIncrement = async () => {
      await incrementKR(kr.id);
      refresh();
    };

    const handleToggleRepeat = async () => {
      const newVal = isRepeat ? 0 : 1;
      await toggleKRRepeat(kr.id, newVal);
      await refresh();
      if (newVal === 1) {
        setEditTargetKR(kr);
        setEditTargetVal(String(kr.target_value === 1 ? 10 : kr.target_value));
      }
    };

    return (
      <View key={kr.id} style={styles.taskCard}>
        {/* Parent task row */}
        <View style={styles.taskRow}>
          <Pressable
            accessibilityLabel={isProgress ? '添加进度记录' : done ? '标记为未完成' : '标记为完成'}
            style={[styles.taskCheckbox, isProgress && styles.progressAddButton, !isProgress && done && styles.taskCheckboxDone]}
            onPress={() => isProgress ? openProgressRecord(kr) : toggleTaskComplete(kr)}
          >
            <Text style={[styles.taskCheckboxText, isProgress && styles.progressAddText]}>{isProgress ? '+' : done ? '✓' : ''}</Text>
          </Pressable>
          <View style={styles.taskContent}>
            <View style={styles.taskTitleRow}>
              <Text style={[styles.taskName, done && styles.taskNameDone]} numberOfLines={2}>
                {kr.title}
              </Text>
            </View>
            {/* Progress bar for repeat tasks */}
            {(isRepeat || isProgress) && kr.target_value > 0 && (
              <View style={styles.taskProgressBar}>
                <View
                  style={[
                    styles.taskProgressFill,
                    done && styles.taskProgressFillDone,
                    { width: `${Math.min(100, (kr.current_value / kr.target_value) * 100)}%` },
                  ]}
                />
              </View>
            )}
            {(isRepeat || isProgress) ? (
              <View style={styles.taskMetaRow}>
                {isRepeat && <Pressable onPress={handleToggleRepeat}><Text style={styles.repeatIcon}>🔁</Text></Pressable>}
                {isProgress && <Text style={styles.progressTypeLabel}>累计进度</Text>}
                <Pressable onPress={() => { setEditTargetKR(kr); setEditTargetVal(String(kr.target_value)); }}>
                  <Text style={styles.taskCount}>
                    <Text style={styles.taskCountCurrent}>{kr.current_value}</Text>
                    <Text style={styles.taskCountTotal}> / {kr.target_value}{kr.unit ? ` ${kr.unit}` : ''}</Text>
                  </Text>
                </Pressable>
                {subs.length > 0 && (
                  <Text style={styles.subtaskCount}>
                     {subDoneCount}/{subs.length}
                  </Text>
                )}
                {/* Date display for repeat tasks */}
                {kr.start_date && kr.end_date && (
                  <Text style={styles.taskDate}>
                    📅 {kr.start_date.slice(5)}~{kr.end_date.slice(5)}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.taskMetaRow}>
                {subs.length > 0 ? (
                  <Text style={styles.subtaskCount}>
                    🔗 {subDoneCount}/{subs.length} 子任务
                  </Text>
                ) : (
                  <Text style={styles.taskStatus}>{done ? '已完成' : '未完成'}</Text>
                )}
                <Pressable onPress={() => openAddSubTask(kr.id, 1)}>
                  <Text style={styles.addSubBtn}>＋ 子任务</Text>
                </Pressable>
              </View>
            )}
          </View>
          {isRepeat && (
            <Pressable
              style={[styles.plusBtn, done && styles.plusBtnDone]}
              onPress={handleIncrement}
              disabled={done}
            >
              <Text style={[styles.plusBtnText, done && styles.plusBtnTextDone]}>+1</Text>
            </Pressable>
          )}
          {/* More actions menu: edit / complete / postpone / delete grouped here to keep the task name roomy */}
          <Pressable
            onPress={() => {
              openActionSheet('更多操作', `「${kr.title}」`, [
                { text: '✏️ 编辑任务', onPress: () => openEditTask(kr) },
                { text: '✅ 永久完成', onPress: () => confirmCompletePermanently(kr) },
                { text: '⏭ 顺延一天', onPress: () => confirmPostponeKR(kr) },
                { text: '🗑️ 删除任务', danger: true, onPress: () => confirmDeleteKR(kr) },
              ]);
            }}
            hitSlop={8}
          >
            <Text style={styles.taskMoreBtn}>⋯</Text>
          </Pressable>
          {subs.length > 0 && (
            <Pressable style={styles.treeExpandBtn} onPress={() => toggleExpand(kr.id)} hitSlop={10}>
              <Text style={[styles.treeExpandIcon, isExpanded && styles.treeExpandIconOpen]}>⌄</Text>
            </Pressable>
          )}
        </View>

        {/* Timer row */}
        <View style={styles.timerRow}>
          <Pressable
            style={[styles.timerBtn, timerKRId === kr.id && styles.timerBtnActive]}
            onPress={() => timerKRId === kr.id ? handleStopTimer() : handleStartTimer(kr.id)}
          >
            <Text style={[styles.timerBtnIcon, timerKRId === kr.id && styles.timerBtnIconActive]}>
              {timerKRId === kr.id ? '⏹' : '⏱'}
            </Text>
            <Text style={[styles.timerBtnText, timerKRId === kr.id && styles.timerBtnTextActive]}>
              {timerKRId === kr.id ? formatElapsed(timerElapsed) : '计时'}
            </Text>
          </Pressable>
          {(kr.elapsed_seconds > 0 || timerKRId === kr.id) && (
            <Text style={styles.timerTotal}>
              累计 {formatElapsed((kr.elapsed_seconds || 0) + (timerKRId === kr.id ? timerElapsed : 0))}
            </Text>
          )}
          <Pressable style={[styles.todayBtn, styles.todayBtnInActionRow, kr.today_date === today && styles.todayBtnActive]} onPress={() => handleToggleToday(kr)} hitSlop={8}>
            <Text style={[styles.todayBtnText, kr.today_date === today && styles.todayBtnTextActive]}>{kr.today_date === today ? '✓ 今天' : '＋ 今天'}</Text>
          </Pressable>
        </View>

        {/* Subtasks */}
        {isExpanded && subs.length > 0 && (
          <View style={styles.subtaskList}>{subs.map((sub) => renderSubTask(sub, 2))}</View>
        )}
      </View>
    );
  };

  const allDone = incompleteTasks.length === 0 && keyResults.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header: progress + action button */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            {objStatus === 'paused' && <Text style={styles.statusBadge}>⏸ 已暂停</Text>}
            {objStatus === 'completed' && <Text style={[styles.statusBadge, styles.statusBadgeCompleted]}>✅ 已完成</Text>}
            <Pressable style={styles.objMoreBtn} onPress={openObjMenu} hitSlop={8}>
              <Text style={styles.objMoreIcon}>⋯</Text>
            </Pressable>
          </View>

          {objectiveEndDate && deadlineInfo && (
            <View style={styles.deadlineRow}>
              <Text style={styles.deadlineDate}>截止 {objectiveEndDate.replace(/-/g, '.')}</Text>
              <View style={[styles.deadlineBadge, deadlineInfo.overdue && styles.deadlineBadgeOverdue]}><Text style={[styles.deadlineText, deadlineInfo.overdue && styles.deadlineTextOverdue]}>{deadlineInfo.text}</Text></View>
            </View>
          )}

          <View style={styles.progressSection}>
            <View style={styles.progressLabel}>
              <Text style={styles.progressPercent}>{overallProgress}%</Text>
              <Text style={styles.progressSub}>{krDoneCount}/{allTaskCount} 任务已完成</Text>
            </View>
            <View style={styles.progressBarRow}>
              <Pressable
                accessibilityLabel="减少一点目标进度"
                style={[styles.progressStepBtn, (isInactive || overallProgress <= 0) && styles.progressStepBtnDisabled]}
                onPress={handleTopDecrement}
                disabled={isInactive || overallProgress <= 0}
                hitSlop={6}
              >
                <Text style={[styles.progressStepText, (isInactive || overallProgress <= 0) && styles.progressStepTextDisabled]}>－</Text>
              </Pressable>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, allDone && styles.progressFillDone, { width: `${overallProgress}%` }]} />
              </View>
              <Pressable
                accessibilityLabel="增加一点目标进度"
                style={[styles.progressStepBtn, (allDone || isInactive) && styles.progressStepBtnDisabled]}
                onPress={handleTopIncrement}
                disabled={allDone || isInactive}
                hitSlop={6}
              >
                <Text style={[styles.progressStepText, (allDone || isInactive) && styles.progressStepTextDisabled]}>＋</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabItem, activeTab === 'tasks' && styles.tabItemActive]}
            onPress={() => setActiveTab('tasks')}
          >
            <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>任务</Text>
          </Pressable>
          <Pressable
            style={[styles.tabItem, activeTab === 'trends' && styles.tabItemActive]}
            onPress={() => setActiveTab('trends')}
          >
            <Text style={[styles.tabText, activeTab === 'trends' && styles.tabTextActive]}>趋势</Text>
          </Pressable>
        </View>

        {activeTab === 'tasks' && (
          <>
        {/* Add task button + sort */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>未完成任务（{incompleteTasks.length}）</Text>
          <View style={styles.sectionActions}>
            <Pressable onPress={cycleSortMode}>
              <Text style={styles.sortBtn}>排序: {sortModeLabel}</Text>
            </Pressable>
            <Pressable onPress={openAddTask}>
              <Text style={styles.addBtn}>＋ 新任务</Text>
            </Pressable>
          </View>
        </View>

        {incompleteTasks.length === 0 && keyResults.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>还没有任务，点击上方添加</Text>
          </View>
        ) : incompleteTasks.length === 0 ? null : (
          incompleteTasks.map(renderTask)
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>已结束（{completedTasks.length}）</Text>
            </View>
            {completedTasks.map(renderTask)}
          </>
        )}
          </>
        )}

        {activeTab === 'trends' && (
          <View style={styles.trendsSection}>
            {/* Range toggle */}
            <View style={styles.rangeToggle}>
              {(['week', 'month', 'year'] as const).map((r) => (
                <Pressable
                  key={r}
                  style={[styles.rangeBtn, heatRange === r && styles.rangeBtnActive]}
                  onPress={() => setHeatRange(r)}
                >
                  <Text style={[styles.rangeBtnText, heatRange === r && styles.rangeBtnTextActive]}>
                    {r === 'week' ? '周' : r === 'month' ? '月' : '年'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Heatmap */}
            <View style={styles.heatmapContainer}>
              {(() => {
                const now = new Date();
                const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                let days: number;
                let cols: number;
                if (heatRange === 'week') { days = 7; cols = 7; }
                else if (heatRange === 'month') { days = 30; cols = 10; }
                else { days = 365; cols = 53; }
                const cells: { date: string; count: number }[] = [];
                for (let i = days - 1; i >= 0; i--) {
                  const d = new Date(now);
                  d.setDate(d.getDate() - i);
                  const dateStr = fmt(d);
                  cells.push({ date: dateStr, count: activityCounts[dateStr] || 0 });
                }
                const maxCount = Math.max(1, ...cells.map((c) => c.count));
                const rows: typeof cells[] = [];
                for (let i = 0; i < cells.length; i += cols) {
                  rows.push(cells.slice(i, i + cols));
                }
                return rows.map((row, ri) => (
                  <View key={ri} style={styles.heatmapRow}>
                    {row.map((cell, ci) => {
                      const intensity = cell.count === 0 ? 0 : Math.ceil((cell.count / maxCount) * 4);
                      const bgColors = [colors.bg, colors.orange + '30', colors.orange + '60', colors.orange + '90', colors.orange];
                      return (
                        <View
                          key={ci}
                          style={[styles.heatCell, { backgroundColor: bgColors[intensity] }]}
                        />
                      );
                    })}
                  </View>
                ));
              })()}
            </View>

            {/* Legend */}
            <View style={styles.heatLegend}>
              <Text style={styles.heatLegendText}>少</Text>
              {[0, 1, 2, 3, 4].map((i) => {
                const bgColors = [colors.bg, colors.orange + '30', colors.orange + '60', colors.orange + '90', colors.orange];
                return <View key={i} style={[styles.heatLegendCell, { backgroundColor: bgColors[i] }]} />;
              })}
              <Text style={styles.heatLegendText}>多</Text>
            </View>

            {/* Stats summary */}
            <View style={styles.trendStats}>
              {(() => {
                const values = Object.values(activityCounts);
                const total = values.reduce((a, b) => a + b, 0);
                const activeDays = values.filter((v) => v > 0).length;
                const days = heatRange === 'week' ? 7 : heatRange === 'month' ? 30 : 365;
                return (
                  <>
                    <View style={styles.trendStatCard}>
                      <Text style={styles.trendStatValue}>{total}</Text>
                      <Text style={styles.trendStatLabel}>总完成次数</Text>
                    </View>
                    <View style={styles.trendStatCard}>
                      <Text style={styles.trendStatValue}>{activeDays}</Text>
                      <Text style={styles.trendStatLabel}>活跃天数</Text>
                    </View>
                    <View style={styles.trendStatCard}>
                      <Text style={styles.trendStatValue}>{days > 0 ? Math.round((activeDays / days) * 100) : 0}%</Text>
                      <Text style={styles.trendStatLabel}>活跃率</Text>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={addVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.form}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>新增任务</Text>
              <Pressable onPress={() => setAddVisible(false)}>
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.formInput}
              placeholder="任务名称"
              value={taskTitle}
              onChangeText={setTaskTitle}
            />
            {/* Type toggle */}
            <View style={styles.typeToggle}>
              <Pressable
                style={[styles.typeBtn, !taskRepeat && styles.typeBtnActive]}
                onPress={() => setTaskRepeat(false)}
              >
                <Text style={[styles.typeBtnText, !taskRepeat && styles.typeBtnTextActive]}>普通任务</Text>
              </Pressable>
              <Pressable
                style={[styles.typeBtn, taskRepeat && styles.typeBtnActive]}
                onPress={() => setTaskRepeat(true)}
              >
                <Text style={[styles.typeBtnText, taskRepeat && styles.typeBtnTextActive]}>重复任务</Text>
              </Pressable>
            </View>
            {taskRepeat && (
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.formInput, styles.formInputShort]}
                  placeholder="重复次数"
                  value={taskTarget}
                  onChangeText={setTaskTarget}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.formInput, styles.formInputShort]}
                  placeholder="单位（可选）"
                  value={taskUnit}
                  onChangeText={setTaskUnit}
                />
              </View>
            )}
            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAddTask}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Repeat Target Modal */}
      <Modal visible={!!editTargetKR} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.form}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>设置重复次数</Text>
              <Pressable onPress={() => setEditTargetKR(null)}>
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.editHint}>{editTargetKR?.title}</Text>
            <TextInput
              style={styles.formInput}
              placeholder="重复次数"
              value={editTargetVal}
              onChangeText={setEditTargetVal}
              keyboardType="decimal-pad"
            />
            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditTargetKR(null)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveTarget}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Progress tasks use repeatable signed records instead of a checkbox. */}
      <Modal visible={!!progressKR} transparent animationType="slide" onRequestClose={() => setProgressKR(null)}>
        <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.form}>
            <View style={styles.formHeader}>
              <View style={styles.progressModalHeading}><Text style={styles.formTitle}>添加进度记录</Text><Text style={styles.editHint} numberOfLines={1}>{progressKR?.title}</Text></View>
              <Pressable onPress={() => setProgressKR(null)}><Text style={styles.closeBtn}>×</Text></Pressable>
            </View>

            <Text style={styles.fieldLabel}>日期</Text>
            <Pressable style={styles.dateField} onPress={() => setShowProgressDatePicker(true)}>
              <Text style={styles.dateFieldText}>{progressDate.getFullYear()}年{progressDate.getMonth() + 1}月{progressDate.getDate()}日</Text><Text style={styles.dateFieldIcon}>📅</Text>
            </Pressable>
            {showProgressDatePicker && <DateTimePicker value={progressDate} mode="date" display={Platform.OS === 'ios' ? 'compact' : 'default'} onChange={(_event: unknown, date?: Date) => { setShowProgressDatePicker(false); if (date) setProgressDate(date); }} />}

            <Text style={styles.fieldLabel}>符号</Text>
            <View style={styles.signToggle}>
              <Pressable style={[styles.signButton, progressSign === 1 && styles.signButtonActive]} onPress={() => setProgressSign(1)}><Text style={[styles.signButtonText, progressSign === 1 && styles.signButtonTextActive]}>＋ 正数</Text></Pressable>
              <Pressable style={[styles.signButton, progressSign === -1 && styles.signButtonNegative]} onPress={() => setProgressSign(-1)}><Text style={[styles.signButtonText, progressSign === -1 && styles.signButtonNegativeText]}>－ 负数</Text></Pressable>
            </View>

            <Text style={styles.fieldLabel}>进度增加值</Text>
            <View style={styles.amountRow}><Text style={[styles.amountSign, progressSign === -1 && styles.amountSignNegative]}>{progressSign === 1 ? '+' : '−'}</Text><TextInput style={[styles.formInput, styles.amountInput]} value={progressAmount} onChangeText={setProgressAmount} keyboardType="decimal-pad" selectTextOnFocus /></View>
            <Text style={styles.progressPreview}>当前 {progressKR?.current_value ?? 0} / {progressKR?.target_value ?? 0}{progressKR?.unit ? ` ${progressKR.unit}` : ''} · 本次 {progressSign === 1 ? '+' : '−'}{progressAmount || '0'}</Text>

            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setProgressKR(null)}><Text style={styles.cancelBtnText}>取消</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={saveProgressRecord}><Text style={styles.saveBtnText}>添加记录</Text></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom action sheet (replaces Alert.alert, which caps at 3 buttons on Android) */}
      <Modal visible={!!actionSheet} transparent animationType="fade" onRequestClose={() => setActionSheet(null)}>
        <Pressable style={styles.sheetMask} onPress={() => setActionSheet(null)}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{actionSheet?.title}</Text>
            {!!actionSheet?.subtitle && (
              <Text style={styles.sheetSubtitle} numberOfLines={2}>{actionSheet.subtitle}</Text>
            )}
            {actionSheet?.options.map((opt, idx) => (
              <Pressable
                key={idx}
                style={styles.sheetOption}
                onPress={() => {
                  setActionSheet(null);
                  opt.onPress();
                }}
              >
                <Text style={[styles.sheetOptionText, opt.danger && styles.sheetOptionDanger]}>{opt.text}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.sheetOption, styles.sheetCancel]} onPress={() => setActionSheet(null)}>
              <Text style={styles.sheetCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 13, paddingTop: 11, paddingBottom: 32 },
  // Action sheet (custom menu replacing Alert.alert)
  sheetMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  sheetCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 6,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: 12,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.subtext,
    textAlign: 'center',
    paddingBottom: 10,
  },
  sheetOption: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sheetOptionDanger: { color: colors.danger },
  sheetCancel: { marginTop: 4 },
  sheetCancelText: { fontSize: 15, fontWeight: '700', color: colors.subtext },
  // Header card
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 12,
    elevation: 1,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 24 },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.orange,
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  statusBadgeCompleted: { color: colors.accent, backgroundColor: colors.accent + '12' },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7, gap: 7 },
  deadlineDate: { fontSize: 10, color: colors.subtext },
  deadlineBadge: { backgroundColor: colors.primarySoft, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  deadlineBadgeOverdue: { backgroundColor: '#FAEEEE' },
  deadlineText: { fontSize: 10, fontWeight: '700', color: colors.orangeDark },
  deadlineTextOverdue: { color: colors.danger },
  // Progress section
  progressSection: { marginTop: 10 },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressPercent: { fontSize: 24, fontWeight: '800', color: colors.orange },
  progressSub: { fontSize: 11, color: colors.subtext },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.orange,
    borderRadius: 4,
  },
  progressFillDone: { backgroundColor: colors.accent },
  // Progress bar row with -/+ step buttons beside the bar
  progressBarRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 9 },
  progressStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepBtnDisabled: { backgroundColor: colors.bg, borderColor: colors.border, opacity: 0.5 },
  progressStepText: { color: colors.orangeDark, fontSize: 18, fontWeight: '700', lineHeight: 21 },
  progressStepTextDisabled: { color: colors.subtext },
  // Objective more-actions button (top-right corner of the card)
  objMoreBtn: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2 },
  objMoreIcon: { fontSize: 22, fontWeight: '700', color: colors.subtext, lineHeight: 26 },
  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 17,
    marginBottom: 7,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  sectionActions: { flexDirection: 'row', gap: 7 },
  sortBtn: { fontSize: 10, color: colors.subtext, fontWeight: '600', backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  addBtn: { fontSize: 11, color: '#fff', fontWeight: '800', backgroundColor: colors.orange, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  // Empty
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyText: { fontSize: 14, color: colors.subtext, textAlign: 'center' },
  // Task card + subtask styles
  taskCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 7,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.025,
    shadowRadius: 6,
    elevation: 1,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  taskCheckbox: {
    width: 27,
    height: 27,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskCheckboxDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  taskCheckboxText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  progressAddButton: { borderColor: colors.orange, backgroundColor: colors.primarySoft, borderRadius: 999 },
  progressAddText: { color: colors.orangeDark, fontSize: 20, lineHeight: 21, fontWeight: '600' },
  taskContent: { flex: 1 },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 19 },
  taskNameDone: { textDecorationLine: 'line-through', color: colors.subtext },
  taskProgressBar: {
    height: 4,
    backgroundColor: colors.bg,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  taskProgressFill: {
    height: '100%',
    backgroundColor: colors.orange,
    borderRadius: 2,
  },
  taskProgressFillDone: { backgroundColor: colors.accent },
  expandBtn: { padding: 4 },
  expandIcon: { fontSize: 14, color: colors.subtext, fontWeight: '600' },
  treeExpandBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  treeExpandIcon: { fontSize: 22, color: colors.subtext, fontWeight: '700', transform: [{ rotate: '-90deg' }] },
  treeExpandIconOpen: { transform: [{ rotate: '0deg' }] },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 3,
  },
  repeatIcon: { fontSize: 16 },
  progressTypeLabel: { fontSize: 10, color: colors.orangeDark, fontWeight: '700', backgroundColor: colors.primarySoft, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden' },
  taskCount: { flexDirection: 'row', alignItems: 'baseline' },
  taskCountCurrent: { fontSize: 14, fontWeight: '700', color: colors.orange },
  taskCountTotal: { fontSize: 10, color: colors.subtext },
  subtaskCount: { fontSize: 10, color: colors.subtext },
  addSubBtn: { fontSize: 10, color: colors.orange, fontWeight: '700' },
  taskStatus: { fontSize: 10, color: colors.subtext },
  taskDate: { fontSize: 11, color: colors.subtext, marginLeft: 'auto' },
  plusBtn: {
    backgroundColor: colors.orange,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 48,
    alignItems: 'center',
    flexShrink: 0,
  },
  plusBtnDone: { backgroundColor: colors.accent },
  plusBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  plusBtnTextDone: { color: '#fff' },
  taskMoreBtn: { fontSize: 17, paddingHorizontal: 3, paddingVertical: 2, flexShrink: 0, color: colors.subtext },
  // Timer row
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: colors.bg,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  timerBtnActive: {
    backgroundColor: colors.orange + '18',
  },
  timerBtnIcon: { fontSize: 14 },
  timerBtnIconActive: { color: colors.orange },
  timerBtnText: { fontSize: 12, color: colors.subtext, fontWeight: '500' },
  timerBtnTextActive: { color: colors.orange, fontWeight: '700' },
  timerTotal: { fontSize: 12, color: colors.subtext },
  todayBtn: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.surfaceMuted, marginLeft: 2 },
  todayBtnInActionRow: { marginLeft: 'auto' },
  todayBtnActive: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryMuted },
  todayBtnText: { fontSize: 10, color: colors.subtext, fontWeight: '700' },
  todayBtnTextActive: { color: colors.orangeDark },
  // Subtask styles
  subtaskList: {
    marginTop: 9,
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  subtaskBranch: { paddingVertical: 2 },
  subtaskBranchLevel3: { paddingVertical: 2 },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
  },
  subtaskContent: { flex: 1 },
  subtaskMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  inlineAddSub: { fontSize: 11, color: colors.orange, fontWeight: '700' },
  nestedChildren: { marginLeft: 11, paddingLeft: 13, borderLeftWidth: 1.5, borderLeftColor: colors.border },
  subCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subCheckboxDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  subCheckboxText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  subName: { fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 17 },
  subNameDone: { textDecorationLine: 'line-through', color: colors.subtext },
  subDelete: { fontSize: 18, color: colors.subtext, padding: 4, flexShrink: 0 },
  subEdit: { fontSize: 14, padding: 4, flexShrink: 0 },
  // Add task modal
  typeToggle: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  typeBtnActive: { backgroundColor: colors.orange + '18' },
  typeBtnText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  typeBtnTextActive: { color: colors.orange, fontWeight: '700' },
  // Edit hint
  editHint: { fontSize: 13, color: colors.subtext, marginBottom: 4 },
  // Form
  formRow: { flexDirection: 'row', gap: 10 },
  formInputShort: { flex: 1 },
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
  progressModalHeading: { flex: 1, minWidth: 0, paddingRight: 12 },
  fieldLabel: { fontSize: 12, color: colors.subtext, fontWeight: '700', marginTop: 2 },
  dateField: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateFieldText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  dateFieldIcon: { fontSize: 16 },
  signToggle: { flexDirection: 'row', gap: 8 },
  signButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  signButtonActive: { borderColor: colors.orange, backgroundColor: colors.primarySoft },
  signButtonNegative: { borderColor: colors.danger, backgroundColor: '#FAEEEE' },
  signButtonText: { fontSize: 13, color: colors.subtext, fontWeight: '700' },
  signButtonTextActive: { color: colors.orangeDark },
  signButtonNegativeText: { color: colors.danger },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  amountSign: { width: 42, height: 46, textAlign: 'center', textAlignVertical: 'center', borderRadius: 12, overflow: 'hidden', backgroundColor: colors.primarySoft, color: colors.orangeDark, fontSize: 24, fontWeight: '700' },
  amountSignNegative: { backgroundColor: '#FAEEEE', color: colors.danger },
  amountInput: { flex: 1, fontSize: 18, fontWeight: '700' },
  progressPreview: { fontSize: 11, lineHeight: 17, color: colors.subtext, backgroundColor: colors.surfaceMuted, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  levelHint: { fontSize: 11, color: colors.subtext, marginTop: 1 },
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
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabItemActive: { backgroundColor: colors.primarySoft },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.subtext },
  tabTextActive: { color: colors.orangeDark },
  // Trends / heatmap
  trendsSection: { marginTop: 16 },
  rangeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rangeBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  rangeBtnActive: { backgroundColor: colors.orange + '18' },
  rangeBtnText: { fontSize: 13, color: colors.subtext, fontWeight: '500' },
  rangeBtnTextActive: { color: colors.orange, fontWeight: '700' },
  heatmapContainer: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 3,
  },
  heatCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  heatLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 8,
  },
  heatLegendText: { fontSize: 11, color: colors.subtext },
  heatLegendCell: { width: 12, height: 12, borderRadius: 2 },
  trendStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  trendStatCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  trendStatValue: { fontSize: 20, fontWeight: '700', color: colors.orange },
  trendStatLabel: { fontSize: 11, color: colors.subtext, marginTop: 4 },
});
