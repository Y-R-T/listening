document.addEventListener('DOMContentLoaded', () => {
    // --- 原有元素引用 ---
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

    // --- 新增：帮助弹窗元素引用 ---
    const helpModal = document.getElementById('help-modal');
    const showHelpBtn = document.getElementById('show-help-btn');
    const closeBtn = document.querySelector('.close-btn');

    currentYearElement.textContent = new Date().getFullYear();

    // --- 状态变量 ---
    let isShortcutModeActive = false;
    let currentAudioName = null;
    let bookmarks = [];
    let listenedSegments = [];
    let audioFilesData = {};

    // --- 新增/修改：存储键 ---
    const APP_STORAGE_KEY = 'toeflIntensiveListeningApp';
    const INSTRUCTIONS_VISITED_KEY = 'toeflInstructionsVisited'; // 新增键，用于判断是否首次访问

    // --- 初始化 ---
    loadAppStorage();
    renderAudioList();
    disablePlayerControls(true);
    initializeHelpModal(); // 新增：初始化帮助弹窗逻辑

    // --- 新增：帮助弹窗 (Modal) 逻辑 ---
    function initializeHelpModal() {
        // 为按钮和关闭图标添加事件
        showHelpBtn.addEventListener('click', openHelpModal);
        closeBtn.addEventListener('click', closeHelpModal);
        // 点击弹窗外部（背景）关闭弹窗
        window.addEventListener('click', (event) => {
            if (event.target == helpModal) {
                closeHelpModal();
            }
        });

        // 检查是否是第一次访问
        if (!localStorage.getItem(INSTRUCTIONS_VISITED_KEY)) {
            openHelpModal();
            localStorage.setItem(INSTRUCTIONS_VISITED_KEY, 'true');
        }
    }

    function openHelpModal() {
        helpModal.classList.add('show');
    }

    function closeHelpModal() {
        helpModal.classList.remove('show');
    }


    // --- 事件监听器 (其余部分与原版相同) ---
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
    });

    audioPlayerContainer.addEventListener('click', (e) => {
        if (isShortcutModeActive && currentAudioName && audioElement.src) {
            if (e.target.closest('button') || e.target.closest('input[type="range"]')) return;
            goToPrevBookmark();
        }
    });

    audioPlayerContainer.addEventListener('contextmenu', (e) => {
        if (isShortcutModeActive && currentAudioName && audioElement.src) {
            if (e.target.closest('button') || e.target.closest('input[type="range"]')) return;
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

    audioElement.addEventListener('play', () => { playPauseBtn.textContent = '⏸️ 暂停'; playPauseBtn.title = '暂停 (Space)'; });
    audioElement.addEventListener('pause', () => { playPauseBtn.textContent = '▶️ 播放'; playPauseBtn.title = '播放 (Space)'; });
    audioElement.addEventListener('ended', () => { playPauseBtn.textContent = '▶️ 播放'; playPauseBtn.title = '播放 (Space)'; checkCompletion(); });

    document.addEventListener('keydown', (e) => {
        const isTypingContext = (e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA';
        if (isTypingContext) return;

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            if (!setBookmarkBtn.disabled) setBookmarkBtn.click();
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            if (!prevBookmarkBtn.disabled) prevBookmarkBtn.click();
        } else if (e.key === ' ' && currentAudioName) {
            e.preventDefault();
            if (!playPauseBtn.disabled) playPauseBtn.click();
        }
    });

    // --- 核心功能函数 (与原版完全相同) ---
    // (此处省略了所有未改动的函数，如 loadAppStorage, saveAppStorage, handleFileUpload, loadAudio, renderAudioList 等...
    //  请直接复用您提供的原始 JS 中的这些函数，它们无需任何修改。)
    
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
            loadAudio(file, fileName);
            if (!Array.from(audioListElement.children).some(li => li.dataset.filename === fileName)) {
                 renderAudioList();
            }
            setActiveAudioInList(fileName);
            saveAppStorage();
        }
        event.target.value = null;
    }

    function loadAudio(fileObject, fileNameToSet) {
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
            renderProgressVisualization();
            setActiveAudioInList(currentAudioName);
            disablePlayerControls(false);
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
        const fileNames = Object.keys(audioFilesData);
        if (fileNames.length === 0) {
            const li = document.createElement('li');
            li.textContent = "暂无听力记录 (No audio records yet)";
            li.style.textAlign = "center";
            li.style.cursor = "default";
            li.style.justifyContent = "center";
            audioListElement.appendChild(li);
            return;
        }

        fileNames.forEach(fileName => {
            const li = document.createElement('li');
            const textSpan = document.createElement('span');
            textSpan.textContent = fileName;
            li.appendChild(textSpan);

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
        if (!currentAudioName || !audioElement.src || audioElement.readyState < 1) return;
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
            seekBarTooltip.style.left = `${(e.clientX - rect.left)}px`;
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
        if (!bookmarks.some(b => Math.abs(b - currentTime) < 0.5)) {
            bookmarks.push(currentTime);
            bookmarks.sort((a, b) => a - b);
            const newBookmarkIndex = bookmarks.indexOf(currentTime);
            if (newBookmarkIndex >= 0) {
                 listenedSegments[newBookmarkIndex] = true;
            }
        }
        renderProgressVisualization();
        saveCurrentAudioProgress();
        checkCompletion();
    }

    function goToPrevBookmark() {
        if (!currentAudioName || audioElement.readyState < 1 || bookmarks.length === 0) return;
        let targetBookmark = 0;
        const sortedBookmarks = [...bookmarks].sort((a,b) => a-b);
        for (let i = sortedBookmarks.length - 1; i >= 0; i--) {
            if (sortedBookmarks[i] < audioElement.currentTime - 0.2) {
                targetBookmark = sortedBookmarks[i];
                break;
            }
        }
        audioElement.currentTime = targetBookmark;
        if (audioElement.paused) {
             audioElement.play().catch(err => console.warn("Autoplay prevented after jump:", err));
        }
    }

    function renderProgressVisualization() {
        bookmarkVisualizationLayer.innerHTML = '';
        if (!currentAudioName || !audioElement.duration || isNaN(audioElement.duration) || audioElement.duration === 0) {
            return;
        }
        const duration = audioElement.duration;
        for (let i = 0; i < bookmarks.length; i++) {
            if (listenedSegments[i]) {
                const segmentStart = (i === 0) ? 0 : bookmarks[i-1];
                const segmentEnd = bookmarks[i];
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
        if (!currentAudioName || !audioElement.duration || audioElement.duration === 0) {
            completionMessageElement.style.display = 'none';
            return;
        }

        let allBookmarkedSegmentsListened = true;
        if (bookmarks.length > 0) {
            for (let i = 0; i < bookmarks.length; i++) {
                if (!listenedSegments[i]) {
                    allBookmarkedSegmentsListened = false;
                    break;
                }
            }
        } else {
            allBookmarkedSegmentsListened = false;
        }

        if (allBookmarkedSegmentsListened && audioElement.currentTime >= audioElement.duration - 0.5) {
            completionMessageElement.style.display = 'block';
            if (typeof confetti === 'function') {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                const fireworksDuration = 3 * 1000;
                const animationEnd = Date.now() + fireworksDuration;
                const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };
                function randomInRange(min, max) { return Math.random() * (max - min) + min; }
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