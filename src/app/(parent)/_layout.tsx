import { Stack } from 'expo-router';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function ParentLayout() {
  return <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.background }, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerTintColor: theme.colors.primary, headerStyle: { backgroundColor: theme.colors.background } }}><Stack.Screen name="parent/home" options={{ headerShown: false }} /><Stack.Screen name="parent/toy-library" options={{ headerShown: false }} /><Stack.Screen name="parent/locations" options={{ headerShown: false }} /><Stack.Screen name="parent/settings" options={{ headerShown: false }} /><Stack.Screen name="parent/add-toy" options={{ title: 'Add a New Toy' }} /><Stack.Screen name="parent/edit-toy" options={{ title: 'Edit Toy' }} /></Stack>;
}
