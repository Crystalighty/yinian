import React, { useState } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { addTimeCapsule, getTimeCapsule, updateTimeCapsule } from '../db/database';
import { colors } from '../theme';

type RootStackParamList = {
  TimeCapsuleList: undefined;
  TimeCapsuleForm: { capsuleId?: number } | undefined;
  TimeCapsuleDetail: { capsuleId: number };
};

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function TimeCapsuleFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { capsuleId } = (route.params as any) || {};
  const isEdit = !!capsuleId;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [openDate, setOpenDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default to 7 days later
    return d;
  });
  const [showPicker, setShowPicker] = useState(false);
  
  // Audio recording state
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder, 500);
  const player = useAudioPlayer();
  const [audioUri, setAudioUri] = useState<string | null>(null);

  React.useEffect(() => {
    if (isEdit && capsuleId) {
      getTimeCapsule(capsuleId).then((capsule) => {
        if (capsule) {
          setTitle(capsule.title);
          setContent(capsule.content || '');
          setAudioUri(capsule.audio_uri || null);
          setOpenDate(new Date(capsule.open_date + 'T00:00:00'));
        }
      });
    }
  }, [capsuleId, isEdit]);

  // Start recording
  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('提示', '需要麦克风权限才能录音');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      Alert.alert('错误', '无法开始录音');
      console.error(err);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!recorderState.isRecording) return;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const fileName = `capsule_${Date.now()}.m4a`;
        const newUri = FileSystem.documentDirectory + fileName;
        await FileSystem.copyAsync({ from: uri, to: newUri });
        setAudioUri(newUri);
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    } catch (err) {
      Alert.alert('错误', '停止录音失败');
      console.error(err);
    }
  };

  // Delete audio
  const deleteAudio = async () => {
    if (audioUri) {
      try {
        await FileSystem.deleteAsync(audioUri, { idempotent: true });
      } catch (err) {
        console.error(err);
      }
    }
    setAudioUri(null);
  };

  // Play audio preview
  const playAudio = async () => {
    if (!audioUri) return;
    try {
      player.replace(audioUri);
      await player.seekTo(0);
      player.play();
    } catch (err) {
      Alert.alert('错误', '播放失败');
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '标题不能为空');
      return;
    }

    try {
      if (isEdit && capsuleId) {
        await updateTimeCapsule(capsuleId, title.trim(), content.trim() || null, audioUri, fmtDate(openDate));
      } else {
        await addTimeCapsule(title.trim(), content.trim() || null, audioUri, fmtDate(openDate));
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('错误', '保存失败，请重试');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
        {/* Title */}
        <TextInput
          style={styles.titleInput}
          placeholder="给时间胶囊起个名字..."
          value={title}
          onChangeText={setTitle}
          maxLength={50}
        />

        {/* Content */}
        <TextInput
          style={styles.contentInput}
          placeholder="写下想对未来的自己说的话..."
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        {/* Audio Section */}
        <View style={styles.audioSection}>
          <Text style={styles.audioLabel}>🎤 语音留言</Text>
          {audioUri ? (
            <View style={styles.audioPreview}>
              <Pressable style={styles.playBtn} onPress={playAudio}>
                <Text style={styles.playBtnText}>▶️ 播放</Text>
              </Pressable>
              <Pressable style={styles.deleteAudioBtn} onPress={deleteAudio}>
                <Text style={styles.deleteAudioText}>🗑️ 删除</Text>
              </Pressable>
            </View>
          ) : recorderState.isRecording ? (
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingDot}>●</Text>
              <Text style={styles.recordingText}>录音中 {Math.floor(recorderState.durationMillis / 1000)}s</Text>
              <Pressable style={styles.stopBtn} onPress={stopRecording}>
                <Text style={styles.stopBtnText}>⏹ 停止</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.recordBtn} onPress={startRecording}>
              <Text style={styles.recordBtnText}>🎙 开始录音</Text>
            </Pressable>
          )}
        </View>

        {/* Open Date */}
        <View style={styles.dateSection}>
          <Text style={styles.dateLabel}>📅 开启日期</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.dateText}>{fmtDate(openDate)}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={openDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              minimumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowPicker(false);
                if (selectedDate) {
                  setOpenDate(selectedDate);
                }
              }}
            />
          )}
        </View>

        {/* Save Button */}
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{isEdit ? '更新' : '创建'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110 },
  titleInput: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 20,
  },
  contentInput: {
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    minHeight: 160,
    marginBottom: 20,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateText: {
    fontSize: 16,
    color: colors.text,
  },
  saveBtn: {
    backgroundColor: colors.orange,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  audioSection: {
    marginBottom: 24,
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  audioPreview: {
    flexDirection: 'row',
    gap: 12,
  },
  playBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  playBtnText: {
    fontSize: 14,
    color: colors.orangeDark,
    fontWeight: '600',
  },
  deleteAudioBtn: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteAudioText: {
    fontSize: 14,
    color: colors.subtext,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 14,
  },
  recordingDot: {
    fontSize: 16,
    color: colors.danger,
  },
  recordingText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  stopBtn: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stopBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  recordBtn: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  recordBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
