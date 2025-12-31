# vibe_pitch

Vibecoding a singing pitch webapp

A simple web app that helps you practice singing specific musical notes. Select a target pitch, sing into your microphone, and get real-time visual feedback showing whether you're on pitch, too high, or too low.

## Features

- Select any note from C2 to C6 (covers most vocal ranges)
- Real-time pitch detection using your microphone
- Visual feedback with a horizontal line:
  - **Green (middle)** = on pitch
  - **Red (moves up)** = too high
  - **Blue (moves down)** = too low

## Requirements

- A modern web browser (Chrome, Firefox, Edge, or Safari)
- A microphone
- A local web server (see instructions below)

**Note:** Due to browser security restrictions, the microphone will only work when the page is served from `localhost` or `https://`. Opening the HTML file directly (`file://`) will not work.

## Setup Instructions

### Step 1: Clone the Repository

**All platforms (Mac/Linux/Windows):**

```bash
git clone https://github.com/holistudio/vibe_pitch.git
cd vibe_pitch
```

### Step 2: Start a Local Web Server

Choose ONE of the following options based on what you have installed or prefer to install:

---

#### Option A: Using Python (Recommended for Mac/Linux)

**Mac/Linux:** Python 3 is usually pre-installed.

```bash
python3 -m http.server 8000
```

**Windows:** Python is not pre-installed. First install it from [python.org](https://www.python.org/downloads/), then:

```cmd
python -m http.server 8000
```

Then open: http://localhost:8000

---

#### Option B: Using Node.js/npm

First install Node.js from [nodejs.org](https://nodejs.org/) if you don't have it.

**All platforms:**

```bash
npx serve
```

Then open the URL shown (usually http://localhost:3000)

---

#### Option C: Using PHP (if installed)

**Mac/Linux:**

```bash
php -S localhost:8000
```

**Windows:**

```cmd
php -S localhost:8000
```

Then open: http://localhost:8000

---

#### Option D: Using VS Code Live Server Extension

1. Install [Visual Studio Code](https://code.visualstudio.com/)
2. Install the "Live Server" extension by Ritwick Dey
3. Open the `vibe_pitch` folder in VS Code
4. Right-click on `index.html` and select "Open with Live Server"

---

#### Option E: Using browser extensions

**Chrome:**
1. Install "Web Server for Chrome" from the Chrome Web Store
2. Launch the app, select the `vibe_pitch` folder
3. Click the server URL to open

---

### Step 3: Allow Microphone Access

When you click "Start" in the app, your browser will ask for permission to use your microphone. Click "Allow" to enable pitch detection.

## Usage

1. Select a target note from the dropdown (default is A3)
2. Click "Start"
3. Allow microphone access when prompted
4. Sing the note and watch the line move:
   - Aim to keep the line green and centered
   - If the line goes up and turns red, you're singing too high
   - If the line goes down and turns blue, you're singing too low
5. Click "Stop" when done

## Troubleshooting

**Microphone not working:**
- Make sure you're accessing via `localhost` (not `file://`)
- Check that your browser has microphone permissions enabled
- Try a different browser

**No pitch detected:**
- Sing louder or move closer to the microphone
- Make sure your microphone is not muted
- Check your system audio input settings

**Page not loading:**
- Ensure the local server is running
- Check that you're using the correct port number in the URL
