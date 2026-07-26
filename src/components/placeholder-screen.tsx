import { StyleSheet, Text, View } from 'react-native';

type PlaceholderScreenProps = { routeName: string };

export function PlaceholderScreen({ routeName }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PlayMap</Text>
      <Text style={styles.routeName}>{routeName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  routeName: { fontSize: 18 },
});
