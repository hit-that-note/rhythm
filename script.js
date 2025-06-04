// Ad blocking functionality
const originalFetch = window.fetch;
window.fetch = function(...args) {
    if (args[0] && typeof args[0] === 'string' && (
        args[0].includes('ad_break') || 
        args[0].includes('get_midroll_info') ||
        args[0].includes('adunit') ||
        args[0].includes('pagead') ||
        args[0].includes('googlesyndication') ||
        args[0].includes('doubleclick') ||
        args[0].includes('adservice') ||
        args[0].includes('imasdk') ||
        args[0].includes('manifest.googlevideo.com/api/manifest/ads')
    )) {
        console.log('Blocked ad request:', args[0]);
        return new Promise(() => {}); // Never resolve, effectively blocking the ad
    }
    return originalFetch.apply(this, args);
};

const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (url && typeof url === 'string' && (
        url.includes('ad_break') || 
        url.includes('get_midroll_info') ||
        url.includes('adunit') ||
        url.includes('pagead') ||
        url.includes('googlesyndication') ||
        url.includes('doubleclick') ||
        url.includes('adservice') ||
        url.includes('imasdk') ||
        url.includes('manifest.googlevideo.com/api/manifest/ads')
    )) {
        console.log('Blocked XHR ad request:', url);
        return; // Block the request
    }
    return originalXHROpen.call(this, method, url, ...rest);
};

// YouTube Player API
let player;
let currentSongId = null;
let isGameStarted = false;
let pendingSongId = null; // Variable to store songId before player is ready

// Initialize YouTube Player
function onYouTubeIframeAPIReady() {
    console.log('YouTube IFrame API Ready');
    try {
        player = new YT.Player('youtube-player', {
            height: '360',
            width: '640',
            videoId: '',
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'disablekb': 1,
                'fs': 0,
                'rel': 0,
                'adblock': 1,
                'iv_load_policy': 3,
                'modestbranding': 1,
                'origin': window.location.origin,
                'enablejsapi': 1,
                'widget_referrer': window.location.origin,
                'host': 'https://www.youtube-nocookie.com',
                'autoplay': 0,
                'mute': 0,
                'loop': 0,
                'showinfo': 0,
                'cc_load_policy': 0,
                'cc_lang_pref': 'us',
                'hl': 'en',
                'color': 'white',
                'theme': 'dark'
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } catch (error) {
        console.error('Error initializing YouTube player:', error);
    }
}

// Add error handling for YouTube API
function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    // alert('Error loading video. Please try again.'); // Removed alert to avoid interrupting gameplay
}

// Ensure the API is loaded
if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
    console.log('YouTube API not loaded, loading now...');
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

function onPlayerReady(event) {
    console.log('YouTube Player Ready');
    setupAdHandlers();
    
    // If there's a pending song ID, load and play it now
    if (pendingSongId) {
        console.log('Player ready, loading pending video:', pendingSongId);
        player.loadVideoById(pendingSongId);
        pendingSongId = null;
        if (isGameStarted) {
            startNoteGeneration();
        }
    }
}

function onPlayerStateChange(event) {
    console.log('YouTube Player State Change:', event.data);
    
    // Handle video state changes
    if (event.data === YT.PlayerState.ENDED) {
        endGame();
    } 
    
    // Handle ad states
    if (event.data === YT.PlayerState.PLAYING) {
        // Check if current video is an ad
        const currentVideoData = player.getVideoData();
        if (currentVideoData && currentVideoData.isAd) {
            console.log('Ad detected, attempting to skip...');
            try {
                player.seekTo(player.getDuration());
                player.mute(); // Mute during ads
            } catch (error) {
                console.error('Error skipping ad:', error);
            }
        } else if (isGameStarted) {
            console.log('Video started playing, starting note generation.');
            startNoteGeneration();
        }
    }
    
    // Handle buffering state to skip ads
    if (event.data === YT.PlayerState.BUFFERING) {
        const currentTime = player.getCurrentTime();
        if (currentTime < 1) {
            console.log('Buffering at start, attempting to skip potential ad...');
            player.seekTo(1);
        }
    }
}

// Song Selection
document.querySelectorAll('.song-card').forEach(card => {
    card.addEventListener('click', () => {
        const songId = card.dataset.song;
        console.log('Song card clicked, starting game with song:', songId);
        startGame(songId);
    });
});

function startGame(songId) {
    console.log('startGame function called with songId:', songId);
    currentSongId = songId;
    // Removed beatmap loading
    // currentBeatmap = beatmaps[songId] || [];
    // nextNoteIndex = 0;

    // Hide song selection, show game screen
    document.getElementById('song-selection').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    // Start the game
    isGameStarted = true;
    resetGame();

    // Load and play the selected song only if player is ready
    if (player && player.getPlayerState) { // Check if player object exists and seems ready
        console.log('Player already initialized, loading and playing video:', songId);
        player.loadVideoById(songId);
        // player.playVideo(); // Auto-play might still be blocked, will rely on user interaction or state change
        // Note generation is now started by the onPlayerStateChange (PLAYING) event
    } else {
        console.log('Player not yet initialized, storing songId and waiting for onPlayerReady:', songId);
        pendingSongId = songId; // Store the songId to be loaded when player is ready
        // Note generation will be started by onPlayerReady or onPlayerStateChange (PLAYING)
    }

    console.log('Game started, waiting for video to load/play to start note generation.');
    // Note generation is now started by the onPlayerReady or onPlayerStateChange (PLAYING) event
}

function endGame() {
    console.log('Game ending. Stopping note generation.');
    isGameStarted = false;
    stopNoteGeneration(); // Stop note generation
    currentStreak = 0; // Reset streak at end of game
    updateStreakDisplay();
    // Show song selection screen again
    document.getElementById('song-selection').style.display = 'flex';
    document.getElementById('game-screen').style.display = 'none';
    // Stop video playback
    if (player) {
        player.stopVideo();
        console.log('Video stopped.');
    }
}

function resetGame() {
    console.log('Resetting game state.');
    score = 0;
    totalNotes = 0;
    hitNotes = 0;
    currentStreak = 0;
    notesInLanes = [[], [], [], []];
    // Clear existing notes from the DOM and arrays
    lanes.forEach(lane => lane.innerHTML = '');
    notesInLanes = [[], [], [], []];

    updateScoreDisplay();
    updateAccuracyDisplay();
    updateStreakDisplay();
}

// Get game elements
const lanes = document.querySelectorAll('.lane');
const inputButtons = document.querySelectorAll('.input-button');
const scoreDisplay = document.querySelector('.score-display');
const accuracyDisplay = document.querySelector('.accuracy-display');
const streakDisplay = document.querySelector('.streak-display');
const hitCrossbar = document.querySelector('.hit-crossbar');

// Map keyboard keys to lane indices
const keyMap = {
    'A': 0,
    'S': 1,
    'D': 2,
    'F': 3
};

// Game state variables
let score = 0;
let totalNotes = 0;
let hitNotes = 0;
let currentStreak = 0;
let notesInLanes = [[], [], [], []]; // Array to keep track of notes in each lane
// Add an array to keep track of active slider notes that are within the hit/hold window
let activeSliders = [[], [], [], []];

// Add array to track the type of the last generated note in each lane
let lastNoteType = ['regular', 'regular', 'regular', 'regular']; // Initialize all lanes with regular

// Add array to track currently held keys and active slider start times
let heldKeys = {};
let activeSliderStartTime = {}; // To store when a slider in a lane was activated

const perfectWindow = 10; // Pixels for perfect hit
const goodWindow = 25; // Pixels for good hit
const badWindow = 40; // Pixels for bad hit
const missPenalty = 50; // Points deducted for a note miss (passing crossbar)
const phantomPressPenalty = 25; // Points deducted for pressing when no note is hittable
const noteSpeed = 3; // Base speed for regular notes
const fasterNoteSpeed = noteSpeed * 1.5; // Speed for faster notes
const sliderNoteSpeed = noteSpeed; // Base speed for slider notes (can be varied later)
const minSliderDuration = 0.5; // Minimum duration for a slider in seconds
const maxSliderDuration = 2.0; // Maximum duration for a slider in seconds
const assumedFrameRate = 60; // frames per second (for calculating pixel height of sliders)

let gameHeight = 0; // Will be calculated after layout

// Calculate crossbar position and game height once (and re-calculate on resize)
let crossbarPosition = 0;

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        if(entry.target === lanes[0]) {
            const lanesRect = lanes[0].getBoundingClientRect();
            gameHeight = lanesRect.height;
            const crossbarRect = hitCrossbar.getBoundingClientRect();
            crossbarPosition = crossbarRect.top - lanesRect.top + crossbarRect.height / 2;
            console.log('Game height:', gameHeight, 'Crossbar position:', crossbarPosition);
        }
    }
});

