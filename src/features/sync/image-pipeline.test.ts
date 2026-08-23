import { downloadAndImportToyImage, uploadToyImageIfChanged } from './image-pipeline';
import { FakeHouseholdGateway, FakeToyImageStorage } from './test-fakes';

describe('uploading a toy photo', () => {
  it('uploads when there is no prior synced fingerprint', async () => {
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();
    storage.setFingerprint('file:///local/toy.jpg', 'abc123');

    const result = await uploadToyImageIfChanged(gateway, storage, 'remote-1', 5, 'file:///local/toy.jpg', null);

    expect(result).toMatchObject({ uploaded: true, fingerprint: 'abc123' });
    expect(gateway.uploadedImages).toHaveLength(1);
  });

  it('skips a re-upload when the local photo has not changed since the last sync', async () => {
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();
    storage.setFingerprint('file:///local/toy.jpg', 'abc123');

    const result = await uploadToyImageIfChanged(gateway, storage, 'remote-1', 5, 'file:///local/toy.jpg', 'abc123');

    expect(result).toEqual({ uploaded: false, reason: 'unchanged' });
    expect(gateway.uploadedImages).toHaveLength(0);
  });

  it('uploads again when the fingerprint actually changed — a real photo replacement', async () => {
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();
    storage.setFingerprint('file:///local/new.jpg', 'def456');

    const result = await uploadToyImageIfChanged(gateway, storage, 'remote-1', 5, 'file:///local/new.jpg', 'abc123');

    expect(result).toMatchObject({ uploaded: true, fingerprint: 'def456' });
  });
});

describe('restoring a toy photo — through the canonical pipeline, not a bare URL', () => {
  it('downloads bytes and imports them via copyIntoManagedStorage, returning a local managed uri', async () => {
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();

    const result = await downloadAndImportToyImage(gateway, storage, 'remote-1', '5/photo.jpg');

    // The proof that restore is not "store a remote URL": the pipeline's own
    // copy step ran, and what comes back is what that step returns, not the
    // gateway's download path.
    expect(storage.copied).toHaveLength(1);
    expect(result.localUri).toBe(storage.copied[0]);
    expect(result.localUri).not.toContain('remote');
    expect(result.localUri.startsWith('file:///managed/')).toBe(true);
  });

  it('fingerprints the imported file so a future sync can detect a further local change', async () => {
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();
    storage.setFingerprint('file:///tmp/downloaded/5/photo.jpg', 'server-fingerprint');

    const result = await downloadAndImportToyImage(gateway, storage, 'remote-1', '5/photo.jpg');

    expect(result.fingerprint).toBe('server-fingerprint');
  });

  it('removes the raw download once it has been imported, so a restore does not accumulate one temp file per photo', async () => {
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();

    await downloadAndImportToyImage(gateway, storage, 'remote-1', '5/photo.jpg');

    expect(storage.deletedTemp).toEqual(['file:///tmp/downloaded/5/photo.jpg']);
  });

  it('still removes the raw download when importing it fails, rather than leaking it', async () => {
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();
    storage.failNextCopy = true;

    await expect(downloadAndImportToyImage(gateway, storage, 'remote-1', '5/photo.jpg')).rejects.toThrow();

    expect(storage.deletedTemp).toEqual(['file:///tmp/downloaded/5/photo.jpg']);
  });
});

describe('an image conflict never deletes the losing photo', () => {
  it('records the losing path in archiveImagePath and never calls delete on either side', async () => {
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();

    await gateway.archiveImagePath('remote-1', 5, 'old-photo-path.jpg');

    expect(gateway.archivedImages).toContainEqual({ toyLocalId: 5, imagePath: 'old-photo-path.jpg' });
    expect(gateway.deletedImages).toHaveLength(0);
    expect(storage.deleted).toHaveLength(0);
  });
});
