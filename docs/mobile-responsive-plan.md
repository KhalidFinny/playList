# Mobile Responsive Redesign Plan

## Philosophy
Strip away decorative desktop elements. Build a simple, touch-first mobile experience — not a squeezed desktop UI.

## Layout Per Viewport

### Landing Page
- Simplified hero: logo + tagline + two CTAs ("Join Room" / "Admin Login")
- Remove the full-screen vinyl SVG, animated rings, and concentric circle decorations
- Centered single-column layout
- Minimal animations (fade-in only)

### Participant — Music Room (`/r/:roomId`)
- **Single column scrollable layout**
- Hero section: mini album art circle (instead of turntable) with progress ring
- Track title + artist below
- Progress bar + time display
- Play/pause button (participant view-only)
- Up-next list: simple numbered track titles, no thumbnails (saves bandwidth)
- **Bottom mini-player bar** (persistent, like Spotify): album art thumbnail, title, play/pause

### Participant — Request (`/r/:roomId/request`)
- Full-width search bar that expands on focus
- Autocomplete suggestions overlay below
- Search results: compact rows (thumbnail + title + artist + duration)
- Submit button on each result row
- Bottom bar showing current "now playing" (compact)

### Participant — Join Flow
- Full-screen passkey entry, centered, large keypad
- "Join" button prominent
- Error state inline below the input

### Admin Dashboard
- **Bottom tab bar** (iOS-style): Review | Music | Search | Access Code
- Each tab is a full-width simple view:

#### Review Tab
- Pending requests as a simple list: track title, artist, requested-by
- **Swipe gestures**: swipe right → approve, swipe left → reject
- Tap to expand preview (inline audio player)
- Audio output device selector in a collapsible settings panel

#### Music Tab
- Full-width player card with simplified controls (play/pause, skip)
- Album art as a large circle with progress ring
- Now playing info: title + artist
- Progress bar (touch-scrubbable)

#### Search Tab
- Full-width search input with autocomplete
- Results as compact list rows
- Tap to add to queue directly

#### Access Code Tab
- Large passkey display with copy button
- QR code display for easy sharing (optional)

### Admin Login / Register
- Keep current design (already reasonably responsive)
- Full-width inputs, centered card

## Shared Mobile Components

1. **Bottom Tab Bar** — replaces header tabs on mobile
2. **Mini Player Bar** — persistent at bottom, shows current track + play/pause
3. **Bottom Sheet** — for context menus (edit title, etc.)
4. **Swipeable Cards** — for approve/reject in review
5. **Pull to Refresh** — for queue reload
6. **Touch Feedback** — active states, haptic-like transitions

## Breakpoints

- `sm` (640px): single column, bottom nav, mini-player
- `md` (768px): two-column tablet layout (queue list + player side-by-side)
- `lg+` (1024px+): current desktop layout

## Implementation Order

1. Participant music room (most common mobile use case)
2. Participant request/search
3. Participant join flow
4. Admin review with swipe gestures
5. Admin music tab
6. Admin search & access code
7. Landing page
8. Polish & gesture tuning