// Observe all lanes, although height should be consistent
lanes.forEach(lane => resizeObserver.observe(lane));

// Function to update the score display
function updateScoreDisplay() {
    // Round the score to the nearest integer before displaying
    scoreDisplay.textContent = `Score: ${Math.round(score)}`;
}

// Function to update the accuracy display
function updateAccuracyDisplay() {
    if (totalNotes === 0) {
        accuracyDisplay.textContent = 'Accuracy: 100%';
    } else {
        // Calculate accuracy based on hitNotes vs totalNotes (which now includes slider segments implicitly)
        // This might need adjustment later for more granular slider scoring
        const accuracy = (hitNotes / totalNotes) * 100;
        accuracyDisplay.textContent = `Accuracy: ${accuracy.toFixed(2)}%`;
    }
}

// Function to update the streak display
function updateStreakDisplay() {
    streakDisplay.textContent = `Streak: ${currentStreak}`;
}

// Function to show floating hit feedback text
function showHitFeedback(accuracy, laneElement) {
    // Remove any existing feedback in this lane to avoid clutter
    const existingFeedback = laneElement.querySelector('.hit-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }

    const feedbackText = document.createElement('div');
    feedbackText.classList.add('hit-feedback', accuracy.toLowerCase());
    feedbackText.textContent = accuracy.toUpperCase();
    
    // Position feedback relative to the hit crossbar
    const laneRect = laneElement.getBoundingClientRect();
    const crossbarRect = hitCrossbar.getBoundingClientRect();
    const feedbackTop = crossbarRect.top - laneRect.top - feedbackText.offsetHeight; // Position above crossbar
    
    feedbackText.style.top = `${feedbackTop}px`;
    
    laneElement.appendChild(feedbackText);

    // Remove the element after the animation
    feedbackText.addEventListener('animationend', () => {
        feedbackText.remove();
    });
}

// Function to create a falling note
function createNote(laneIndex, type = 'regular', speed = noteSpeed, duration = 0) {
    if (!isGameStarted) {
         console.log('Game not started, not creating note.');
         return;
    }
    if (laneIndex < 0 || laneIndex >= lanes.length) {
        console.error('Invalid lane index:', laneIndex);
        return;
    }

    const note = document.createElement('div');
    note.classList.add('note', type);
    
    note.dataset.status = 'falling';
    note.dataset.lane = laneIndex; // Store lane index
    note.dataset.speed = speed; // Store the note's speed
    note.dataset.type = type; // Store the note type

    if (type === 'slider') {
        note.dataset.duration = duration; // Store slider duration
        // Calculate height based on duration and speed (pixels per second)
        const pixelHeight = speed * assumedFrameRate * duration;
        note.style.height = `${pixelHeight}px`;
        note.style.backgroundColor = '#00bfff'; // Blue for sliders
        note.style.borderRadius = '5px'; // Maybe adjust border-radius for sliders
        console.log(`Creating slider note in lane ${laneIndex} with duration ${duration.toFixed(2)}s and pixel height ${pixelHeight.toFixed(2)}px.`);

    } else {
        note.style.height = '20px'; // Default height for regular notes
        note.style.backgroundColor = '#00ff00'; // Green for regular notes
        note.style.borderRadius = '5px';
         console.log(`Creating regular note in lane ${laneIndex} with speed ${speed}.`);
    }

    note.style.top = '0'; // Start from the top

    note.style.width = 'calc(100% - 10px)';
    note.style.left = '5px';
    note.style.position = 'absolute';

    lanes[laneIndex].appendChild(note);
    notesInLanes[laneIndex].push(note);
    totalNotes++; // Count both regular and slider initial appearance as a total note
    updateAccuracyDisplay(); // This calculation might need refinement for sliders

    // Animate the note falling
    function fall() {
        // Stop animation if note is hit or missed
        if (note.dataset.status === 'hit' || note.dataset.status === 'missed') {
            // For sliders, if hit, the removal is handled by keyup/miss logic
            if (note.dataset.status === 'hit' && type !== 'slider') { // Remove regular and flick notes on hit
                 removeNote(note, note.dataset.lane);
            }
             // Sliders that are missed will be removed by the miss detection below or keyup logic
            return;
        }

        let position = parseFloat(note.style.top);
        // Use the note's specific speed for falling
        const currentNoteSpeed = parseFloat(note.dataset.speed);
        position += currentNoteSpeed;
        note.style.top = position + 'px';

        const noteBottomPosition = parseFloat(note.style.top) + note.offsetHeight;
        const noteTopPosition = parseFloat(note.style.top);

        // Miss detection for regular notes (based on passing the hit window)
        if (type === 'regular' && note.dataset.status === 'falling' && noteBottomPosition > crossbarPosition + badWindow) {
            note.classList.add('miss');
            note.dataset.status = 'missed';
            score -= missPenalty;
            currentStreak = 0; // Reset streak on miss
            updateScoreDisplay();
            updateStreakDisplay();
            console.log('Regular note missed!');
            showHitFeedback('Miss', lanes[note.dataset.lane]);
            // Remove the note after a short delay to show the miss feedback
            setTimeout(() => {
                removeNote(note, note.dataset.lane);
            }, 300);
            return;
        }

         // Miss detection for slider notes (when the head passes the hit window without being activated)
        if (type === 'slider' && note.dataset.status === 'falling' && noteBottomPosition > crossbarPosition + badWindow && !activeSliders[laneIndex].includes(note)) {
             note.classList.add('miss');
             note.dataset.status = 'missed';
             score -= missPenalty; // Penalize for missing the start of the slider
             currentStreak = 0; // Reset streak on miss
             updateScoreDisplay();
             updateStreakDisplay();
             console.log('Slider note head missed!');
             showHitFeedback('Miss', lanes[laneIndex]);
             // Remove the note after a short delay
             setTimeout(() => {
                 removeNote(note, laneIndex);
             }, 300);
             return;
        }

         // Remove slider notes once their tail has passed the hit window and they are not active or are hit (completed)
        if (type === 'slider' && noteTopPosition > crossbarPosition + badWindow && note.dataset.status !== 'falling') { // If not falling, means it was hit/active and passed
             console.log('Completed/missed slider tail passed hit window, removing.');
             removeNote(note, laneIndex);
             return;
        }

        // Fallback removal for notes that go off screen below the hit window (should be covered by miss detection, but as safeguard)
        if (position > gameHeight && note.dataset.status === 'falling') {
            console.log('Note went off screen below hit window, removing.');
            removeNote(note, note.dataset.lane);
            currentStreak = 0; // Reset streak on note going off screen
            updateStreakDisplay();
            return; // Stop animation loop
        }

        requestAnimationFrame(fall);
    }

    fall(); // Start the falling animation
}

// Function to remove a note
function removeNote(note, laneIndex) {
    console.log(`Removing note from lane ${laneIndex}.`);
    if (note && note.parentNode) {
        note.parentNode.removeChild(note);
        // Remove the note from the notesInLanes array as well
        notesInLanes[laneIndex] = notesInLanes[laneIndex].filter(n => n !== note);
        // Also remove from activeSliders if it's a slider
        activeSliders[laneIndex] = activeSliders[laneIndex].filter(s => s !== note);
        console.log(`Note removed from DOM and notesInLanes array.`);
    } else {
        console.log(`Attempted to remove note, but note or parentNode is null/undefined.`);
    }
}

// Optional: Get a random color for notes (using fixed green/blue/yellow for now)
/*
function getRandomColor() {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
    return colors[Math.floor(Math.random() * colors.length)];
}
*/

// Handle key presses
document.addEventListener('keydown', (event) => {
    if (!isGameStarted) return;

    const key = event.key.toUpperCase();
    if (keyMap.hasOwnProperty(key)) {
        const laneIndex = keyMap[key];

        // Prevent processing if key is already held
        if (heldKeys[laneIndex]) {
            return;
        }

        // Mark key as held
        heldKeys[laneIndex] = true;
        console.log(`Key pressed: ${key} in lane ${laneIndex}. Held keys: ${JSON.stringify(heldKeys)}`);

        // Check for hits in the corresponding lane
        const notes = notesInLanes[laneIndex];
        let hitRegistered = false;

        // Sort notes by position to prioritize the closest note to the crossbar
        notes.sort((a, b) => (parseFloat(a.style.top) + a.offsetHeight / 2) - (parseFloat(b.style.top) + b.offsetHeight / 2));

        for (let i = notes.length - 1; i >= 0; i--) {
            const note = notes[i];
            const notePosition = parseFloat(note.style.top);
            const noteCenterPosition = notePosition + note.offsetHeight / 2;
            const noteBottomPosition = notePosition + note.offsetHeight;
            const noteType = note.dataset.type || 'regular'; // Default to regular

            // Calculate the hit area boundaries relative to the crossbar
            const perfectAreaTop = crossbarPosition - perfectWindow;
            const perfectAreaBottom = crossbarPosition + perfectWindow;
            const goodAreaTop = crossbarPosition - goodWindow;
            const goodAreaBottom = crossbarPosition + goodWindow;
            const badAreaTop = crossbarPosition - badWindow;
            const badAreaBottom = crossbarPosition + badWindow;

            // --- Hit detection for regular notes ---
            if (noteType === 'regular' && note.dataset.status === 'falling' && noteCenterPosition > badAreaTop && noteCenterPosition < badAreaBottom) {
                let hitAccuracy = 'Bad';
                let scoreIncrease = 50;

                if (noteCenterPosition > goodAreaTop && noteCenterPosition < goodAreaBottom) {
                    hitAccuracy = 'Good';
                    scoreIncrease = 100;
                }

                if (noteCenterPosition > perfectAreaTop && noteCenterPosition < perfectAreaBottom) {
                    hitAccuracy = 'Perfect';
                    scoreIncrease = 200;
                }

                score += scoreIncrease;
                hitNotes++; // Count regular note hits
                currentStreak++; // Increment streak on hit
                updateScoreDisplay();
                updateAccuracyDisplay();
                updateStreakDisplay(); // Update streak display

                console.log(`${hitAccuracy}! Score: ${score}, Accuracy: ${(hitNotes / totalNotes) * 100}, Streak: ${currentStreak}`);
                note.dataset.status = 'hit';
                removeNote(note, laneIndex);

                // Visual feedback for hit button
                const inputButton = inputButtons[laneIndex];
                inputButton.classList.add('hit');
                setTimeout(() => {
                    inputButton.classList.remove('hit');
                }, 100);

                showHitFeedback(hitAccuracy, lanes[laneIndex]);
                hitRegistered = true;
                break; // Only hit the closest note
            }
             // If the note has already passed the hit window, it's a miss handled by the fall animation
             else if (noteType === 'regular' && notePosition > badAreaBottom && note.dataset.status === 'falling') {
                 console.log('Key pressed after regular note has passed hit window. Not a hit here.');
             }

             // --- Hit detection for slider notes (start) ---
             // Check if the head (bottom) of a falling slider note is within the hit window
             if (noteType === 'slider' && note.dataset.status === 'falling' && noteBottomPosition > badAreaTop && noteBottomPosition < badAreaBottom && !activeSliders[laneIndex].includes(note)) {
                 console.log('Slider note head hit window reached, activating slider.');
                 note.dataset.status = 'active'; // Mark slider as active
                 activeSliders[laneIndex].push(note); // Add to active sliders
                 activeSliderStartTime[laneIndex] = performance.now(); // Store activation time
                 hitRegistered = true; // Consider the start of the slider as a hit
                 // Further scoring and completion check will be in keyup or a separate update loop

                 // Visual feedback (optional)
                 note.style.backgroundColor = '#ffd700'; // Change color when active (gold)
                 // You might want to change the appearance of the hit crossbar or input button here too

                 break; // Only activate the closest slider head
             }
        }

        // If no hit was registered AND there is no active slider in this lane, it's a phantom press
        if (!hitRegistered && !activeSliders[laneIndex].some(note => note.dataset.status === 'active')) {
            console.log('Key pressed, no note to hit or activate - Phantom Press!');
            score -= phantomPressPenalty;
            currentStreak = 0; // Reset streak on phantom press
            updateScoreDisplay();
            updateStreakDisplay();
            showHitFeedback('Miss', lanes[laneIndex]); // Show miss feedback for phantom press
        }

        // Visual feedback on button press
        const inputButton = inputButtons[laneIndex];
        inputButton.classList.add('pressed'); // Add a pressed class for styling
    }
});

// Handle key releases
document.addEventListener('keyup', (event) => {
    if (!isGameStarted) return;

    const key = event.key.toUpperCase();
    if (keyMap.hasOwnProperty(key)) {
        const laneIndex = keyMap[key];
        // Mark key as not held
        heldKeys[laneIndex] = false;
        console.log(`Key released: ${key} in lane ${laneIndex}. Held keys: ${JSON.stringify(heldKeys)}`);

        // Visual feedback on button release
        const inputButton = inputButtons[laneIndex];
        inputButton.classList.remove('pressed'); // Remove the pressed class

        // --- Slider note completion check on key release ---
        // Find the active slider in this lane, if any
        const activeSlider = activeSliders[laneIndex].find(note => note.dataset.status === 'active');

        if (activeSlider) {
            console.log('Active slider released.');
            const holdDuration = (performance.now() - activeSliderStartTime[laneIndex]) / 1000; // Duration in seconds
            const requiredDuration = parseFloat(activeSlider.dataset.duration); // Required hold duration

            console.log(`Held for: ${holdDuration.toFixed(2)}s, Required: ${requiredDuration.toFixed(2)}s`);

            // Simple completion check for now: remove if held for at least required duration (within a tolerance)
            const durationTolerance = 0.1; // seconds tolerance for hold duration
            if (holdDuration >= requiredDuration - durationTolerance) {
                 console.log('Slider held for sufficient duration. Removing.');
                 // TODO: Add scoring for successful slider hold (e.g., based on duration)
                 score += 50 * requiredDuration; // Example: score proportional to duration
                 hitNotes++; // Count slider hold as one hit for now (can be refined)
                 currentStreak++; // Increment streak
                 updateScoreDisplay();
                 updateAccuracyDisplay(); // Accuracy calculation needs refinement
                 updateStreakDisplay();

                 removeNote(activeSlider, laneIndex); // Remove the slider note
                 showHitFeedback('Hold!', lanes[laneIndex]); // Show feedback for successful hold
            } else {
                 console.log('Slider released too early. Removing.');
                 // Penalize for early release (can be partial or full miss penalty)
                 score -= missPenalty; // For now, full miss penalty
                 currentStreak = 0; // Reset streak on miss/early release
                 updateScoreDisplay();
                 updateStreakDisplay();
                 removeNote(activeSlider, laneIndex); // Remove the slider note
                 showHitFeedback('Early', lanes[laneIndex]); // Show feedback for early release
            }

             // Remove from active sliders regardless of success/failure
             activeSliders[laneIndex] = activeSliders[laneIndex].filter(s => s !== activeSlider);
             delete activeSliderStartTime[laneIndex]; // Clear the start time
        }
    }
});

// Reinstated interval-based note generation function
let noteGenerationInterval = null; // Keep track of the interval

function startNoteGeneration() {
    if (!isGameStarted) {
        console.log('startNoteGeneration called but game not started.');
        return;
    }
    console.log('Starting interval-based note generation.');
    // Clear any existing interval to prevent multiple intervals running
    if (noteGenerationInterval) {
        clearInterval(noteGenerationInterval);
    }

    noteGenerationInterval = setInterval(() => {
        const randomLane = Math.floor(Math.random() * lanes.length);

        // Check if there are ANY notes in this lane (slider or regular)
        if (notesInLanes[randomLane].length > 0) {
            // console.log(`Skipping note generation in lane ${randomLane} due to existing notes.`);
            return; // Skip this interval tick for this lane
        }

        let type = 'regular';
        let speed = noteSpeed;
        let duration = 0;

        // Randomly choose between regular and slider notes
        const noteTypeChance = Math.random();

        // Prevent generating a slider if the last note in this lane was a slider
        if (lastNoteType[randomLane] !== 'slider' && noteTypeChance < 0.3) { // 30% chance for slider
            type = 'slider';
            duration = minSliderDuration + Math.random() * (maxSliderDuration - minSliderDuration);
            speed = sliderNoteSpeed;
        } else { // 70% chance for regular notes
            const isFaster = Math.random() < 0.3; // 30% chance of a faster regular note
            speed = isFaster ? fasterNoteSpeed : noteSpeed;
        }

        createNote(randomLane, type, speed, duration);
        lastNoteType[randomLane] = type; // Update last note type for this lane

    }, 700); // Adjust interval as needed for desired note density
}

// Reinstated stop note generation (call when game ends or paused)
function stopNoteGeneration() {
    console.log('Stopping note generation interval.');
    if (noteGenerationInterval) {
        clearInterval(noteGenerationInterval);
        noteGenerationInterval = null;
    }
}

// Removed time-based note generation function and related calculations
/*
const assumedFrameRate = 60; // frames per second
const noteSpeedPerSecond = noteSpeed * assumedFrameRate; // pixels per second
let fallDurationInSeconds = 0; // Will be calculated once crossbarPosition is known

function calculateFallDuration() { ... }
calculateFallDuration();

function generateNotesBasedOnTime() { ... }
*/

// Ensure note generation starts only when a song is selected
// The event listener on song cards already calls startGame

// Initial setup (could potentially show the song selection screen here on page load)
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded. Showing song selection.');
    document.getElementById('song-selection').style.display = 'flex';
    document.getElementById('game-screen').style.display = 'none';
});

