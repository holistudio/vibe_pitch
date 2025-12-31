// Main application logic

let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let animationId = null;

// Tone playback
let toneContext = null;
let toneOscillators = [];
let toneGain = null;
let toneTimeout = null;
let isPlayingTone = false;

// Recording state
let currentNoteIndex = 0;
let noteStartTime = 0;
let notePitchSamples = [[], [], [], []];
let recordingTimeout = null;

const BUFFER_SIZE = 2048;

// DOM elements
let rootNoteSelect, tempoInput;
let degreeInputs, sharpChecks, octUpChecks, octDownChecks;
let playButton, startButton, stopButton, statusText;
let pitchLines, noteLabels, noteColumns;

/**
 * Initialize the application
 */
function init() {
    // Get DOM elements
    rootNoteSelect = document.getElementById('root-note');
    tempoInput = document.getElementById('tempo');

    degreeInputs = [
        document.getElementById('degree-0'),
        document.getElementById('degree-1'),
        document.getElementById('degree-2'),
        document.getElementById('degree-3')
    ];
    sharpChecks = [
        document.getElementById('sharp-0'),
        document.getElementById('sharp-1'),
        document.getElementById('sharp-2'),
        document.getElementById('sharp-3')
    ];
    octUpChecks = [
        document.getElementById('oct-up-0'),
        document.getElementById('oct-up-1'),
        document.getElementById('oct-up-2'),
        document.getElementById('oct-up-3')
    ];
    octDownChecks = [
        document.getElementById('oct-down-0'),
        document.getElementById('oct-down-1'),
        document.getElementById('oct-down-2'),
        document.getElementById('oct-down-3')
    ];

    playButton = document.getElementById('play-btn');
    startButton = document.getElementById('start-btn');
    stopButton = document.getElementById('stop-btn');
    statusText = document.getElementById('status');

    pitchLines = [
        document.getElementById('pitch-0'),
        document.getElementById('pitch-1'),
        document.getElementById('pitch-2'),
        document.getElementById('pitch-3')
    ];
    noteLabels = [
        document.getElementById('label-0'),
        document.getElementById('label-1'),
        document.getElementById('label-2'),
        document.getElementById('label-3')
    ];
    noteColumns = [
        document.getElementById('col-0'),
        document.getElementById('col-1'),
        document.getElementById('col-2'),
        document.getElementById('col-3')
    ];

    // Populate root note selector
    populateNoteSelector();

    // Event listeners
    playButton.addEventListener('click', playMelody);
    startButton.addEventListener('click', startRecording);
    stopButton.addEventListener('click', stopRecording);

    // Update labels when inputs change
    for (let i = 0; i < 4; i++) {
        degreeInputs[i].addEventListener('change', updateNoteLabels);
        sharpChecks[i].addEventListener('change', updateNoteLabels);
        octUpChecks[i].addEventListener('change', (e) => {
            // Make octave checkboxes mutually exclusive
            if (e.target.checked) {
                octDownChecks[i].checked = false;
            }
            updateNoteLabels();
        });
        octDownChecks[i].addEventListener('change', (e) => {
            if (e.target.checked) {
                octUpChecks[i].checked = false;
            }
            updateNoteLabels();
        });
    }

    updateNoteLabels();

    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusText.textContent = 'Error: Your browser does not support microphone access';
        startButton.disabled = true;
    }
}

/**
 * Populate the root note selector dropdown
 */
function populateNoteSelector() {
    const notes = getAvailableNotes();
    rootNoteSelect.innerHTML = '';

    notes.forEach(note => {
        const option = document.createElement('option');
        option.value = note.name;
        option.textContent = `${note.name} (${note.frequency.toFixed(1)} Hz)`;
        if (note.name === 'C4') {
            option.selected = true;
        }
        rootNoteSelect.appendChild(option);
    });
}

/**
 * Update the note labels in the visualization
 */
function updateNoteLabels() {
    for (let i = 0; i < 4; i++) {
        const degree = parseInt(degreeInputs[i].value) || 1;
        const sharp = sharpChecks[i].checked;
        const octaveOffset = getOctaveOffset(i);
        noteLabels[i].textContent = getNoteLabel(degree, sharp, octaveOffset);
    }
}

/**
 * Get octave offset for a note index
 */
function getOctaveOffset(index) {
    if (octUpChecks[index].checked) return 1;
    if (octDownChecks[index].checked) return -1;
    return 0;
}

/**
 * Get the current settings from UI
 */
