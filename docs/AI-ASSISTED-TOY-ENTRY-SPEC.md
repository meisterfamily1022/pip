# AI-Assisted Toy Entry Specification

Status: planning only. This document does not authorize a mobile API key, automatic toy creation, generated images, or a production implementation.

## Purpose and non-goals

AI-assisted toy entry is an optional Parent Mode helper. A parent may explicitly submit one chosen toy photograph to a Pip-controlled service and receive editable suggestions for the existing Add Toy form. Manual entry remains immediately available and fully functional with no internet connection.

The child's real toy photo remains the child-facing image. The feature does not generate or replace images, save or update a toy automatically, make medical, therapeutic, developmental, safety, age, identity, preference, price, or brand claims, or provide play instructions.

This supersedes the relevant future-feature assumption in `docs/V1-SCOPE.md`; the V1 scope and current privacy statement remain accurate until this feature is actually released.

## Existing application fit

The current `ToyForm` owns photo selection and all form state. `createParentToy` and `updateParentToy` apply validation and only persist after the existing Save Toy action. The form requires a photo, name, valid room and storage spot, and at least one existing play category. It already exposes cleanup difficulty and adult-help fields. Local toy photos are copied to the app document directory through `expo-file-system`; they are not currently uploaded.

Implementation must preserve this boundary:

```text
Select or take photo -> local form state -> [optional Suggest Details] -> editable form state -> Save Toy -> existing validation -> local SQLite record
                                      \-> no automatic SQLite write
```

Use the existing fixed category values from `src/domain/play-category.ts`: `quiet`, `active`, `creative`, `building`, `pretend`, `sensory`, `independent`, `together`, `indoor`, and `outdoor`. Use existing cleanup values: `easy`, `medium`, and `big`.

The repository contains earlier AI-oriented metadata and a draft table, including enhanced-image fields. This release must not use enhanced images or add image generation. Before implementation, reconcile or remove unused fields separately; do not make that migration silently as part of this feature.

## Strict AI V1.1 contract

The backend accepts exactly one image and a schema version; the mobile request contains no toy name, child nickname, PIN, room, storage spot, household data, or free-text prompt.

### Request

`POST /v1/toy-analysis`

- `image`: one processed JPEG or PNG image, maximum 5 MiB after client preparation and 8 MiB enforced at the edge.
- `schemaVersion`: `"1.1"`.
- `idempotencyKey`: random UUID for one parent action.
- installation/account credential: transport credential only; never derived from a child or household field.

The exact upload format (multipart or short-lived upload URL) is an implementation decision. It must use HTTPS and include no metadata beyond the image, schema version, and diagnostic-safe request identifier.

### Response

The backend returns only this object after schema validation:

```ts
type ToyAnalysisV11 = {
  suggestedName: string | null;
  suggestedCategories: Array<
    'quiet' | 'active' | 'creative' | 'building' | 'pretend' |
    'sensory' | 'independent' | 'together' | 'indoor' | 'outdoor'
  >;
  suggestedCleanupDifficulty: 'easy' | 'medium' | 'big' | null;
  suggestedAdultHelpRequired: boolean | null;
  confidence: 'low' | 'medium' | 'high';
  warnings: Array<
    'image_unclear' | 'multiple_toys_detected' |
    'toy_not_identified' | 'adult_review_recommended'
  >;
};
```

Rules:

- All keys are required; a missing value is represented as `null` or `[]` where shown.
- `suggestedName` is plain text, trimmed, 1–80 characters if present; reject control characters and markup.
- Categories are unique and must be from the allowlist. At most 10 are returned.
- `warnings` are unique, allowlisted machine values. The client maps them to neutral copy.
- `confidence` determines whether suggestions are shown by default; it is never displayed as a score or scientific certainty. Low confidence should not preselect a name and should surface a neutral review message.
- The provider response may contain no other field. The backend discards unknown fields and returns a safe failure when required fields are invalid.

The backend response may additionally use an HTTP header or envelope for `requestId`, cached-result status, and allowance status. Those diagnostics must not enter the toy record.

## Parent interaction

