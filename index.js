const express = require('express');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const { randomUUID } = require('crypto');
const path = require('path');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static('public'));

// In-memory storage
const rooms = new Map();

// Main page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Challenge App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background: #0a0a0a; color: #e5e5e5; }</style>
</head>
<body>
    <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
            <h1 class="text-6xl font-bold mb-8">🏆 Team Challenge</h1>
            <div class="space-y-4">
                <a href="/admin" class="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl">
                    👨‍💼 Admin Setup
                </a>
                <a href="/arena/demo" class="block bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg text-xl">
                    🏟️ Arena Ansicht
                </a>
                <a href="/beamer/demo" class="block bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl">
                    📺 Beamer Ansicht
                </a>
                <a href="/highscore/demo" class="block bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 px-8 rounded-lg text-xl">
                    🏆 Highscore
                </a>
            </div>
            <p class="mt-8 text-gray-400">WebSocket Server läuft</p>
        </div>
    </div>
</body>
</html>
  `);
});

// Admin page - ORIGINAL WORKING VERSION
app.get('/admin', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Setup - Team Challenge</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <script>
        // QR Code fallback if library fails to load
        window.addEventListener('load', function() {
            if (typeof QRCode === 'undefined') {
                console.log('QRCode library not loaded, using fallback');
                window.QRCode = {
                    toCanvas: function(element, text, options) {
                        element.innerHTML = \`<div style="width: \${options.width}px; height: \${options.width}px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 2px solid #ccc; border-radius: 8px;">
                            <div style="text-align: center; padding: 10px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">QR Code</div>
                                <div style="font-size: 10px; color: #333; word-break: break-all;">\${text}</div>
                            </div>
                        </div>\`;
                    }
                };
            }
        });
    </script>
    <style>body { background: #0a0a0a; color: #e5e5e5; }</style>
</head>
<body>
    <div class="min-h-screen bg-neutral-950 text-neutral-100 p-6">
        <div class="max-w-6xl mx-auto space-y-6">
            <div class="flex items-center justify-between">
                <h1 class="text-3xl font-semibold">Admin Setup</h1>
                <div id="wsStatus" class="px-3 py-1 rounded text-sm bg-red-500 text-white">
                    WebSocket Disconnected
                </div>
            </div>

            <div class="bg-neutral-900/60 rounded-xl p-4 grid md:grid-cols-2 gap-4">
                <div class="space-y-3">
                    <label class="block text-sm">Event-Name</label>
                    <input id="eventName" class="w-full bg-neutral-800 rounded px-3 py-2" value="Team Challenge" />

                    <label class="block text-sm mt-2">Logo URL</label>
                    <input id="logoUrl" class="w-full bg-neutral-800 rounded px-3 py-2" />

                    <label class="block text-sm mt-2">Countdown (Sekunden)</label>
                    <input id="countdownSec" type="number" class="w-full bg-neutral-800 rounded px-3 py-2" value="600" />

                    <label class="block text-sm mt-2">Case-insensitive</label>
                    <input id="caseInsensitive" type="checkbox" checked />

                    <label class="block text-sm mt-2">Modus</label>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2">
                            <input type="radio" name="mode" value="shared" checked />
                            <span class="text-sm">Gemeinsam (alle Teams gleiche Fragen)</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="radio" name="mode" value="individual" />
                            <span class="text-sm">Individuell (jedes Team eigene Fragen)</span>
                        </label>
                    </div>

                    <div id="sharedMode">
                        <label class="block text-sm mt-2">Finaler Code</label>
                        <input id="finalCode" class="w-full bg-neutral-800 rounded px-3 py-2" value="VICTORY" />
                    </div>

                    <label class="block text-sm mt-2">Abschluss-Bild/GIF URL</label>
                    <input id="finishMediaUrl" class="w-full bg-neutral-800 rounded px-3 py-2" />

                    <div class="mt-4 flex flex-wrap gap-2">
                        <button id="createEventBtn" class="bg-emerald-500 hover:bg-emerald-600 text-black font-medium px-4 py-2 rounded">
                            Event erstellen
                        </button>
                        <button id="startBtn" class="bg-blue-500 hover:bg-blue-600 text-black font-medium px-4 py-2 rounded" disabled>
                            Start
                        </button>
                        <button id="pauseBtn" class="bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2 rounded" disabled>
                            Pause
                        </button>
                        <button id="resumeBtn" class="bg-indigo-500 hover:bg-indigo-600 text-black font-medium px-4 py-2 rounded" disabled>
                            Resume
                        </button>
                        <button id="resetBtn" class="bg-neutral-500 hover:bg-neutral-600 text-black font-medium px-4 py-2 rounded" disabled>
                            Reset
                        </button>
                    </div>
                </div>

                <div class="space-y-3">
                    <div id="sharedLevels">
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-medium">Gemeinsame Level</h2>
                            <button id="addLevelBtn" class="text-sm underline">Level hinzufügen</button>
                        </div>
                        <div id="levelsList">
                            <div class="level-item bg-neutral-800/60 rounded p-3 space-y-2 mb-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm">Level 1</span>
                                    <button class="remove-level text-xs text-red-300">Entfernen</button>
                                </div>
                                <input class="level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" value="dfw" />
                                <input class="level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" value="LION" />
                            </div>
                            <div class="level-item bg-neutral-800/60 rounded p-3 space-y-2 mb-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm">Level 2</span>
                                    <button class="remove-level text-xs text-red-300">Entfernen</button>
                                </div>
                                <input class="level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" value="wetewtt" />
                                <input class="level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" value="RIVER" />
                            </div>
                            <div class="level-item bg-neutral-800/60 rounded p-3 space-y-2 mb-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm">Level 3</span>
                                    <button class="remove-level text-xs text-red-300">Entfernen</button>
                                </div>
                                <input class="level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" value="ergwr" />
                                <input class="level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" value="ewert" />
                            </div>
                            <div class="level-item bg-neutral-800/60 rounded p-3 space-y-2 mb-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm">Level 4</span>
                                    <button class="remove-level text-xs text-red-300">Entfernen</button>
                                </div>
                                <input class="level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" value="fwegewg" />
                                <input class="level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" value="sgrg" />
                            </div>
                        </div>
                    </div>
                    
                    <div id="individualLevels" style="display: none;">
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-medium">Team-spezifische Level</h2>
                            <button id="addTeamBtn" class="text-sm underline">Team hinzufügen</button>
                        </div>
                        <div id="teamsList">
                            <div class="team-item bg-neutral-800/60 rounded p-4 space-y-3 mb-3">
                                <div class="flex items-center justify-between">
                                    <h3 class="text-lg font-medium">Team 1</h3>
                                    <button class="remove-team text-xs text-red-300">Team entfernen</button>
                                </div>
                                <input class="team-name w-full bg-neutral-800 rounded px-3 py-2" placeholder="Team-Name" value="Team 1" />
                                <div class="space-y-2">
                                    <div class="level-item bg-neutral-700/60 rounded p-3 space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm">Level 1</span>
                                            <button class="remove-team-level text-xs text-red-300">Entfernen</button>
                                        </div>
                                        <input class="team-level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" value="Team 1 - Frage 1" />
                                        <input class="team-level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" value="TEAM1A" />
                                    </div>
                                    <button class="add-team-level text-sm text-blue-300">+ Level hinzufügen</button>
                                </div>
                                <input class="team-final-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Finaler Code" value="TEAM1FINAL" />
                            </div>
                            <div class="team-item bg-neutral-800/60 rounded p-4 space-y-3 mb-3">
                                <div class="flex items-center justify-between">
                                    <h3 class="text-lg font-medium">Team 2</h3>
                                    <button class="remove-team text-xs text-red-300">Team entfernen</button>
                                </div>
                                <input class="team-name w-full bg-neutral-800 rounded px-3 py-2" placeholder="Team-Name" value="Team 2" />
                                <div class="space-y-2">
                                    <div class="level-item bg-neutral-700/60 rounded p-3 space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm">Level 1</span>
                                            <button class="remove-team-level text-xs text-red-300">Entfernen</button>
                                        </div>
                                        <input class="team-level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" value="Team 2 - Frage 1" />
                                        <input class="team-level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" value="TEAM2A" />
                                    </div>
                                    <button class="add-team-level text-sm text-blue-300">+ Level hinzufügen</button>
                                </div>
                                <input class="team-final-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Finaler Code" value="TEAM2FINAL" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="eventInfo" class="bg-neutral-900/60 rounded-xl p-4" style="display: none;">
                <div class="flex items-center gap-6 mb-4">
                    <div id="qrcode"></div>
                    <div class="space-y-1">
                        <div class="text-sm text-neutral-400">Event-ID</div>
                        <div id="eventId" class="text-xl font-mono"></div>
                        <div class="text-sm text-neutral-400">Join-URL</div>
                        <div id="joinUrl" class="font-mono break-all"></div>
                    </div>
                </div>

                <div class="border-t border-neutral-700 pt-4">
                    <h3 class="text-lg font-medium mb-3">Beamer-Ansichten</h3>
                    <div class="flex flex-wrap gap-3">
                        <a id="beamerLink" href="#" target="_blank" class="bg-blue-500 hover:bg-blue-600 text-black font-medium px-4 py-2 rounded inline-flex items-center gap-2">
                            📺 Countdown-Ansicht
                        </a>
                        <a id="arenaLink" href="#" target="_blank" class="bg-purple-500 hover:bg-purple-600 text-black font-medium px-4 py-2 rounded inline-flex items-center gap-2">
                            🏟️ Arena-Ansicht
                        </a>
                        <a id="highscoreLink" href="#" target="_blank" class="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-4 py-2 rounded inline-flex items-center gap-2">
                            🏆 Highscore-Ansicht
                        </a>
                    </div>
                </div>
            </div>

            <div id="countdownDisplay" class="bg-neutral-900/60 rounded-xl p-4 text-center" style="display: none;">
                <h3 class="text-lg font-medium mb-3">Countdown</h3>
                <div id="countdownTime" class="text-4xl font-bold">10:00</div>
            </div>
        </div>
    </div>

    <script>
        let ws = null;
        let currentEventId = null;
        let levelCount = 4;

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}\`;
            console.log('Connecting to WebSocket:', wsUrl);
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                document.getElementById('wsStatus').textContent = 'WebSocket Connected';
                document.getElementById('wsStatus').className = 'px-3 py-1 rounded text-sm bg-green-500 text-black';
                ws.send(JSON.stringify({ type: 'hello', role: 'admin' }));
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                document.getElementById('wsStatus').textContent = 'WebSocket Error';
                document.getElementById('wsStatus').className = 'px-3 py-1 rounded text-sm bg-red-500 text-white';
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'event_created') {
                    currentEventId = data.eventId;
                    showEventInfo(data.eventId);
                } else if (data.type === 'state') {
                    updateCountdown(data.payload.countdown);
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket disconnected');
                document.getElementById('wsStatus').textContent = 'WebSocket Disconnected';
                document.getElementById('wsStatus').className = 'px-3 py-1 rounded text-sm bg-red-500 text-white';
                setTimeout(connectWebSocket, 1000);
            };
        }

        function showEventInfo(eventId) {
            const baseUrl = window.location.origin;
            const joinUrl = \`\${baseUrl}/join/\${eventId}\`;
            
            document.getElementById('eventId').textContent = eventId;
            document.getElementById('joinUrl').innerHTML = \`<a class="underline" href="\${joinUrl}" target="_blank">\${joinUrl}</a>\`;
            document.getElementById('beamerLink').href = \`\${baseUrl}/beamer/\${eventId}\`;
            document.getElementById('arenaLink').href = \`\${baseUrl}/arena/\${eventId}\`;
            document.getElementById('highscoreLink').href = \`\${baseUrl}/highscore/\${eventId}\`;
            
            // Generate QR Code
            const qrDiv = document.getElementById('qrcode');
            qrDiv.innerHTML = '';
            
            // Generate QR Code with better error handling
            try {
                if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
                    console.log('Generating QR Code for:', joinUrl);
                    QRCode.toCanvas(qrDiv, joinUrl, { 
                        width: 160, 
                        color: { 
                            dark: '#e5e5e5', 
                            light: '#0a0a0a' 
                        },
                        margin: 2
                    });
                    console.log('QR Code generated successfully');
                } else {
                    throw new Error('QRCode not available');
                }
            } catch (error) {
                console.log('QR Code generation failed, using fallback:', error);
                // Fallback: show URL as text with better styling
                qrDiv.innerHTML = \`<div style="width: 160px; height: 160px; background: #1f2937; display: flex; align-items: center; justify-content: center; border: 2px solid #374151; border-radius: 8px; margin: 0 auto;">
                    <div style="text-align: center; padding: 10px;">
                        <div style="font-size: 14px; color: #d1d5db; margin-bottom: 8px; font-weight: bold;">QR Code</div>
                        <div style="font-size: 10px; color: #9ca3af; word-break: break-all; line-height: 1.2;">\${joinUrl}</div>
                    </div>
                </div>\`;
            }
            
            document.getElementById('eventInfo').style.display = 'block';
            document.getElementById('countdownDisplay').style.display = 'block';
            
            // Enable countdown buttons
            document.getElementById('startBtn').disabled = false;
            document.getElementById('pauseBtn').disabled = false;
            document.getElementById('resumeBtn').disabled = false;
            document.getElementById('resetBtn').disabled = false;
        }

        function updateCountdown(countdown) {
            const minutes = Math.floor(countdown.remainingMs / 60000);
            const seconds = Math.floor((countdown.remainingMs % 60000) / 1000);
            document.getElementById('countdownTime').textContent = \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
        }

        function sendCountdownControl(action) {
            if (ws && currentEventId) {
                ws.send(JSON.stringify({ type: 'countdown_control', action }));
            }
        }

        // Level management
        document.getElementById('addLevelBtn').addEventListener('click', () => {
            levelCount++;
            const levelsList = document.getElementById('levelsList');
            const newLevel = document.createElement('div');
            newLevel.className = 'level-item bg-neutral-800/60 rounded p-3 space-y-2 mb-3';
            newLevel.innerHTML = \`
                <div class="flex items-center justify-between">
                    <span class="text-sm">Level \${levelCount}</span>
                    <button class="remove-level text-xs text-red-300">Entfernen</button>
                </div>
                <input class="level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" />
                <input class="level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" />
            \`;
            levelsList.appendChild(newLevel);
            
            // Add remove functionality
            newLevel.querySelector('.remove-level').addEventListener('click', () => {
                newLevel.remove();
            });
        });
        
        // Remove level functionality for existing levels
        document.querySelectorAll('.remove-level').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.level-item').remove();
            });
        });

        // Team management
        let teamCount = 2;
        
        document.getElementById('addTeamBtn').addEventListener('click', () => {
            teamCount++;
            const teamsList = document.getElementById('teamsList');
            const newTeam = document.createElement('div');
            newTeam.className = 'team-item bg-neutral-800/60 rounded p-4 space-y-3 mb-3';
            newTeam.innerHTML = \`
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-medium">Team \${teamCount}</h3>
                    <button class="remove-team text-xs text-red-300">Team entfernen</button>
                </div>
                <input class="team-name w-full bg-neutral-800 rounded px-3 py-2" placeholder="Team-Name" value="Team \${teamCount}" />
                <div class="space-y-2">
                    <div class="level-item bg-neutral-700/60 rounded p-3 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-sm">Level 1</span>
                            <button class="remove-team-level text-xs text-red-300">Entfernen</button>
                        </div>
                        <input class="team-level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" value="Team \${teamCount} - Frage 1" />
                        <input class="team-level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" value="TEAM\${teamCount}A" />
                    </div>
                    <button class="add-team-level text-sm text-blue-300">+ Level hinzufügen</button>
                </div>
                <input class="team-final-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Finaler Code" value="TEAM\${teamCount}FINAL" />
            \`;
            teamsList.appendChild(newTeam);
            
            // Add event listeners for new team
            setupTeamEventListeners(newTeam);
        });
        
        // Setup event listeners for existing teams
        document.querySelectorAll('.team-item').forEach(team => {
            setupTeamEventListeners(team);
        });
        
        function setupTeamEventListeners(teamElement) {
            // Remove team
            teamElement.querySelector('.remove-team').addEventListener('click', () => {
                teamElement.remove();
            });
            
            // Add team level
            teamElement.querySelector('.add-team-level').addEventListener('click', () => {
                const levelsContainer = teamElement.querySelector('.space-y-2');
                const levelCount = levelsContainer.querySelectorAll('.level-item').length;
                const newLevel = document.createElement('div');
                newLevel.className = 'level-item bg-neutral-700/60 rounded p-3 space-y-2';
                newLevel.innerHTML = \`
                    <div class="flex items-center justify-between">
                        <span class="text-sm">Level \${levelCount + 1}</span>
                        <button class="remove-team-level text-xs text-red-300">Entfernen</button>
                    </div>
                    <input class="team-level-prompt w-full bg-neutral-800 rounded px-3 py-2" placeholder="Frage/Prompt" />
                    <input class="team-level-code w-full bg-neutral-800 rounded px-3 py-2" placeholder="Lösungs-Code" />
                \`;
                levelsContainer.insertBefore(newLevel, teamElement.querySelector('.add-team-level'));
                
                // Add remove functionality
                newLevel.querySelector('.remove-team-level').addEventListener('click', () => {
                    newLevel.remove();
                });
            });
            
            // Remove team level
            teamElement.querySelectorAll('.remove-team-level').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.target.closest('.level-item').remove();
                });
            });
        }

        // Mode switching
        document.querySelectorAll('input[name="mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('sharedMode').style.display = e.target.value === 'shared' ? 'block' : 'none';
                document.getElementById('sharedLevels').style.display = e.target.value === 'shared' ? 'block' : 'none';
                document.getElementById('individualLevels').style.display = e.target.value === 'individual' ? 'block' : 'none';
            });
        });

        // Event creation
        document.getElementById('createEventBtn').addEventListener('click', () => {
            console.log('Create Event button clicked');
            console.log('WebSocket state:', ws ? ws.readyState : 'null');
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                console.error('WebSocket not ready:', ws ? ws.readyState : 'null');
                alert('WebSocket nicht verbunden! Bitte Seite neu laden.');
                return;
            }
            
            const mode = document.querySelector('input[name="mode"]:checked').value;
            let formData;
            
            if (mode === 'shared') {
                const levels = [];
                document.querySelectorAll('#sharedLevels .level-item').forEach((item, index) => {
                    const prompt = item.querySelector('.level-prompt').value;
                    const code = item.querySelector('.level-code').value;
                    if (prompt && code) {
                        levels.push({ index: index + 1, prompt, code });
                    }
                });
                
                formData = {
                    name: document.getElementById('eventName').value,
                    logoUrl: document.getElementById('logoUrl').value || undefined,
                    countdownSec: parseInt(document.getElementById('countdownSec').value),
                    mode: mode,
                    levels: levels,
                    finalCode: document.getElementById('finalCode').value,
                    finishMediaUrl: document.getElementById('finishMediaUrl').value || undefined,
                    caseInsensitive: document.getElementById('caseInsensitive').checked
                };
            } else {
                const teamLevels = [];
                document.querySelectorAll('.team-item').forEach((teamItem, teamIndex) => {
                    const teamName = teamItem.querySelector('.team-name').value;
                    const finalCode = teamItem.querySelector('.team-final-code').value;
                    const levels = [];
                    
                    teamItem.querySelectorAll('.level-item').forEach((levelItem, levelIndex) => {
                        const prompt = levelItem.querySelector('.team-level-prompt').value;
                        const code = levelItem.querySelector('.team-level-code').value;
                        if (prompt && code) {
                            levels.push({ index: levelIndex + 1, prompt, code });
                        }
                    });
                    
                    if (teamName && levels.length > 0) {
                        teamLevels.push({
                            teamId: \`team-\${teamIndex + 1}\`,
                            teamName: teamName,
                            levels: levels,
                            finalCode: finalCode
                        });
                    }
                });
                
                formData = {
                    name: document.getElementById('eventName').value,
                    logoUrl: document.getElementById('logoUrl').value || undefined,
                    countdownSec: parseInt(document.getElementById('countdownSec').value),
                    mode: mode,
                    levels: [],
                    teamLevels: teamLevels,
                    finalCode: '',
                    finishMediaUrl: document.getElementById('finishMediaUrl').value || undefined,
                    caseInsensitive: document.getElementById('caseInsensitive').checked
                };
            }
            
            console.log('Sending create_event:', formData);
            ws.send(JSON.stringify({ type: 'create_event', payload: formData }));
        });

        // Countdown controls
        document.getElementById('startBtn').addEventListener('click', () => sendCountdownControl('start'));
        document.getElementById('pauseBtn').addEventListener('click', () => sendCountdownControl('pause'));
        document.getElementById('resumeBtn').addEventListener('click', () => sendCountdownControl('resume'));
        document.getElementById('resetBtn').addEventListener('click', () => sendCountdownControl('reset'));

        // Connect on load
        connectWebSocket();
    </script>
</body>
</html>
  `);
});

