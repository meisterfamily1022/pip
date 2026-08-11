import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChildButton, ChildModeHeader, ChildPage, ToyCard } from '@/components/child-ui';
import { Banner, SkeletonGrid } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import { recommendToys, safeChoiceLimit, type PlayType } from '@/features/child/recommendation-service';
import { offersSpokenLabels, readingSupportOf, showsToyNames, speakToyName } from '@/features/child/spoken-labels';
import { getActiveChildProfile } from '@/repositories/child-profiles-repository';
import { listActivePlaySessions } from '@/repositories/play-sessions-repository';
import { getSettings } from '@/repositories/settings-repository';
import { listChildToys, type ChildToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/** A toy another child is currently playing with, and who has it. */
type HeldToy = { toy: ChildToy; holder: string };

type Suggestions = {
  toys: ChildToy[];
  shown: number[];
  held: HeldToy[];
  showNames: boolean;
  speak: boolean;
};

export function childSuggestionLimit(choiceLimit: number, surprise: boolean): number {
  return surprise ? 1 : safeChoiceLimit(choiceLimit);
}

async function loadSuggestions(category: PlayType, dismissed: readonly number[], surprise: boolean): Promise<Suggestions> {
  const database = await initializeDatabase();
  const settings = await getSettings(database);
  // Ask as the child who is playing; null means Guest.
  const [allToys, sessions] = await Promise.all([
    listChildToys(database, { childId: settings.activeChildId }),
    listActivePlaySessions(database),
  ]);

  // A child's own preference wins over the household default; Guest uses the
  // household setting, since there is no profile to read from.
  let support = readingSupportOf(null);
  let choiceLimit = settings.choiceLimit;
  if (settings.activeChildId !== null) {
    try {
      const profile = await getActiveChildProfile(database);
      support = readingSupportOf(profile.readingSupport);
      choiceLimit = profile.choiceLimit;
    } catch {
      // A missing profile falls back to the household defaults above.
    }
  }

  const toys = recommendToys(allToys, {
    category,
    choiceLimit: childSuggestionLimit(choiceLimit, surprise),
    dismissedIds: dismissed,
  });

  // Toys held by someone else are excluded from the pool by the query. They are
  // surfaced separately so "where is the marble run?" has an answer.
  const held = sessions
    .filter((session): session is typeof session & { toy: ChildToy } => session.toy !== null)
    .filter((session) => session.childId !== settings.activeChildId)
    .filter((session) => category === 'anything' || session.toy.categories.includes(category as PlayCategory))
    .map((session) => ({ toy: session.toy, holder: session.childName }));

  return { toys, shown: [...dismissed, ...toys.map((toy) => toy.id)], held, showNames: showsToyNames(support), speak: offersSpokenLabels(support) };
}

export default function ChildToySuggestionsRoute() {
  const params = useLocalSearchParams<{ category?: string; surprise?: string }>();
  const requested = params.category ?? 'anything';
  const category: PlayType = requested === 'anything' || PLAY_CATEGORIES.includes(requested as PlayCategory)
    ? (requested as PlayType)
    : 'anything';
  const surprise = params.surprise === '1';

  const [state, setState] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (dismissed: readonly number[]) => {
    try {
      setState(await loadSuggestions(category, dismissed, surprise));
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not find any toys.');
    } finally {
      setLoading(false);
    }
  }, [category, surprise]);

  /** Fetching a fresh set is the one place the spinner comes back. */
  const reshuffle = useCallback((dismissed: readonly number[]) => {
    setLoading(true);
    setError(null);
    void load(dismissed);
  }, [load]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await loadSuggestions(category, [], surprise);
        if (active) {
          setState(next);
          setError(null);
        }
      } catch (caught: unknown) {
        if (active) setError(caught instanceof Error ? caught.message : 'Pip could not find any toys.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [category, surprise]);

  const back = (): void => router.replace(surprise ? '/child/home' : '/child/categories');
  const header = <ChildModeHeader backLabel="Back" onBack={back} />;

  if (loading) {
    return (
      <ChildPage>
        {header}
        <SkeletonGrid label="Finding toys…" tiles={surprise ? 1 : 3} />
      </ChildPage>
    );
  }

  if (error) {
    return (
      <ChildPage>
        {header}
        <Banner message={error} tone="alert" />
        <ChildButton label="Try again" onPress={() => reshuffle([])} />
      </ChildPage>
    );
  }

  const { toys, held, showNames, speak } = state ?? { toys: [], held: [], showNames: true, speak: false };

  if (toys.length === 0) {
    return (
      <ChildPage>
        {header}
        <View style={styles.emptyBlock}>
          <Text accessibilityRole="header" style={styles.title}>
            {category === 'anything' ? 'Nothing to play with right now' : `Nothing to ${verbFor(category)} right now`}
          </Text>
          <Text style={styles.subtitle}>
            {held.length > 0
              ? 'They are all out with someone else. Try a different kind of play.'
              : 'Ask a grown-up to add some toys, then come back.'}
          </Text>
        </View>

        {held.length > 0 ? (
          <View style={styles.heldNote}>
            <Text style={styles.heldText}>{describeHolders(held)}</Text>
          </View>
        ) : null}

        <ChildButton label="Try a different kind of play" onPress={() => router.replace('/child/categories')} />
        {category !== 'anything' ? (
          <ChildButton
            label="Show me anything"
            onPress={() => router.replace({ pathname: '/child/toy-suggestions', params: { category: 'anything' } })}
            secondary
          />
        ) : null}
      </ChildPage>
    );
  }

  return (
    <ChildPage>
      {header}
      <Text accessibilityRole="header" style={styles.title}>
        {surprise ? 'How about this one?' : 'Pick one to play with'}
      </Text>

      <View style={styles.list}>
        {toys.map((toy) => (
          <ToyCard
            key={toy.id}
            onPress={() => router.push({
              pathname: '/child/toy-detail',
              params: { id: String(toy.id), category, ...(surprise ? { surprise: '1' } : {}) },
            })}
            onSpeak={speak ? () => speakToyName(toy.name) : undefined}
            showName={showNames}
            toy={toy}
          />
        ))}

        {/* One held toy is shown so a child can see why it is not on offer. */}
        {held.slice(0, 1).map(({ toy, holder }) => (
          <ToyCard key={`held-${toy.id}`} onPress={() => undefined} showName={showNames} toy={toy} unavailableBecause={holder} />
        ))}
      </View>

      <Pressable
        accessibilityLabel={`Show me ${toys.length === 1 ? 'a different toy' : `${toys.length} different toys`}`}
        accessibilityRole="button"
        onPress={() => reshuffle(state?.shown ?? [])}
        style={({ pressed }) => [styles.reshuffle, pressed && styles.pressed]}
      >
        <Text style={styles.reshuffleTitle}>Nothing here feels right?</Text>
        <Text style={styles.reshuffleAction}>
          {toys.length === 1 ? 'Show me a different toy' : `Show me ${toys.length} different toys`}
        </Text>
      </Pressable>
    </ChildPage>
  );
}

function verbFor(category: PlayType): string {
  const verbs: Partial<Record<PlayCategory, string>> = {
    building: 'build with',
    creative: 'make with',
    quiet: 'do quietly',
    active: 'run around with',
    pretend: 'pretend with',
    sensory: 'touch and feel',
    independent: 'play alone with',
    together: 'play together with',
    indoor: 'play with inside',
    outdoor: 'play with outside',
  };
  return verbs[category as PlayCategory] ?? 'play with';
}

function describeHolders(held: readonly HeldToy[]): string {
  const byHolder = new Map<string, string[]>();
  for (const { toy, holder } of held) byHolder.set(holder, [...(byHolder.get(holder) ?? []), toy.name]);
  return [...byHolder.entries()]
    .map(([holder, names]) => `${holder} has ${listNames(names)}.`)
    .join(' ');
}

function listNames(names: readonly string[]): string {
  if (names.length === 1) return `the ${names[0]}`;
  return `the ${names.slice(0, -1).join(', the ')} and the ${names[names.length - 1]}`;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  title: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 30, lineHeight: 34 },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.body },
  emptyBlock: { gap: 6, paddingTop: theme.spacing[16] },
  list: { gap: theme.spacing[12] },
  heldNote: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    padding: theme.spacing[16],
  },
  heldText: { color: theme.colors.secondaryText, ...theme.typography.body },
  reshuffle: {
    alignItems: 'center',
    borderColor: theme.colors.dashedBorder,
    borderRadius: theme.radii.card,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 4,
    minHeight: theme.measurements.childButtonHeight,
    justifyContent: 'center',
    padding: theme.spacing[16],
  },
  reshuffleTitle: { color: theme.colors.secondaryText, ...theme.typography.meta },
  reshuffleAction: { color: theme.colors.brandInk, ...theme.typography.rowTitle },
});
