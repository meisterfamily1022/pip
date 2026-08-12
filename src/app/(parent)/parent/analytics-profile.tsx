import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ParentScreen } from '@/components/parent-ui';
import { Banner, PrimaryButton, SecondaryButton } from '@/components/playmap-ui';
import { saveAnalyticsProfile, type AnalyticsHouseholdProfile } from '@/features/analytics/analytics-service';
import { playmapTheme as theme } from '@/theme/playmap-theme';

const childOptions = ['1','2','3','4+','prefer_not_to_say'] as const;
const caregiverOptions = ['1','2','3+','prefer_not_to_say'] as const;
const ages = ['under_4','4_6','7_9','10_12','13_plus','prefer_not_to_say'] as const;

export default function AnalyticsProfileRoute() {
  const [childCountBand, setChild] = useState<AnalyticsHouseholdProfile['childCountBand']>('prefer_not_to_say');
  const [caregiverCountBand, setCaregiver] = useState<AnalyticsHouseholdProfile['caregiverCountBand']>('prefer_not_to_say');
  const [childAgeBands, setAges] = useState<AnalyticsHouseholdProfile['childAgeBands']>(['prefer_not_to_say']);
  const [countryCode, setCountry] = useState(''); const [regionCode, setRegion] = useState(''); const [notice, setNotice] = useState<string | null>(null);
  const chooseAge = (age: typeof ages[number]) => setAges((current) => age === 'prefer_not_to_say' ? [age] : [...new Set(current.filter((item) => item !== 'prefer_not_to_say').concat(age))]);
  const save = async () => { try { await saveAnalyticsProfile({ childCountBand, caregiverCountBand, childAgeBands, countryCode: countryCode.trim().toUpperCase() || null, regionCode: regionCode.trim().toUpperCase() || null }); setNotice('Optional profile saved.'); } catch { setNotice('The optional profile could not be saved.'); } };
  return <ParentScreen tab="settings"><Text accessibilityRole="header" style={styles.title}>Optional household profile</Text><Text style={styles.body}>Share only broad bands. This is optional, used only in staff aggregates, and never identifies a child. Choose Prefer not to say or leave geography blank.</Text>{notice ? <Banner message={notice} tone={notice.includes('could not') ? 'alert' : 'info'} /> : null}
    <Choice label="Children in household" options={childOptions} value={childCountBand} onChange={setChild} />
    <Choice label="Caregivers" options={caregiverOptions} value={caregiverCountBand} onChange={setCaregiver} />
    <View style={styles.group}><Text style={styles.heading}>Child age bands (select all that apply)</Text><View style={styles.row}>{ages.map((age) => <SecondaryButton key={age} label={age.replaceAll('_',' ')} onPress={() => chooseAge(age)} />)}</View></View>
    <TextInput accessibilityLabel="Country code" autoCapitalize="characters" maxLength={2} onChangeText={setCountry} placeholder="Country code, e.g. US (optional)" style={styles.input} value={countryCode} />
    <TextInput accessibilityLabel="State or province code" autoCapitalize="characters" maxLength={12} onChangeText={setRegion} placeholder="State/province, e.g. NY (optional)" style={styles.input} value={regionCode} />
    <PrimaryButton label="Save optional profile" onPress={() => { void save(); }} />
  </ParentScreen>;
}
function Choice<T extends string>({label,options,value,onChange}:{label:string;options:readonly T[];value:T|null;onChange:(value:T)=>void}) { return <View style={styles.group}><Text style={styles.heading}>{label}</Text><View style={styles.row}>{options.map((option)=><SecondaryButton key={option} label={option.replaceAll('_',' ')} onPress={()=>onChange(option)} />)}</View><Text style={styles.selected}>Selected: {value?.replaceAll('_',' ')}</Text></View>; }
const styles=StyleSheet.create({title:{color:theme.colors.primaryText,...theme.typography.pageTitle},body:{color:theme.colors.secondaryText,...theme.typography.body},heading:{color:theme.colors.primaryText,...theme.typography.label},group:{gap:theme.spacing[8]},row:{flexDirection:'row',flexWrap:'wrap',gap:theme.spacing[8]},selected:{color:theme.colors.mutedText,...theme.typography.meta},input:{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,borderRadius:theme.radii.medium,borderWidth:1,color:theme.colors.primaryText,padding:theme.spacing[12],...theme.typography.body}});