// Join page
app.get('/join/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team beitreten - Team Challenge</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background: #0a0a0a; color: #e5e5e5; }</style>
</head>
<body>
    <div class="min-h-screen flex items-center justify-center">
        <div class="max-w-md mx-auto bg-gray-800 p-8 rounded-lg">
            <h1 class="text-3xl font-bold mb-6 text-center">🏆 Team beitreten</h1>
            <form id="joinForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Team Name</label>
                    <input type="text" id="teamName" class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg" placeholder="Mein Team" required>
                </div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">
                    Beitreten
                </button>
            </form>
            <div id="teamView" class="mt-6" style="display: none;">
                <h2 class="text-xl font-bold mb-4">Team: <span id="currentTeamName"></span></h2>
                <div id="levelInfo" class="mb-4"></div>
                <div class="space-y-2">
                    <input type="text" id="answerInput" class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg" placeholder="Antwort eingeben">
                    <button id="submitBtn" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">
                        Antwort senden
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const eventId = '${eventId}';
        let ws = null;
        let currentTeam = null;

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}\`;
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                ws.send(JSON.stringify({ type: 'hello', role: 'team', eventId }));
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'state') {
                    updateTeamView(data.payload);
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setTimeout(connectWebSocket, 1000);
            };
        }

        function updateTeamView(state) {
            const team = state.teams.find(t => t.id === currentTeam?.id);
            if (team) {
                document.getElementById('currentTeamName').textContent = team.name;
                document.getElementById('levelInfo').innerHTML = \`
                    <p>Level: \${team.currentLevel + 1}</p>
                    <p>Gelöst: \${team.solvedCount}</p>
                    <p>Status: \${team.finished ? 'Fertig!' : 'Aktiv'}</p>
                \`;
            }
        }

        document.getElementById('joinForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const teamName = document.getElementById('teamName').value;
            ws.send(JSON.stringify({ type: 'join_team', teamName }));
            currentTeam = { name: teamName };
            document.getElementById('joinForm').style.display = 'none';
            document.getElementById('teamView').style.display = 'block';
        });

        document.getElementById('submitBtn').addEventListener('click', () => {
            const answer = document.getElementById('answerInput').value;
            if (answer && currentTeam) {
                ws.send(JSON.stringify({ type: 'submit_answer', payload: { code: answer } }));
                document.getElementById('answerInput').value = '';
            }
        });

        connectWebSocket();
    </script>
</body>
</html>
  `);
});

