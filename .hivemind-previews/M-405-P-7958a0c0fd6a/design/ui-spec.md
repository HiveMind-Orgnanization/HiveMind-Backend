# Snake Game Web Application UI/UX Specification

## 1. Pages & Navigation

### 1.1 Home ("/", Landing Page)
- **Purpose:** Welcome users, introduce the game, and provide access to play, leaderboard, and settings.
- **Primary Actions:**
  - Start Game
  - View Leaderboard
  - Open Settings
- **Elements:**
  - Game logo/branding
  - Brief intro/description
  - Prominent "Play" button
  - Secondary buttons: "Leaderboard", "Settings"
  - Responsive hero illustration or animation

### 1.2 Game ("/game")
- **Purpose:** Main gameplay area with controls, score, and feedback.
- **Primary Actions:**
  - Play/Pause/Restart
  - Navigate back to Home
- **Elements:**
  - Game canvas (snake, food, grid)
  - Score display (current, best)
  - Difficulty indicator
  - Pause/Resume button
  - Sound toggle
  - Animated transitions (start, game over)
  - On mobile: touch controls overlay
  - Game over modal (score, name input, save to leaderboard, retry, home)

### 1.3 Leaderboard ("/leaderboard")
- **Purpose:** Display top scores and player rankings.
- **Primary Actions:**
  - View rankings
  - Return to Home or Game
- **Elements:**
  - Leaderboard table (rank, player name, score, date)
  - Highlight current user's score if present
  - Filter/sort options (e.g., all-time, weekly)
  - Loading and error states

### 1.4 Settings ("/settings")
- **Purpose:** Allow users to customize game experience.
- **Primary Actions:**
  - Adjust difficulty
  - Toggle sound/music
  - Change theme (light/dark)
  - Reset progress
- **Elements:**
  - Difficulty selector (Easy, Normal, Hard, Custom)
  - Sound/music toggles
  - Theme switch
  - Reset data button (with confirmation)
  - Save/cancel actions

### 1.5 Error/Not Found ("*", fallback)
- **Purpose:** Gracefully handle unknown routes or errors.
- **Elements:**
  - Friendly error message
  - Button to return Home

## 2. User Flows

### 2.1 Start Game Flow
1. User lands on Home
2. Clicks "Play"
3. Navigates to Game page
4. Game starts (with animation)

### 2.2 Game Over & Leaderboard Flow
1. User finishes game (collision)
2. Game Over modal appears with score
3. User can enter name (if new high score)
4. Option to save score, retry, or return Home
5. If saved, redirected or prompted to view Leaderboard

### 2.3 Settings Flow
1. User opens Settings from any page
2. Adjusts preferences (difficulty, sound, theme)
3. Saves or cancels changes
4. Preferences persist across sessions

### 2.4 Mobile Controls Flow
- On mobile, touch controls (directional pad or swipe) are available and visually distinct.

## 3. Component List

### 3.1 Layout & Navigation
- **AppShell**: Header (logo, nav), main content, footer
- **NavBar**: Responsive navigation (hamburger on mobile)
- **Button**: Primary, secondary, icon, floating
- **Modal**: For game over, confirmation dialogs

### 3.2 Game Components
- **GameCanvas**: Renders snake, food, grid, animations
- **ScoreBoard**: Displays current and best score
- **PauseOverlay**: Semi-transparent overlay with controls
- **MobileControls**: Touch D-pad or swipe area
- **GameOverModal**: Score, name input, actions

### 3.3 Leaderboard Components
- **LeaderboardTable**: Ranks, names, scores, dates
- **LeaderboardRow**: Individual entry, highlight current user
- **FilterTabs**: All-time, weekly, etc.
- **Loading/Error States**

### 3.4 Settings Components
- **DifficultySelector**: Radio or segmented control
- **ToggleSwitch**: Sound, music, theme
- **ResetButton**: With confirmation modal

### 3.5 Feedback & Utility
- **Toast**: For quick feedback (e.g., score saved)
- **ErrorBoundary**: Catch and display errors
- **LoadingSpinner**: For async states

## 4. Visual System

### 4.1 Color Palette
- **Primary:** Vibrant green (#4ADE80), for snake and accents
- **Secondary:** Deep blue (#2563EB), for backgrounds and highlights
- **Accent:** Orange (#F59E42), for food and call-to-action
- **Background:** Light (#F9FAFB) and dark (#18181B) modes
- **Neutral:** Grays for UI elements, borders, and text

### 4.2 Typography
- **Font Family:** Rounded, geometric sans-serif (e.g., Inter, Nunito)
- **Headings:** Bold, clear, large for titles
- **Body:** Medium weight, high contrast
- **Monospace:** For scores if desired

### 4.3 Spacing & Layout
- **Grid:** 8px base spacing
- **Card & Modal:** Rounded corners, subtle shadows
- **Responsive:** Mobile-first, fluid layouts, touch-friendly targets

### 4.4 Iconography & Imagery
- **Icons:** Simple, line or filled (e.g., Material Icons)
- **Illustrations:** Playful, geometric, minimal
- **Animations:** Smooth transitions for game events, modals, and buttons

### 4.5 Sound & Feedback
- **Sound Effects:**
  - Eating food (pop/chime)
  - Game over (distinct tone)
  - Button clicks (subtle)
- **Visual Feedback:**
  - Animations for snake movement, food spawn, collisions
  - Score increase animation

### 4.6 Accessibility
- **Contrast:** Sufficient for all text and interactive elements
- **Keyboard Navigation:** All actions accessible via keyboard
- **ARIA Labels:** For all interactive controls
- **Focus States:** Visible and distinct

## 5. Responsive & Mobile Design
- **Touch Controls:** Prominent and easy to use
- **Layout:** Stacks vertically, collapses nav into hamburger
- **Font & Button Sizes:** Increased for touch
- **Safe Areas:** Padding for notches and rounded corners

## 6. Persistent Storage & State
- **Local Storage:** For user preferences, best score
- **Backend API:** For leaderboard (with loading/error states)

## 7. Error & Loading States
- **Loading Spinners:** For leaderboard, settings fetch
- **Error Boundaries:** Friendly messages, retry options

---

This specification ensures a delightful, modern, and accessible Snake Game experience for all users, across devices.