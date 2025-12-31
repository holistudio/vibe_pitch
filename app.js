// Main application logic

let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let targetFrequency = null;
let animationId = null;

const BUFFER_SIZE = 2048;

// DOM elements
let noteSelect, startButton, stopButton, statusText;
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

    // Event listeners
    startButton.addEventListener('click', startListening);
    stopButton.addEventListener('click', stopListening);
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
