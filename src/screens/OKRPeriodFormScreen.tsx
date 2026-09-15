import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  listPeriods,
  updatePeriod,
} from '../db/database';
import { colors } from '../theme';

type RootStackParamList = {
  OKRList: undefined;
  OKRDetail: { objectiveId: number; objectiveTitle: string };
  OKRPeriodForm: { periodId?: number } | undefined;
};

export default function OKRPeriodFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OKRPeriodForm'>>();
  const periodId = (route.params as { periodId?: number } | undefined)?.periodId;
  const isEdit = !!periodId;

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (periodId) {
      listPeriods(true).then((periods) => {
        const p = periods.find((x) => x.id === periodId);
        if (p) {
          setName(p.name);
          setStartDate(p.start_date.split('T')[0]);
          setEndDate(p.end_date.split('T')[0]);
        }
      });
    }
  }, [periodId]);

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) {
      Alert.alert('提示', '请填写完整信息');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      Alert.alert('提示', '结束日期必须晚于开始日期');
      return;
    }
    if (periodId) {
      await updatePeriod(periodId, name.trim(), startDate, endDate);
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>周期名称</Text>
        <TextInput
          style={styles.input}
          placeholder="如：2026 Q3、年度目标"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.fieldLabel}>开始日期</Text>
        <TextInput
          style={styles.input}
          placeholder="格式：2026-07-01"
          value={startDate}
          onChangeText={setStartDate}
        />

        <Text style={styles.fieldLabel}>结束日期</Text>
        <TextInput
          style={styles.input}
          placeholder="格式：2026-09-30"
          value={endDate}
          onChangeText={setEndDate}
        />
      </View>

      <Pressable style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{isEdit ? '保存修改' : '创建周期'}</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 100 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  saveBtn: {
    backgroundColor: colors.orange,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