function getSettings() {
    const rootFrequency = noteToFrequency(rootNoteSelect.value);
    const tempo = parseInt(tempoInput.value) || 60;
    const noteDuration = (60 / tempo) * 1000;

    const notes = [];
    for (let i = 0; i < 4; i++) {
        const degree = parseInt(degreeInputs[i].value) || 1;
        const sharp = sharpChecks[i].checked;
        const octaveOffset = getOctaveOffset(i);
        const frequency = scaleDegreeToFrequency(degree, rootFrequency, sharp, octaveOffset);
        notes.push({ degree, sharp, octaveOffset, frequency });
    }

    return { rootFrequency, tempo, noteDuration, notes };
}

/**
 * Play a single piano-like note
 */
function playPianoNote(frequency, duration, startTime, context) {
    const harmonics = [
        { ratio: 1, amplitude: 1.0 },
        { ratio: 2, amplitude: 0.5 },
        { ratio: 3, amplitude: 0.35 },
        { ratio: 4, amplitude: 0.25 },
        { ratio: 5, amplitude: 0.15 },
        { ratio: 6, amplitude: 0.1 },
        { ratio: 7, amplitude: 0.05 },
        { ratio: 8, amplitude: 0.03 },
    ];

    const masterGain = context.createGain();
    masterGain.connect(context.destination);

    const durationSec = duration / 1000;
    const attackTime = 0.005;
    const decayTime = 0.2;
    const sustainLevel = 0.3;

    harmonics.forEach((harmonic, index) => {
        const freq = frequency * harmonic.ratio;
        if (freq > context.sampleRate / 2) return;

        const osc = context.createOscillator();
        const gainNode = context.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        if (index > 0) {
            osc.detune.setValueAtTime((Math.random() - 0.5) * 4, startTime);
        }

        const peakAmp = harmonic.amplitude * 0.12;
        const sustainAmp = peakAmp * sustainLevel;
        const harmonicDecayMultiplier = 1 + (index * 0.3);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(peakAmp, startTime + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(
            Math.max(sustainAmp / harmonicDecayMultiplier, 0.001),
            startTime + attackTime + decayTime
        );
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + durationSec + 0.1);
    });
}

/**
 * Play the 4-note melody
 */
function playMelody() {
    if (isPlayingTone) {
        stopMelody();
        return;
    }

    const settings = getSettings();
    toneContext = new (window.AudioContext || window.webkitAudioContext)();

    isPlayingTone = true;
    playButton.textContent = 'Stop';
    startButton.disabled = true;
    disableControls(true);

    const now = toneContext.currentTime;
    const noteDurationSec = settings.noteDuration / 1000;

    // Play each note in sequence
    settings.notes.forEach((note, i) => {
        const startTime = now + (i * noteDurationSec);
        playPianoNote(note.frequency, settings.noteDuration * 0.9, startTime, toneContext);
    });

    const totalDuration = settings.noteDuration * 4;

    statusText.textContent = 'Playing melody...';

    toneTimeout = setTimeout(() => {
        stopMelody();
        statusText.textContent = 'Melody complete. Click "Start Singing" to record your attempt.';
    }, totalDuration);
}

/**
 * Stop melody playback
 */
function stopMelody() {
    if (toneTimeout) {
        clearTimeout(toneTimeout);
        toneTimeout = null;
    }

    if (toneContext) {
        toneContext.close();
        toneContext = null;
    }

    isPlayingTone = false;
    playButton.textContent = 'Play Melody';
    startButton.disabled = false;
    disableControls(false);
}

/**
 * Disable/enable controls
 */
function disableControls(disabled) {
    rootNoteSelect.disabled = disabled;
    tempoInput.disabled = disabled;
    for (let i = 0; i < 4; i++) {
        degreeInputs[i].disabled = disabled;
        sharpChecks[i].disabled = disabled;
        octUpChecks[i].disabled = disabled;
        octDownChecks[i].disabled = disabled;
    }
}

/**
 * Start recording the user's singing
 */
