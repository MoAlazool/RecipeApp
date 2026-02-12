import { useState, useRef } from 'react';
import { View, StyleSheet, Alert, Image, Pressable } from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';


export default function FridgeScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPremium = useAuthStore((s) => s.user?.is_premium);
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
        {/* Back button */}
        <Pressable style={styles.permBackBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1510" />
        </Pressable>

        <View style={styles.permContent}>
          <View style={styles.permIconWrap}>
            <Ionicons name="camera-outline" size={36} color="#C66E4E" />
          </View>
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            Allow camera access to scan your fridge and identify ingredients automatically
          </Text>

          <Pressable
            style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={requestPermission}
          >
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.galleryButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={pickImage}
          >
            <Ionicons name="images-outline" size={18} color="#1A1510" />
            <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
          </Pressable>
        </View>
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
          <Pressable style={({ pressed }) => [styles.retakeButton, pressed && { opacity: 0.8 }]} onPress={handleReset}>
            <Text style={styles.retakeButtonText}>Retake</Text>
          </Pressable>
        ) : (
          <>
            {/* Recent Activity Button */}
            {isPremium && (
              <Pressable
                style={styles.recentActivityButton}
                onPress={handleOpenRecentScans}
              >
                <Ionicons name="time-outline" size={20} color="#FFF" />
                <Text style={styles.recentActivityText}>Recent Activity</Text>
              </Pressable>
            )}

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
    backgroundColor: '#FAFAF8',
  },
  permBackBtn: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  permContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#1A1510',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#8A8578',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1A1510',
    borderRadius: 18,
    paddingHorizontal: 32,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 12,
  },
  permissionButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    borderRadius: 18,
    paddingHorizontal: 32,
    paddingVertical: 16,
    width: '100%',
  },
  galleryButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1A1510',
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
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#FFF',
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
