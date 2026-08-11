import {
  DestructiveButton,
  EmptyStateCard,
  ErrorStateCard,
  PageShell,
  PrimaryButton,
  SecondaryButton,
  SkeletonRows,
} from './playmap-ui';

/** The shared states the Spaces screens show while loading, failing or empty. */

type LocationButtonProps = { label: string; onPress(): void; destructive?: boolean; primary?: boolean };

export function LocationButton({ label, onPress, destructive = false, primary = false }: LocationButtonProps) {
  if (primary) return <PrimaryButton label={label} onPress={onPress} />;
  return destructive ? <DestructiveButton label={label} onPress={onPress} /> : <SecondaryButton label={label} onPress={onPress} />;
}

export function LocationError({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <ErrorStateCard
      action={<LocationButton label="Try again" onPress={onRetry} />}
      message={message}
      title="Your spaces could not load"
    />
  );
}

/** Skeleton rows rather than a spinner: the shape of the list arrives first. */
export function LocationLoading() {
  return (
    <PageShell scroll={false}>
      <SkeletonRows label="Loading your rooms…" rows={4} />
    </PageShell>
  );
}

export function LocationEmpty({ onAddRoom }: { onAddRoom(): void }) {
  return (
    <EmptyStateCard
      action={<LocationButton label="Add a room" onPress={onAddRoom} primary />}
      icon="spaces"
      message="A room and a spot inside it is all Pip needs to say where a toy belongs."
      title="No rooms yet"
    />
  );
}
