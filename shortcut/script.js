document.addEventListener('DOMContentLoaded', () => {
    const audioUpload = document.getElementById('audio-upload');
    const audioListElement = document.getElementById('audio-list');
    const currentAudioTitleElement = document.getElementById('current-audio-title');
    const audioElement = document.getElementById('audio-element');
    const seekBar = document.getElementById('seek-bar');
    const seekBarTooltip = document.getElementById('seek-bar-tooltip');
    const bookmarkVisualizationLayer = document.getElementById('bookmark-visualization-layer');
    const currentTimeElement = document.getElementById('current-time');
    const totalTimeElement = document.getElementById('total-time');
    const prevBookmarkBtn = document.getElementById('prev-bookmark-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const setBookmarkBtn = document.getElementById('set-bookmark-btn');
    const volumeControl = document.getElementById('volume-control');
    const completionMessageElement = document.getElementById('completion-message');
    const currentYearElement = document.getElementById('current-year');
    const shortcutModeBtn = document.getElementById('shortcut-mode-btn'); 
    const audioPlayerContainer = document.getElementById('audio-player-container');

    currentYearElement.textContent = new Date().getFullYear();

    let isShortcutModeActive = false; 
    let currentAudioName = null;
    let bookmarks = []; 
    let listenedSegments = []; 
    let audioFilesData = {}; 

    const APP_STORAGE_KEY = 'toeflIntensiveListeningApp';

    // --- Initialization ---
    loadAppStorage();
    renderAudioList();
    disablePlayerControls(true);

    // --- Event Listeners ---
    audioUpload.addEventListener('change', handleFileUpload);
    playPauseBtn.addEventListener('click', togglePlayPause);
    setBookmarkBtn.addEventListener('click', setBookmark);
    prevBookmarkBtn.addEventListener('click', goToPrevBookmark);
    volumeControl.addEventListener('input', handleVolumeChange);
    seekBar.addEventListener('input', handleSeekBarInput);
    seekBar.addEventListener('mousemove', handleSeekBarHover);
    seekBar.addEventListener('mouseleave', () => seekBarTooltip.style.display = 'none');

    shortcutModeBtn.addEventListener('click', () => {
        isShortcutModeActive = !isShortcutModeActive;
        shortcutModeBtn.textContent = isShortcutModeActive ? '🖱️ 退出快捷模式' : '🖱️ 进入快捷模式';
        shortcutModeBtn.classList.toggle('active', isShortcutModeActive);
        audioPlayerContainer.classList.toggle('shortcut-mode-active', isShortcutModeActive);

        if (isShortcutModeActive) {
            console.log("鼠标快捷模式已激活：在播放器区域内，左键 = 上一记录点, 右键 = 设置记录点。");
        } else {
            console.log("鼠标快捷模式已停用。");
        }
    });

    audioPlayerContainer.addEventListener('click', (e) => {
        if (isShortcutModeActive && currentAudioName && audioElement.src) {
            if (e.target.closest('button') || e.target.closest('input[type="range"]')) {
                return;
            }
            goToPrevBookmark();
        }
    });

    audioPlayerContainer.addEventListener('contextmenu', (e) => {
        if (isShortcutModeActive && currentAudioName && audioElement.src) {
            if (e.target.closest('button') || e.target.closest('input[type="range"]')) {
                return;
            }
            e.preventDefault(); 
            setBookmark();
        }
    });

    audioElement.addEventListener('loadedmetadata', () => {
        totalTimeElement.textContent = formatTime(audioElement.duration);
        seekBar.max = audioElement.duration;
        seekBar.value = 0;
        disablePlayerControls(false);
        renderProgressVisualization(); 
    });

    audioElement.addEventListener('timeupdate', () => {
        currentTimeElement.textContent = formatTime(audioElement.currentTime);
        if (!audioElement.seeking) { 
            seekBar.value = audioElement.currentTime;
        }
        renderProgressVisualization(); 
    });

    audioElement.addEventListener('play', () => {
        playPauseBtn.textContent = '⏸️ 暂停';
        playPauseBtn.title = '暂停 (Space)';
    });

    audioElement.addEventListener('pause', () => {
        playPauseBtn.textContent = '▶️ 播放';
        playPauseBtn.title = '播放 (Space)';
    });

    audioElement.addEventListener('ended', () => {
        playPauseBtn.textContent = '▶️ 播放';
        playPauseBtn.title = '播放 (Space)';
        checkCompletion();
    });

    document.addEventListener('keydown', (e) => {
        const isTypingContext = (e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA';

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
            if (isTypingContext) return;
            e.preventDefault();
            if (!setBookmarkBtn.disabled) setBookmarkBtn.click();
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
            if (isTypingContext) return;
            e.preventDefault();
            if (!prevBookmarkBtn.disabled) prevBookmarkBtn.click();
        } else if (e.key === ' ' && currentAudioName) { 
            if (isTypingContext) {
                 return; 
            }
            e.preventDefault();
            if (!playPauseBtn.disabled) playPauseBtn.click();
        }
    });

    // --- Storage Functions ---
    function loadAppStorage() {
        const data = localStorage.getItem(APP_STORAGE_KEY);
        if (data) {
            audioFilesData = JSON.parse(data);
        } else {
            audioFilesData = {};
        }
    }

    function saveAppStorage() {
        localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(audioFilesData));
    }

    function saveCurrentAudioProgress() {
        if (currentAudioName) {
            audioFilesData[currentAudioName] = {
                bookmarks: [...bookmarks].sort((a, b) => a - b), 
                listenedSegments: [...listenedSegments]
            };
            saveAppStorage();
        }
    }

    // --- Audio Management ---
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const fileName = file.name;
            if (!audioFilesData[fileName]) {
                audioFilesData[fileName] = { bookmarks: [], listenedSegments: [] };
            }
            currentAudioName = fileName; 
            loadAudio(file, fileName); // Pass the File object
            if (!Array.from(audioListElement.children).some(li => li.dataset.filename === fileName)) {
                 renderAudioList(); 
            }
            setActiveAudioInList(fileName);
            saveAppStorage(); 
        }
        event.target.value = null; 
    }
    
    function loadAudio(fileObject, fileNameToSet) { // Renamed fileOrName to fileObject for clarity
        completionMessageElement.style.display = 'none';
        currentAudioName = fileNameToSet;
    
        const reader = new FileReader();
        reader.onload = (e) => {
            audioElement.src = e.target.result;
            audioElement.load(); 
            currentAudioTitleElement.textContent = currentAudioName;
            if (audioFilesData[currentAudioName]) {
                bookmarks = [...audioFilesData[currentAudioName].bookmarks].sort((a,b)=>a-b);
                listenedSegments = [...audioFilesData[currentAudioName].listenedSegments];
            } else {
                bookmarks = [];
                listenedSegments = [];
            }
            // Don't auto-play here, let user control
            // audioElement.play().catch(err => console.warn("Autoplay prevented:", err)); 
            renderProgressVisualization();
            setActiveAudioInList(currentAudioName);
            disablePlayerControls(false); // Enable controls after file is loaded
        };
        reader.onerror = (err) => {
            console.error("Error reading file:", err);
            currentAudioTitleElement.textContent = "文件读取错误，请重试";
            disablePlayerControls(true);
        };
        reader.readAsDataURL(fileObject);
    }
    
    function loadAudioFromList(fileName) {
        currentAudioName = fileName;
        if (audioFilesData[currentAudioName]) {
            bookmarks = [...audioFilesData[currentAudioName].bookmarks].sort((a,b)=>a-b);
            listenedSegments = [...audioFilesData[currentAudioName].listenedSegments];
        } else {
            bookmarks = [];
            listenedSegments = [];
        }
        currentAudioTitleElement.textContent = `选中: ${fileName} (请重新上传文件以播放)`;
        audioElement.src = ""; 
        totalTimeElement.textContent = "0:00";
        currentTimeElement.textContent = "0:00";
        seekBar.value = 0;
        seekBar.max = 100; 
        disablePlayerControls(true); 
        renderProgressVisualization();
        setActiveAudioInList(fileName);
        completionMessageElement.style.display = 'none';
        alert("若要播放 '" + currentAudioName + "', 请通过“上传”按钮重新选择该文件。\n当前版本不支持直接从列表重载已关闭浏览器的本地文件数据。");
    }


    function renderAudioList() {
        audioListElement.innerHTML = ''; 
        Object.keys(audioFilesData).forEach(fileName => {
            const li = document.createElement('li');
            li.textContent = fileName;
            li.dataset.filename = fileName;
            li.addEventListener('click', () => {
                loadAudioFromList(fileName);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '删除';
            deleteBtn.className = 'delete-audio-btn';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); 
                if (confirm(`确定要删除听力 "${fileName}" 及其精听记录吗？`)) {
                    deleteAudio(fileName);
                }
            };
            li.appendChild(deleteBtn);
            audioListElement.appendChild(li);
        });
        if (Object.keys(audioFilesData).length === 0) {
            const li = document.createElement('li');
            li.textContent = "暂无听力记录 (No audio records yet)";
            li.style.textAlign = "center";
            li.style.cursor = "default";
            audioListElement.appendChild(li);
        }
    }

    function deleteAudio(fileName) {
        delete audioFilesData[fileName];
        saveAppStorage();
        renderAudioList();
        if (currentAudioName === fileName) {
            currentAudioName = null;
            audioElement.src = "";
            currentAudioTitleElement.textContent = "请先上传或选择一篇听力";
            bookmarks = [];
            listenedSegments = [];
            renderProgressVisualization();
            disablePlayerControls(true);
            completionMessageElement.style.display = 'none';
        }
    }

    function setActiveAudioInList(fileName) {
        Array.from(audioListElement.children).forEach(li => {
            if (li.dataset.filename === fileName) {
                li.classList.add('active');
            } else {
                li.classList.remove('active');
            }
        });
    }


    // --- Player Controls ---
    function togglePlayPause() {
        if (!currentAudioName || !audioElement.src || audioElement.readyState < 1) return; // readyState < 1 means no metadata/data
        if (audioElement.paused || audioElement.ended) {
            audioElement.play().catch(err => console.error("Error playing audio:", err));
        } else {
            audioElement.pause();
        }
    }

    function handleVolumeChange() {
        audioElement.volume = volumeControl.value;
    }

    function handleSeekBarInput() {
        if (!currentAudioName || !audioElement.src || audioElement.readyState < 1) return;
        audioElement.currentTime = seekBar.value;
    }
    
    function handleSeekBarHover(e) {
        if (!currentAudioName || !audioElement.duration) return;
        const rect = seekBar.getBoundingClientRect();
        const hoverTime = (e.clientX - rect.left) / rect.width * audioElement.duration;
        if (hoverTime >= 0 && hoverTime <= audioElement.duration) {
            seekBarTooltip.style.left = `${(e.clientX - rect.left)}px`; // Position relative to bar start
            seekBarTooltip.textContent = formatTime(hoverTime);
            seekBarTooltip.style.display = 'block';
        } else {
            seekBarTooltip.style.display = 'none';
        }
    }


    function disablePlayerControls(disabled) {
        playPauseBtn.disabled = disabled;
        setBookmarkBtn.disabled = disabled;
        prevBookmarkBtn.disabled = disabled;
        seekBar.disabled = disabled;
    }

    // --- Bookmark & Segment Logic ---
    function setBookmark() {
        if (!currentAudioName || audioElement.readyState < 1) return;
        const currentTime = audioElement.currentTime;
        if (!bookmarks.some(b => Math.abs(b - currentTime) < 0.5)) { // Avoid too close bookmarks
            bookmarks.push(currentTime);
            bookmarks.sort((a, b) => a - b);

            const newBookmarkIndex = bookmarks.indexOf(currentTime);
            // Mark segment leading up to this new bookmark as listened.
            // listenedSegments[i] corresponds to segment ending at bookmarks[i]
             // (i.e., segment from bookmarks[i-1] or 0, to bookmarks[i])
            if (newBookmarkIndex >= 0) { // Ensure bookmark was added and found
                 listenedSegments[newBookmarkIndex] = true;
            }
        }
        renderProgressVisualization();
        saveCurrentAudioProgress();
        checkCompletion();
    }

    function goToPrevBookmark() {
        if (!currentAudioName || audioElement.readyState < 1 || bookmarks.length === 0) return;
        
        let targetBookmark = 0; // Default to start of audio
        // Find the largest bookmark strictly less than current time (with a small tolerance)
        const sortedBookmarks = [...bookmarks].sort((a,b) => a-b); 
        for (let i = sortedBookmarks.length - 1; i >= 0; i--) {
            if (sortedBookmarks[i] < audioElement.currentTime - 0.2) { // 0.2s tolerance to allow re-jump to current segment start
                targetBookmark = sortedBookmarks[i];
                break;
            }
        }
        audioElement.currentTime = targetBookmark;
        if (audioElement.paused) { // If paused, play after jumping
             audioElement.play().catch(err => console.warn("Autoplay prevented after jump:", err));
        }
    }

    function renderProgressVisualization() {
        if (!currentAudioName || !audioElement.duration || isNaN(audioElement.duration) || audioElement.duration === 0) {
            bookmarkVisualizationLayer.innerHTML = ''; 
            return;
        }
        bookmarkVisualizationLayer.innerHTML = ''; 
        const duration = audioElement.duration;

        // Define listenedSegments based on bookmarks. listenedSegments[i] means segment ending at bookmarks[i] is listened.
        // Draw listened segments
        for (let i = 0; i < bookmarks.length; i++) {
            if (listenedSegments[i]) { // If the segment ending at bookmarks[i] is listened
                const segmentStart = (i === 0) ? 0 : bookmarks[i-1];
                const segmentEnd = bookmarks[i];
                
                const segDiv = document.createElement('div');
                segDiv.className = 'listened-segment';
                segDiv.style.left = `${(segmentStart / duration) * 100}%`;
                segDiv.style.width = `${((segmentEnd - segmentStart) / duration) * 100}%`;
                bookmarkVisualizationLayer.appendChild(segDiv);
            }
        }
        
        // If all bookmarked segments are listened and there are bookmarks,
        // also highlight from last bookmark to end of audio (if audio is considered 'finished' by reaching its end)
        // This part is implicitly handled by checkCompletion's confetti. For visualization,
        // one might consider if audioElement.ended and all listenedSegments are true.
        // For now, the explicit segments up to bookmarks are shown.

        // Draw bookmarks
        bookmarks.forEach(bTime => {
            if (bTime <= duration) {
                const dot = document.createElement('div');
                dot.className = 'bookmark-dot';
                dot.style.left = `${(bTime / duration) * 100}%`;
                dot.title = `记录点: ${formatTime(bTime)}`;
                bookmarkVisualizationLayer.appendChild(dot);
            }
        });
    }

    // --- Completion Logic ---
    function checkCompletion() {
        if (!currentAudioName || !audioElement.duration || audioElement.duration === 0) {
            completionMessageElement.style.display = 'none';
            return;
        }

        // Condition for completion:
        // 1. Audio has reached its end (or very close to it).
        // 2. All segments defined by existing bookmarks are marked as listened.
        //    - If no bookmarks, this condition is vacuously true, but then "精听" hasn't really happened.
        //    - We require at least one bookmark for completion if we consider the segment from 0 to the first bookmark.
        //    - Or, if there are bookmarks, all `listenedSegments[i]` up to `bookmarks.length - 1` must be true.

        let allBookmarkedSegmentsListened = true;
        if (bookmarks.length > 0) {
            for (let i = 0; i < bookmarks.length; i++) {
                if (!listenedSegments[i]) {
                    allBookmarkedSegmentsListened = false;
                    break;
                }
            }
        } else {
            // If no bookmarks, cannot be "completed" in the context of精听.
            // However, if audio ends, it just ends. We only show confetti if精听 related conditions are met.
            allBookmarkedSegmentsListened = false; 
        }


        if (allBookmarkedSegmentsListened && audioElement.currentTime >= audioElement.duration - 0.5) { 
            completionMessageElement.style.display = 'block';

            if (typeof confetti === 'function') { 
                confetti({
                    particleCount: 100, 
                    spread: 70,         
                    origin: { y: 0.6 }  
                });

                const fireworksDuration = 3 * 1000; 
                const animationEnd = Date.now() + fireworksDuration;
                const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 }; 

                function randomInRange(min, max) {
                    return Math.random() * (max - min) + min;
                }

                const interval = setInterval(function() {
                    const timeLeft = animationEnd - Date.now();
                    if (timeLeft <= 0) return clearInterval(interval);
                    const particleCount = 50 * (timeLeft / fireworksDuration);
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 } }));
                }, 250); 

                setTimeout(() => confetti(Object.assign({}, defaults, { particleCount: 80, angle: 60, spread: 55, origin: { x: 0, y: 1 }})), 200);
                setTimeout(() => confetti(Object.assign({}, defaults, { particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 1 }})), 400);
            }
        } else {
            completionMessageElement.style.display = 'none';
        }
    }

    // --- Utility Functions ---
    function formatTime(timeInSeconds) {
        if (isNaN(timeInSeconds) || timeInSeconds === Infinity) return "0:00";
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
});