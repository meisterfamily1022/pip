import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Field } from "@/components/onboarding-controls";
import {
  ChildButton,
  ChildModeHeader,
  LocationPanel,
  ToyImage,
} from "@/components/child-ui";
import { PageHeader, PageShell } from "@/components/playmap-ui";
import { initializeDatabase } from "@/database/client";
import { verifyParentPin } from "@/features/child/parent-access";
import {
  beginCleanup,
  completeCleanup,
  completeCleanupWithParentOverride,
  loadCleanupState,
  requestCleanupHelp,
} from "@/features/child/cleanup-service";
import { pinStorage } from "@/services/pin-storage";
import type { ActivePlaySession } from "@/repositories/play-sessions-repository";
import { playmapTheme as theme } from "@/theme/playmap-theme";
import { getActiveChildProfile } from "@/repositories/child-profiles-repository";

type HelpMode = "child" | "pin" | "parent";

export default function CleanupRoute() {
  const [session, setSession] = useState<ActivePlaySession | null>(null);
  const [cleanupRequired, setCleanupRequired] = useState(true);
  const [step, setStep] = useState(1);
  const [helpMode, setHelpMode] = useState<HelpMode>("child");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [childId, setChildId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    initializeDatabase()
      .then(async (database) => {
        const child = await getActiveChildProfile(database);
        setChildId(child.id);
        const state = await loadCleanupState(database, child.id);
        if (!state.activeSession) return state;
        const active = state.cleanupRequired
          ? await beginCleanup(database, child.id)
          : state.activeSession;
        return { ...state, activeSession: active };
      })
      .then((state) => {
        if (!mounted) return;
        setSession(state.activeSession);
        setCleanupRequired(state.cleanupRequired);
        if (state.activeSession?.helpRequested) setHelpMode("child");
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Could not load cleanup.",
        ),
      )
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const finish = async (parentOverride = false): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      if (!childId) throw new Error("Child profile could not be recovered.");
      if (parentOverride)
        await completeCleanupWithParentOverride(database, childId);
      else await completeCleanup(database, childId);
      router.replace("/child/home");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Could not finish cleanup.",
      );
      setSaving(false);
    }
  };

  const needHelp = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      if (!childId) throw new Error("Child profile could not be recovered.");
      setSession(await requestCleanupHelp(database, childId));
      setHelpMode("child");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Could not request help.",
      );
    } finally {
      setSaving(false);
    }
  };

  const verifyPin = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (!(await verifyParentPin(pinStorage, pin))) {
        setError("That PIN is not correct.");
        return;
      }
      setHelpMode("parent");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Could not verify the PIN.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <PageShell child scroll={false}>
        <ChildModeHeader onBack={() => router.replace("/child/home")} />
        <ActivityIndicator color={theme.colors.sageAction} />
        <Text style={styles.helper}>Loading cleanup…</Text>
      </PageShell>
    );
  if (error && !session)
    return (
      <PageShell child>
        <ChildModeHeader onBack={() => router.replace("/child/home")} />
        <PageHeader
          eyebrow="CLEANUP TIME"
          title="Cleanup"
          subtitle="Let’s get ready for the next play."
        />
        <Text style={styles.error}>{error}</Text>
      </PageShell>
    );
  if (!session)
    return (
      <PageShell child>
        <ChildModeHeader onBack={() => router.replace("/child/home")} />
        <PageHeader
          eyebrow="CLEANUP TIME"
          title="Cleanup"
          subtitle="Let’s get ready for the next play."
        />
        <Text style={styles.stepText}>There is no active toy to clean up.</Text>
      </PageShell>
    );
  if (!session.toy)
    return (
      <PageShell child>
        <ChildModeHeader onBack={() => router.replace("/child/home")} />
        <PageHeader
          eyebrow="CLEANUP TIME"
          title="Cleanup"
          subtitle="Let’s get ready for the next play."
        />
        <Text style={styles.stepText}>
          This toy is missing from the toy library.
        </Text>
        <ChildButton
          label="Mark It Put Away"
          onPress={() => {
            void finish(true);
          }}
        />
      </PageShell>
    );

  if (!cleanupRequired) {
    return (
      <PageShell child>
        <ChildModeHeader
          backLabel="Current toy"
          onBack={() => router.replace("/child/current-toy")}
        />
        <ToyImage uri={session.toy.imageUri} />
        <Text accessibilityRole="header" style={styles.title}>
          All done with {session.toy.name}?
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <ChildButton
          label={saving ? "Finishing…" : "Yes, All Done"}
          disabled={saving}
          onPress={() => {
            void finish(false);
          }}
        />
      </PageShell>
    );
  }

  if (session.helpRequested && helpMode === "child") {
    return (
      <PageShell child>
        <ChildModeHeader
          backLabel="Current toy"
          onBack={() => router.replace("/child/current-toy")}
        />
        <Text accessibilityRole="header" style={styles.title}>
          Ask a grown-up for help.
        </Text>
        <Text style={styles.helper}>
          You can keep playing, or ask a grown-up to help put things away.
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <ChildButton label="Grown-Up Help" onPress={() => setHelpMode("pin")} />
      </PageShell>
    );
  }

  if (helpMode === "pin") {
    return (
      <PageShell child>
        <ChildModeHeader
          backLabel="Cleanup"
          onBack={() => setHelpMode("child")}
        />
        <Text style={styles.eyebrow}>GROWN-UP HELP</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Enter the parent PIN
        </Text>
        <Text style={styles.helper}>A grown-up can help finish cleanup.</Text>
        <Field
          label="Parent PIN"
          value={pin}
          onChangeText={(value) => {
            setPin(value.replace(/\D/g, ""));
            setError(null);
          }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          error={error}
        />
        <ChildButton
          label={saving ? "Checking…" : "Continue"}
          disabled={saving}
          onPress={() => {
            void verifyPin();
          }}
        />
      </PageShell>
    );
  }

  if (helpMode === "parent") {
    return (
      <PageShell child>
        <ChildModeHeader
          backLabel="Cleanup"
          onBack={() => setHelpMode("child")}
        />
        <Text accessibilityRole="header" style={styles.title}>
          Grown-Up Help
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <ChildButton
          label={saving ? "Finishing…" : "Mark It Put Away"}
          disabled={saving}
          onPress={() => {
            void finish(true);
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell child>
      <ChildModeHeader
        backLabel="Current toy"
        onBack={() => router.replace("/child/current-toy")}
      />
      <Text style={styles.eyebrow}>CLEANUP TIME</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Let’s put it away together.
      </Text>
      <Text style={styles.helper}>
        Three gentle steps, then you’re all done.
      </Text>
      <View style={styles.progress}>
        {[1, 2, 3].map((number) => (
          <View key={number} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                number === step && styles.progressDotActive,
              ]}
            >
              <Text style={[styles.progressNumber, number === step && styles.progressNumberActive]}>{number}</Text>
            </View>
            <Text
              style={[
                styles.progressLabel,
                number === step && styles.progressLabelActive,
              ]}
            >
              {number === 1 ? "Pieces" : number === 2 ? "Location" : "Finished"}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.stepBox}>
        {step === 1 && (
          <Text style={styles.stepText}>First, put all the pieces back.</Text>
        )}
        {step === 2 && (
          <>
            <Text style={styles.stepText}>
              Next, put it back where it belongs.
            </Text>
            <LocationPanel
              room={session.toy.roomName}
              spot={session.toy.storageSpotName}
            />
          </>
        )}
        {step === 3 && (
          <>
            <Text style={styles.stepText}>
              Is everything back where it belongs?
            </Text>
            <LocationPanel
              room={session.toy.roomName}
              spot={session.toy.storageSpotName}
            />
          </>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {step < 3 ? (
        <ChildButton
          label="Next"
          onPress={() => setStep((current) => current + 1)}
        />
      ) : (
        <ChildButton
          label={saving ? "Finishing…" : "Yes, All Done"}
          disabled={saving}
          onPress={() => {
            void finish(false);
          }}
        />
      )}
      <ChildButton
        label="I Need Help"
        secondary
        onPress={() => {
          void needHelp();
        }}
      />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: theme.colors.coralDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  helper: { color: theme.colors.secondaryText, fontSize: 17, lineHeight: 25 },
  error: { color: theme.colors.error, fontSize: 17, textAlign: "center" },
  stepBox: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.large,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  stepText: {
    color: theme.colors.primaryText,
    fontFamily: "Georgia",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 32,
    textAlign: "center",
  },
  title: {
    color: theme.colors.primaryText,
    fontFamily: "Georgia",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
  },
  progress: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  progressItem: { alignItems: "center", flex: 1, gap: 6 },
  progressDot: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceYellow,
    borderRadius: 28,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  progressDotActive: { backgroundColor: theme.colors.sageAction },
  progressNumber: {
    color: theme.colors.primaryText,
    fontSize: 22,
    fontWeight: "800",
  },
  progressNumberActive: { color: theme.colors.white },
  progressLabel: {
    color: theme.colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
  },
  progressLabelActive: { color: theme.colors.primaryText },
});
