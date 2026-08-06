# Pip V1 Scope

> **Revised 2026-08-06.** V1 shipped as a local-first, single-device product. A
> follow-on release added a public landing page, optional parent accounts, a
> household container, and multiple child profiles. Those were originally listed
> here as excluded, so this document has been updated to match what the code
> actually does. See
> `docs/implementation/LANDING_ACCOUNTS_PROFILES_DECISION_RECORD.md` for the
> reasoning behind each decision.
>
> **The local-first promise did not change.** Pip still works with no account
> and no internet connection, and toy photos still never leave the device.

## Product Goal

Pip helps a parent photograph and organize toys, then gives a child a simple visual way to choose what to play with, find where the toy belongs, and complete a cleanup routine before choosing again.

Version 1 should prove the core loop:

1. Parent adds toys.
2. Parent assigns each toy a location.
3. Child chooses from a limited number of visual options.
4. Child sees where the toy is stored.
5. Child marks the toy as in use.
6. Child completes cleanup.
7. Child can choose again.

## Included in Version 1

### Parent Setup

- First-launch onboarding
- Four-digit parent PIN
- Optional local child profiles. Child Mode asks who is playing when more than
  one exists, and Guest works when none do
- Working settings only. Settings covers the choice limit, cleanup requirement
  and parent PIN; profiles are managed in Children and the account in Account
- Local data reset with explicit confirmation
- Choice limit of 1, 3, or 5 toys, set per child
- Cleanup requirement setting
- Parent Mode and Child Mode

### Locations

Parents can create:

- Rooms
- Storage spots inside rooms

Examples:

- Playroom → Blue Bin
- Bedroom → Bottom Shelf
- Homeschool Room → Craft Cabinet

Parents can:

- Create locations
- Edit locations
- Delete unused locations

A location cannot be deleted if toys are currently assigned to it.

### Toys

Parents can:

- Take a photo of a toy
- Select an existing photo
- Enter the toy name
- Select the room
- Select the storage spot
- Select one or more play categories
- Mark the toy as available or hidden
- Edit the toy
- Archive the toy
- Delete the toy

### Play Categories

Version 1 uses these fixed categories:

- Quiet
- Active
- Creative
- Building
- Pretend
- Sensory
- Independent
- Play Together
- Indoor
- Outdoor

Custom categories are not included in Version 1.

### Parent Toy Library

The parent can:

- View toys in a photo grid
- Search toys by name
- Filter toys by room
- Filter toys by category
- Edit toys
- Hide toys
- Archive toys
- Delete toys

### Child Mode

Child Mode includes:

- Find Something to Play With
- Surprise Me
- Current Toy
- Category selection
- Limited toy suggestions
- Toy location details
- Current play session
- Cleanup routine
- Ask for Help
- Parent override

### Child Choice Experience

The child can choose from:

- Something Quiet
- Something Active
- Build Something
- Make Something
- Pretend
- Play Together
- Show Me Anything

The app shows the number of toy choices selected by the parent:

- 1 toy
- 3 toys
- 5 toys

The default should be 3 toys.

### Toy Selection

Each toy choice shows:

- Large toy photo
- Toy name
- Room
- Storage spot
- Play With This button

When a toy is selected, the app shows exactly where it is stored.

Example:

Magnetic Tiles

Playroom → Blue Bin

### Current Toy

After the child confirms that they found the toy:

- The toy becomes the active toy
- Each child profile has at most one active toy at a time, and Guest has one of
  its own, so two children can play at once without disturbing each other
- One physical toy can only be in one active session, so two children are never
  sent to the same object
- The active toy remains saved if the app is closed
- The child can return to the Current Toy screen

### Cleanup

When the child is finished, the app guides them through:

1. Put the pieces back.
2. Put the toy in its storage location.
3. Confirm that everything is put away.

The child can choose:

- Yes, All Done
- I Need Help
- I’m Still Playing

A parent can enter the parent PIN to override the cleanup requirement.

### Local Data Storage

Version 1 stores all information on the device.

This includes:

- Toy photos
- Toy names
- Locations
- Categories
- Settings
- Current toy
- Play history

Version 1 does not require internet access.

## Added after the original V1 scope

These were excluded from the first release and have since been built. Each is
optional: Pip remains fully usable without any of them.

- **Public landing page** — marketing only, with an early-access signup. Not a
  dashboard and not a place to manage a library.
- **Optional parent accounts** — sign up, confirm email, sign in, password
  recovery, account settings, data export, account deletion. An account is never
  required to use Pip.
- **Household container** — one family space owning the rooms, storage spots,
  toys and profiles on the device.
- **Multiple child profiles** — each with a nickname, a built-in avatar, an
  accent colour, an optional broad age band, a choice count, and a reading
  support mode. Profiles are optional and can be added, paused, reordered, or
  deleted later.
- **Guest mode** — a visitor can play without a profile and leaves no permanent
  child data.
- **Per-child toy visibility** — Everyone, Selected children, Parent only, or
  Temporarily unavailable, enforced in the recommendation query rather than only
  in the interface.
- **Sample toys** — a clearly-labelled demonstration library that can be cleared
  in one action and never mixes with the family's own toys.

### Still excluded, and still not built

- Cloud backup and multi-device sync. The conflict policy, eligibility checks,
  tombstones and durable import state exist and are tested, but there is no
  remote transport, so nothing leaves the device.