// Beamer page
app.get('/beamer/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Beamer - Team Challenge</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background: #0a0a0a; color: #e5e5e5; }</style>
</head>
<body>
    <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
            <h1 class="text-8xl font-bold mb-8">🏆 Team Challenge</h1>
            <div id="countdownDisplay" class="text-9xl font-bold mb-8">10:00</div>
            <div id="teamsInfo" class="text-2xl"></div>
        </div>
    </div>

    <script>
        const eventId = '${eventId}';
        let ws = null;

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}\`;
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                ws.send(JSON.stringify({ type: 'hello', role: 'beamer', eventId }));
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'state') {
                    updateDisplay(data.payload);
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setTimeout(connectWebSocket, 1000);
            };
        }

        function updateDisplay(state) {
            const countdown = state.countdown;
            const minutes = Math.floor(countdown.remainingMs / 60000);
            const seconds = Math.floor((countdown.remainingMs % 60000) / 1000);
            document.getElementById('countdownDisplay').textContent = \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
            
            const teamsInfo = \`Teams: \${state.teams.length} | Gelöst: \${state.teams.filter(t => t.finished).length}\`;
            document.getElementById('teamsInfo').textContent = teamsInfo;
        }

        connectWebSocket();
    </script>
</body>
</html>
  `);
});