async function startRecording() {
    try {
        const settings = getSettings();

        statusText.textContent = 'Requesting microphone access...';

        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        analyser = audioContext.createAnalyser();
        analyser.fftSize = BUFFER_SIZE;

        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        // Update UI
        startButton.disabled = true;
        stopButton.disabled = false;
        playButton.disabled = true;
        disableControls(true);

        // Reset visualization
        resetVisualization();

        // Start countdown at metronome speed
        await countdown(settings.noteDuration);

        // After countdown, start recording
        isListening = true;
        currentNoteIndex = 0;
        notePitchSamples = [[], [], [], []];
        noteStartTime = Date.now();

        statusText.textContent = 'Sing now! Note 1...';
        noteColumns[0].classList.add('active');

        // Schedule note transitions
        const totalDuration = settings.noteDuration * 4;

        for (let i = 1; i < 4; i++) {
            setTimeout(() => {
                if (isListening) {
                    currentNoteIndex = i;
                    statusText.textContent = `Sing now! Note ${i + 1}...`;
                    noteColumns.forEach(col => col.classList.remove('active'));
                    noteColumns[i].classList.add('active');
                }
            }, settings.noteDuration * i);
        }

        // Schedule end of recording
        recordingTimeout = setTimeout(() => {
            finishRecording();
        }, totalDuration);

        // Start analyzing
        analyze();

    } catch (error) {
        console.error('Error accessing microphone:', error);
        statusText.textContent = 'Error: Could not access microphone.';
    }
}

/**
 * Countdown 3-2-1 at metronome speed
 */
function countdown(beatDuration) {
    return new Promise((resolve) => {
        statusText.textContent = '3...';

        setTimeout(() => {
            statusText.textContent = '2...';
        }, beatDuration);

        setTimeout(() => {
            statusText.textContent = '1...';
        }, beatDuration * 2);

        setTimeout(() => {
            resolve();
        }, beatDuration * 3);
    });
}

/**
 * Stop recording
 */
function stopRecording() {
    isListening = false;

    if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
    }

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
    playButton.disabled = false;
    disableControls(false);

    noteColumns.forEach(col => col.classList.remove('active'));

    statusText.textContent = 'Stopped. Click Play Melody to hear the notes again.';
}

/**
 * Finish recording and show results
 */
function finishRecording() {
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

    // Calculate and display results for each note
    const settings = getSettings();
    displayResults(settings);

    startButton.disabled = false;
    stopButton.disabled = true;
    playButton.disabled = false;
    disableControls(false);

    noteColumns.forEach(col => col.classList.remove('active'));
}

/**
 * Calculate and display results
 */
function displayResults(settings) {
    let allGood = true;

    for (let i = 0; i < 4; i++) {
        const samples = notePitchSamples[i];
        const targetFreq = settings.notes[i].frequency;

        if (samples.length === 0) {
            pitchLines[i].style.top = '50%';
            pitchLines[i].style.backgroundColor = '#ccc';
            allGood = false;
            continue;
        }

        const avgCents = samples.reduce((sum, freq) => {
            return sum + centsDifference(freq, targetFreq);
        }, 0) / samples.length;

        updatePitchLine(i, avgCents);

        if (Math.abs(avgCents) > 10) {
            allGood = false;
        }
    }

    if (allGood) {
        statusText.textContent = 'Great job! All notes were on pitch!';
    } else {
        statusText.textContent = 'Recording complete. Check your pitch accuracy above.';
    }
}

/**
 * Reset visualization
 */
function resetVisualization() {
    pitchLines.forEach(line => {
        line.style.top = '50%';
        line.style.backgroundColor = '#ccc';
    });
    noteColumns.forEach(col => col.classList.remove('active', 'completed'));
}

/**
 * Main analysis loop during recording
 */
function analyze() {
    if (!isListening) return;

    const settings = getSettings();
    const buffer = new Float32Array(BUFFER_SIZE);
    analyser.getFloatTimeDomainData(buffer);

    const detectedFreq = detectPitch(buffer, audioContext.sampleRate);

    if (detectedFreq !== null && currentNoteIndex < 4) {
        notePitchSamples[currentNoteIndex].push(detectedFreq);

        const targetFreq = settings.notes[currentNoteIndex].frequency;
        const cents = centsDifference(detectedFreq, targetFreq);
        updatePitchLine(currentNoteIndex, cents);
    }

    animationId = requestAnimationFrame(analyze);
}

/**
 * Update pitch line position and color
 */
function updatePitchLine(index, cents) {
    const threshold = 10;
    const clampedCents = Math.max(-100, Math.min(100, cents));
    const percentage = 50 - (clampedCents * 0.3);

    pitchLines[index].style.top = `${percentage}%`;

    if (Math.abs(cents) <= threshold) {
        pitchLines[index].style.backgroundColor = '#22c55e';
    } else if (cents > 0) {
        pitchLines[index].style.backgroundColor = '#ef4444';
    } else {
        pitchLines[index].style.backgroundColor = '#3b82f6';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
