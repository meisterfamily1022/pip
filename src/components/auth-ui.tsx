import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
} from "react-native";
import { useState, type ReactNode } from "react";

import { RoundedTextInput } from "@/components/playmap-ui";
import { playmapTheme as theme } from "@/theme/playmap-theme";

/**
 * Shared pieces for the account surfaces: sign up, sign in, verification,
 * recovery, and the sensitive-action re-authentication prompts.
 *
 * These exist separately from `playmap-ui` because they carry behaviour the
 * general components should not: credential masking, consent that must never
 * default to accepted, and error summaries that move focus.
 */

type NoticeTone = "info" | "success" | "warning" | "error";

const noticeTone: Record<NoticeTone, { background: string; border: string; text: string }> = {
  info: { background: theme.colors.brandPrimarySoft, border: theme.colors.brandPrimary, text: theme.colors.brandInk },
  success: { background: theme.colors.successSoft, border: theme.colors.success, text: theme.colors.success },
  warning: { background: theme.colors.warningSoft, border: theme.colors.warning, text: theme.colors.warning },
  error: { background: theme.colors.errorSoft, border: theme.colors.error, text: theme.colors.error },
};

/**
 * A short status message. `error` and `warning` announce themselves, because
 * they usually appear in response to something the parent just did.
 */
export function NoticeBanner({
  tone = "info",
  title,
  message,
  action,
}: {
  tone?: NoticeTone;
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  const palette = noticeTone[tone];
  return (
    <View
      accessibilityLiveRegion={tone === "error" || tone === "warning" ? "polite" : "none"}
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: palette.background, borderColor: palette.border }]}
    >
      {title && <Text style={[styles.noticeTitle, { color: palette.text }]}>{title}</Text>}
      <Text style={[styles.noticeMessage, { color: palette.text }]}>{message}</Text>
      {action}
    </View>
  );
}

/**
 * Password entry with a reveal toggle.
 *
 * The toggle is a real button with its own label so a screen reader announces
 * the current state rather than an unlabelled icon.
 */
export function PasswordField({
  label,
  error,
  value,
  onChangeText,
  textContentType = "password",
  autoComplete = "current-password",
  requirementHint,
  ...props
}: Omit<TextInputProps, "secureTextEntry"> & {
  label: string;
  error?: string | null;
  value: string;
  onChangeText: (value: string) => void;
  textContentType?: TextInputProps["textContentType"];
  autoComplete?: TextInputProps["autoComplete"];
  /** Shown under the field until the parent types, e.g. the length rule. */
  requirementHint?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View>
      <RoundedTextInput
        {...props}
        autoCapitalize="none"
        autoComplete={autoComplete}
        autoCorrect={false}
        error={error}
        label={label}
        onChangeText={onChangeText}
        secureTextEntry={!revealed}
        textContentType={textContentType}
        value={value}
      />
      <View style={styles.passwordRow}>
        {requirementHint && !error ? <Text style={styles.hint}>{requirementHint}</Text> : <View />}
        <Pressable
          accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}
          accessibilityRole="button"
          accessibilityState={{ selected: revealed }}
          hitSlop={12}
          onPress={() => setRevealed((current) => !current)}
          style={styles.revealButton}
        >
          <Text style={styles.revealText}>{revealed ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Lists every validation failure above a form.
 *
 * Screen-reader users otherwise have to hunt each field to discover what went
 * wrong, so the summary is announced and rendered before the inputs.
 */
export function ErrorSummary({ title = "Check these details", errors }: { title?: string; errors: readonly string[] }) {
  if (errors.length === 0) return null;
  return (
    <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.summary}>
      <Text style={styles.summaryTitle}>{title}</Text>
      {errors.map((message) => (
        <Text key={message} style={styles.summaryItem}>
          {`• ${message}`}
        </Text>
      ))}
    </View>
  );
}

/**
 * Consent control for Terms and Privacy.
 *
 * `value` has no default and the caller must start it false — consent is never
 * pre-accepted.
 */
export function ConsentCheckbox({
  label,
  value,
  onValueChange,
  error,
  children,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  error?: string | null;
  /** Rendered beside the box, for inline Terms and Privacy links. */
  children?: ReactNode;
}) {
  return (
    <View>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
        style={styles.consentRow}
      >
        <View style={[styles.checkbox, value && styles.checkboxChecked, Boolean(error) && styles.checkboxError]}>
          {value && <Text style={styles.checkmark}>{"✓"}</Text>}
        </View>
        <View style={styles.consentLabel}>{children ?? <Text style={styles.consentText}>{label}</Text>}</View>
      </Pressable>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Shown when a session-bearing action could not reach the server. */
export function OfflineNotice({ message = "You are offline. Pip still works on this device, and changes sync when you reconnect." }: { message?: string }) {
  return <NoticeBanner message={message} tone="warning" title="No connection" />;
}

const styles = StyleSheet.create({
  checkbox: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.small,
    borderWidth: 2,
    height: 28,
    justifyContent: "center",
    marginTop: 2,
    width: 28,
  },
  checkboxChecked: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandInk },
  checkboxError: { borderColor: theme.colors.error },
  checkmark: { color: theme.colors.white, fontSize: 16, fontWeight: "700" },
  consentLabel: { flex: 1 },
  consentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing[12],
    minHeight: theme.measurements.minimumTouchTarget,
    paddingVertical: theme.spacing[8],
  },
  consentText: { color: theme.colors.primaryText, ...theme.typography.supporting },
  fieldError: { color: theme.colors.error, ...theme.typography.supporting },
  hint: { color: theme.colors.mutedText, flex: 1, ...theme.typography.caption },
  notice: {
    borderLeftWidth: 4,
    borderRadius: theme.radii.medium,
    gap: theme.spacing[4],
    padding: theme.spacing[16],
  },
  noticeMessage: { ...theme.typography.supporting },
  noticeTitle: { ...theme.typography.label },
  passwordRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -theme.spacing[8],
  },
  revealButton: {
    justifyContent: "center",
    minHeight: theme.measurements.minimumTouchTarget,
    paddingHorizontal: theme.spacing[8],
  },
  revealText: { color: theme.colors.brandInk, ...theme.typography.label },
  summary: {
    backgroundColor: theme.colors.errorSoft,
    borderColor: theme.colors.error,
    borderLeftWidth: 4,
    borderRadius: theme.radii.medium,
    gap: theme.spacing[4],
    padding: theme.spacing[16],
  },
  summaryItem: { color: theme.colors.error, ...theme.typography.supporting },
  summaryTitle: { color: theme.colors.error, ...theme.typography.label },
});