// Arena page
app.get('/arena/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Arena - Team Challenge</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background: #0a0a0a; color: #e5e5e5; }</style>
</head>
<body>
    <div class="min-h-screen p-8">
        <div class="max-w-6xl mx-auto">
            <h1 class="text-6xl font-bold mb-8 text-center">🏟️ Arena</h1>
            <div id="teamsGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
        </div>
    </div>

    <script>
        const eventId = '${eventId}';
        let ws = null;

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}\`;
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                ws.send(JSON.stringify({ type: 'hello', role: 'arena', eventId }));
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'state') {
                    updateTeamsGrid(data.payload);
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setTimeout(connectWebSocket, 1000);
            };
        }

        function updateTeamsGrid(state) {
            const grid = document.getElementById('teamsGrid');
            grid.innerHTML = state.teams.map(team => \`
                <div class="bg-gray-800 p-6 rounded-lg">
                    <h3 class="text-xl font-bold mb-2">\${team.name}</h3>
                    <p>Level: \${team.currentLevel + 1}</p>
                    <p>Gelöst: \${team.solvedCount}</p>
                    <p>Status: \${team.finished ? '✅ Fertig!' : '🔄 Aktiv'}</p>
                </div>
            \`).join('');
        }

        connectWebSocket();
    </script>
</body>
</html>
  `);
});

