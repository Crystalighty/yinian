import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportDatabase, importDatabase } from '../db/database';
import { colors } from '../theme';

export default function BackupScreen() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Export database to JSON file
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const jsonData = await exportDatabase();
      
      // Save to file
      const fileName = `oneday_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
        Alert.alert('导出成功', '备份文件已生成');
      } else {
        Alert.alert('导出成功', `文件已保存到：${fileUri}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('导出失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsExporting(false);
    }
  };

  // Import database from JSON file
  const handleImport = async () => {
    Alert.alert(
      '导入数据',
      '导入将覆盖当前所有数据，此操作不可恢复。确定继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            setIsImporting(true);
            try {
              // Pick JSON file
              const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (result.canceled || !result.assets || result.assets.length === 0) {
                setIsImporting(false);
                return;
              }

              const fileUri = result.assets[0].uri;
              const jsonData = await FileSystem.readAsStringAsync(fileUri, {
                encoding: FileSystem.EncodingType.UTF8,
              });

              await importDatabase(jsonData);
              Alert.alert('导入成功', '数据已成功导入，请重启应用以查看更改');
            } catch (error) {
              console.error('Import failed:', error);
              Alert.alert('导入失败', error instanceof Error ? error.message : '未知错误');
            } finally {
              setIsImporting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerIcon}>💾</Text>
        <Text style={styles.headerTitle}>数据备份与恢复</Text>
        <Text style={styles.headerDesc}>
          定期备份您的数据，防止意外丢失。备份文件包含所有模块的数据。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>导出数据</Text>
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>📤 导出备份</Text>
          <Text style={styles.actionDesc}>
            将所有数据导出为 JSON 文件，可分享到其他设备或云存储
          </Text>
          <Pressable
            style={[styles.actionBtn, isExporting && styles.actionBtnDisabled]}
            onPress={handleExport}
            disabled={isExporting}
          >
            <Text style={styles.actionBtnText}>
              {isExporting ? '导出中...' : '开始导出'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>导入数据</Text>
        <View style={[styles.actionCard, styles.warningCard]}>
          <Text style={styles.actionTitle}>📥 导入备份</Text>
          <Text style={styles.actionDesc}>
            从 JSON 文件恢复数据，将覆盖当前所有数据
          </Text>
          <Text style={styles.warningText}>⚠️ 警告：此操作不可恢复，请谨慎使用</Text>
          <Pressable
            style={[styles.actionBtn, styles.dangerBtn, isImporting && styles.actionBtnDisabled]}
            onPress={handleImport}
            disabled={isImporting}
          >
            <Text style={styles.dangerBtnText}>
              {isImporting ? '导入中...' : '选择文件导入'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 使用提示</Text>
        <Text style={styles.tipsItem}>• 建议定期备份数据，特别是添加重要内容后</Text>
        <Text style={styles.tipsItem}>• 备份文件为 JSON 格式，可用文本编辑器查看</Text>
        <Text style={styles.tipsItem}>• 导入前请确认备份文件来自同一版本的应用</Text>
        <Text style={styles.tipsItem}>• 导入后将完全替换当前数据，无法撤销</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  headerCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  headerIcon: { fontSize: 48, marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  headerDesc: { fontSize: 13, color: colors.subtext, textAlign: 'center', lineHeight: 20 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningCard: {
    borderColor: colors.danger + '40',
    backgroundColor: colors.danger + '08',
  },
  actionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  actionDesc: { fontSize: 13, color: colors.subtext, lineHeight: 20, marginBottom: 14 },
  warningText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: 14,
  },
  actionBtn: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dangerBtn: { backgroundColor: colors.danger },
  dangerBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  tipsCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 18,
    marginTop: 10,
  },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  tipsItem: { fontSize: 13, color: colors.subtext, lineHeight: 22, marginBottom: 4 },
});
