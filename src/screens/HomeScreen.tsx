import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRandomHomeMessage, getTodayOverview, listTodayTasks, TodayOverview, TodayTask } from '../db/database';
import { colors } from '../theme';

export interface AppModule { id: string; icon: string; label: string; desc: string; tabTitle: string; }
export const ALL_MODULES: AppModule[] = [
  { id: 'inspiration', icon: '🎲', label: '惊喜盒子', desc: '随机抽取想法', tabTitle: '灵感盲盒' },
  { id: 'game', icon: '🎮', label: '游戏殿堂', desc: '管理游戏库', tabTitle: '游戏殿堂' },
  { id: 'dice', icon: '🎯', label: '扔骰子', desc: '随机做决定', tabTitle: '扔骰子' },
  { id: 'okr', icon: '📋', label: '目标管理', desc: '目标与任务', tabTitle: 'OKR' },
  { id: 'habit', icon: '✅', label: '习惯打卡', desc: '每天坚持', tabTitle: '习惯打卡' },
  { id: 'timeCapsule', icon: '⏳', label: '时间胶囊', desc: '写给未来', tabTitle: '时间胶囊' },
];
export function getModuleById(id: string): AppModule | undefined { return ALL_MODULES.find((m) => m.id === id); }
function localDate(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const moduleTints = ['#FFF0E6', '#EAF0FC', '#FFF6D9', '#EEEAF8', '#E7F3EC', '#FCEAF0'];

export default function HomeScreen({ activeModules = ALL_MODULES.map((m) => m.id) }: { activeModules?: string[] }) {
  const navigation = useNavigation() as any;
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [homeMessage, setHomeMessage] = useState<{ content: string; box_name: string } | null>(null);
  const visibleModules = ALL_MODULES.filter((m) => activeModules.includes(m.id));
  const refresh = useCallback(async () => { const date = localDate(); const [a, b, message] = await Promise.all([listTodayTasks(date), getTodayOverview(date), getRandomHomeMessage()]); setTasks(a); setOverview(b); setHomeMessage(message); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><View style={styles.heroText}><Text style={styles.greeting} numberOfLines={3}>{homeMessage?.content ?? '今天，慢慢完成'}</Text><Text style={styles.subtitle} numberOfLines={1}>{homeMessage ? `来自「${homeMessage.box_name}」` : tasks.length ? `有 ${tasks.length} 件重要的小事` : '从一个小念头开始'}</Text></View><View style={styles.heroBadge}><Text style={styles.heroBadgeText}>念</Text></View></View>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>今日</Text><Text style={styles.sectionHint}>专注眼前的小事</Text></View>
    <View style={styles.todayCard}>
      {tasks.slice(0, 4).map((task) => <Pressable key={task.id} style={styles.taskRow} disabled={!activeModules.includes('okr')} onPress={() => navigation.navigate('okr', { screen: 'OKRDetail', params: { objectiveId: task.objective_id, objectiveTitle: task.objective_title } })}><View style={styles.taskDot}/><View style={styles.taskMain}><Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text><Text style={styles.taskSource}>{task.objective_title}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
      {!tasks.length && <Pressable style={styles.emptyToday} disabled={!activeModules.includes('okr')} onPress={() => navigation.navigate('okr')}><Text style={styles.emptyIcon}>🌿</Text><View><Text style={styles.emptyTitle}>今天还没有安排任务</Text><Text style={styles.emptySub}>到目标管理里选择“加入今天”</Text></View></Pressable>}
      <View style={styles.metricRow}><Pressable style={styles.metric} disabled={!activeModules.includes('habit')} onPress={() => navigation.navigate('habit')}><Text style={styles.metricValue}>{overview?.checkedHabitCount ?? 0}/{overview?.activeHabitCount ?? 0}</Text><Text style={styles.metricLabel}>习惯完成</Text></Pressable><View style={styles.metricDivider}/><Pressable style={styles.metric} disabled={!activeModules.includes('timeCapsule')} onPress={() => navigation.navigate('timeCapsule')}><Text style={styles.metricValue}>{overview?.availableCapsuleCount ?? 0}</Text><Text style={styles.metricLabel}>胶囊可开启</Text></Pressable><View style={styles.metricDivider}/><Pressable style={styles.metric} disabled={!activeModules.includes('inspiration')} onPress={() => navigation.navigate('inspiration')}><Text style={styles.metricValue}>{overview?.dailyDraw ? '1' : '0'}</Text><Text style={styles.metricLabel}>今日惊喜</Text></Pressable></View>
    </View>
    {overview?.recentGame && activeModules.includes('game') && <Pressable style={styles.gameCard} onPress={() => navigation.navigate('game', { screen: 'GameDetail', params: { gameId: overview.recentGame!.id } })}>{overview.recentGame.image_uri ? <Image source={{ uri: overview.recentGame.image_uri }} style={styles.gameImage}/> : <View style={styles.gamePlaceholder}><Text>🎮</Text></View>}<View style={styles.gameMain}><Text style={styles.gameEyebrow}>继续游玩</Text><Text style={styles.gameTitle} numberOfLines={1}>{overview.recentGame.name}</Text></View><Text style={styles.continueText}>继续 ›</Text></Pressable>}
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>全部应用</Text></View>
    <View style={styles.grid}>{visibleModules.map((mod, index) => <Pressable key={mod.id} style={({pressed}) => [styles.card, pressed && styles.pressed]} onPress={() => navigation.navigate(mod.id)}><View style={[styles.iconWrap, { backgroundColor: moduleTints[index % moduleTints.length] }]}><Text style={styles.cardIcon}>{mod.icon}</Text></View><View style={styles.cardText}><Text style={styles.cardLabel}>{mod.label}</Text><Text style={styles.cardDesc}>{mod.desc}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:colors.bg},content:{paddingHorizontal:15,paddingTop:20,paddingBottom:28},hero:{minHeight:88,borderRadius:20,backgroundColor:'#FFF2E8',padding:15,marginBottom:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:'#F3DCCB'},heroText:{flex:1,minWidth:0,paddingRight:12},greeting:{fontSize:21,lineHeight:28,fontWeight:'800',color:colors.text},subtitle:{fontSize:12,color:'#A66848',marginTop:5},heroBadge:{width:50,height:50,borderRadius:16,backgroundColor:'#E68A65',alignItems:'center',justifyContent:'center'},heroBadgeText:{fontSize:22,fontWeight:'800',color:'#FFF'},
  sectionHeader:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',marginBottom:7,marginTop:1},sectionTitle:{fontSize:18,fontWeight:'800',color:colors.text},sectionHint:{fontSize:11,color:colors.subtext},todayCard:{backgroundColor:colors.card,borderRadius:18,borderWidth:1,borderColor:colors.border,paddingHorizontal:12,paddingVertical:9,marginBottom:10},taskRow:{minHeight:49,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:colors.border},taskDot:{width:8,height:8,borderRadius:4,borderWidth:2,borderColor:colors.orange,marginRight:10},taskMain:{flex:1},taskTitle:{fontSize:14,fontWeight:'700',color:colors.text},taskSource:{fontSize:11,color:colors.subtext,marginTop:2},chevron:{fontSize:20,color:colors.subtext},emptyToday:{flexDirection:'row',alignItems:'center',paddingVertical:5},emptyIcon:{fontSize:24,marginRight:10},emptyTitle:{fontSize:14,fontWeight:'700',color:colors.text},emptySub:{fontSize:11,color:colors.subtext,marginTop:3},
  metricRow:{flexDirection:'row',marginTop:9,paddingTop:9,borderTopWidth:1,borderTopColor:colors.border},metric:{flex:1,alignItems:'center',paddingVertical:2},metricValue:{fontSize:17,fontWeight:'800',color:colors.orangeDark},metricLabel:{fontSize:10,color:colors.subtext,marginTop:2},metricDivider:{width:1,backgroundColor:colors.border},gameCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#EEF2FC',borderRadius:16,padding:9,marginBottom:16,borderWidth:1,borderColor:'#DDE4F5'},gameImage:{width:42,height:50,borderRadius:9},gamePlaceholder:{width:42,height:50,borderRadius:9,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'},gameMain:{flex:1,marginLeft:10},gameEyebrow:{fontSize:10,color:'#6577A4',fontWeight:'800'},gameTitle:{fontSize:15,color:colors.text,fontWeight:'800',marginTop:3},continueText:{color:'#6577A4',fontSize:12,fontWeight:'700'},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},card:{width:'48.7%',minHeight:64,flexDirection:'row',alignItems:'center',backgroundColor:colors.card,borderRadius:15,padding:9,borderWidth:1,borderColor:colors.border},pressed:{opacity:.75},iconWrap:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',marginRight:8},cardIcon:{fontSize:20},cardText:{flex:1,minWidth:0},cardLabel:{fontSize:14,fontWeight:'700',color:colors.text},cardDesc:{fontSize:10,color:colors.subtext,marginTop:2}
});
