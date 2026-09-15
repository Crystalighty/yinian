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
  GlobalTag,
  addGlobalTag,
  deleteGlobalTag,
  listGlobalTags,
} from '../db/database';
import { colors } from '../theme';

const MODULE_LABELS: Record<string, string> = {
  inspiration: '惊喜盒子',
  game: '游戏殿堂',
  okr: '目标管理',
};

const MODULE_ICONS: Record<string, string> = {
  inspiration: '🎲',
  game: '🎮',
  okr: '📋',
};

const MODULES = ['inspiration', 'game', 'okr'];

export default function TagManageScreen() {
  const [tags, setTags] = useState<GlobalTag[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [addModule, setAddModule] = useState('inspiration');
  const [addName, setAddName] = useState('');

  const refresh = useCallback(async () => {
    const all = await listGlobalTags();
    setTags(all);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const grouped = MODULES.map((mod) => ({
    module: mod,
    label: MODULE_LABELS[mod] ?? mod,
    icon: MODULE_ICONS[mod] ?? '📌',
    items: tags.filter((t) => t.module === mod),
  }));

  const openAdd = (module: string) => {
    setAddModule(module);
    setAddName('');
    setAddVisible(true);
  };

  const handleAdd = async () => {
    if (!addName.trim()) {
      Alert.alert('提示', '标签名称不能为空');
      return;
    }
    await addGlobalTag(addName.trim(), addModule);
    setAddVisible(false);
    setAddName('');
    refresh();
  };

  const confirmDelete = (tag: GlobalTag) => {
    Alert.alert('删除标签', `确定删除「${tag.name}」吗？\n（已使用该标签的数据不会受影响）`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteGlobalTag(tag.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>标签管理</Text>
        <Text style={styles.headerDesc}>
          集中管理各模块的标签。创建内容时可以从已有标签中选择，也可以直接新增。
        </Text>
      </View>

      {grouped.map((group) => (
        <View key={group.module} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLeft}>
              <Text style={styles.sectionIcon}>{group.icon}</Text>
              <Text style={styles.sectionTitle}>{group.label}</Text>
              <Text style={styles.sectionCount}>{group.items.length}</Text>
            </View>
            <Pressable onPress={() => openAdd(group.module)}>
              <Text style={styles.addBtn}>＋ 新增</Text>
            </Pressable>
          </View>
          {group.items.length === 0 ? (
            <Text style={styles.emptyText}>暂无标签</Text>
          ) : (
            <View style={styles.tagList}>
              {group.items.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag.name}</Text>
                  <Pressable onPress={() => confirmDelete(tag)} style={styles.tagDelete}>
                    <Text style={styles.tagDeleteText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      {/* Add Tag Modal */}
      <Modal visible={addVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalMask} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.form}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                新增标签 — {MODULE_LABELS[addModule]}
              </Text>
              <Pressable onPress={() => { setAddVisible(false); setAddName(''); }}>
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.formInput}
              placeholder="标签名称"
              value={addName}
              onChangeText={setAddName}
              autoFocus
            />
            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setAddVisible(false); setAddName(''); }}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  headerDesc: { fontSize: 13, color: colors.subtext, marginTop: 6, lineHeight: 18 },
  // Section
  section: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  sectionCount: {
    fontSize: 12,
    color: colors.subtext,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  addBtn: { fontSize: 13, color: colors.orange, fontWeight: '600' },
  emptyText: { fontSize: 13, color: colors.subtext },
  // Tags
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontSize: 13, color: colors.text },
  tagDelete: { marginLeft: 4, padding: 2 },
  tagDeleteText: { fontSize: 14, color: colors.danger, fontWeight: '700' },
  // Modal
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
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
});
