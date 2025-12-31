// Main application logic

let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let targetFrequency = null;
let animationId = null;

const BUFFER_SIZE = 4096; // Larger buffer for better frequency resolution

// DOM elements
let noteSelect, startButton, stopButton, statusText;
let targetDisplay, detectedDisplay, centsDisplay;
let pitchLine;
let spectrumCanvas, spectrumCtx;

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
    spectrumCanvas = document.getElementById('spectrum-canvas');
    spectrumCtx = spectrumCanvas.getContext('2d');

    // Set up canvas sizing
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

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
    clearSpectrum();
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

    // Draw the frequency spectrum
    drawSpectrum();

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

        // Update the pitch line based on detected frequency
        updatePitchLine(detectedFreq);
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
function updatePitchLine(detectedFreq) {
    const { minFreq, maxFreq } = getFrequencyRange();

    // Calculate cents difference for color
    const cents = centsDifference(detectedFreq, targetFrequency);
    const threshold = 10; // Within 10 cents is considered "on pitch"

    // Clamp frequency to display range
    const clampedFreq = Math.max(minFreq, Math.min(maxFreq, detectedFreq));

    // Use same logarithmic scale as spectrum for consistent positioning
    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const logFreq = Math.log2(clampedFreq);

    // Calculate percentage (higher freq = lower percentage = higher on screen)
    const normalized = (logFreq - logMin) / (logMax - logMin);
    const percentage = (1 - normalized) * 100;

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

/**
 * Resize canvas to match its container
 */
function resizeCanvas() {
    const container = spectrumCanvas.parentElement;
    spectrumCanvas.width = container.clientWidth;
    spectrumCanvas.height = container.clientHeight;
}

/**
 * Get frequency range to display based on target frequency
 * Shows approximately 2 octaves centered around the target
 */
function getFrequencyRange() {
    // Show from 1 octave below to 1 octave above target
    const minFreq = targetFrequency / 2;
    const maxFreq = targetFrequency * 2;
    return { minFreq, maxFreq };
}

/**
 * Convert frequency to Y position on canvas
 */
function frequencyToY(freq, minFreq, maxFreq, canvasHeight) {
    // Use logarithmic scale for frequency (more natural for music)
    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const logFreq = Math.log2(freq);

    // Higher frequencies at top (lower Y), lower frequencies at bottom (higher Y)
    const normalized = (logFreq - logMin) / (logMax - logMin);
    return canvasHeight * (1 - normalized);
}

/**
 * Draw the frequency spectrum
 */
function drawSpectrum() {
    if (!analyser || !spectrumCtx) return;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    const width = spectrumCanvas.width;
    const height = spectrumCanvas.height;
    const sampleRate = audioContext.sampleRate;
    const binCount = analyser.frequencyBinCount;
    const freqPerBin = sampleRate / (binCount * 2);

    // Clear canvas
    spectrumCtx.clearRect(0, 0, width, height);

    // Get frequency range based on target pitch
    const { minFreq, maxFreq } = getFrequencyRange();

    // Find which bins correspond to our frequency range
    const minBin = Math.floor(minFreq / freqPerBin);
    const maxBin = Math.ceil(maxFreq / freqPerBin);

    // Draw spectrum bars (horizontal bars at each frequency)
    spectrumCtx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // 10% black

    for (let bin = minBin; bin <= maxBin && bin < binCount; bin++) {
        const freq = bin * freqPerBin;
        const amplitude = frequencyData[bin] / 255; // Normalize to 0-1

        // Calculate Y position for this frequency
        const y = frequencyToY(freq, minFreq, maxFreq, height);

        // Bar width based on amplitude (extends from left edge)
        const barWidth = amplitude * width;

        // Bar height - make it thin for a smooth spectrum look
        const barHeight = Math.max(2, height / (maxBin - minBin));

        spectrumCtx.fillRect(0, y - barHeight / 2, barWidth, barHeight);
    }
}

/**
 * Clear the spectrum canvas
 */
function clearSpectrum() {
    if (spectrumCtx) {
        spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