// Initial call to update displays on page load (before game starts)
updateScoreDisplay();
updateAccuracyDisplay();
updateStreakDisplay();

// Add touch event listeners for mobile support
inputButtons.forEach((button, index) => {
    // Touch start (equivalent to keydown)
    button.addEventListener('touchstart', (event) => {
        event.preventDefault(); // Prevent default touch behavior
        if (!isGameStarted) return;

        // Prevent processing if key is already held
        if (heldKeys[index]) {
            return;
        }

        // Mark key as held
        heldKeys[index] = true;
        console.log(`Touch started on button ${index}. Held keys: ${JSON.stringify(heldKeys)}`);

        // Check for hits in the corresponding lane
        const notes = notesInLanes[index];
        let hitRegistered = false;

        // Sort notes by position to prioritize the closest note to the crossbar
        notes.sort((a, b) => (parseFloat(a.style.top) + a.offsetHeight / 2) - (parseFloat(b.style.top) + b.offsetHeight / 2));

        for (let i = notes.length - 1; i >= 0; i--) {
            const note = notes[i];
            const notePosition = parseFloat(note.style.top);
            const noteCenterPosition = notePosition + note.offsetHeight / 2;
            const noteBottomPosition = notePosition + note.offsetHeight;
            const noteType = note.dataset.type || 'regular'; // Default to regular

            // Calculate the hit area boundaries relative to the crossbar
            const perfectAreaTop = crossbarPosition - perfectWindow;
            const perfectAreaBottom = crossbarPosition + perfectWindow;
            const goodAreaTop = crossbarPosition - goodWindow;
            const goodAreaBottom = crossbarPosition + goodWindow;
            const badAreaTop = crossbarPosition - badWindow;
            const badAreaBottom = crossbarPosition + badWindow;

            // --- Hit detection for regular notes ---
            if (noteType === 'regular' && note.dataset.status === 'falling' && noteCenterPosition > badAreaTop && noteCenterPosition < badAreaBottom) {
                let hitAccuracy = 'Bad';
                let scoreIncrease = 50;

                if (noteCenterPosition > goodAreaTop && noteCenterPosition < goodAreaBottom) {
                    hitAccuracy = 'Good';
                    scoreIncrease = 100;
                }

                if (noteCenterPosition > perfectAreaTop && noteCenterPosition < perfectAreaBottom) {
                    hitAccuracy = 'Perfect';
                    scoreIncrease = 200;
                }

                score += scoreIncrease;
                hitNotes++; // Count regular note hits
                currentStreak++; // Increment streak on hit
                updateScoreDisplay();
                updateAccuracyDisplay();
                updateStreakDisplay(); // Update streak display

                console.log(`${hitAccuracy}! Score: ${Math.round(score)}, Accuracy: ${(hitNotes / totalNotes) * 100}, Streak: ${currentStreak}`);
                note.dataset.status = 'hit';
                removeNote(note, index);

                // Visual feedback for hit button
                button.classList.add('hit');
                setTimeout(() => {
                    button.classList.remove('hit');
                }, 100);

                showHitFeedback(hitAccuracy, lanes[index]);
                hitRegistered = true;
                break; // Only hit the closest note
            }
            // If the note has already passed the hit window, it's a miss handled by the fall animation
            else if (noteType === 'regular' && notePosition > badAreaBottom && note.dataset.status === 'falling') {
                console.log('Touch after regular note has passed hit window. Not a hit here.');
            }

            // --- Hit detection for slider notes (start) ---
            // Check if the head (bottom) of a falling slider note is within the hit window
            if (noteType === 'slider' && note.dataset.status === 'falling' && noteBottomPosition > badAreaTop && noteBottomPosition < badAreaBottom && !activeSliders[index].includes(note)) {
                console.log('Slider note head hit window reached, activating slider.');
                note.dataset.status = 'active'; // Mark slider as active
                activeSliders[index].push(note); // Add to active sliders
                activeSliderStartTime[index] = performance.now(); // Store activation time
                hitRegistered = true; // Consider the start of the slider as a hit

                // Visual feedback
                note.style.backgroundColor = '#ffd700'; // Change color when active (gold)
                break; // Only activate the closest slider head
            }
        }

        // If no hit was registered AND there is no active slider in this lane, it's a phantom press
        if (!hitRegistered && !activeSliders[index].some(note => note.dataset.status === 'active')) {
            console.log('Touch, no note to hit or activate - Phantom Press!');
            score -= phantomPressPenalty;
            currentStreak = 0; // Reset streak on phantom press
            updateScoreDisplay();
            updateStreakDisplay();
            showHitFeedback('Miss', lanes[index]); // Show miss feedback for phantom press
        }

        // Visual feedback on button press
        button.classList.add('pressed'); // Add a pressed class for styling
    });

    // Touch end (equivalent to keyup)
    button.addEventListener('touchend', (event) => {
        event.preventDefault(); // Prevent default touch behavior
        if (!isGameStarted) return;

        // Mark key as not held
        heldKeys[index] = false;
        console.log(`Touch ended on button ${index}. Held keys: ${JSON.stringify(heldKeys)}`);

        // Visual feedback on button release
        button.classList.remove('pressed'); // Remove the pressed class

        // --- Slider note completion check on touch end ---
        // Find the active slider in this lane, if any
        const activeSlider = activeSliders[index].find(note => note.dataset.status === 'active');

        if (activeSlider) {
            console.log('Active slider released.');
            const holdDuration = (performance.now() - activeSliderStartTime[index]) / 1000; // Duration in seconds
            const requiredDuration = parseFloat(activeSlider.dataset.duration); // Required hold duration

            console.log(`Held for: ${holdDuration.toFixed(2)}s, Required: ${requiredDuration.toFixed(2)}s`);

            // Simple completion check for now: remove if held for at least required duration (within a tolerance)
            const durationTolerance = 0.1; // seconds tolerance for hold duration
            if (holdDuration >= requiredDuration - durationTolerance) {
                console.log('Slider held for sufficient duration. Removing.');
                score += 50 * requiredDuration; // Example: score proportional to duration
                hitNotes++; // Count slider hold as one hit for now (can be refined)
                currentStreak++; // Increment streak
                updateScoreDisplay();
                updateAccuracyDisplay(); // Accuracy calculation needs refinement
                updateStreakDisplay();

                removeNote(activeSlider, index); // Remove the slider note
                showHitFeedback('Hold!', lanes[index]); // Show feedback for successful hold
            } else {
                console.log('Slider released too early. Removing.');
                score -= missPenalty; // For now, full miss penalty
                currentStreak = 0; // Reset streak on miss/early release
                updateScoreDisplay();
                updateStreakDisplay();
                removeNote(activeSlider, index); // Remove the slider note
                showHitFeedback('Early', lanes[index]); // Show feedback for early release
            }

            // Remove from active sliders regardless of success/failure
            activeSliders[index] = activeSliders[index].filter(s => s !== activeSlider);
            delete activeSliderStartTime[index]; // Clear the start time
        }
    });

    // Prevent default touch behavior on the button
    button.addEventListener('touchmove', (event) => {
        event.preventDefault();
    });
});

