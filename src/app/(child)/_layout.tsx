import { Stack } from 'expo-router';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function ChildLayout() {
  return <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.childBackground }, headerShown: false }}><Stack.Screen name="child/home" options={{ title: 'Child mode' }} /><Stack.Screen name="child/categories" options={{ title: 'Play type' }} /><Stack.Screen name="child/toy-suggestions" options={{ title: 'Toy suggestions' }} /><Stack.Screen name="child/toy-detail" options={{ title: 'Pick up your toy' }} /><Stack.Screen name="child/current-toy" options={{ title: 'Current toy' }} /><Stack.Screen name="child/cleanup" options={{ title: 'Cleanup time' }} /><Stack.Screen name="child/parent-return" options={{ title: 'Parent mode' }} /></Stack>;
}
