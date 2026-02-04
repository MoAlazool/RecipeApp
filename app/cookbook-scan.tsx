import { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Image,
  Pressable,
  ScrollView,
} from 'react-native';
import { Text, Button } from '@rneui/themed';
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
        <Ionicons name="camera-outline" size={64} color="#C8B7B2" />
        <Text h4 style={styles.permissionTitle}>
          Camera Access Required
        </Text>
        <Text style={styles.permissionText}>
          We need camera access to photograph your cookbook pages
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
          onPress={pickImages}
          buttonStyle={styles.galleryButton}
          titleStyle={styles.galleryButtonText}
        />
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
          <Ionicons name="close" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Cookbook</Text>
        <Pressable style={styles.headerButton} onPress={() => setFlashEnabled(!flashEnabled)}>
          <Ionicons name={flashEnabled ? 'flash' : 'flash-off'} size={22} color="#FFF" />
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
                  <Ionicons name="close-circle" size={22} color="#F2330D" />
                </Pressable>
                <View style={styles.thumbnailBadge}>
                  <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.pageCountBadge}>
            <Ionicons name="documents-outline" size={14} color="#FFF" />
            <Text style={styles.pageCountText}>
              {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            </Text>
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.captureRow}>
          <Pressable style={styles.galleryIconButton} onPress={pickImages}>
            <Ionicons name="images" size={24} color="#FFF" />
          </Pressable>
          <Pressable style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </Pressable>
          {pages.length > 0 ? (
            <Pressable style={styles.extractButton} onPress={handleExtract}>
              <Ionicons name="sparkles" size={18} color="#FFF" />
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
    width: 64,
    height: 84,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFF',
    borderRadius: 11,
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 10,
  },
  pageCountText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
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
    gap: 36,
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
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2330D',
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