// Highscore page
app.get('/highscore/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Highscore - Team Challenge</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background: #0a0a0a; color: #e5e5e5; }</style>
</head>
<body>
    <div class="min-h-screen p-8">
        <div class="max-w-4xl mx-auto">
            <h1 class="text-6xl font-bold mb-8 text-center">🏆 Highscore</h1>
            <div id="highscoreList" class="space-y-4"></div>
        </div>
    </div>

    <script>
        const eventId = '${eventId}';
        let ws = null;

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}\`;
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                ws.send(JSON.stringify({ type: 'hello', role: 'highscore', eventId }));
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'state') {
                    updateHighscore(data.payload);
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setTimeout(connectWebSocket, 1000);
            };
        }

        function updateHighscore(state) {
            const sortedTeams = state.teams.sort((a, b) => {
                if (a.finished && !b.finished) return -1;
                if (!a.finished && b.finished) return 1;
                return b.solvedCount - a.solvedCount;
            });

            const list = document.getElementById('highscoreList');
            list.innerHTML = sortedTeams.map((team, index) => \`
                <div class="bg-gray-800 p-6 rounded-lg flex justify-between items-center">
                    <div class="flex items-center">
                        <span class="text-3xl mr-4">\${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}</span>
                        <div>
                            <h3 class="text-xl font-bold">\${team.name}</h3>
                            <p>Level: \${team.currentLevel + 1} | Gelöst: \${team.solvedCount}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold">\${team.finished ? '✅' : '🔄'}</p>
                    </div>
                </div>
            \`).join('');
        }

        connectWebSocket();
    </script>
</body>
</html>
  `);
});

