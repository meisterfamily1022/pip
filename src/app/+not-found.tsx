import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundRoute() {
  return <View><Text>Route not found.</Text><Link href="/">Go to startup</Link></View>;
}
