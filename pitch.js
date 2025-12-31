// Piano key to frequency conversion and pitch detection utilities

// A4 = 440Hz standard tuning
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

// Note names for display
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a piano key name (e.g., 'C4', 'A#3') to frequency in Hz
 */
function noteToFrequency(noteName) {
    const match = noteName.match(/^([A-G]#?)(\d+)$/i);
    if (!match) return null;

    const note = match[1].toUpperCase();
    const octave = parseInt(match[2]);

    const noteIndex = NOTE_NAMES.indexOf(note);
    if (noteIndex === -1) return null;

    // Calculate MIDI note number (C4 = 60)
    const midiNote = (octave + 1) * 12 + noteIndex;

    // Convert MIDI note to frequency
    return A4_FREQUENCY * Math.pow(2, (midiNote - A4_MIDI) / 12);
}

/**
 * Convert frequency to the nearest note name
 */
function frequencyToNote(frequency) {
    if (frequency <= 0) return null;

    // Calculate MIDI note number from frequency
    const midiNote = Math.round(12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI);

    const noteIndex = midiNote % 12;
    const octave = Math.floor(midiNote / 12) - 1;

    return {
        name: NOTE_NAMES[noteIndex] + octave,
        frequency: A4_FREQUENCY * Math.pow(2, (midiNote - A4_MIDI) / 12),
        midiNote: midiNote
    };
}

/**
 * Calculate cents difference between two frequencies
 * Positive = sharp (too high), Negative = flat (too low)
 */
function centsDifference(detected, target) {
    if (detected <= 0 || target <= 0) return 0;
    return 1200 * Math.log2(detected / target);
}

/**
 * Autocorrelation-based pitch detection
 * Returns detected frequency in Hz, or null if no clear pitch
 */
function detectPitch(audioBuffer, sampleRate) {
    const bufferLength = audioBuffer.length;

    // Check if there's enough signal
    let rms = 0;
    for (let i = 0; i < bufferLength; i++) {
        rms += audioBuffer[i] * audioBuffer[i];
    }
    rms = Math.sqrt(rms / bufferLength);

    // If signal is too quiet, return null
    if (rms < 0.01) return null;

    // Autocorrelation
    const correlations = new Float32Array(bufferLength);

    for (let lag = 0; lag < bufferLength; lag++) {
        let correlation = 0;
        for (let i = 0; i < bufferLength - lag; i++) {
            correlation += audioBuffer[i] * audioBuffer[i + lag];
        }
        correlations[lag] = correlation;
    }

    // Find the first peak after the initial decline
    // Start looking after a minimum period (max frequency ~1000Hz)
    const minPeriod = Math.floor(sampleRate / 1000);
    const maxPeriod = Math.floor(sampleRate / 60); // Min frequency ~60Hz

    let foundPeak = false;
    let peakLag = minPeriod;
    let peakValue = -1;

    // First, find where correlation starts declining from lag 0
    let declining = false;
    for (let lag = 1; lag < minPeriod; lag++) {
        if (correlations[lag] < correlations[lag - 1]) {
            declining = true;
            break;
        }
    }

    if (!declining) return null;

    // Now find the highest peak in the valid range
    for (let lag = minPeriod; lag < maxPeriod && lag < bufferLength; lag++) {
        if (correlations[lag] > peakValue) {
            peakValue = correlations[lag];
            peakLag = lag;
            foundPeak = true;
        }
    }

    if (!foundPeak) return null;

    // Parabolic interpolation for better accuracy
    let betterLag = peakLag;
    if (peakLag > 0 && peakLag < bufferLength - 1) {
        const y1 = correlations[peakLag - 1];
        const y2 = correlations[peakLag];
        const y3 = correlations[peakLag + 1];
        const a = (y1 + y3 - 2 * y2) / 2;
        const b = (y3 - y1) / 2;
        if (a !== 0) {
            betterLag = peakLag - b / (2 * a);
        }
    }

    const frequency = sampleRate / betterLag;

    // Sanity check: human voice range is roughly 80-1000Hz
    if (frequency < 60 || frequency > 1000) return null;

    return frequency;
}

/**
 * Generate list of available notes for selection
 */
function getAvailableNotes() {
    const notes = [];
    // C2 to C6 covers most vocal ranges
    for (let octave = 2; octave <= 6; octave++) {
        for (let i = 0; i < NOTE_NAMES.length; i++) {
            const noteName = NOTE_NAMES[i] + octave;
            notes.push({
                name: noteName,
                frequency: noteToFrequency(noteName)
            });
            // Stop at C6
            if (octave === 6 && i === 0) break;
        }
    }
    return notes;
}
