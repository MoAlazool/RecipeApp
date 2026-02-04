import { useState, useRef } from 'react';
import { View, StyleSheet, Alert, Image, Pressable } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function FridgeScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

  const handleOpenRecentScans = () => {
    router.push('/recent-scans');
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (photo?.uri) {
        router.push({
          pathname: '/fridge-review',
          params: { imageUri: photo.uri },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].uri) {
        router.push({
          pathname: '/fridge-review',
          params: { imageUri: result.assets[0].uri },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleReset = () => {
    setCapturedImage(null);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top + 8 }]}>
        <Ionicons name="camera-outline" size={64} color="#C8B7B2" />
        <Text h4 style={styles.permissionTitle}>
          Camera Access Required
        </Text>
        <Text style={styles.permissionText}>
          We need camera access to scan your fridge and identify ingredients
        </Text>
        <Button
          title="Grant Permission"
          onPress={requestPermission}
          buttonStyle={styles.permissionButton}
          titleStyle={styles.permissionButtonText}
        />
        <Button
          title="Choose from Gallery"
          type="outline"
          onPress={pickImage}
          buttonStyle={styles.galleryButton}
          titleStyle={styles.galleryButtonText}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera/Preview Layer */}
      {capturedImage ? (
        <Image source={{ uri: capturedImage }} style={styles.preview} />
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          enableTorch={flashEnabled}
        />
      )}

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 12 }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Fridge</Text>
        <Pressable style={styles.headerButton} onPress={() => setFlashEnabled(!flashEnabled)}>
          <Ionicons name={flashEnabled ? 'flash' : 'flash-off'} size={22} color="#FFF" />
        </Pressable>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {capturedImage ? (
          <Button title="Retake" onPress={handleReset} type="outline" buttonStyle={styles.retakeButton} />
        ) : (
          <>
            {/* Recent Activity Button */}
            <Pressable
              style={styles.recentActivityButton}
              onPress={handleOpenRecentScans}
            >
              <Ionicons name="time-outline" size={20} color="#FFF" />
              <Text style={styles.recentActivityText}>Recent Activity</Text>
            </Pressable>

            <View style={styles.captureRow}>
              <Pressable style={styles.galleryIconButton} onPress={pickImage}>
                <Ionicons name="images" size={24} color="#FFF" />
              </Pressable>
              <Pressable style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </Pressable>
              <View style={styles.galleryIconButton} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F8F6F5',
  },
  permissionTitle: {
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  permissionText: {
    textAlign: 'center',
    color: '#9C5749',
    marginBottom: 32,
    lineHeight: 22,
    fontFamily: 'NotoSans_500Medium',
  },
  permissionButton: {
    backgroundColor: '#F2330D',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 16,
  },
  permissionButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  galleryButton: {
    borderColor: '#F2330D',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  galleryButtonText: {
    color: '#F2330D',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  camera: {
    flex: 1,
  },
  preview: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
  },
  galleryIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F2330D',
  },
  retakeButton: {
    borderColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 32,
  },
  recentActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 24,
  },
  recentActivityText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
