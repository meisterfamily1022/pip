import type { ParentToy } from '@/repositories/toys-repository';
import {
  DestructiveButton,
  ErrorStateCard,
  FilterChip,
  PageShell,
  SecondaryButton,
  SkeletonGrid,
  ToyImage,
  ToyPhotoCard,
  type ToyCardStatus,
} from './playmap-ui';

type ToyButtonProps = {
  label: string;
  onPress(): void;
  destructive?: boolean;
  disabled?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
};

export function ToyButton({ label, onPress, destructive = false, disabled = false, selected = false, accessibilityLabel }: ToyButtonProps) {
  if (selected) return <FilterChip label={label} onPress={onPress} selected />;
  const Button = destructive ? DestructiveButton : SecondaryButton;
  return <Button accessibilityLabel={accessibilityLabel} disabled={disabled} label={label} onPress={onPress} />;
}

export function ToyImagePreview({ uri }: { uri: string | null }) {
  return <ToyImage accessibilityLabel="Toy photo" uri={uri} />;
}

/**
 * Works out what a toy's card should say from the record itself, so the library
 * grid and every other list agree on what "unavailable" looks like.
 */
export function toyCardStatus(toy: ParentToy, holderName?: string | null): ToyCardStatus {
  if (holderName) return 'checked-out';
  if (toy.isArchived) return 'unavailable';
  if (!toy.isAvailable) return 'hidden';
  if (!toy.imageUri) return 'no-photo';
  return 'available';
}

export function ToyGridCard({ toy, onPress, holderName }: { toy: ParentToy; onPress(): void; holderName?: string | null }) {
  return (
    <ToyPhotoCard
      holderName={holderName ?? undefined}
      location={`${toy.roomName} · ${toy.storageSpotName}`}
      onPress={onPress}
      status={toyCardStatus(toy, holderName)}
      title={toy.name}
      uri={toy.imageUri}
    />
  );
}

export function ToyLoading() {
  return (
    <PageShell scroll={false}>
      <SkeletonGrid label="Loading toys…" tiles={6} />
    </PageShell>
  );
}

export function ToyError({ message, onRetry, actionLabel = 'Try again' }: { message: string; onRetry(): void; actionLabel?: string }) {
  return (
    <PageShell>
      <ErrorStateCard
        action={<ToyButton label={actionLabel} onPress={onRetry} />}
        message={message}
        title="The library could not load"
      />
    </PageShell>
  );
}
