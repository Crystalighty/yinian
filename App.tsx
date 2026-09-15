import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import BoxListScreen from './src/screens/BoxListScreen';
import BoxDetailScreen from './src/screens/BoxDetailScreen';
import GameScreen from './src/screens/GameScreen';
import GameDetailScreen from './src/screens/GameDetailScreen';
import GameFormScreen from './src/screens/GameFormScreen';
import MemoirScreen from './src/screens/MemoirScreen';
import DiceScreen from './src/screens/DiceScreen';
import OKRListScreen from './src/screens/OKRListScreen';
import OKRDetailScreen from './src/screens/OKRDetailScreen';
import OKRFormScreen from './src/screens/OKRFormScreen';
import OKRTaskFormScreen from './src/screens/OKRTaskFormScreen';
import HabitScreen from './src/screens/HabitScreen';
import TimeCapsuleScreen from './src/screens/TimeCapsuleScreen';
import TimeCapsuleFormScreen from './src/screens/TimeCapsuleFormScreen';
import TimeCapsuleDetailScreen from './src/screens/TimeCapsuleDetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TagManageScreen from './src/screens/TagManageScreen';
import PlatformManageScreen from './src/screens/PlatformManageScreen';
import BackupScreen from './src/screens/BackupScreen';
import ModuleSwitcher from './src/components/ModuleSwitcher';
import { getActiveModules } from './src/db/database';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const HabitStack = createNativeStackNavigator();
const InspirationStack = createNativeStackNavigator();
const GameStack = createNativeStackNavigator();
const OKRStack = createNativeStackNavigator();
const DiceStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const stackOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTitleStyle: { color: colors.text, fontWeight: '700' as const, fontSize: 18 },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

const appStackOptions = {
  ...stackOptions,
  headerRight: () => <ModuleSwitcher />,
};

function tabIcon(symbol: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={[styles.tabIcon, !focused && styles.tabIconInactive]}>{symbol}</Text>
  );
}

function InspirationNavigator() {
  return (
    <InspirationStack.Navigator screenOptions={appStackOptions}>
      <InspirationStack.Screen name="BoxList" component={BoxListScreen} options={{ title: '惊喜盒子' }} />
      <InspirationStack.Screen name="BoxDetail" component={BoxDetailScreen} options={({ route }) => ({ title: (route.params as { boxName: string })?.boxName ?? '' })} />
    </InspirationStack.Navigator>
  );
}

function GameNavigator() {
  return (
    <GameStack.Navigator screenOptions={appStackOptions}>
      <GameStack.Screen name="GameList" component={GameScreen} options={{ title: '游戏殿堂' }} />
      <GameStack.Screen name="GameDetail" component={GameDetailScreen} options={{ title: '游戏详情' }} />
      <GameStack.Screen name="GameForm" component={GameFormScreen} options={({ route }) => ({ title: (route.params as { gameId?: number })?.gameId ? '编辑游戏' : '新增游戏' })} />
    </GameStack.Navigator>
  );
}

function OKRNavigator() {
  return (
    <OKRStack.Navigator screenOptions={appStackOptions}>
      <OKRStack.Screen name="OKRList" component={OKRListScreen} options={{ title: '目标管理' }} />
      <OKRStack.Screen name="OKRForm" component={OKRFormScreen} options={{ title: '新建目标' }} />
      <OKRStack.Screen name="OKRDetail" component={OKRDetailScreen} options={({ route }) => ({ title: (route.params as { objectiveTitle: string })?.objectiveTitle ?? '目标详情' })} />
      <OKRStack.Screen name="OKRTaskForm" component={OKRTaskFormScreen} options={{ title: '新建任务' }} />
    </OKRStack.Navigator>
  );
}

function HabitNavigator() {
  return <HabitStack.Navigator screenOptions={appStackOptions}><HabitStack.Screen name="HabitMain" component={HabitScreen} options={{ title: '习惯打卡' }} /></HabitStack.Navigator>;
}

function DiceNavigator() {
  return <DiceStack.Navigator screenOptions={appStackOptions}><DiceStack.Screen name="DiceMain" component={DiceScreen} options={{ title: '扔骰子' }} /></DiceStack.Navigator>;
}

