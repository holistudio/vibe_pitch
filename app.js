// Main application logic

let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let targetFrequency = null;
let animationId = null;
let toneContext = null;
let toneOscillators = [];
let toneGain = null;
let toneTimeout = null;
let isPlayingTone = false;

const BUFFER_SIZE = 2048;
const TONE_DURATION = 3000; // 3 seconds

// DOM elements
let noteSelect, startButton, stopButton, playButton, statusText;
let targetDisplay, detectedDisplay, centsDisplay;
let pitchLine;

/**
 * Initialize the application
 */
function init() {
    // Get DOM elements
    noteSelect = document.getElementById('note-select');
    startButton = document.getElementById('start-btn');
    stopButton = document.getElementById('stop-btn');
    statusText = document.getElementById('status');
    targetDisplay = document.getElementById('target-display');
    detectedDisplay = document.getElementById('detected-display');
    centsDisplay = document.getElementById('cents-display');
    pitchLine = document.getElementById('pitch-line');

    // Populate note selector
    populateNoteSelector();

    // Get play button
    playButton = document.getElementById('play-btn');

    // Event listeners
    startButton.addEventListener('click', startListening);
    stopButton.addEventListener('click', stopListening);
    playButton.addEventListener('click', playTone);
    noteSelect.addEventListener('change', updateTargetNote);

    // Set initial target
    updateTargetNote();

    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusText.textContent = 'Error: Your browser does not support microphone access';
        startButton.disabled = true;
    }
}

/**
 * Populate the note selector dropdown
 */
function populateNoteSelector() {
    const notes = getAvailableNotes();
    noteSelect.innerHTML = '';

    notes.forEach(note => {
        const option = document.createElement('option');
        option.value = note.name;
        option.textContent = `${note.name} (${note.frequency.toFixed(1)} Hz)`;
        // Default to A3 (comfortable for most voices)
        if (note.name === 'A3') {
            option.selected = true;
        }
        noteSelect.appendChild(option);
    });
}

/**
 * Update the target note when selection changes
 */
function updateTargetNote() {
    const noteName = noteSelect.value;
    targetFrequency = noteToFrequency(noteName);
    targetDisplay.textContent = `Target: ${noteName} (${targetFrequency.toFixed(1)} Hz)`;
}

/**
 * Play a piano-like tone at the target frequency for 5 seconds
 * Uses additive synthesis with harmonics and ADSR envelope
 */
function playTone() {
    // If already playing, stop it
    if (isPlayingTone) {
        stopTone();
        return;
    }

    // Create audio context
    toneContext = new (window.AudioContext || window.webkitAudioContext)();
    toneOscillators = [];

    // Piano harmonic structure - relative amplitudes for each harmonic
    // Grand piano has strong fundamental with decreasing harmonics
    const harmonics = [
        { ratio: 1, amplitude: 1.0 },      // Fundamental
        { ratio: 2, amplitude: 0.5 },      // 2nd harmonic
        { ratio: 3, amplitude: 0.35 },     // 3rd harmonic
        { ratio: 4, amplitude: 0.25 },     // 4th harmonic
        { ratio: 5, amplitude: 0.15 },     // 5th harmonic
        { ratio: 6, amplitude: 0.1 },      // 6th harmonic
        { ratio: 7, amplitude: 0.05 },     // 7th harmonic
        { ratio: 8, amplitude: 0.03 },     // 8th harmonic
    ];

    // Master gain for overall volume
    toneGain = toneContext.createGain();
    toneGain.connect(toneContext.destination);

    const now = toneContext.currentTime;
    const duration = TONE_DURATION / 1000;

    // Piano ADSR envelope parameters
    const attackTime = 0.005;   // Very fast attack (piano hammer strike)
    const decayTime = 0.3;      // Quick initial decay
    const sustainLevel = 0.4;   // Sustain level relative to peak
    const releaseTime = 0.5;    // Release time

    // Create oscillators for each harmonic
    harmonics.forEach((harmonic, index) => {
        const freq = targetFrequency * harmonic.ratio;

        // Skip harmonics above Nyquist frequency
        if (freq > toneContext.sampleRate / 2) return;

        const osc = toneContext.createOscillator();
        const gainNode = toneContext.createGain();

        // Use sine waves for clean harmonics
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Slight detuning for richness (piano strings are slightly out of tune)
        if (index > 0) {
            osc.detune.setValueAtTime((Math.random() - 0.5) * 4, now);
        }

        // Calculate amplitude with ADSR envelope
        const peakAmp = harmonic.amplitude * 0.15; // Scale down overall volume
        const sustainAmp = peakAmp * sustainLevel;

        // Higher harmonics decay faster (mimics real piano)
        const harmonicDecayMultiplier = 1 + (index * 0.3);

        gainNode.gain.setValueAtTime(0, now);
        // Attack
        gainNode.gain.linearRampToValueAtTime(peakAmp, now + attackTime);
        // Decay to sustain
        gainNode.gain.exponentialRampToValueAtTime(
            Math.max(sustainAmp / harmonicDecayMultiplier, 0.001),
            now + attackTime + decayTime
        );
        // Gradual decay during sustain (piano sound naturally decays)
        gainNode.gain.exponentialRampToValueAtTime(
            Math.max(sustainAmp / harmonicDecayMultiplier / 3, 0.001),
            now + duration - releaseTime
        );
        // Release
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(toneGain);

        osc.start(now);
        osc.stop(now + duration + 0.1);

        toneOscillators.push({ osc, gainNode });
    });

    // Update UI
    isPlayingTone = true;
    playButton.textContent = 'Stop Tone';
    noteSelect.disabled = true;

    // Stop after duration
    toneTimeout = setTimeout(() => {
        stopTone();
    }, TONE_DURATION);
}

