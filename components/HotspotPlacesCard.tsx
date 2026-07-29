import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from './Themed';
import { Card } from './Card';
import { SectionHeader } from './SectionHeader';
import { addHotspotPlace, getHotspotPlaces, removeHotspotPlace } from '@/lib/storage';
import { getCurrentCoords, hasLocationPermission, requestLocationPermission } from '@/lib/location';
import { HotspotPlace } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

const DEFAULT_RADIUS_METERS = 150;

export function HotspotPlacesCard() {
  const { t } = useI18n();
  const [places, setPlaces] = useState<HotspotPlace[]>([]);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  const border = useThemeColor({}, 'border');
  const subtle = useThemeColor({}, 'subtle');
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');

  const load = useCallback(async () => {
    const [list, granted] = await Promise.all([getHotspotPlaces(), hasLocationPermission()]);
    setPlaces(list);
    setPermissionGranted(granted);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleEnableLocation = async () => {
    const granted = await requestLocationPermission();
    setPermissionGranted(granted);
    if (!granted) {
      setNotice({ title: t('hotspot.deniedTitle'), body: t('hotspot.deniedBody') });
    }
  };

  const handleSavePlace = async () => {
    if (!label.trim()) {
      setNotice({ title: t('hotspot.namePromptTitle'), body: t('hotspot.namePromptBody') });
      return;
    }
    setSaving(true);
    try {
      const coords = await getCurrentCoords();
      if (!coords) {
        setNotice({ title: t('hotspot.locationErrorTitle'), body: t('hotspot.locationErrorBody') });
        return;
      }
      const next = await addHotspotPlace({
        label: label.trim(),
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: DEFAULT_RADIUS_METERS,
      });
      setPlaces(next);
      setLabel('');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    const next = await removeHotspotPlace(id);
    setPlaces(next);
  };

  return (
    <Card>
      <SectionHeader icon="location-outline" title={t('hotspot.title')} subtitle={t('hotspot.description')} />

      {notice && (
        <View style={[styles.infoBanner, { borderColor: accent, backgroundColor: accentSoft }]}>
          <View style={styles.infoBannerContent}>
            <Text style={[styles.infoBannerTitle, { color: accent }]}>{notice.title}</Text>
            <Text style={[styles.infoBannerBody, { color: subtle }]}>{notice.body}</Text>
          </View>
          <Pressable
            onPress={() => setNotice(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={16} color={subtle} />
          </Pressable>
        </View>
      )}

      {permissionGranted === false && (
        <Pressable style={[styles.enableButton, { borderColor: tint, marginBottom: 12 }]} onPress={handleEnableLocation}>
          <Text style={{ color: tint, fontWeight: '700' }}>{t('hotspot.enableLocation')}</Text>
        </Pressable>
      )}

      {places.map((p) => (
        <View key={p.id} style={[styles.placeRow, { borderColor: border }]}>
          <Ionicons name="location" size={14} color={subtle} style={{ marginRight: 6 }} />
          <Text style={styles.placeLabel} numberOfLines={1}>
            {p.label}
          </Text>
          <Pressable
            onPress={() => handleRemove(p.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${t('common.remove')} ${p.label}`}>
            <Ionicons name="close" size={16} color={subtle} />
          </Pressable>
        </View>
      ))}

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { borderColor: border, color: textColor }]}
          placeholder={t('hotspot.placeholder')}
          placeholderTextColor={subtle}
          value={label}
          onChangeText={setLabel}
        />
        <Pressable
          style={[styles.saveButton, { backgroundColor: label.trim() ? tint : border }]}
          onPress={handleSavePlace}
          disabled={!label.trim() || saving}>
          {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveButtonText}>{t('hotspot.saveHere')}</Text>}
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  infoBannerBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  enableButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  placeLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  saveButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
});