// Additional ad blocking functionality
function blockAdIframes() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Block ad iframes
                    if (node.tagName === 'IFRAME') {
                        const src = node.src || '';
                        if (src.includes('googleads') || 
                            src.includes('doubleclick') || 
                            src.includes('adservice') ||
                            src.includes('pagead')) {
                            console.log('Blocking ad iframe:', src);
                            node.remove();
                        }
                    }
                    // Block ad scripts
                    if (node.tagName === 'SCRIPT') {
                        const src = node.src || '';
                        const content = node.textContent || '';
                        if (src.includes('googleads') || 
                            src.includes('doubleclick') || 
                            src.includes('adservice') ||
                            content.includes('googleads') ||
                            content.includes('doubleclick')) {
                            console.log('Blocking ad script:', src);
                            node.remove();
                        }
                    }
                }
            });
        });
    });

    // Observe the entire document
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

// Enhanced ad blocking functionality
function setupEnhancedAdBlocking() {
    // Block additional ad-related domains
    const blockedDomains = [
        'googleads',
        'doubleclick',
        'adservice',
        'pagead',
        'googlesyndication',
        'adnxs',
        'adform',
        'adroll',
        'advertising',
        'analytics',
        'tracking',
        'pixel',
        'beacon',
        'stats',
        'metrics'
    ];

    // Enhanced fetch blocking
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0]?.url || args[0];
        if (url && typeof url === 'string' && blockedDomains.some(domain => url.includes(domain))) {
            console.log('Blocked fetch request to:', url);
            return new Promise(() => {});
        }
        return originalFetch.apply(this, args);
    };

    // Enhanced XHR blocking
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (url && typeof url === 'string' && blockedDomains.some(domain => url.includes(domain))) {
            console.log('Blocked XHR request to:', url);
            return;
        }
        return originalXHROpen.call(this, method, url, ...rest);
    };

    // Block WebSocket connections to ad servers
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, ...args) {
        if (url && typeof url === 'string' && blockedDomains.some(domain => url.includes(domain))) {
            console.log('Blocked WebSocket connection to:', url);
            return new originalWebSocket('ws://localhost');
        }
        return new originalWebSocket(url, ...args);
    };

    // YouTube-specific ad blocking
    function blockYouTubeAds() {
        // Block ad-related elements
        const adSelectors = [
            '.ytp-ad-overlay-container',
            '.ytp-ad-text',
            '.ytp-ad-skip-button',
            '.ytp-ad-preview-container',
            '.ytp-ad-preview-slot',
            '.ytp-ad-skip-button-modern',
            '.ytp-ad-skip-button-container',
            '.ytp-ad-skip-button-icon',
            '.ytp-ad-skip-button-text',
            '.ytp-ad-message-container',
            '.ytp-ad-action-interstitial',
            '.ytp-ad-action-interstitial-background-container',
            '.ytp-ad-action-interstitial-content',
            '.ytp-ad-action-interstitial-dismiss-button',
            '.ytp-ad-action-interstitial-headline',
            '.ytp-ad-action-interstitial-description',
            '.ytp-ad-action-interstitial-action-button',
            '.ytp-ad-action-interstitial-action-button-text',
            '.ytp-ad-action-interstitial-action-button-icon',
            '.ytp-ad-action-interstitial-action-button-icon-container',
            '.ytp-ad-action-interstitial-action-button-icon-svg',
            '.ytp-ad-action-interstitial-action-button-icon-path',
            '.ytp-ad-action-interstitial-action-button-icon-circle',
            '.ytp-ad-action-interstitial-action-button-icon-rect',
            '.ytp-ad-action-interstitial-action-button-icon-polygon',
            '.ytp-ad-action-interstitial-action-button-icon-line',
            '.ytp-ad-action-interstitial-action-button-icon-ellipse',
            '.ytp-ad-action-interstitial-action-button-icon-polyline',
            '.ytp-ad-action-interstitial-action-button-icon-path',
            '.ytp-ad-action-interstitial-action-button-icon-text',
            '.ytp-ad-action-interstitial-action-button-icon-image',
            '.ytp-ad-action-interstitial-action-button-icon-video',
            '.ytp-ad-action-interstitial-action-button-icon-audio',
            '.ytp-ad-action-interstitial-action-button-icon-document',
            '.ytp-ad-action-interstitial-action-button-icon-archive',
            '.ytp-ad-action-interstitial-action-button-icon-code',
            '.ytp-ad-action-interstitial-action-button-icon-data',
            '.ytp-ad-action-interstitial-action-button-icon-other'
        ];

        // Create and inject CSS to hide ad elements
        const style = document.createElement('style');
        style.textContent = adSelectors.map(selector => `${selector} { display: none !important; }`).join('\n');
        document.head.appendChild(style);

        // Monitor for ad-related mutations
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check for ad-related elements
                        if (node.matches && adSelectors.some(selector => node.matches(selector))) {
                            console.log('Removing ad element:', node);
                            node.remove();
                        }
                        // Check child elements
                        if (node.querySelectorAll) {
                            adSelectors.forEach(selector => {
                                node.querySelectorAll(selector).forEach(element => {
                                    console.log('Removing ad element:', element);
                                    element.remove();
                                });
                            });
                        }
                    }
                });
            });
        });

        // Start observing
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // Call YouTube-specific ad blocking
    blockYouTubeAds();
}