- Family sharing between several adults. The household membership model allows
  it later; there is no invitation flow.
- Multiple households per account.

## Excluded from Version 1

The following features must not be added:

- AI toy recognition
- Automatic AI tagging
- Push notifications
- Rewards
- Points
- Badges
- Subscriptions
- Payments
- Advertising
- Analytics
- Voice controls
- Visual timers
- Photo cleanup verification
- Camera-based cleanup verification
- Toy rotation recommendations
- Missing-piece tracking
- Donation marketplace
- Toy resale marketplace
- Social sharing
- Developmental scoring
- Medical claims
- Android release
- Website dashboard for managing a library. The public landing page is
  marketing only.

## Privacy Requirements

Pip must:

- Keep all toy photos on the device
- Keep all toy data on the device
- Avoid collecting children’s personal information
- Avoid analytics
- Avoid advertising
- Avoid cloud uploads
- Work without an account
- Work without an internet connection

Still true after accounts were added. An account stores a parent's first name
and email address, and nothing about a child. Children never sign in and never
have credentials. No birthday, legal name, school, therapy detail, or diagnosis
is collected. Toy photos are not uploaded, because no sync exists.

Additional requirements introduced with accounts:

- Passwords are hashed with a memory-hard function and never logged
- Session tokens live in secure platform storage, never in general storage
- No credential, token, verification code, child name, or image path is logged
- Household membership is checked at the service boundary, not only in
  navigation, and a household id supplied by a client is never trusted
- Sign-up, sign-in and password recovery reveal nothing about whether an address
  is registered
- Account deletion requires a recent password confirmation and revokes every
  session
- Data export contains no password, hash, token, PIN, or verification code

Pip makes no COPPA, GDPR, HIPAA, or SOC 2 compliance claims. These are
privacy-supporting controls, not a legal opinion.

## Technical Requirements

Version 1 should use:

- React Native
- Expo
- TypeScript
- Expo Router
- Expo SQLite
- Expo Image Picker
- Expo FileSystem
- Local device storage
- EAS Build
- EAS Submit

The original scope said the app must not include a backend. That is no longer
accurate: `web.output` is `server`, and Expo Router API routes under
`src/app/v1/**` serve the AI proxy, parent authentication, and early-access
signup. The rule it was protecting still holds — **the device database remains
the source of truth for a family's library, and the app works with the server
unreachable.**

External configuration still required before release:

- A mail provider credential. Email confirmation and password reset are
  implemented and tested against a `MailSender` interface, but no message can be
  delivered until a provider is configured. See `.env.example`.
- `PIP_SESSION_SECRET` and `PIP_ONE_TIME_SECRET` in production. The server
  refuses to start without them.
- Apple and Google sign-in client ids, if those methods are wanted. The buttons
  stay hidden while unconfigured, so nothing offers a method that cannot
  complete.

## Version 1 Completion Criteria

Version 1 is complete when:

1. A parent can create at least one room.
2. A parent can create at least one storage spot.
3. A parent can photograph and save a toy.
4. A parent can assign the toy to a location.
5. A parent can assign categories.
6. A child can open Child Mode.
7. A child can choose a play category.
8. The app can show 1, 3, or 5 toy suggestions.
9. The child can select a toy.
10. The app shows exactly where the toy is stored.
11. The app remembers the current toy.
12. The child can complete the cleanup flow.
13. The child can ask for help.
14. A parent can override the cleanup requirement.
15. The app works after closing and reopening.
16. The app works without internet access.
17. The app does not lose saved toys after restarting.
18. The app is usable on both iPhone and iPad.

## Accounts Release Completion Criteria

The follow-on release is complete when, in addition to the above:

1. A visitor can read the landing page without the app opening a database.
2. Every feature named on the landing page exists in the build.
3. A parent can create an account, confirm it, and name their household without
   creating a duplicate on retry.
4. A parent can use Pip fully without ever creating an account.
5. A parent can add, edit, pause, reorder, and delete child profiles.
6. Deleting a child profile removes their play history and no toys, rooms,
   storage spots, or photos.
7. Two children can each have an active toy at the same time.
8. One physical toy cannot be in two active sessions.
9. A toy marked Parent only or Temporarily unavailable is never offered, even by
   a direct service call.
10. Guest can play without creating permanent child data.
11. Sample toys can be added and cleared without touching the family's own toys.
12. A parent can sign in, recover a password, export their data, and delete
    their account.
13. Deleting an account leaves the device's library intact.
14. Sign out, reset, profile deletion, and account deletion are clearly distinct.

Not yet demonstrable, and excluded above: cloud backup, multi-device sync, and
live email delivery.

## Scope Rule

Do not add features outside this document during the Version 1 build.

Any new idea should be recorded for a future release rather than added to Version 1.
Settings shows only controls that do something. Children, accounts, data export,
and account deletion now have real behaviour and are shown. Play prompts, visual
themes, Face ID, dashboards, and backups still have no persistence, so they are
still absent rather than displayed as inert switches.

The four ways of removing something are deliberately kept apart, because
confusing them is how a family loses a library they meant to keep:

| Action | Where | What it removes |
|---|---|---|
| Sign out | Account | The session. Nothing is deleted. |
| Delete a child profile | Children | That profile and its play history. Never toys. |
| Reset Pip | Settings | Everything on this device. Not the account. |
| Delete account | Account | The account only. Not the device's library. |
