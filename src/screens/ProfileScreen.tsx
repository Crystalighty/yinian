import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Box,
  getActiveModules,
  getHomeMessageBoxId,
  listBoxes,
  setActiveModules,
  setHomeMessageBoxId,
} from '../db/database';
import { ALL_MODULES, getModuleById } from './HomeScreen';
import { colors } from '../theme';

type ProfileStackParamList = {
  ProfileMain: undefined;
  TagManage: undefined;
  PlatformManage: undefined;
  BackupManage: undefined;
};

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const [activeModules, setActiveModulesState] = useState<string[]>([]);
  const [changed, setChanged] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [messageBoxId, setMessageBoxId] = useState<number | null>(null);
  const [messagePickerVisible, setMessagePickerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getActiveModules(), listBoxes(), getHomeMessageBoxId()]).then(([modules, nextBoxes, boxId]) => {
        setActiveModulesState(modules);
        setBoxes(nextBoxes);
        setMessageBoxId(boxId);
      });
      setChanged(false);
    }, [])
  );

  const toggleModule = (id: string) => {
    setActiveModulesState((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      setChanged(true);
      return next;
    });
  };

  const moveModule = (id: string, dir: -1 | 1) => {
    setActiveModulesState((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      setChanged(true);
      return next;
    });
  };

  const handleSave = async () => {
    if (activeModules.length === 0) {
      Alert.alert('提示', '至少需要保留一个应用');
      return;
    }
    await setActiveModules(activeModules);
    setChanged(false);
  };

  const handleReset = () => {
    const defaults = ['inspiration', 'game', 'dice', 'okr'];
    setActiveModulesState(defaults);
    setChanged(true);
  };

  const selectMessageBox = async (boxId: number | null) => {
    await setHomeMessageBoxId(boxId);
    setMessageBoxId(boxId);
    setMessagePickerVisible(false);
  };

  const selectedMessageBox = boxes.find((box) => box.id === messageBoxId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>念</Text></View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerEyebrow}>MY SPACE</Text>
          <Text style={styles.headerTitle}>我的一念空间</Text>
          <Text style={styles.headerDesc}>{activeModules.length} 个应用正在首页展示</Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View><Text style={styles.sectionLabel}>首页寄语</Text><Text style={styles.sectionDesc}>从指定盒子中随机展示一条内容</Text></View>
      </View>
      <Pressable style={({ pressed }) => [styles.messageBoxCard, pressed && styles.rowPressed]} onPress={() => setMessagePickerVisible(true)}>
        <View style={styles.messageBoxLeft}><View style={styles.messageIcon}><Text style={styles.messageIconText}>{selectedMessageBox?.icon || '💬'}</Text></View><View style={styles.messageText}><Text style={styles.messageLabel}>{selectedMessageBox?.name || '使用默认提示'}</Text><Text style={styles.messageDesc}>{selectedMessageBox ? `${selectedMessageBox.thought_count} 条待选内容` : '点击选择一个惊喜盒子'}</Text></View></View><Text style={styles.menuArrow}>›</Text>
      </Pressable>

      <View style={[styles.sectionHeading, styles.moduleHeading]}>
        <View>
          <Text style={styles.sectionLabel}>首页应用</Text>
          <Text style={styles.sectionDesc}>选择展示内容，并用箭头调整顺序</Text>
        </View>
        {changed && <View style={styles.changedBadge}><Text style={styles.changedText}>待保存</Text></View>}
      </View>

      {ALL_MODULES.map((mod) => {
        const isActive = activeModules.includes(mod.id);
        const activeIdx = activeModules.indexOf(mod.id);
        return (
          <View key={mod.id} style={[styles.moduleRow, !isActive && styles.moduleRowInactive]}>
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleIcon}>{mod.icon}</Text>
              <View style={styles.moduleText}>
                <Text style={[styles.moduleLabel, !isActive && styles.moduleLabelInactive]}>
                  {mod.label}
                </Text>
                <Text style={styles.moduleDesc}>{mod.desc}</Text>
              </View>
            </View>
            <View style={styles.moduleActions}>
              {isActive && activeModules.length > 1 && (
                <View style={styles.orderBtns}>
                  <Pressable
                    style={[styles.orderBtn, activeIdx === 0 && styles.orderBtnDisabled]}
                    onPress={() => moveModule(mod.id, -1)}
                    disabled={activeIdx === 0}
                  >
                    <Text style={[styles.orderBtnText, activeIdx === 0 && styles.orderBtnTextDisabled]}>↑</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.orderBtn, activeIdx === activeModules.length - 1 && styles.orderBtnDisabled]}
                    onPress={() => moveModule(mod.id, 1)}
                    disabled={activeIdx === activeModules.length - 1}
                  >
                    <Text style={[styles.orderBtnText, activeIdx === activeModules.length - 1 && styles.orderBtnTextDisabled]}>↓</Text>
                  </Pressable>
                </View>
              )}
              <Pressable
                style={[styles.toggle, isActive && styles.toggleActive]}
                onPress={() => toggleModule(mod.id)}
              >
                <View style={[styles.toggleThumb, isActive && styles.toggleThumbActive]} />
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={styles.toolsSection}>
        <Text style={styles.sectionLabel}>管理工具</Text>
        <View style={styles.menuGroup}>
          <Pressable style={({ pressed }) => [styles.menuCard, pressed && styles.rowPressed]} onPress={() => navigation.navigate('TagManage')}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconWrap}><Text style={styles.menuIcon}>🏷️</Text></View>
              <View>
                <Text style={styles.menuLabel}>标签管理</Text>
                <Text style={styles.menuDesc}>分类管理各模块的标签</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable style={({ pressed }) => [styles.menuCard, pressed && styles.rowPressed]} onPress={() => navigation.navigate('PlatformManage')}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconWrap}><Text style={styles.menuIcon}>🎮</Text></View>
              <View>
                <Text style={styles.menuLabel}>游戏平台</Text>
                <Text style={styles.menuDesc}>管理游戏模块的平台选项</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable style={({ pressed }) => [styles.menuCard, pressed && styles.rowPressed]} onPress={() => navigation.navigate('BackupManage')}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconWrap}><Text style={styles.menuIcon}>💾</Text></View>
              <View>
                <Text style={styles.menuLabel}>数据备份</Text>
                <Text style={styles.menuDesc}>导出或导入应用数据</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.previewSection}>
        <Text style={styles.sectionLabel}>当前首页顺序</Text>
        <View style={styles.previewGrid}>
          {activeModules.map((id) => {
            const mod = getModuleById(id);
            return mod ? (
              <View key={id} style={styles.previewGridItem}>
                <Text style={styles.previewGridIcon}>{mod.icon}</Text>
                <Text style={styles.previewGridLabel}>{mod.label}</Text>
              </View>
            ) : null;
          })}
        </View>
      </View>

      <View style={styles.btnRow}>
        <Pressable style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>恢复默认</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, !changed && styles.saveBtnDisabled]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>
            {changed ? '保存更改' : '已保存'}
          </Text>
        </Pressable>
      </View>
      <Modal visible={messagePickerVisible} transparent animationType="fade" onRequestClose={() => setMessagePickerVisible(false)}>
        <Pressable style={styles.modalMask} onPress={() => setMessagePickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.pickerHeader}><View><Text style={styles.pickerTitle}>选择首页寄语盒子</Text><Text style={styles.pickerDesc}>每次进入首页会重新随机展示</Text></View><Pressable onPress={() => setMessagePickerVisible(false)}><Text style={styles.pickerClose}>×</Text></Pressable></View>
            <ScrollView style={styles.pickerList}>
              <Pressable style={[styles.pickerRow, messageBoxId === null && styles.pickerRowActive]} onPress={() => selectMessageBox(null)}><Text style={styles.pickerIcon}>💬</Text><Text style={styles.pickerName}>使用默认提示</Text>{messageBoxId === null && <Text style={styles.pickerCheck}>✓</Text>}</Pressable>
              {boxes.map((box) => <Pressable key={box.id} style={[styles.pickerRow, messageBoxId === box.id && styles.pickerRowActive]} onPress={() => selectMessageBox(box.id)}><Text style={styles.pickerIcon}>{box.icon || '📦'}</Text><View style={styles.pickerMain}><Text style={styles.pickerName}>{box.name}</Text><Text style={styles.pickerCount}>{box.thought_count} 条可用内容</Text></View>{messageBoxId === box.id && <Text style={styles.pickerCheck}>✓</Text>}</Pressable>)}
            </ScrollView>
            {!boxes.length && <Text style={styles.pickerEmpty}>还没有盒子，请先在惊喜盒子中创建</Text>}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 38 },
  // Header
  headerCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 22,
    padding: 18,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    elevation: 1,
  },
  avatar: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerInfo: { flex: 1 },
  headerEyebrow: { fontSize: 9, color: colors.orange, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerDesc: { fontSize: 12, color: colors.orangeDark, marginTop: 5, lineHeight: 17 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  sectionLabel: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sectionDesc: { fontSize: 11, color: colors.subtext },
  moduleHeading: { marginTop: 22 },
  messageBoxCard: { minHeight: 70, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  messageBoxLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  messageIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  messageIconText: { fontSize: 22 },
  messageText: { flex: 1 },
  messageLabel: { fontSize: 15, color: colors.text, fontWeight: '700' },
  messageDesc: { fontSize: 11, color: colors.subtext, marginTop: 4 },
  changedBadge: { backgroundColor: colors.primarySoft, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  changedText: { fontSize: 10, color: colors.orangeDark, fontWeight: '700' },
  // Module rows
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  moduleRowInactive: { opacity: 0.62, backgroundColor: colors.surfaceMuted },
  moduleInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  moduleIcon: { width: 42, height: 42, textAlign: 'center', textAlignVertical: 'center', fontSize: 23, marginRight: 10, backgroundColor: colors.primarySoft, borderRadius: 13, overflow: 'hidden' },
  moduleText: { flex: 1 },
  moduleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  moduleLabelInactive: { color: colors.subtext },
  moduleDesc: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  moduleActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Order buttons
  orderBtns: { flexDirection: 'row', gap: 4 },
  orderBtn: { width: 27, height: 27, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  orderBtnDisabled: { opacity: 0.3 },
  orderBtnText: { fontSize: 15, color: colors.orange, fontWeight: '800' },
  orderBtnTextDisabled: { color: colors.subtext },
  // Toggle switch
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: colors.orange },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  // Preview
  previewSection: { marginTop: 22 },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  previewGridItem: {
    flexBasis: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  previewGridIcon: { fontSize: 22, backgroundColor: colors.primarySoft, width: 40, height: 40, borderRadius: 12, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden' },
  previewGridLabel: { fontSize: 10, color: colors.text, fontWeight: '600', marginTop: 5 },
  previewBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  previewItem: { flex: 1, alignItems: 'center' },
  previewIcon: { fontSize: 18 },
  previewLabel: { fontSize: 10, color: colors.subtext, marginTop: 2 },
  // Menu group
  toolsSection: { marginTop: 22 },
  menuGroup: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: 7 },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 65 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 20 },
  menuLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  menuDesc: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  menuArrow: { fontSize: 22, color: colors.subtext, fontWeight: '300' },
  modalMask: { flex: 1, backgroundColor: 'rgba(30,45,37,0.34)', justifyContent: 'center', padding: 22 },
  pickerCard: { maxHeight: '72%', backgroundColor: colors.card, borderRadius: 22, padding: 18 },
  pickerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  pickerDesc: { fontSize: 11, color: colors.subtext, marginTop: 5 },
  pickerClose: { fontSize: 26, lineHeight: 28, color: colors.subtext, paddingHorizontal: 5 },
  pickerList: { flexGrow: 0 },
  pickerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, borderRadius: 14, marginBottom: 6 },
  pickerRowActive: { backgroundColor: colors.primarySoft },
  pickerIcon: { width: 36, fontSize: 22 },
  pickerMain: { flex: 1 },
  pickerName: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '700' },
  pickerCount: { fontSize: 10, color: colors.subtext, marginTop: 3 },
  pickerCheck: { fontSize: 17, color: colors.orangeDark, fontWeight: '800' },
  pickerEmpty: { textAlign: 'center', color: colors.subtext, paddingVertical: 20, fontSize: 12 },
  // Buttons
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  resetBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetBtnText: { color: colors.text, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.orange,
  },
  saveBtnDisabled: { backgroundColor: colors.primaryMuted },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});
