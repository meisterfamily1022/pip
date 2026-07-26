import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function ParentHomeRoute() {
  return <View style={styles.container}><Text style={styles.title}>Parent Home</Text><Text style={styles.description}>Manage your PlayMap setup.</Text><View style={styles.links}><Link href="/parent/toy-library" asChild><Pressable accessibilityRole="button" style={styles.link}><Text>Toy Library</Text></Pressable></Link><Link href="/parent/locations" asChild><Pressable accessibilityRole="button" style={styles.link}><Text>Locations</Text></Pressable></Link><Link href="/parent/settings" asChild><Pressable accessibilityRole="button" style={styles.link}><Text>Settings</Text></Pressable></Link><Link href="/child/home" asChild><Pressable accessibilityRole="button" style={styles.link}><Text>Child Mode</Text></Pressable></Link></View></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, gap: 16, padding: 24, paddingTop: 56 }, title: { fontSize: 32, fontWeight: '700' }, description: { color: '#4B4B55', fontSize: 17 }, links: { gap: 12, marginTop: 16 }, link: { borderColor: '#B8B8C2', borderRadius: 10, borderWidth: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: 16 }, });
