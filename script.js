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

    currentYearElement.textContent = new Date().getFullYear();

    let currentAudioName = null;
    let bookmarks = []; // Array of timestamps in seconds
    let listenedSegments = []; // Array of booleans, true if segment before bookmark i+1 is listened
    let audioFilesData = {}; // Stores { filename: { bookmarks: [], listenedSegments: [] } }

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


    audioElement.addEventListener('loadedmetadata', () => {
        totalTimeElement.textContent = formatTime(audioElement.duration);
        seekBar.max = audioElement.duration;
        seekBar.value = 0;
        disablePlayerControls(false);
        renderProgressVisualization(); // Render initial state
    });

    audioElement.addEventListener('timeupdate', () => {
        currentTimeElement.textContent = formatTime(audioElement.currentTime);
        if (!audioElement.seeking) { // only update if not actively seeking
            seekBar.value = audioElement.currentTime;
        }
        renderProgressVisualization(); // Continuously update for active segment highlighting (optional)
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

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // Ignore if typing in input

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') { // Ctrl+Shift+B or Cmd+Shift+B
            e.preventDefault();
            if (!setBookmarkBtn.disabled) setBookmarkBtn.click();
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { // Ctrl+Shift+P or Cmd+Shift+P
            e.preventDefault();
            if (!prevBookmarkBtn.disabled) prevBookmarkBtn.click();
        } else if (e.key === ' ' && currentAudioName) { // Spacebar
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
                bookmarks: [...bookmarks].sort((a, b) => a - b), // Store sorted
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
            currentAudioName = fileName; // Set before loading
            loadAudio(file, fileName);
            if (!Array.from(audioListElement.children).some(li => li.dataset.filename === fileName)) {
                 renderAudioList(); // Add to list if new
            }
            setActiveAudioInList(fileName);
            saveAppStorage(); // Save the new file entry
        }
        event.target.value = null; // Reset file input
    }

    function loadAudio(fileOrName, fileNameToSet) {
        completionMessageElement.style.display = 'none';
        if (typeof fileOrName === 'string') { // Loading from list (name provided)
            currentAudioName = fileOrName;
            currentAudioTitleElement.textContent = currentAudioName;
            alert("若要播放 '" + currentAudioName + "', 请通过“上传”按钮重新选择该文件。当前版本不支持直接从列表重载文件数据。");
            audioElement.src = ""; // Clear src
            disablePlayerControls(true);
            currentAudioTitleElement.textContent = "请上传或选择一篇听力";
            bookmarks = [];
            listenedSegments = [];

        } else { // Loading from file upload (File object provided)
            currentAudioName = fileNameToSet;
            const reader = new FileReader();
            reader.onload = (e) => {
                audioElement.src = e.target.result;
                audioElement.load(); // Important for some browsers
                currentAudioTitleElement.textContent = currentAudioName;
                if (audioFilesData[currentAudioName]) {
                    bookmarks = [...audioFilesData[currentAudioName].bookmarks].sort((a,b)=>a-b);
                    listenedSegments = [...audioFilesData[currentAudioName].listenedSegments];
                } else {
                    bookmarks = [];
                    listenedSegments = [];
                }
                audioElement.play().catch(err => console.warn("Autoplay prevented:", err));
            };
            reader.readAsDataURL(fileOrName);
        }
        renderProgressVisualization();
        setActiveAudioInList(currentAudioName);
    }


    function renderAudioList() {
        audioListElement.innerHTML = ''; // Clear existing list
        Object.keys(audioFilesData).forEach(fileName => {
            const li = document.createElement('li');
            li.textContent = fileName;
            li.dataset.filename = fileName;
            li.addEventListener('click', () => {
                currentAudioName = fileName;
                if (audioFilesData[currentAudioName]) {
                    bookmarks = [...audioFilesData[currentAudioName].bookmarks].sort((a,b)=>a-b);
                    listenedSegments = [...audioFilesData[currentAudioName].listenedSegments];
                } else {
                    bookmarks = [];
                    listenedSegments = [];
                }
                currentAudioTitleElement.textContent = `选中: ${fileName} (请重新上传文件以播放)`;
                audioElement.src = ""; // Clear previous audio
                totalTimeElement.textContent = "0:00";
                currentTimeElement.textContent = "0:00";
                seekBar.value = 0;
                seekBar.max = 100; // Reset seekbar
                disablePlayerControls(true); // Disable controls until file is re-uploaded
                renderProgressVisualization();
                setActiveAudioInList(fileName);
                completionMessageElement.style.display = 'none';
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '删除';
            deleteBtn.className = 'delete-audio-btn';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent li click event
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
        if (!currentAudioName || !audioElement.src || audioElement.readyState < 2) return;
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
        if (!currentAudioName || !audioElement.src || audioElement.readyState < 2) return;
        audioElement.currentTime = seekBar.value;
    }
    
    function handleSeekBarHover(e) {
        if (!currentAudioName || !audioElement.duration) return;
        const rect = seekBar.getBoundingClientRect();
        const hoverTime = (e.clientX - rect.left) / rect.width * audioElement.duration;
        if (hoverTime >= 0 && hoverTime <= audioElement.duration) {
            seekBarTooltip.style.left = `${e.clientX - rect.left}px`;
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
        if (!currentAudioName || audioElement.readyState < 2) return;
        const currentTime = audioElement.currentTime;
        if (!bookmarks.some(b => Math.abs(b - currentTime) < 0.5)) {
            bookmarks.push(currentTime);
            bookmarks.sort((a, b) => a - b);

            const newBookmarkIndex = bookmarks.indexOf(currentTime);
            if (newBookmarkIndex > 0) {
                listenedSegments[newBookmarkIndex - 1] = true;
            } else if (newBookmarkIndex === 0 && bookmarks.length > 0) {
                listenedSegments[newBookmarkIndex] = true; 
            }
        }
        renderProgressVisualization();
        saveCurrentAudioProgress();
        checkCompletion();
    }

    function goToPrevBookmark() {
        if (!currentAudioName || audioElement.readyState < 2 || bookmarks.length === 0) return;
        const currentTime = audioElement.currentTime;
        let targetBookmark = 0;
        const sortedBookmarks = [...bookmarks].sort((a,b) => a-b); 
        for (let i = sortedBookmarks.length - 1; i >= 0; i--) {
            if (sortedBookmarks[i] < audioElement.currentTime - 0.1) { 
                targetBookmark = sortedBookmarks[i];
                break;
            }
        }
        audioElement.currentTime = targetBookmark;
        audioElement.play().catch(err => console.warn("Autoplay prevented:", err));
    }


    function renderProgressVisualization() {
        if (!currentAudioName || !audioElement.duration || isNaN(audioElement.duration) || audioElement.duration === 0) {
            bookmarkVisualizationLayer.innerHTML = ''; 
            return;
        }
        bookmarkVisualizationLayer.innerHTML = ''; 
        const duration = audioElement.duration;

        const allSegmentPoints = [0, ...bookmarks.filter(b => b <= duration), duration].filter((v, i, a) => a.indexOf(v) === i).sort((a,b)=>a-b);

        for (let i = 0; i < allSegmentPoints.length -1; i++) {
            const segmentStart = allSegmentPoints[i];
            const segmentEnd = allSegmentPoints[i+1];

            let isListened = false;
            const bookmarkIndexForSegmentEnd = bookmarks.indexOf(segmentEnd);

            if (segmentEnd === duration) { 
                if (bookmarks.length > 0 && listenedSegments[bookmarks.length -1]) {
                     isListened = true;
                }
            } else if (bookmarkIndexForSegmentEnd !== -1 && listenedSegments[bookmarkIndexForSegmentEnd]) {
                isListened = true;
            }

            if (isListened) {
                const segDiv = document.createElement('div');
                segDiv.className = 'listened-segment';
                segDiv.style.left = `${(segmentStart / duration) * 100}%`;
                segDiv.style.width = `${((segmentEnd - segmentStart) / duration) * 100}%`;
                bookmarkVisualizationLayer.appendChild(segDiv);
            }
        }

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
        if (!currentAudioName || bookmarks.length === 0 || !audioElement.duration) {
            completionMessageElement.style.display = 'none';
            return;
        }

        const allMarkedSegmentsListened = bookmarks.every((_, index) => listenedSegments[index]);

        if (allMarkedSegmentsListened && audioElement.currentTime >= audioElement.duration - 0.5) { 
            completionMessageElement.style.display = 'block';

            // 触发礼花特效!
            if (typeof confetti === 'function') { // 检查 confetti 函数是否已定义
                // 基础的庆祝礼花
                confetti({
                    particleCount: 100, 
                    spread: 70,         
                    origin: { y: 0.6 }  
                });

                // 模拟烟花，多次、多角度发射
                const fireworksDuration = 3 * 1000; 
                const animationEnd = Date.now() + fireworksDuration;
                const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 }; // zIndex ensures it's on top

                function randomInRange(min, max) {
                    return Math.random() * (max - min) + min;
                }

                const interval = setInterval(function() {
                    const timeLeft = animationEnd - Date.now();

                    if (timeLeft <= 0) {
                        return clearInterval(interval);
                    }

                    const particleCount = 50 * (timeLeft / fireworksDuration);
                    confetti(Object.assign({}, defaults, {
                        particleCount,
                        origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 } 
                    }));
                }, 250); 

                setTimeout(() => {
                    confetti({
                        particleCount: 80,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0, y: 1 },
                        zIndex: 10000
                    });
                }, 200); 

                setTimeout(() => {
                    confetti({
                        particleCount: 80,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1, y: 1 },
                        zIndex: 10000
                    });
                }, 400);
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