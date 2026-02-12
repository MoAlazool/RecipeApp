import { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Image,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CookbookScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [pages, setPages] = useState<string[]>([]);
  const [flashEnabled, setFlashEnabled] = useState(false);

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (photo?.uri) {
        setPages(prev => [...prev, photo.uri]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: true,
      });

      if (!result.canceled) {
        const uris = result.assets.map(a => a.uri);
        setPages(prev => [...prev, ...uris]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const removePage = (index: number) => {
    setPages(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtract = () => {
    router.push({
      pathname: '/cookbook-review',
      params: { pages: JSON.stringify(pages) },
    });
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top + 8 }]}>
        {/* Back */}
        <Pressable
          style={[styles.permBackBtn, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1510" />
        </Pressable>

        <View style={styles.permIconWrap}>
          <Ionicons name="camera-outline" size={36} color="#8A8578" />
        </View>
        <Text style={styles.permissionTitle}>Camera Access</Text>
        <Text style={styles.permissionText}>
          We need camera access to photograph your cookbook pages
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={pickImages}
          activeOpacity={0.8}
        >
          <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={flashEnabled}
      />

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 12 }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Cookbook</Text>
        <Pressable style={styles.headerButton} onPress={() => setFlashEnabled(!flashEnabled)}>
          <Ionicons name={flashEnabled ? 'flash' : 'flash-off'} size={20} color="#FFF" />
        </Pressable>
      </View>

      {/* Thumbnail Strip */}
      {pages.length > 0 && (
        <View style={styles.thumbnailStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailScroll}
          >
            {pages.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.thumbnailWrapper}>
                <Image source={{ uri }} style={styles.thumbnail} />
                <Pressable
                  style={styles.thumbnailRemove}
                  onPress={() => removePage(index)}
                  hitSlop={6}
                >
                  <Ionicons name="close-circle" size={20} color="#C66E4E" />
                </Pressable>
                <View style={styles.thumbnailBadge}>
                  <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.pageCountBadge}>
            <Ionicons name="documents-outline" size={13} color="#FFF" />
            <Text style={styles.pageCountText}>
              {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            </Text>
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.captureRow}>
          <Pressable style={styles.galleryIconButton} onPress={pickImages}>
            <Ionicons name="images" size={22} color="#FFF" />
          </Pressable>
          <Pressable style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </Pressable>
          {pages.length > 0 ? (
            <Pressable style={styles.extractButton} onPress={handleExtract}>
              <Ionicons name="sparkles" size={16} color="#FFF" />
              <Text style={styles.extractButtonText}>Extract</Text>
            </Pressable>
          ) : (
            <View style={styles.galleryIconButton} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Permission ──
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FAFAF8',
  },
  permBackBtn: {
    position: 'absolute',
    left: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#1A1510',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#8A8578',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#C66E4E',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  galleryButton: {
    borderWidth: 1,
    borderColor: 'rgba(26, 21, 16, 0.10)',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  galleryButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1A1510',
  },

  // ── Camera ──
  camera: {
    flex: 1,
  },

  // ── Header ──
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },

  // ── Thumbnails ──
  thumbnailStrip: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  thumbnailScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 60,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  thumbnailBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  pageCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  pageCountText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },

  // ── Controls ──
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 16,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  galleryIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#C66E4E',
  },
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C66E4E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  extractButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
