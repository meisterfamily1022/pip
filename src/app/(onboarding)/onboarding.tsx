import { router } from 'expo-router';
import { Text } from 'react-native';

import { PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';

export default function OnboardingHomeRoute() {
  return <OnboardingScreen title="PlayMap" description="Photograph your child’s toys, organize where they belong, and give your child a simpler way to choose what to play with." footer={<PrimaryButton label="Set Up PlayMap" onPress={() => router.push('/parent-pin-setup')} />}><Text>Let’s get the basics ready.</Text></OnboardingScreen>;
}
