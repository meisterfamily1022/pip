import { DestructiveButton, EmptyStateCard, ErrorStateCard, LoadingState, PageShell, PrimaryButton, SecondaryButton } from './playmap-ui';

type LocationButtonProps = { label: string; onPress(): void; destructive?: boolean; primary?: boolean };
export function LocationButton({ label, onPress, destructive = false, primary = false }: LocationButtonProps) {
  if (primary) return <PrimaryButton label={label} onPress={onPress} />;
  return destructive ? <DestructiveButton label={label} onPress={onPress} /> : <SecondaryButton label={label} onPress={onPress} />;
}

export function LocationError({ message, onRetry }: { message: string; onRetry(): void }) {
  return <ErrorStateCard action={<LocationButton label="Retry" onPress={onRetry} />} message={message} />;
}

export function LocationLoading() { return <PageShell scroll={false}><LoadingState label="Loading locations…" /></PageShell>; }

export function LocationEmpty({ onAddRoom }: { onAddRoom(): void }) {
  return <EmptyStateCard action={<LocationButton label="Add Room" onPress={onAddRoom} />} message="Add your first room to start organizing where toys belong." title="No rooms yet" />;
}
