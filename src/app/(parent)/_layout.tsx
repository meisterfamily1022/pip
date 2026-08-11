import { Stack } from 'expo-router';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function ParentLayout() {
  // `headerShown: false` belongs on the group, not on each screen: Parent Mode
  // draws its own headers and its navigation is the tab bar. Listing screens
  // individually meant any route added later inherited the platform header and
  // showed its own path — "parent/toy-detail" — as the title.
  return <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.background }, headerShown: false, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerTintColor: theme.colors.primary, headerStyle: { backgroundColor: theme.colors.background } }}><Stack.Screen name="parent/home" options={{ headerShown: false }} /><Stack.Screen name="parent/select-child" options={{ headerShown: false }} /><Stack.Screen name="parent/toy-library" options={{ headerShown: false }} /><Stack.Screen name="parent/locations" options={{ headerShown: false }} /><Stack.Screen name="parent/settings" options={{ headerShown: false }} /><Stack.Screen name="parent/add-location" options={{ headerShown: false }} /><Stack.Screen name="parent/edit-location" options={{ headerShown: false }} /><Stack.Screen name="parent/add-toy" options={{ headerShown: false }} /><Stack.Screen name="parent/edit-toy" options={{ headerShown: false }} /></Stack>;
}
