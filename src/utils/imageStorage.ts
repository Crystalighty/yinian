import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

async function saveToDocuments(sourceUri: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}images/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = `${dir}${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function pickImageFromLibrary(): Promise<string | null> {
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
  if (result.canceled) return null;
  return saveToDocuments(result.assets[0].uri);
}

export async function takePhoto(): Promise<string | null> {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled) return null;
  return saveToDocuments(result.assets[0].uri);
}
