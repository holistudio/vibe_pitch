# Project Context

A pitch training webapp that helps users practice singing specific musical notes. The user selects a target pitch (piano key notation like 'C4'), sings into their microphone, and receives real-time visual feedback showing whether they're singing too high, too low, or on pitch.

## Core Features
1. **Pitch Selection** - User picks a target note using piano key notation (e.g., C4, A3, F#5)
2. **Microphone Input** - Capture user's voice via browser's built-in Web Audio API (no plugins/installs needed)
3. **Pitch Detection** - Analyze the audio to determine the frequency being sung
4. **Visual Feedback** - Display whether the sung pitch is above, below, or matching the target

## Tech Stack
- HTML/CSS/JavaScript (vanilla, no frameworks)
- Web Audio API for microphone access and audio processing
- Single-page app, runs locally in browser
- **Zero installation required** - works immediately in any modern browser

## How It Works
- Convert piano key names to frequencies (e.g., A4 = 440Hz, C4 = 261.63Hz)
- Use pitch detection algorithm (autocorrelation) on microphone input
- Compare detected frequency to target frequency
- Show visual indicator (e.g., meter, arrow, color coding) for pitch accuracy

## File Structure
- `index.html` - Main page with UI
- `style.css` - Styling
- `app.js` - Main application logic
- `pitch.js` - Pitch detection and frequency utilities

## Things to Avoid
- No backend required - purely client-side
- No external dependencies/CDNs - keep it simple and self-contained
- No build tools or installation steps - just open index.html in browser
- No browser plugins or extensions required
