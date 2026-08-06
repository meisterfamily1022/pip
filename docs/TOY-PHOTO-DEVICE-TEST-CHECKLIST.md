# Toy photo intake device-test checklist

The automated suite and browser preview cannot verify native permission dialogs, camera
hardware, Android activity recreation, or OS photo-library behavior. Run this checklist
on at least one current iOS simulator/device and one Android emulator/device before release.

## Build and setup

- [ ] Install a fresh SDK 57 development or release build (not only the web preview).
- [ ] Complete onboarding and create one room with at least two storage spots.
- [ ] Confirm the app configuration displays PlayMap-specific camera and photo permission copy.

## Single toy

- [ ] Tap **Use Camera**. Confirm the screen immediately explains the permission request.
- [ ] Deny permission. Confirm a visible error and usable **Choose a Photo Instead** action.
- [ ] Re-enable permission in OS Settings, reopen the camera, switch cameras, and take a photo.
- [ ] Cancel the camera once. Confirm “Camera canceled” feedback and unchanged form values.
- [ ] Tap **Choose Photo**, cancel once, and confirm visible cancellation feedback.
- [ ] Select a photo, save, restart the app, and confirm the original image still renders.
- [ ] Save a different toy without a photo. Confirm “No photo yet” in Parent and Child Mode.
- [ ] Replace a saved toy photo. Confirm the original managed file is removed only after the update succeeds.
- [ ] Delete the toy. Confirm all original/enhanced managed image files for it are removed.

## Batch review

- [ ] Select one photo with **Choose Multiple** and confirm one editable review card.
- [ ] Select several photos and confirm one card per selected image and correct counters.
- [ ] For every card, edit name, room, storage spot, category, cleanup, adult help, and child availability.
- [ ] Replace one photo and remove another before saving.
- [ ] Leave at least one card incomplete. Save and confirm only valid cards are created.
- [ ] Force one save failure if a debug filesystem/database fault switch is available. Confirm the failed card remains editable.
- [ ] Retry the failed/previously submitted queue twice. Confirm no duplicate toys are created.
- [ ] Kill and restart the app before saving. Confirm the complete review queue and edits return.
- [ ] On Android, enable **Don't keep activities**, pick photos, and confirm pending picker results recover.
- [ ] Kill the app immediately after tapping save, reopen, and retry. Confirm intake-key duplicate protection returns the existing toy.

## Visibility and AI

- [ ] Confirm saved, available toys appear in Parent Mode and Child Mode only after successful persistence.
- [ ] Confirm hidden toys appear in Parent Mode but not Child Mode.
- [ ] Confirm photo upload and toy creation work offline and without AI.
- [ ] If optional AI suggestions are enabled later, confirm no suggestion is saved without explicit parent review.