// Enhanced YouTube-specific ad blocking
function setupYouTubeSpecificAdBlocking() {
    // Additional YouTube ad-related selectors
    const youtubeAdSelectors = [
        // Video player ad elements
        'div.ytp-ad-player-overlay',
        'div.ytp-ad-preview-container',
        'div.ytp-ad-skip-button-container',
        'div.ytp-ad-skip-button-modern',
        'div.ytp-ad-skip-button-text',
        'div.ytp-ad-skip-button-icon',
        'div.ytp-ad-skip-button-modern:active',
        'div.ytp-ad-skip-button-modern:hover',
        'div.ytp-ad-skip-button-modern:focus',
        'div.ytp-ad-skip-button-modern:disabled',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):hover',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):focus',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):active',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):disabled',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):not(:hover):not(:focus):not(:active):not(:disabled)',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):not(:hover):not(:focus):not(:active):not(:disabled):hover',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):not(:hover):not(:focus):not(:active):not(:disabled):focus',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):not(:hover):not(:focus):not(:active):not(:disabled):active',
        'div.ytp-ad-skip-button-modern:not([aria-disabled=true]):not(:hover):not(:focus):not(:active):not(:disabled):disabled',
        // Ad overlay elements
        'div.ytp-ad-overlay-container',
        'div.ytp-ad-overlay-slot',
        'div.ytp-ad-overlay-image',
        'div.ytp-ad-overlay-close-button',
        'div.ytp-ad-overlay-close-button-icon',
        'div.ytp-ad-overlay-close-button-icon-svg',
        'div.ytp-ad-overlay-close-button-icon-path',
        'div.ytp-ad-overlay-close-button-icon-circle',
        'div.ytp-ad-overlay-close-button-icon-rect',
        'div.ytp-ad-overlay-close-button-icon-polygon',
        'div.ytp-ad-overlay-close-button-icon-line',
        'div.ytp-ad-overlay-close-button-icon-ellipse',
        'div.ytp-ad-overlay-close-button-icon-polyline',
        'div.ytp-ad-overlay-close-button-icon-path',
        'div.ytp-ad-overlay-close-button-icon-text',
        'div.ytp-ad-overlay-close-button-icon-image',
        'div.ytp-ad-overlay-close-button-icon-video',
        'div.ytp-ad-overlay-close-button-icon-audio',
        'div.ytp-ad-overlay-close-button-icon-document',
        'div.ytp-ad-overlay-close-button-icon-archive',
        'div.ytp-ad-overlay-close-button-icon-code',
        'div.ytp-ad-overlay-close-button-icon-data',
        'div.ytp-ad-overlay-close-button-icon-other',
        // Ad message elements
        'div.ytp-ad-message-container',
        'div.ytp-ad-message-text',
        'div.ytp-ad-message-icon',
        'div.ytp-ad-message-icon-svg',
        'div.ytp-ad-message-icon-path',
        'div.ytp-ad-message-icon-circle',
        'div.ytp-ad-message-icon-rect',
        'div.ytp-ad-message-icon-polygon',
        'div.ytp-ad-message-icon-line',
        'div.ytp-ad-message-icon-ellipse',
        'div.ytp-ad-message-icon-polyline',
        'div.ytp-ad-message-icon-path',
        'div.ytp-ad-message-icon-text',
        'div.ytp-ad-message-icon-image',
        'div.ytp-ad-message-icon-video',
        'div.ytp-ad-message-icon-audio',
        'div.ytp-ad-message-icon-document',
        'div.ytp-ad-message-icon-archive',
        'div.ytp-ad-message-icon-code',
        'div.ytp-ad-message-icon-data',
        'div.ytp-ad-message-icon-other',
        // Ad action elements
        'div.ytp-ad-action-interstitial',
        'div.ytp-ad-action-interstitial-background-container',
        'div.ytp-ad-action-interstitial-content',
        'div.ytp-ad-action-interstitial-dismiss-button',
        'div.ytp-ad-action-interstitial-headline',
        'div.ytp-ad-action-interstitial-description',
        'div.ytp-ad-action-interstitial-action-button',
        'div.ytp-ad-action-interstitial-action-button-text',
        'div.ytp-ad-action-interstitial-action-button-icon',
        'div.ytp-ad-action-interstitial-action-button-icon-container',
        'div.ytp-ad-action-interstitial-action-button-icon-svg',
        'div.ytp-ad-action-interstitial-action-button-icon-path',
        'div.ytp-ad-action-interstitial-action-button-icon-circle',
        'div.ytp-ad-action-interstitial-action-button-icon-rect',
        'div.ytp-ad-action-interstitial-action-button-icon-polygon',
        'div.ytp-ad-action-interstitial-action-button-icon-line',
        'div.ytp-ad-action-interstitial-action-button-icon-ellipse',
        'div.ytp-ad-action-interstitial-action-button-icon-polyline',
        'div.ytp-ad-action-interstitial-action-button-icon-path',
        'div.ytp-ad-action-interstitial-action-button-icon-text',
        'div.ytp-ad-action-interstitial-action-button-icon-image',
        'div.ytp-ad-action-interstitial-action-button-icon-video',
        'div.ytp-ad-action-interstitial-action-button-icon-audio',
        'div.ytp-ad-action-interstitial-action-button-icon-document',
        'div.ytp-ad-action-interstitial-action-button-icon-archive',
        'div.ytp-ad-action-interstitial-action-button-icon-code',
        'div.ytp-ad-action-interstitial-action-button-icon-data',
        'div.ytp-ad-action-interstitial-action-button-icon-other'
    ];

    // Create and inject CSS to hide ad elements
    const style = document.createElement('style');
    style.textContent = youtubeAdSelectors.map(selector => `${selector} { display: none !important; }`).join('\n');
    document.head.appendChild(style);

    // Function to handle problematic videos
    function handleProblematicVideos(videoId) {
        if (videoId === 'IAWfOhT8sXo') {
            console.log('Problematic video detected, applying enhanced ad blocking...');
            
            // Additional ad blocking for this specific video
            const additionalSelectors = [
                'div[class*="ytp-ad"]',
                'div[class*="ytp-ad-overlay"]',
                'div[class*="ytp-ad-skip"]',
                'div[class*="ytp-ad-preview"]',
                'div[class*="ytp-ad-message"]',
                'div[class*="ytp-ad-action"]',
                'div[class*="ytp-ad-player"]',
                'div[class*="ytp-ad-slot"]',
                'div[class*="ytp-ad-text"]',
                'div[class*="ytp-ad-image"]',
                'div[class*="ytp-ad-video"]',
                'div[class*="ytp-ad-audio"]',
                'div[class*="ytp-ad-document"]',
                'div[class*="ytp-ad-archive"]',
                'div[class*="ytp-ad-code"]',
                'div[class*="ytp-ad-data"]',
                'div[class*="ytp-ad-other"]'
            ];

            const additionalStyle = document.createElement('style');
            additionalStyle.textContent = additionalSelectors.map(selector => `${selector} { display: none !important; }`).join('\n');
            document.head.appendChild(additionalStyle);

            // More aggressive ad blocking for this video
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            // Check for any element with ad-related classes
                            if (node.classList) {
                                const classes = Array.from(node.classList);
                                if (classes.some(cls => cls.includes('ytp-ad'))) {
                                    console.log('Removing ad element:', node);
                                    node.remove();
                                }
                            }
                            // Check child elements
                            if (node.querySelectorAll) {
                                additionalSelectors.forEach(selector => {
                                    node.querySelectorAll(selector).forEach(element => {
                                        console.log('Removing ad element:', element);
                                        element.remove();
                                    });
                                });
                            }
                        }
                    });
                });
            });

            // Start observing
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }
    }

    // Add to the existing onPlayerStateChange function
    const originalOnPlayerStateChange = onPlayerStateChange;
    onPlayerStateChange = function(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            const currentVideoId = player.getVideoData().video_id;
            handleProblematicVideos(currentVideoId);
        }
        return originalOnPlayerStateChange(event);
    };
}

