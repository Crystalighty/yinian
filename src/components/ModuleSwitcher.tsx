import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { getActiveModules } from '../db/database';
import { getModuleById } from '../screens/HomeScreen';
import { colors } from '../theme';

export default function ModuleSwitcher() {
  const navigation = useNavigation() as any;
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getActiveModules().then(setActiveModules).catch(() => setActiveModules([]));
      return () => setVisible(false);
    }, [])
  );

  const modules = useMemo(
    () => activeModules.map((id) => getModuleById(id)).filter(Boolean),
    [activeModules]
  );

  let homeStack = navigation;
  for (let level = 0; level < 5; level++) {
    const parent = homeStack.getParent?.();
    if (!parent) {
      homeStack = null;
      break;
    }
    if (parent.getState()?.routeNames?.includes('Home')) {
      homeStack = parent;
      break;
    }
    homeStack = parent;
  }

  const state = homeStack?.getState?.();
  const currentRoute = state?.routes?.[state.index]?.name ?? 'Home';
  const currentModule = getModuleById(currentRoute);

  if (modules.length <= 1 || !currentModule) return null;

  const switchTo = (moduleId: string) => {
    if (moduleId === currentRoute) {
      setVisible(false);
      return;
    }
    if (!homeStack || switchingTo) return;

    setSwitchingTo(moduleId);
    setVisible(false);
    homeStack.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: 'Home' }, { name: moduleId }],
      })
    );
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`当前为${currentModule.label}，切换应用`}
        style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.currentEmoji}>{currentModule.icon}</Text>
        <Text style={styles.switchText}>切换</Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>切换应用</Text>
                <Text style={styles.sheetSubtitle}>将直接进入所选应用的首页</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭" style={styles.closeButton} onPress={() => setVisible(false)}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.moduleGrid}>
              {modules.map((module) => {
                const selected = module!.id === currentRoute;
                return (
                  <Pressable
                    key={module!.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.moduleCard,
                      selected && styles.moduleCardSelected,
                      pressed && !selected && styles.moduleCardPressed,
                    ]}
                    onPress={() => switchTo(module!.id)}
                  >
                    <View style={[styles.moduleIcon, selected && styles.moduleIconSelected]}>
                      <Text style={styles.moduleEmoji}>{module!.icon}</Text>
                    </View>
                    <Text style={[styles.moduleLabel, selected && styles.moduleLabelSelected]}>{module!.label}</Text>
                    <Text style={styles.moduleDesc} numberOfLines={1}>{module!.desc}</Text>
                    {selected && <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  currentEmoji: { fontSize: 15 },
  switchButton: { height: 34, paddingHorizontal: 11, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  switchText: { color: colors.orangeDark, fontSize: 13, fontWeight: '800' },
  chevron: { color: colors.orangeDark, fontSize: 15, marginTop: -3 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(28, 31, 35, 0.42)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30, shadowColor: colors.shadow, shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 12 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle: { color: colors.text, fontSize: 21, fontWeight: '800' },
  sheetSubtitle: { color: colors.subtext, fontSize: 12, marginTop: 4 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.subtext, fontSize: 25, lineHeight: 27 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moduleCard: { position: 'relative', width: '47%', minHeight: 126, borderRadius: 20, padding: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  moduleCardSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryMuted },
  moduleCardPressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.98 }] },
  moduleIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  moduleIconSelected: { backgroundColor: colors.primaryMuted },
  moduleEmoji: { fontSize: 21 },
  moduleLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  moduleLabelSelected: { color: colors.orangeDark },
  moduleDesc: { color: colors.subtext, fontSize: 10, marginTop: 4 },
  check: { position: 'absolute', right: 12, top: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
});