// WebSocket handling
wss.on('connection', (socket) => {
  let meta = { socket, role: 'admin' };

  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'hello') {
        meta.role = msg.role;
        meta.eventId = msg.eventId;
        meta.teamName = msg.teamName;
        
        if (msg.eventId) {
          if (!rooms.has(msg.eventId)) {
            rooms.set(msg.eventId, { clients: new Set(), state: null });
          }
          rooms.get(msg.eventId).clients.add(meta);
        }
      }
      
      if (msg.type === 'create_event') {
        const eventId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const event = {
          id: eventId,
          name: msg.payload.name,
          logoUrl: msg.payload.logoUrl,
          countdownSec: msg.payload.countdownSec,
          mode: msg.payload.mode || 'shared',
          levels: msg.payload.levels || [],
          teamLevels: msg.payload.teamLevels || [],
          finalCode: msg.payload.finalCode || '',
          finishMediaUrl: msg.payload.finishMediaUrl,
          caseInsensitive: msg.payload.caseInsensitive || false,
          createdAt: Date.now()
        };
        
        const room = { 
          clients: new Set(), 
          state: { 
            event, 
            teams: [], 
            countdown: { 
              startedAtMs: null, 
              pausedAtMs: null, 
              remainingMs: event.countdownSec * 1000, 
              isRunning: false 
            } 
          } 
        };
        rooms.set(eventId, room);
        room.clients.add(meta);
        meta.eventId = eventId;
        
        socket.send(JSON.stringify({ type: 'event_created', eventId }));
      }
      
      if (msg.type === 'join_team' && meta.eventId) {
        const room = rooms.get(meta.eventId);
        if (room && room.state) {
          const teamId = randomUUID();
          const newTeam = {
            id: teamId,
            name: msg.teamName,
            currentLevel: 0,
            solvedCount: 0,
            finished: false,
            elapsedMs: 0,
            joinedAt: Date.now()
          };
          room.state.teams.push(newTeam);
          meta.teamId = teamId;
          
          // Broadcast updated state
          room.clients.forEach(client => {
            if (client.socket.readyState === 1) {
              client.socket.send(JSON.stringify({ type: 'state', payload: room.state }));
            }
          });
        }
      }
      
      if (msg.type === 'countdown_control' && meta.eventId) {
        const room = rooms.get(meta.eventId);
        if (room && room.state) {
          const cd = room.state.countdown;
          const totalDuration = room.state.event.countdownSec * 1000;
          
          if (msg.action === 'start') {
            cd.startedAtMs = Date.now();
            cd.pausedAtMs = null;
            cd.isRunning = true;
            cd.remainingMs = totalDuration;
          } else if (msg.action === 'pause' && cd.isRunning) {
            cd.pausedAtMs = Date.now();
            cd.isRunning = false;
            cd.remainingMs = Math.max(0, totalDuration - (cd.pausedAtMs - cd.startedAtMs));
          } else if (msg.action === 'resume' && !cd.isRunning) {
            cd.startedAtMs = Date.now() - (totalDuration - cd.remainingMs);
            cd.pausedAtMs = null;
            cd.isRunning = true;
          } else if (msg.action === 'reset') {
            cd.startedAtMs = null;
            cd.pausedAtMs = null;
            cd.isRunning = false;
            cd.remainingMs = totalDuration;
          }
          
          // Broadcast to all clients
          room.clients.forEach(client => {
            if (client.socket.readyState === 1) {
              client.socket.send(JSON.stringify({ type: 'state', payload: room.state }));
            }
          });
        }
      }
      
      if (msg.type === 'submit_answer' && meta.eventId && meta.teamId) {
        const room = rooms.get(meta.eventId);
        if (room && room.state) {
          const team = room.state.teams.find(t => t.id === meta.teamId);
          if (team) {
            const event = room.state.event;
            let isCorrect = false;
            
            if (event.mode === 'shared') {
              if (team.currentLevel < event.levels.length) {
                isCorrect = normalizeCode(msg.payload.code) === normalizeCode(event.levels[team.currentLevel].code);
              } else {
                isCorrect = normalizeCode(msg.payload.code) === normalizeCode(event.finalCode);
              }
            } else {
              const teamConfig = event.teamLevels.find(tl => tl.teamId === team.id);
              if (teamConfig) {
                if (team.currentLevel < teamConfig.levels.length) {
                  isCorrect = normalizeCode(msg.payload.code) === normalizeCode(teamConfig.levels[team.currentLevel].code);
                } else {
                  isCorrect = normalizeCode(msg.payload.code) === normalizeCode(teamConfig.finalCode);
                }
              }
            }
            
            if (isCorrect) {
              team.currentLevel++;
              team.solvedCount++;
              
              const totalLevels = event.mode === 'shared' ? event.levels.length + 1 : (event.teamLevels.find(tl => tl.teamId === team.id)?.levels.length || 0) + 1;
              if (team.currentLevel >= totalLevels) {
                team.finished = true;
                team.elapsedMs = Date.now() - team.joinedAt;
              }
            }
            
            // Broadcast updated state
            room.clients.forEach(client => {
              if (client.socket.readyState === 1) {
                client.socket.send(JSON.stringify({ type: 'state', payload: room.state }));
              }
            });
          }
        }
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  socket.on('close', () => {
    if (meta.eventId) {
      const room = rooms.get(meta.eventId);
      if (room) room.clients.delete(meta);
    }
  });
});

// Countdown ticker
setInterval(() => {
  rooms.forEach((room, eventId) => {
    if (room.state && room.state.countdown.isRunning) {
      const cd = room.state.countdown;
      const totalDuration = room.state.event.countdownSec * 1000;
      const elapsed = Date.now() - cd.startedAtMs;
      cd.remainingMs = Math.max(0, totalDuration - elapsed);
      
      if (cd.remainingMs <= 0) {
        cd.isRunning = false;
        cd.remainingMs = 0;
      }
      
      // Broadcast to all clients
      room.clients.forEach(client => {
        if (client.socket.readyState === 1) {
          client.socket.send(JSON.stringify({ type: 'state', payload: room.state }));
        }
      });
    }
  });
}, 100);

function normalizeCode(code) {
  return code.replace(/\s/g, '');
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Team Challenge Server running on port ${PORT}`);
});