// Function to block specific overlay ads
function blockSpecificOverlayAds() {
    // CSS selectors for specific overlay ads
    const overlayAdSelectors = [
        'div[class*="ytp-ad-overlay"]',
        'div[class*="ytp-ad-skip-button"]',
        'div[class*="ytp-ad-text"]',
        'div[class*="ytp-ad-image"]',
        'div[class*="ytp-ad-video"]',
        'div[class*="ytp-ad-audio"]',
        'div[class*="ytp-ad-document"]',
        'div[class*="ytp-ad-archive"]',
        'div[class*="ytp-ad-code"]',
        'div[class*="ytp-ad-data"]',
        'div[class*="ytp-ad-other"]'
    ];

    // Create and inject CSS to hide overlay ads
    const style = document.createElement('style');
    style.textContent = overlayAdSelectors.map(selector => `${selector} { display: none !important; }`).join('\n');
    document.head.appendChild(style);

    // Aggressive MutationObserver to remove overlay ads
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    overlayAdSelectors.forEach(selector => {
                        try {
                            if (node.matches && node.matches(selector)) {
                                console.log('Aggressively removing overlay ad element via MutationObserver:', node);
                                node.remove();
                            } else if (node.querySelectorAll) {
                                // Check children as well
                                node.querySelectorAll(selector).forEach(element => {
                                    console.log('Aggressively removing overlay ad element (child) via MutationObserver:', element);
                                    element.remove();
                                });
                            }
                        } catch (e) {
                            console.error('Error processing node in MutationObserver:', e);
                        }
                    });
                }
            });
        });
    });

    // Observe the entire document for changes
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

