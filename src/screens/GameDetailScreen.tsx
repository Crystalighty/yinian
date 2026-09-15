import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  GameItem,
  GameObjective,
  GameProgress,
  GameRecord,
  addObjective,
  addProgress,
  addRecord,
  deleteObjective,
  deleteProgress,
  deleteRecord,
  getGame,
  listObjectives,
  listProgress,
  listRecords,
  toggleObjectiveComplete,
  toggleProgressComplete,
  updateProgress,
  updatePlayTime,
  updateLastPlayed,
} from '../db/database';
import {
  formatElapsed,
  formatPlayTime,
  formatTimeRange,
  isTimerRunning,
  getTimerGameId,
  restoreTimer,
  startTimer,
  stopTimer,
} from '../utils/gameTimer';
import { colors } from '../theme';
import DateTimePicker from '@react-native-community/datetimepicker';

type RootStackParamList = {
  GameList: undefined;
  GameDetail: { gameId: number };
  GameForm: { gameId?: number } | undefined;
};

const STATUS_LABELS: Record<string, string> = {
  wish: '想玩',
  playing: '在玩',
  cleared: '已通关',
};

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  const clamped = Math.max(0, Math.min(rating, 5));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtTime(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function GameDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'GameDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { gameId } = route.params;
  const [game, setGame] = useState<GameItem | null>(null);
  const [progressList, setProgressList] = useState<GameProgress[]>([]);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskNote, setTaskNote] = useState('');
  const [recordContent, setRecordContent] = useState('');
  const [recordVisible, setRecordVisible] = useState(false);
  const [recordDate, setRecordDate] = useState(new Date());
  const [recordPickerMode, setRecordPickerMode] = useState<'date' | 'time' | null>(null);
  const [recordDuration, setRecordDuration] = useState('');
  const [timerRecord, setTimerRecord] = useState<{ seconds: number; playedAt: string; fallback: string } | null>(null);
  const [objectives, setObjectives] = useState<GameObjective[]>([]);
  const [addObjVisible, setAddObjVisible] = useState(false);
  const [objName, setObjName] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerForOther, setTimerForOther] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<'progress' | 'objective' | 'record'>('progress');
  const timerTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setGame(await getGame(gameId));
    setProgressList(await listProgress(gameId));
    setObjectives(await listObjectives(gameId));
    setRecords(await listRecords(gameId));
  }, [gameId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Timer management
  useEffect(() => {
    const init = async () => {
      if (!game) return;
      if (isTimerRunning()) {
        if (getTimerGameId() === gameId) {
          setTimerRunning(true);
          setElapsed(0);
          timerTickRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
        } else {
          setTimerForOther(true);
        }
      } else {
        const restored = await restoreTimer(game.name, async (secs, start, end) => {
          await handleStopResult(secs, start, end);
        });
        if (restored && getTimerGameId() === gameId) {
          setTimerRunning(true);
          setElapsed(0);
          timerTickRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
        }
      }
    };
    if (game) init();
    return () => {
      if (timerTickRef.current) clearInterval(timerTickRef.current);
    };
  }, [game?.id]);

  const handleStopResult = async (secs: number, startTime: string, endTime: string) => {
    if (secs >= 60) {
      const hours = (secs / 3600).toFixed(1);
      const timeRange = formatTimeRange(startTime, endTime);
      const playedAt = endTime.slice(0, 10);
      setTimerRecord({ seconds: secs, playedAt, fallback: `游玩 ${hours} 小时 · ${timeRange}` });
      setRecordContent('');
      setRecordDuration(hours);
      setRecordDate(new Date(endTime));
      setActiveTab('record');
      setRecordVisible(true);
    }
    await refresh();
  };

  const handleStartTimer = async () => {
    await startTimer(gameId, game!.name, async (secs, start, end) => {
      setTimerRunning(false);
      if (timerTickRef.current) clearInterval(timerTickRef.current);
      await handleStopResult(secs, start, end);
    });
    setTimerRunning(true);
    setTimerForOther(false);
    setElapsed(0);
    timerTickRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  };

  const handleStopTimer = async () => {
    const result = await stopTimer();
    setTimerRunning(false);
    if (timerTickRef.current) clearInterval(timerTickRef.current);
    if (result) {
      await handleStopResult(result.elapsedSeconds, result.startTime, result.endTime);
    }
  };

  const saveTask = async () => {
    if (!taskName.trim()) {
      Alert.alert('提示', '任务名称不能为空');
      return;
    }
    await addProgress(gameId, taskName.trim(), taskNote.trim() || null);
    setTaskName('');
    setTaskNote('');
    setAddVisible(false);
    refresh();
  };

  const confirmDeleteTask = (task: GameProgress) => {
    Alert.alert('删除任务', `确定删除「${task.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteProgress(task.id);
          refresh();
        },
      },
    ]);
  };

  const onToggleComplete = async (task: GameProgress) => {
    await toggleProgressComplete(task.id);
    refresh();
  };

  const onProgressChange = async (task: GameProgress, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      await updateProgress(task.id, num);
      refresh();
    }
  };

  const saveRecord = async () => {
    if (!recordContent.trim() && !timerRecord) {
      Alert.alert('提示', '记录内容不能为空');
      return;
    }
    // recordDate 对手动新增默认为当前时间，对计时器记录为精确结束时间，统一保存至时分
    const playedAt = fmtDateTime(recordDate);
    const durationHours = parseFloat(recordDuration) || 0;
    const durationSeconds = timerRecord?.seconds ?? Math.round(durationHours * 3600);
    await addRecord(gameId, recordContent.trim() || timerRecord!.fallback, {
      playedAt,
      durationSeconds,
    });
    setRecordContent('');
    setRecordDuration('');
    setRecordDate(new Date());
    setRecordVisible(false);
    setTimerRecord(null);
    refresh();
  };

  const closeRecordModal = async () => {
    if (timerRecord) {
      await addRecord(gameId, timerRecord.fallback, { playedAt: fmtDateTime(recordDate), durationSeconds: timerRecord.seconds });
      setTimerRecord(null);
      await refresh();
    }
    setRecordVisible(false); setRecordContent(''); setRecordDuration('');
  };

  const saveObjective = async () => {
    if (!objName.trim()) {
      Alert.alert('提示', '目标名称不能为空');
      return;
    }
    await addObjective(gameId, objName.trim());
    setObjName('');
    setAddObjVisible(false);
    refresh();
  };

  const onToggleObjective = async (obj: GameObjective) => {
    await toggleObjectiveComplete(obj.id);
    refresh();
  };

  const confirmDeleteObjective = (obj: GameObjective) => {
    Alert.alert('删除目标', `确定删除「${obj.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteObjective(obj.id);
          refresh();
        },
      },
    ]);
  };

  const confirmDeleteRecord = (record: GameRecord) => {
    Alert.alert('删除记录', '确定删除这条记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteRecord(record.id);
          refresh();
        },
      },
    ]);
  };

  const openEdit = () => {
    navigation.navigate('GameForm', { gameId });
  };

  if (!game) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>加载中…</Text>
      </View>
    );
  }

  return (
    <>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
      {/* Game summary */}
      <View style={styles.heroCard}>
        {game.image_uri ? (
          <Image source={{ uri: game.image_uri }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroText}>{game.name.slice(0, 1)}</Text>
          </View>
        )}
        <View style={styles.heroInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{game.name}</Text>
            <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]} onPress={openEdit}>
              <Text style={styles.editBtn}>编辑</Text>
            </Pressable>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.badge}><Text style={styles.badgeText}>{STATUS_LABELS[game.status] ?? game.status}</Text></View>
            <Text style={styles.platform} numberOfLines={1}>{game.platform.length > 0 ? game.platform.join(' · ') : '未选平台'}</Text>
          </View>
          {game.rating != null && game.rating > 0 ? (
            <View style={styles.ratingRow}><StarDisplay rating={game.rating} size={16} /><Text style={styles.ratingValue}>{game.rating.toFixed(1)}</Text></View>
          ) : <Text style={styles.noRating}>暂未评分</Text>}
          {game.tags && game.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {game.tags.slice(0, 4).map((t) => <View key={t} style={styles.tag}><Text style={styles.tagText}>#{t}</Text></View>)}
            </View>
          ) : null}
        </View>
      </View>

      {game.sharp_comment || game.comment ? (
        <View style={styles.reviewCard}>
          <View style={styles.reviewHeadingRow}>
            <View style={styles.reviewMark}><Text style={styles.reviewMarkText}>“</Text></View>
            <Text style={styles.reviewHeading}>我的评价</Text>
          </View>
          {game.sharp_comment ? <Text style={styles.sharpComment}>{game.sharp_comment}</Text> : null}
          {game.comment ? <Text style={styles.comment}>{game.comment}</Text> : null}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIconWrap}><Text style={styles.statIcon}>◷</Text></View>
          <View style={styles.statInfo}><Text style={styles.statLabel}>累计游玩</Text><Text style={styles.statValue}>{formatPlayTime(game.play_time ?? 0)}</Text></View>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconWrap}><Text style={styles.statIcon}>⌁</Text></View>
          <View style={styles.statInfo}><Text style={styles.statLabel}>最近游玩</Text><Text style={styles.statValue}>{game.last_played ? new Date(game.last_played).toISOString().slice(0, 10).replace(/-/g, '/') : '暂无记录'}</Text></View>
        </View>
      </View>

      {/* Timer */}
      <View style={styles.timerSection}>
        {timerRunning ? (
          <>
            <View><Text style={styles.timerCaption}>本次游戏</Text><Text style={styles.timerTime}>{formatElapsed(elapsed)}</Text></View>
            <Pressable style={styles.stopBtn} onPress={handleStopTimer}>
              <Text style={styles.stopBtnText}>■ 结束</Text>
            </Pressable>
          </>
        ) : timerForOther ? (
          <View style={styles.timerIdleInfo}><Text style={styles.timerIdleIcon}>◷</Text><View><Text style={styles.timerIdleTitle}>计时暂不可用</Text><Text style={styles.timerHint}>另一个游戏正在计时中</Text></View></View>
        ) : (
          <>
            <View style={styles.timerIdleInfo}><Text style={styles.timerIdleIcon}>◷</Text><View><Text style={styles.timerIdleTitle}>记录本次游玩</Text><Text style={styles.timerHint}>结束后自动累计时长</Text></View></View>
            <Pressable style={({ pressed }) => [styles.startBtn, pressed && styles.buttonPressed]} onPress={handleStartTimer}>
              <Text style={styles.startBtnText}>开始</Text>
            </Pressable>
          </>
        )}
      </View>

      
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'progress' as const, label: '进度', count: progressList.length },
          { key: 'objective' as const, label: '目标', count: objectives.length },
          { key: 'record' as const, label: '记录', count: records.length },
        ]).map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            <View style={[styles.tabCount, activeTab === tab.key && styles.tabCountActive]}><Text style={[styles.tabCountText, activeTab === tab.key && styles.tabCountTextActive]}>{tab.count}</Text></View>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'progress' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>进度任务</Text><Text style={styles.sectionSubtitle}>拆分流程，随时更新完成度</Text></View>
            <Pressable style={styles.addTaskButton} onPress={() => setAddVisible(true)}>
              <Text style={styles.addTaskBtn}>＋ 新增</Text>
            </Pressable>
          </View>
          {progressList.length === 0 ? (
            <Text style={styles.emptyTask}>还没有任务，点击上方添加</Text>
          ) : (
            progressList.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskTop}>
                  <Pressable
                    style={[styles.checkCircle, task.completed === 1 && styles.checkCircleDone]}
                    onPress={() => onToggleComplete(task)}
                  >
                    <Text style={styles.checkIcon}>
                      {task.completed === 1 ? '✓' : ''}
                    </Text>
                  </Pressable>
                  <Text
                    style={[
                      styles.taskName,
                      task.completed === 1 && styles.taskNameDone,
                    ]}
                    numberOfLines={1}
                  >
                    {task.name}
                  </Text>
                  <Pressable onPress={() => confirmDeleteTask(task)}>
                    <Text style={styles.taskDelete}>🗑️</Text>
                  </Pressable>
                </View>
                <View style={styles.progressRow}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${task.progress}%` },
                        task.completed === 1 && styles.progressFillDone,
                      ]}
                    />
                  </View>
                  <TextInput
                    style={styles.progressInput}
                    value={String(task.progress)}
                    onChangeText={(v) => onProgressChange(task, v)}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.progressUnit}>%</Text>
                </View>
                {task.note ? <Text style={styles.taskNote}>{task.note}</Text> : null}
              </View>
            ))
          )}
        </View>
      )}

      {activeTab === 'objective' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>游戏目标</Text><Text style={styles.sectionSubtitle}>记录想达成的里程碑</Text></View>
            <Pressable style={styles.addTaskButton} onPress={() => setAddObjVisible(true)}>
              <Text style={styles.addTaskBtn}>＋ 新增</Text>
            </Pressable>
          </View>
          {objectives.length === 0 ? (
            <Text style={styles.emptyTask}>还没有目标，点击上方添加</Text>
          ) : (
            objectives.map((obj) => (
              <View key={obj.id} style={styles.taskCard}>
                <View style={styles.taskTop}>
                  <Pressable
                    style={[styles.checkCircle, obj.completed === 1 && styles.checkCircleDone]}
                    onPress={() => onToggleObjective(obj)}
                  >
                    <Text style={styles.checkIcon}>
                      {obj.completed === 1 ? '✓' : ''}
                    </Text>
                  </Pressable>
                  <Text
                    style={[
                      styles.taskName,
                      obj.completed === 1 && styles.taskNameDone,
                    ]}
                    numberOfLines={1}
                  >
                    {obj.name}
                  </Text>
                  <Pressable onPress={() => confirmDeleteObjective(obj)}>
                    <Text style={styles.taskDelete}>🗑️</Text>
                  </Pressable>
                </View>
                {obj.completed === 1 && obj.completed_at ? (
                  <Text style={styles.objCompletedAt}>
                    ✅ 完成于 {formatDateTime(obj.completed_at)}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}

      {activeTab === 'record' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>游玩记录</Text><Text style={styles.sectionSubtitle}>留下每一次游玩的片段</Text></View>
            <Pressable style={styles.addTaskButton} onPress={() => { setRecordDate(new Date()); setRecordVisible(true); }}>
              <Text style={styles.addTaskBtn}>＋ 新增</Text>
            </Pressable>
          </View>
          {records.length === 0 ? (
            <Text style={styles.emptyTask}>还没有记录，点击上方添加</Text>
          ) : (
            <View style={styles.timeline}>
              {records.map((record, index) => (
                <View key={record.id} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  {index < records.length - 1 ? <View style={styles.timelineLine} /> : null}
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineTop}>
                      <Text style={styles.timelineDate}>
                        {record.played_at ? record.played_at.replace(/-/g, '/') : formatDateTime(record.created_at)}
                      </Text>
                      {record.duration > 0 ? (
                        <Text style={styles.timelineDuration}>
                          {record.duration >= 3600
                            ? `${(record.duration / 3600).toFixed(1)}小时`
                            : `${Math.round(record.duration / 60)}分钟`}
                        </Text>
                      ) : null}
                      <Pressable onPress={() => confirmDeleteRecord(record)}>
                        <Text style={styles.taskDelete}>🗑️</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.timelineContent}>{record.content}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.dateFooter}>
        <Text style={styles.dateText}>添加于 {new Date(game.created_at).toLocaleDateString()}</Text>
        <Text style={styles.dateDot}>·</Text>
        <Text style={styles.dateText}>更新于 {new Date(game.updated_at).toLocaleDateString()}</Text>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>

    <Modal visible={addVisible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>新增进度任务</Text>
            <Pressable
              onPress={() => {
                setAddVisible(false);
                setTaskName('');
                setTaskNote('');
              }}
            >
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.formInput}
            placeholder="任务名称（必填）"
            value={taskName}
            onChangeText={setTaskName}
          />
          <TextInput
            style={styles.formInput}
            placeholder="备注/攻略提示（选填）"
            value={taskNote}
            onChangeText={setTaskNote}
            multiline
          />
          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => {
                setAddVisible(false);
                setTaskName('');
                setTaskNote('');
              }}
            >
              <Text style={styles.cancelBtnText}>取消</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={saveTask}>
              <Text style={styles.saveBtnText}>保存</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={addObjVisible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>新增目标任务</Text>
            <Pressable
              onPress={() => {
                setAddObjVisible(false);
                setObjName('');
              }}
            >
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.formInput}
            placeholder="目标名称（必填）"
            value={objName}
            onChangeText={setObjName}
          />
          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => {
                setAddObjVisible(false);
                setObjName('');
              }}
            >
              <Text style={styles.cancelBtnText}>取消</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={saveObjective}>
              <Text style={styles.saveBtnText}>保存</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={recordVisible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{timerRecord ? '记录本次游玩' : '新增游戏记录'}</Text>
            <Pressable
              onPress={closeRecordModal}
            >
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder={timerRecord ? '这次玩到哪里了？有什么感受？（可跳过）' : '记录你的游戏心得…'}
            value={recordContent}
            onChangeText={setRecordContent}
            multiline
          />
          {/* Date & Time picker */}
          <Text style={styles.formLabel}>游玩时间（默认当前时间，可修改）</Text>
          <View style={styles.dateTimeRow}>
            <Pressable style={[styles.formDateBtn, styles.dateTimeBtn]} onPress={() => setRecordPickerMode('date')}>
              <Text style={styles.formDateText}>{fmtDate(recordDate)}</Text>
              <Text style={styles.formDateIcon}>📅</Text>
            </Pressable>
            <Pressable style={[styles.formDateBtn, styles.dateTimeBtn]} onPress={() => setRecordPickerMode('time')}>
              <Text style={styles.formDateText}>{fmtTime(recordDate)}</Text>
              <Text style={styles.formDateIcon}>🕐</Text>
            </Pressable>
          </View>
          {recordPickerMode && (
            <DateTimePicker
              value={recordDate}
              mode={recordPickerMode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event: any, selectedDate?: Date) => {
                const mode = recordPickerMode;
                setRecordPickerMode(null);
                if (selectedDate) {
                  const merged = new Date(recordDate);
                  if (mode === 'date') {
                    merged.setFullYear(selectedDate.getFullYear());
                    merged.setMonth(selectedDate.getMonth());
                    merged.setDate(selectedDate.getDate());
                  } else {
                    merged.setHours(selectedDate.getHours());
                    merged.setMinutes(selectedDate.getMinutes());
                  }
                  setRecordDate(merged);
                }
              }}
            />
          )}
          {/* Duration input */}
          <Text style={styles.formLabel}>游戏时长（小时）</Text>
          <TextInput
            style={styles.formInput}
            placeholder="如 1.5"
            value={recordDuration}
            onChangeText={setRecordDuration}
            keyboardType="decimal-pad"
          />
          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={closeRecordModal}
            >
              <Text style={styles.cancelBtnText}>{timerRecord ? '跳过心得' : '取消'}</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={saveRecord}>
              <Text style={styles.saveBtnText}>保存</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, alignItems: 'center' },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 60 },
  heroCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 13,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 14,
    elevation: 1,
  },
  heroImage: {
    width: 104,
    height: 140,
    borderRadius: 16,
  },
  heroPlaceholder: {
    width: 104,
    height: 140,
    borderRadius: 16,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { fontSize: 48, fontWeight: '800', color: colors.text },
  heroInfo: { flex: 1, minWidth: 0, paddingLeft: 14, paddingVertical: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  editButton: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  editBtn: { fontSize: 11, color: colors.orangeDark, fontWeight: '800' },
  buttonPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  name: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: colors.orange,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  platform: { flexShrink: 1, fontSize: 12, color: colors.subtext },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11 },
  ratingValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  noRating: { color: colors.subtext, fontSize: 12, marginTop: 11 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 12 },
  tag: {
    backgroundColor: colors.amber,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: { fontSize: 10, color: colors.orangeDark, fontWeight: '600' },
  statsRow: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 10 },
  statCard: { flex: 1, minHeight: 76, backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border },
  statIconWrap: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  statIcon: { fontSize: 19, color: colors.orangeDark },
  statInfo: { flex: 1, minWidth: 0 },
  statValue: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  statLabel: { color: colors.subtext, fontSize: 10 },
  section: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 3,
  },
  sectionSubtitle: { fontSize: 11, color: colors.subtext, marginTop: 3 },
  reviewCard: { width: '100%', borderRadius: 18, padding: 16, marginTop: 10, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryMuted },
  reviewHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reviewMark: { width: 26, height: 26, borderRadius: 9, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  reviewMarkText: { color: colors.orangeDark, fontSize: 20, fontWeight: '800', lineHeight: 24 },
  reviewHeading: { color: colors.orangeDark, fontSize: 12, fontWeight: '800' },
  comment: { fontSize: 13, color: colors.orangeDark, lineHeight: 21, marginTop: 8 },
  dateFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' },
  dateDot: { color: colors.border, marginHorizontal: 8 },
  dateText: { fontSize: 13, color: colors.subtext, marginTop: 4 },
  tabBar: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 4,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  tabItem: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  tabItemActive: { backgroundColor: colors.orange },
  tabText: { color: colors.subtext, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabCountText: { color: colors.subtext, fontSize: 10, fontWeight: '800' },
  tabCountTextActive: { color: '#fff' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addTaskButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  addTaskBtn: { fontSize: 12, color: colors.orangeDark, fontWeight: '800' },
  emptyTask: { fontSize: 13, color: colors.subtext, textAlign: 'center', paddingVertical: 25 },
  taskCard: {
    backgroundColor: colors.bg,
    borderRadius: 17,
    padding: 14,
    marginTop: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkCircle: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  checkIcon: { fontSize: 12, color: '#fff', fontWeight: '700' },
  taskName: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  taskNameDone: { color: colors.subtext, textDecorationLine: 'line-through' },
  taskDelete: { fontSize: 14 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginLeft: 30,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.orange,
    borderRadius: 3,
  },
  progressFillDone: {
    backgroundColor: colors.accent,
  },
  progressInput: {
    width: 36,
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: colors.card,
    borderRadius: 4,
    paddingVertical: 2,
    color: colors.text,
  },
  progressUnit: { fontSize: 12, color: colors.subtext },
  taskNote: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 4,
    marginLeft: 30,
  },
  objCompletedAt: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 4,
    marginLeft: 30,
  },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  form: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  formContent: {
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
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  formLabel: { fontSize: 13, fontWeight: '600', color: colors.subtext, marginTop: 14, marginBottom: 6 },
  formDateBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formDateText: { fontSize: 15, color: colors.text },
  formDateIcon: { fontSize: 16 },
  dateTimeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateTimeBtn: { flex: 1, justifyContent: 'center', gap: 4 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  cancelBtnText: { color: colors.text, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.orange,
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  timeline: { marginTop: 4 },
  timelineItem: {
    flexDirection: 'row',
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.orange,
    marginTop: 4,
    marginRight: 10,
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    left: 16,
    top: 14,
    bottom: 0,
    width: 2,
    backgroundColor: colors.border,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 12,
  },
  timelineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineDate: { fontSize: 12, color: colors.subtext },
  timelineDuration: { fontSize: 12, color: colors.orange, fontWeight: '600' },
  timelineContent: { fontSize: 14, color: colors.text, lineHeight: 20 },
  timerSection: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 10,
    minHeight: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  timerTime: {
    fontSize: 25,
    fontWeight: '700',
    color: colors.orange,
    fontVariant: ['tabular-nums'],
  },
  timerCaption: { color: colors.subtext, fontSize: 10, marginBottom: 2 },
  timerIdleInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerIdleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, textAlign: 'center', textAlignVertical: 'center', color: colors.orangeDark, fontSize: 20 },
  timerIdleTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  startBtn: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  stopBtn: {
    backgroundColor: colors.danger || '#EF4444',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  stopBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  timerHint: { fontSize: 10, color: colors.subtext, marginTop: 3 },
  playTimeText: { fontSize: 14, color: colors.orange, fontWeight: '600', marginBottom: 6 },
  sharpComment: { fontSize: 17, color: colors.text, lineHeight: 26, fontWeight: '700' },
});
