import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CameraIcon } from '@/design/icons';
import { colors, radii } from '@/design/tokens';

/**
 * A toy's photo, or the design's peach placeholder well when it has none.
 *
 * The design frames toy photos at a 1.1:1 aspect ratio on a peach ground.
 */

type ToyPhotoProps = {
  uri: string | null;
  /** Spoken description; toy cards pass the toy name. */
  label: string;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ToyPhoto({ uri, label, rounded = false, style }: ToyPhotoProps) {
  return (
    <View style={[styles.frame, rounded && styles.rounded, style]}>
      {uri ? (
        <Image
          accessibilityLabel={`Photo of ${label}`}
          accessible
          contentFit="cover"
          source={uri}
          style={styles.image}
          transition={180}
        />
      ) : (
        <View accessibilityLabel={`${label} has no photo yet`} accessible style={styles.placeholder}>
          <CameraIcon size={34} color={colors.terracotta} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 1.1, backgroundColor: colors.peach, overflow: 'hidden', width: '100%' },
  rounded: { borderRadius: radii.hero },
  image: { height: '100%', width: '100%' },
  placeholder: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