// Further enhanced ad blocking with broader DOM and network targeting
function setupUltraAdBlocking() {
    // Broader and pattern-based DOM selectors for potential ad elements
    const ultraAdSelectors = [
        'div[id*="ad"]', // Any div with ID containing "ad"
        'div[class*="ad"]', // Any div with class containing "ad"
        'iframe[src*="ad"]', // Any iframe with src containing "ad"
        'script[src*="ad"]', // Any script with src containing "ad"
        'div[id*="sponsor"]', // Any div with ID containing "sponsor"
        'div[class*="sponsor"]', // Any div with class containing "sponsor"
        'div[id*="promo"]', // Any div with ID containing "promo"
        'div[class*="promo"]', // Any div with class containing "promo"
        '*[id*="ad-container"]', // Any element with ID containing "ad-container"
        '*[class*="ad-container"]', // Any element with class containing "ad-container"
        '*[id*="ad-wrapper"]', // Any element with ID containing "ad-wrapper"
        '*[class*="ad-wrapper"]', // Any element with class containing "ad-wrapper"
        '*[id*="player-ads"]', // Any element with ID containing "player-ads"
        '*[class*="player-ads"]', // Any element with class containing "player-ads"
        '*[id*="video-ads"]', // Any element with ID containing "video-ads"
        '*[class*="video-ads"]', // Any element with class containing "video-ads"
        // Specific YouTube ad element patterns
        'div[class^="ytp-ad-"]', // Elements with class names starting with "ytp-ad-"
        'div[class*="-ad-container"]', // Elements with class names containing "-ad-container"
        'div[class*="-ad-overlay"]', // Elements with class names containing "-ad-overlay"
        'div[class*="-skip-button"]', // Elements with class names containing "-skip-button"
        'div[class*="-ad-message"]', // Elements with class names containing "-ad-message"
        'div[class*="-ad-action"]', // Elements with class names containing "-ad-action"
        'div[class*="-ad-player"]', // Elements with class names containing "-ad-player"
    ];

    // Create and inject CSS to hide these elements immediately
    const style = document.createElement('style');
    style.textContent = ultraAdSelectors.map(selector => `${selector} { display: none !important; }`).join('\n');
    document.head.appendChild(style);

    // Aggressive MutationObserver to remove any added nodes matching the selectors
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    ultraAdSelectors.forEach(selector => {
                        try {
                            if (node.matches && node.matches(selector)) {
                                console.log('Aggressively removing ad element via MutationObserver:', node);
                                node.remove();
                            } else if (node.querySelectorAll) {
                                // Check children as well
                                node.querySelectorAll(selector).forEach(element => {
                                    console.log('Aggressively removing ad element (child) via MutationObserver:', element);
                                    element.remove();
                                });
                            }
                        } catch (e) {
                            console.error('Error processing node in MutationObserver:', e);
                        }
                    });
                }
            });
        });
    });

    // Observe the entire document for changes
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Broader network request blocking
    const broadBlockedPatterns = [
        /\/\/pagead2\.googlesyndication\.com\//, // Google AdSense
        /\/\/static\.doubleclick\.net\//, // DoubleClick
        /\/\/www\.googletagservices\.com\//, // Google Publisher Tags
        /\/\/www\.googleadservices\.com\//, // Google Ad Services
        /\/\/tpc\.googlesyndication\.com\//, // Third-party content from Google Syndication
        /\/\/r[\d]+\.snrs\.youtube\.com\/ads\//, // YouTube ad specific URLs
        /\/\/manifest\.googlevideo\.com\/api\/manifest\/ads\//, // Ad manifests
        /\/\/imasdk\.googleapis\.com\//, // IMA SDK (Interactive Media Ads SDK)
        /\/\/googleads\.g\.doubleclick\.net\//, // Google Ads via DoubleClick
        /\/\/ad\.doubleclick\.net\//, // DoubleClick Ads
        /\/\/www\.youtube\.com\/get_video_info.*&adpr=/ // Ad parameters in get_video_info
    ];

    // Enhance fetch blocking with broader patterns
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0]?.url || args[0];
        if (url && typeof url === 'string' && broadBlockedPatterns.some(pattern => pattern.test(url))) {
            console.log('Blocked aggressive fetch request to:', url);
            return new Promise(() => {}); // Never resolve
        }
        return originalFetch.apply(this, args);
    };

    // Enhance XHR blocking with broader patterns
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (url && typeof url === 'string' && broadBlockedPatterns.some(pattern => pattern.test(url))) {
            console.log('Blocked aggressive XHR request to:', url);
            return; // Block the request
        }
        return originalXHROpen.call(this, method, url, ...rest);
    };

    // Enhance WebSocket blocking with broader patterns
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, ...args) {
        if (url && typeof url === 'string' && broadBlockedPatterns.some(pattern => pattern.test(url))) {
            console.log('Blocked aggressive WebSocket connection to:', url);
            return new originalWebSocket('ws://localhost'); // Redirect or block
        }
        return new originalWebSocket(url, ...args);
    };

    // Add event listener to attempt to skip ads on state change to playing
    // This is already in onPlayerStateChange, ensuring it's called should be enough

    // Periodically check and remove any remaining ad elements that might have slipped through
    setInterval(() => {
        ultraAdSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                 console.log('Periodically removing persistent ad element:', element);
                 element.remove();
            });
        });
    }, 1000); // Check every second
}

