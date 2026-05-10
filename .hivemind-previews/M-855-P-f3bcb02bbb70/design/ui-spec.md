# Snake Game Web Application UI/UX Specification

## 1. Pages & Navigation

### 1.1 Home Page (`/`)
- **Purpose:** Welcome users, provide game instructions, and allow them to start the game.
- **Elements:**
  - App logo/title
  - Brief game description
  - Instructions (visual + text)
  - Primary CTA: "Start Game"
  - Secondary CTA: "Leaderboard"
  - Link to "Settings"
  - Responsive hero illustration or animation

### 1.2 Game Page (`/game`)
- **Purpose:** Main gameplay interface.
- **Elements:**
  - Game canvas (snake, food, grid)
  - Score display (live)
  - Pause/Resume button
  - Sound toggle
  - Difficulty indicator
  - Mobile controls (swipe or on-screen arrows)
  - Game over modal (score, submit to leaderboard, play again, go home)
  - Loading state (before game assets load)
  - Error boundary (for unexpected errors)

### 1.3 Leaderboard Page (`/leaderboard`)
- **Purpose:** Display top scores and rankings.
- **Elements:**
  - Leaderboard table (rank, player name, score, date)
  - Filter/sort controls (e.g., all-time, today)
  - User’s latest score highlight
  - CTA: "Play Again"
  - Loading state (while fetching data)
  - Error state (if leaderboard fails to load)

### 1.4 Settings Page (`/settings`)
- **Purpose:** Adjust game preferences.
- **Elements:**
  - Difficulty selector (Easy, Medium, Hard, Custom)
  - Sound effects toggle
  - Volume slider
  - Reset settings button
  - Save/Apply button
  - Link back to Home

## 2. User Flows

### 2.1 First-Time User
1. Lands on Home → Reads instructions → Clicks "Start Game"
2. Plays game → Game over → Enters name → Submits score → Views Leaderboard
3. Optionally adjusts settings

### 2.2 Returning User
1. Lands on Home → Clicks "Leaderboard" or "Settings" or "Start Game"
2. Game remembers previous settings (difficulty, sound)
3. Plays game, submits new score

### 2.3 Mobile User
- All flows above, with touch-friendly controls and layouts

## 3. Component List

### Global
- **AppBar/Header**: Logo, navigation links, responsive menu
- **Footer**: Minimal, copyright
- **Modal**: For game over, confirmations, errors
- **Toast/Notification**: For quick feedback (e.g., settings saved)

### Home
- **HeroSection**: Title, description, illustration
- **InstructionsCard**: Visual + text instructions
- **PrimaryButton**: Start Game
- **SecondaryButton**: Leaderboard, Settings

### Game
- **GameCanvas**: Renders snake, food, grid
- **ScoreBoard**: Displays current score
- **PauseButton**: Pauses/resumes game
- **SoundToggle**: Mute/unmute
- **DifficultyBadge**: Shows current difficulty
- **MobileControls**: On-screen arrows or swipe overlay
- **GameOverModal**: Score, name input, submit, play again
- **LoadingSpinner**: While assets load
- **ErrorBoundary**: Catches and displays errors

### Leaderboard
- **LeaderboardTable**: Ranks, names, scores, dates
- **FilterTabs**: All-time, today, etc.
- **HighlightRow**: User’s latest score
- **PlayAgainButton**: CTA
- **LoadingSkeleton**: Placeholder while loading
- **ErrorState**: Retry option

### Settings
- **DifficultySelector**: Radio or segmented control
- **SoundToggle**: Switch
- **VolumeSlider**: Range input
- **ResetButton**: Resets to defaults
- **SaveButton**: Applies settings

## 4. Visual System

### Color Palette
- **Primary:** Emerald 500 (`#10B981`)
- **Accent:** Amber 400 (`#F59E42`)
- **Background:** Gray 900 (`#111827`), Gray 800 (`#1F2937`)
- **Surface:** White (`#FFFFFF`), Gray 100 (`#F3F4F6`)
- **Danger:** Red 500 (`#EF4444`)
- **Success:** Green 500 (`#22C55E`)

### Typography
- **Font Family:** 'Inter', sans-serif
- **Headings:** Bold, tracking-tight
- **Body:** Regular, high contrast
- **Numbers (Score):** Monospaced for clarity

### Spacing & Layout
- **Container:** `max-w-2xl mx-auto px-4`
- **Grid:** 8px base spacing
- **Cards:** Rounded corners, shadow, padding
- **Buttons:** Rounded, shadow, hover/focus states

### Responsiveness
- **Mobile First:** All layouts adapt to small screens
- **Touch Targets:** Minimum 48x48px for controls
- **Game Canvas:** Scales to fit viewport, maintains aspect ratio

### Accessibility
- **Color Contrast:** Meets WCAG AA
- **Keyboard Navigation:** All interactive elements
- **ARIA Labels:** For non-text controls
- **Focus States:** Visible and distinct

### Animations & Effects
- **Game:** Smooth snake movement (CSS transitions or canvas)
- **Buttons:** Subtle hover/active transitions
- **Modals:** Fade/slide in
- **Sounds:** Feedback for eating, game over, button clicks (toggleable)

## 5. Example Tailwind Utility Usage
- **Buttons:** `bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded shadow`
- **Cards:** `bg-white rounded-lg shadow-md p-6`
- **Game Canvas Wrapper:** `bg-gray-900 rounded-lg p-2 flex justify-center items-center`
- **Leaderboard Table:** `w-full bg-gray-100 rounded-lg overflow-hidden`
- **Mobile Controls:** `fixed bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4`

## 6. Loading & Error States
- **Loading:** Spinners or skeletons for async data (leaderboard, assets)
- **Error:** Friendly error messages with retry options
- **Game Errors:** Error boundary with reset button

## 7. Persistent Storage & Personalization
- **Local Storage:** Remembers user settings (difficulty, sound)
- **Leaderboard:** Stores/retrieves scores via backend API
- **Name Entry:** Prompts for name on first score submission, remembers for next time

---

This specification ensures a delightful, accessible, and modern experience for all users across devices, with a focus on smooth gameplay, beautiful visuals, and engaging features.