# PlayMap V1 Scope

## Product Goal

PlayMap helps a parent photograph and organize toys, then gives a child a simple visual way to choose what to play with, find where the toy belongs, and complete a cleanup routine before choosing again.

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
- One child nickname
- Choice limit of 1, 3, or 5 toys
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
- Only one toy can be active in Version 1
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

## Excluded from Version 1

The following features must not be added to Version 1:

- AI toy recognition
- Automatic AI tagging
- User accounts
- Cloud backup
- Family sharing
- Multiple child profiles
- Multiple households
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
- Website dashboard

## Privacy Requirements

Version 1 must:

- Keep all toy photos on the device
- Keep all toy data on the device
- Avoid collecting children’s personal information
- Avoid analytics
- Avoid advertising
- Avoid external AI services
- Avoid cloud uploads
- Work without an account
- Work without an internet connection

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

The app must not include a backend in Version 1.

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

## Scope Rule

Do not add features outside this document during the Version 1 build.

Any new idea should be recorded for a future release rather than added to Version 1.