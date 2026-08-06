import { Stack } from 'expo-router';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function ChildLayout() {
  return <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.childBackground }, headerShown: false }}><Stack.Screen name="child/home" options={{ title: 'Child Mode' }} /><Stack.Screen name="child/categories" options={{ title: 'Play Type' }} /><Stack.Screen name="child/toy-suggestions" options={{ title: 'Toy Suggestions' }} /><Stack.Screen name="child/toy-detail" options={{ title: 'Find Your Toy' }} /><Stack.Screen name="child/current-toy" options={{ title: 'Current Toy' }} /><Stack.Screen name="child/cleanup" options={{ title: 'Cleanup Time' }} /><Stack.Screen name="child/parent-return" options={{ title: 'Parent Mode' }} /></Stack>;
}