1. Parent opens Add Toy and takes or selects a photo using the existing controls.
2. Manual fields remain editable immediately. If there is no photo, the secondary action is disabled with the explanation “Add a photo to get suggestions.”
3. After a photo is selected, show the secondary button **Suggest Details**, separate from the primary **Save Toy** action.
4. Nearby explanation: “Pip can analyze this photo to suggest a toy name and categories. You can review and change everything before saving.” First use also links to the AI privacy notice.
5. Tapping Suggest Details is the explicit consent/action for that one request. The button becomes disabled while the request is active; do not submit when the form is saving.
6. Show a calm, non-blocking loading state: “Looking at the photo…” with Cancel. Keep the photo and every manually entered form value visible and editable where practical.
7. On success, show an “AI suggestions” label and per-field provenance. Apply high- or medium-confidence values only to untouched/empty fields; for populated fields, present an accept control rather than overwriting. Low-confidence values are available for review but not automatically applied.
8. The parent can accept, edit, remove, or ignore every suggestion. Suggested categories appear as individually removable chips or normal category selections. Cleanup and adult-help suggestions use clearly selectable existing controls. Warnings are neutral and never block manual save.
9. Existing validation runs unchanged when the parent presses **Save Toy**. Only that normal save action calls `createParentToy`; AI success must not write a toy, update an existing toy, change the child-facing image, or navigate away.
10. After the parent changes the selected image, clear the prior suggestions and provenance, because they refer to the old image. Keep all manually entered values.

For Edit Toy, follow the same opt-in behavior only if the owner approves it after Add Toy beta evidence. Initial implementation scope is Add Toy only; an edit request must never modify a saved toy until the existing Save Changes action is pressed.

## Failure and recovery behavior

Every failure returns control to normal manual entry, preserves the selected photo and all form data, and offers a non-technical retry only when appropriate. Do not show provider error text.

| Condition | Parent-facing result | Retry / accounting |
| --- | --- | --- |
| AI unavailable or provider error | “Suggestions are unavailable right now. You can keep adding this toy manually.” | Retry later; provider-attempt policy applies. |
| No internet | “You’re offline. You can add this toy manually and try suggestions later.” | Do not consume allowance. |
| Timeout | “That took too long. Your details are still here.” | One retry with the same idempotency key/request state; no double charge. |
| Parent cancels | Stop awaiting result; discard late result from UI. | No charge if backend cancels before provider submission; otherwise count once. |
| Image too large | “Choose a smaller photo to get suggestions. You can still save this toy manually.” | Do not consume allowance. |
| Unsupported image | “That photo format can’t be analyzed. Try a JPEG or PNG, or add details manually.” | Do not consume allowance. |
| Multiple toys | Apply only safe suggestions and show “More than one toy may be in this photo. Please review.” | Counts if provider analyzed it. |
| Unclear photo / not identified | Show warning and leave fields unchanged unless safe suggestions exist. | Counts if provider analyzed it. |
| Provider refusal | “Suggestions aren’t available for this photo. You can add details manually.” | Count once only if provider was invoked. |
| Invalid structured response | Safe generic unavailable state; do not populate anything. | Count provider attempt once; alert internally by request ID. |
| Rate limit | “Please wait a moment before trying again.” | Do not consume a monthly scan. |
| Monthly allowance reached | “You’ve used this month’s suggestions. You can keep adding toys manually.” | Do not retry until allowance resets or the owner-approved upgrade path applies. |

## State and accessibility requirements

- Maintain a request state machine: `idle`, `checking`, `submitting`, `ready`, `failed`, `cancelled`, `limited`.
- One active request per form/photo; ignore rapid repeat taps and prevent a stale response from applying after replacement, cancellation, navigation, or a newer request.
- Associate suggestions with a local photo fingerprint and a form-session ID, not a toy record ID.
- Announce loading, success, warning, and failure messages using accessible live regions. Buttons expose disabled/busy state and Cancel has an accessible label.
- Persist no provider key or raw provider response in SQLite. If the owner approves local draft persistence later, persist only the reviewed allowed fields, status, request ID, schema version, and consent timestamp, with an expiry policy.

## Expo v57 implementation notes

The installed `expo-image-picker` version is SDK 57-compatible. Its selected image asset can supply URI, MIME type, dimensions, and often file size; treat absent MIME type or size as untrusted and validate again on the backend. Camera and library actions must originate from user interaction, and Android recovery should account for `ImagePicker.getPendingResultAsync`. `expo-image-picker` does not include EXIF data unless explicitly requested; do not request it. Use the installed `expo-file-system` API for local staging only. Future image resize/compression needs a reviewed, SDK 57-compatible approach before adding a dependency.

Sources: [Expo ImagePicker SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/) and [Expo FileSystem SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/).