/**
 * Stop playing the tone
 */
function stopTone() {
    // Clear the timeout
    if (toneTimeout) {
        clearTimeout(toneTimeout);
        toneTimeout = null;
    }

    // Stop all oscillators
    toneOscillators.forEach(({ osc, gainNode }) => {
        try {
            gainNode.gain.cancelScheduledValues(0);
            gainNode.gain.setValueAtTime(gainNode.gain.value, toneContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, toneContext.currentTime + 0.05);
            osc.stop(toneContext.currentTime + 0.06);
        } catch (e) {
            // Oscillator may have already stopped
        }
    });
    toneOscillators = [];

    // Close audio context
    if (toneContext) {
        setTimeout(() => {
            toneContext.close();
            toneContext = null;
        }, 100);
    }

    toneGain = null;
    isPlayingTone = false;
    playButton.textContent = 'Play Tone';
    if (!isListening) {
        noteSelect.disabled = false;
    }
}

/**
 * Start listening to microphone
 */
async function startListening() {
    try {
        statusText.textContent = 'Requesting microphone access...';

        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Get microphone stream
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        // Create analyser node
        analyser = audioContext.createAnalyser();
        analyser.fftSize = BUFFER_SIZE;

        // Connect microphone to analyser
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        isListening = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        noteSelect.disabled = true;
        statusText.textContent = 'Listening... Sing into your microphone!';

        // Start the analysis loop
        analyze();

    } catch (error) {
        console.error('Error accessing microphone:', error);
        statusText.textContent = 'Error: Could not access microphone. Please allow microphone access.';
    }
}

/**
 * Stop listening to microphone
 */
function stopListening() {
    isListening = false;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    startButton.disabled = false;
    stopButton.disabled = true;
    noteSelect.disabled = false;
    statusText.textContent = 'Stopped. Select a note and click Start.';

    // Reset displays
    detectedDisplay.textContent = 'Detected: --';
    centsDisplay.textContent = '-- cents';
    resetPitchLine();
}

/**
 * Reset pitch line to center with neutral color
 */
function resetPitchLine() {
    pitchLine.style.top = '50%';
    pitchLine.style.backgroundColor = '#ccc';
}

/**
 * Main analysis loop
 */
function analyze() {
    if (!isListening) return;

    const buffer = new Float32Array(BUFFER_SIZE);
    analyser.getFloatTimeDomainData(buffer);

    const detectedFreq = detectPitch(buffer, audioContext.sampleRate);

    if (detectedFreq !== null) {
        // Get note info
        const noteInfo = frequencyToNote(detectedFreq);
        detectedDisplay.textContent = `Detected: ${noteInfo.name} (${detectedFreq.toFixed(1)} Hz)`;

        // Calculate cents difference
        const cents = centsDifference(detectedFreq, targetFrequency);
        centsDisplay.textContent = `${cents >= 0 ? '+' : ''}${cents.toFixed(0)} cents`;

        // Update the pitch line
        updatePitchLine(cents);
    } else {
        detectedDisplay.textContent = 'Detected: (no pitch)';
        centsDisplay.textContent = '-- cents';
        resetPitchLine();
    }

    animationId = requestAnimationFrame(analyze);
}

/**
 * Update the horizontal pitch line position and color
 * - On pitch (within threshold): middle, green
 * - Too high: moves up, red
 * - Too low: moves down, blue
 */
function updatePitchLine(cents) {
    const threshold = 10; // Within 10 cents is considered "on pitch"

    // Clamp cents to a reasonable range for visualization (-100 to +100)
    const clampedCents = Math.max(-100, Math.min(100, cents));

    // Calculate vertical position
    // 50% = middle, higher pitch = lower percentage (moves up), lower pitch = higher percentage (moves down)
    // Map -100 cents to 80%, 0 cents to 50%, +100 cents to 20%
    const percentage = 50 - (clampedCents * 0.3);
    pitchLine.style.top = `${percentage}%`;

    // Set color based on pitch accuracy
    if (Math.abs(cents) <= threshold) {
        // On pitch - green
        pitchLine.style.backgroundColor = '#22c55e';
    } else if (cents > 0) {
        // Too high - red
        pitchLine.style.backgroundColor = '#ef4444';
    } else {
        // Too low - blue
        pitchLine.style.backgroundColor = '#3b82f6';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
