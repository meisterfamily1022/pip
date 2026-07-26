import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '@/components/onboarding-controls';
import { ChildButton } from '@/components/child-ui';
import type { PlayCategory } from '@/domain/play-category';
const choices: readonly { label: string; category: PlayCategory | 'anything' }[] = [{ label: 'Something Quiet', category: 'quiet' }, { label: 'Something Active', category: 'active' }, { label: 'Build Something', category: 'building' }, { label: 'Make Something', category: 'creative' }, { label: 'Pretend', category: 'pretend' }, { label: 'Something Sensory', category: 'sensory' }, { label: 'Play by Myself', category: 'independent' }, { label: 'Play Together', category: 'together' }, { label: 'Play Inside', category: 'indoor' }, { label: 'Play Outside', category: 'outdoor' }, { label: 'Show Me Anything', category: 'anything' }];
export default function ChildCategoriesRoute() { return <ScrollView contentContainerStyle={styles.container}><BackButton onPress={() => router.back()} /><Text accessibilityRole="header" style={styles.title}>What kind of play sounds good?</Text><View style={styles.choices}>{choices.map((choice) => <ChildButton key={choice.category} label={choice.label} onPress={() => router.push({ pathname: '/child/toy-suggestions', params: { category: choice.category } })} />)}</View></ScrollView>; }
const styles = StyleSheet.create({ container: { gap: 18, padding: 24, paddingTop: 52 }, title: { fontSize: 30, fontWeight: '700', lineHeight: 38 }, choices: { gap: 12 } });
