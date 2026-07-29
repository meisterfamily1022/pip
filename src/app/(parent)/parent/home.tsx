import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { playmapTheme as theme, screenContentStyle } from '@/theme/playmap-theme';

const destinations = [
  { href: '/parent/toy-library', icon: '🧸', title: 'Toy Library', description: 'Browse and manage all toys', tint: theme.colors.sageSoft },
  { href: '/parent/locations', icon: '📍', title: 'Locations', description: 'Rooms and storage spots', tint: theme.colors.yellowSoft },
  { href: '/child/home', icon: '🦊', title: 'Child Mode', description: 'Let your child explore and choose', tint: theme.colors.peachSoft },
  { href: '/parent/settings', icon: '⚙️', title: 'Settings', description: 'Preferences and customization', tint: theme.colors.lavenderSoft },
] as const;

export default function ParentHomeRoute() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.header}><Text style={styles.eyebrow}>PLAYMAP</Text><Text accessibilityRole="header" style={styles.title}>Hello!</Text><Text style={styles.description}>Everything in its place, play starts with ease.</Text></View>
      <View style={styles.welcome}><Text style={styles.welcomeIcon}>♡</Text><View style={styles.welcomeText}><Text style={styles.welcomeTitle}>Your play space</Text><Text style={styles.welcomeBody}>Choose where you’d like to go.</Text></View></View>
      <View style={styles.links}>{destinations.map((item) => <Link key={item.href} href={item.href} asChild><Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.link, { backgroundColor: item.tint }])}><Text style={styles.icon}>{item.icon}</Text><View style={styles.linkText}><Text style={styles.linkTitle}>{item.title}</Text><Text style={styles.linkDescription}>{item.description}</Text></View><Text style={styles.chevron}>›</Text></Pressable></Link>)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { ...screenContentStyle, backgroundColor: theme.colors.background, flexGrow: 1, gap: 22 },
  header: { gap: 6, paddingTop: 18 }, eyebrow: { color: theme.colors.coralDark, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.coral, fontFamily: 'Georgia', fontSize: theme.type.display, fontWeight: '700' },
  description: { color: theme.colors.mutedText, fontSize: theme.type.body, lineHeight: 24 },
  welcome: { ...theme.shadows.card, alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, flexDirection: 'row', gap: 14, padding: 18 },
  welcomeIcon: { color: theme.colors.coral, fontSize: 38 }, welcomeText: { flex: 1, gap: 3 }, welcomeTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700' }, welcomeBody: { color: theme.colors.mutedText, fontSize: 15 },
  links: { gap: 12 }, link: { ...theme.shadows.card, alignItems: 'center', borderColor: 'rgba(100,90,75,0.08)', borderRadius: theme.radii.lg, borderWidth: 1, flexDirection: 'row', gap: 16, minHeight: 96, padding: 18 },
  icon: { fontSize: 34, width: 44 }, linkText: { flex: 1, gap: 4 }, linkTitle: { color: theme.colors.text, fontFamily: 'Georgia', fontSize: 21, fontWeight: '700' }, linkDescription: { color: theme.colors.mutedText, fontSize: 14, lineHeight: 19 }, chevron: { color: theme.colors.mutedText, fontSize: 32 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