function TimeCapsuleNavigator() {
  return (
    <HomeStack.Navigator screenOptions={appStackOptions}>
      <HomeStack.Screen name="TimeCapsuleMain" component={TimeCapsuleScreen} options={{ title: '时间胶囊' }} />
      <HomeStack.Screen name="TimeCapsuleForm" component={TimeCapsuleFormScreen} options={{ title: '编辑时间胶囊', headerBackTitle: '返回' }} />
      <HomeStack.Screen name="TimeCapsuleDetail" component={TimeCapsuleDetailScreen} options={{ title: '胶囊详情', headerBackTitle: '返回' }} />
    </HomeStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={stackOptions}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: '我的' }} />
      <ProfileStack.Screen name="TagManage" component={TagManageScreen} options={{ title: '标签管理' }} />
      <ProfileStack.Screen name="PlatformManage" component={PlatformManageScreen} options={{ title: '游戏平台' }} />
      <ProfileStack.Screen name="BackupManage" component={BackupScreen} options={{ title: '数据备份' }} />
    </ProfileStack.Navigator>
  );
}

const moduleNavigators: Record<string, React.ComponentType> = {
  inspiration: InspirationNavigator,
  game: GameNavigator,
  dice: DiceNavigator,
  okr: OKRNavigator,
  habit: HabitNavigator,
  timeCapsule: TimeCapsuleNavigator,
};

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.stateScreen}>
      <SafeAreaView style={styles.brandMark}><Text style={styles.brandGlyph}>念</Text></SafeAreaView>
      <Text style={styles.brandTitle}>一念</Text>
      <Text style={styles.brandSubtitle}>把每个念头，慢慢变成生活</Text>
      <ActivityIndicator style={styles.spinner} size="small" color={colors.orange} />
    </SafeAreaView>
  );
}

function HomeTab({ activeModules }: { activeModules: string[] }) {
  return (
    <HomeStack.Navigator key={activeModules.join(',')} screenOptions={{ ...stackOptions, headerShown: false }}>
      <HomeStack.Screen name="Home">{() => <HomeScreen activeModules={activeModules} />}</HomeStack.Screen>
      {activeModules.map((id) => {
        const Navigator = moduleNavigators[id];
        return Navigator ? <HomeStack.Screen key={id} name={id} component={Navigator} /> : null;
      })}
    </HomeStack.Navigator>
  );
}

export default function App() {
  const [activeModules, setActiveModules] = useState<string[] | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const initialize = useCallback(() => {
    setInitError(null);
    setActiveModules(null);
    getActiveModules().then(setActiveModules).catch((error: unknown) => {
      console.error('App init error:', error);
      setInitError(error instanceof Error ? error.message : String(error));
    });
  }, []);

  useEffect(initialize, [initialize]);

  if (initError) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <SafeAreaView style={[styles.brandMark, styles.errorMark]}><Text style={styles.errorGlyph}>!</Text></SafeAreaView>
        <Text style={styles.errorTitle}>初始化失败</Text>
        <Text style={styles.errorText}>{initError}</Text>
        <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} onPress={initialize}><Text style={styles.retryText}>重新尝试</Text></Pressable>
      </SafeAreaView>
    );
  }
  if (activeModules === null) return <LoadingScreen />;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Tab.Navigator screenOptions={{ tabBarActiveTintColor: colors.orange, tabBarInactiveTintColor: colors.subtext, headerShown: false, tabBarHideOnKeyboard: true, tabBarStyle: styles.tabBar, tabBarLabelStyle: styles.tabLabel }}>
          <Tab.Screen name="Home" options={{ title: '应用', tabBarIcon: tabIcon('⌂') }}>{() => <HomeTab activeModules={activeModules} />}</Tab.Screen>
          <Tab.Screen name="Memoir" component={MemoirScreen} options={{ title: '回忆', tabBarIcon: tabIcon('◈'), headerShown: true, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 18 } }} />
          <Tab.Screen name="Profile" component={ProfileNavigator} options={{ title: '我的', tabBarIcon: tabIcon('●') }} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  stateScreen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  brandMark: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
  brandGlyph: { color: '#FFF', fontSize: 30, fontWeight: '800' },
  brandTitle: { marginTop: 20, color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  brandSubtitle: { marginTop: 8, color: colors.subtext, fontSize: 13 },
  spinner: { marginTop: 30 },
  errorMark: { backgroundColor: '#F8E9E9', shadowOpacity: 0 },
  errorGlyph: { color: colors.danger, fontSize: 32, fontWeight: '800' },
  errorTitle: { marginTop: 20, color: colors.text, fontSize: 21, fontWeight: '800' },
  errorText: { marginTop: 10, color: colors.subtext, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retryButton: { marginTop: 24, backgroundColor: colors.orange, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  retryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  tabBar: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, height: 68, paddingTop: 7, paddingBottom: 8, elevation: 4, shadowColor: colors.shadow, shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.04, shadowRadius: 12 },
  tabLabel: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  tabIcon: { fontSize: 22, color: colors.orange, fontWeight: '800' },
  tabIconInactive: { color: colors.subtext, opacity: 0.65 },
});