// Update setupAdHandlers to include the new ultra blocking function
function setupAdHandlers() {
    blockAdIframes();
    setupEnhancedAdBlocking();
    setupYouTubeSpecificAdBlocking();
    blockSpecificOverlayAds();
    setupUltraAdBlocking();
    
    // Add CSP meta tag to block ad resources
    const cspMeta = document.createElement('meta');
    cspMeta.httpEquiv = 'Content-Security-Policy';
    cspMeta.content = "connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; script-src 'self'; frame-src https://www.youtube-nocookie.com";
    document.head.appendChild(cspMeta);
    
    // Add additional ad-related class blocking
    const adClasses = [
        'ytp-ad-overlay-container',
        'ytp-ad-text',
        'ytp-ad-skip-button',
        'ytp-ad-preview-container',
        'ytp-ad-preview-slot',
        'ytp-ad-skip-button-modern',
        'ytp-ad-skip-button-container',
        'ytp-ad-skip-button-icon',
        'ytp-ad-skip-button-text',
        'ytp-ad-message-container',
        'ytp-ad-action-interstitial',
        'ytp-ad-action-interstitial-background-container',
        'ytp-ad-action-interstitial-content',
        'ytp-ad-action-interstitial-dismiss-button',
        'ytp-ad-action-interstitial-headline',
        'ytp-ad-action-interstitial-description',
        'ytp-ad-action-interstitial-action-button',
        'ytp-ad-action-interstitial-action-button-text',
        'ytp-ad-action-interstitial-action-button-icon',
        'ytp-ad-action-interstitial-action-button-icon-container',
        'ytp-ad-action-interstitial-action-button-icon-svg',
        'ytp-ad-action-interstitial-action-button-icon-path',
        'ytp-ad-action-interstitial-action-button-icon-circle',
        'ytp-ad-action-interstitial-action-button-icon-rect',
        'ytp-ad-action-interstitial-action-button-icon-polygon',
        'ytp-ad-action-interstitial-action-button-icon-line',
        'ytp-ad-action-interstitial-action-button-icon-ellipse',
        'ytp-ad-action-interstitial-action-button-icon-polyline',
        'ytp-ad-action-interstitial-action-button-icon-path',
        'ytp-ad-action-interstitial-action-button-icon-text',
        'ytp-ad-action-interstitial-action-button-icon-image',
        'ytp-ad-action-interstitial-action-button-icon-video',
        'ytp-ad-action-interstitial-action-button-icon-audio',
        'ytp-ad-action-interstitial-action-button-icon-document',
        'ytp-ad-action-interstitial-action-button-icon-archive',
        'ytp-ad-action-interstitial-action-button-icon-code',
        'ytp-ad-action-interstitial-action-button-icon-data',
        'ytp-ad-action-interstitial-action-button-icon-other'
    ];

    // Create a style element to hide ad-related elements
    const style = document.createElement('style');
    style.textContent = adClasses.map(className => `.${className} { display: none !important; }`).join('\n');
    document.head.appendChild(style);
} 
