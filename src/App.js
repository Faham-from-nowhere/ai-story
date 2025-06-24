import './index.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';


const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const appId = process.env.REACT_APP_FIREBASE_APP_ID || "dungeon-storyteller";

export const auth = getAuth(app);        // ✅ correctly initialize auth
export const db = getFirestore(app);     // ✅ your Firestore reference

// Custom Modal for error messages
const ErrorModal = ({ message, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border-t-4 border-red-500 text-white max-w-sm w-full">
                <h3 className="text-2xl font-bold mb-4 text-red-400">Error!</h3>
                <p className="mb-6 text-lg">{message}</p>
                <button
                    onClick={onClose}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

// Component for Game View
const GameView = ({ chatHistory, messagesEndRef, currentOptions, isLoading, playerInput, setPlayerInput, handlePlayerAction, showWelcomeScreen, worldSetting, isMultiplayer, gameCode, playerCharacters, saveGameState, characterStats, allPlayerCharacters }) => {
  return (
    <>
    {isMultiplayer && gameCode && (
  <div className="text-center text-yellow-400 font-bold mb-4">
    Multiplayer Room Code:&nbsp;
    <span className="bg-gray-900 px-3 py-1 rounded-lg tracking-wider text-lg shadow-md">
      {gameCode}
    </span>
  </div>
)}

      {/* ✅ Story Display Area */}
      <div className="flex-1 bg-gray-800 p-6 rounded-xl shadow-inner mb-6 overflow-y-auto custom-scrollbar">
        {chatHistory.length === 0 ? (
          <p className="text-gray-400 text-center text-lg mt-4">
            Your adventure begins now! Type your first action below.
          </p>
        ) : (
          chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-900 bg-opacity-60 text-blue-100 self-end ml-auto max-w-[80%]'
                  : msg.role === 'model'
                  ? 'bg-green-900 bg-opacity-60 text-green-100 self-start mr-auto max-w-[80%]'
                  : 'bg-gray-700 text-gray-300 self-start mr-auto max-w-[80%]'
              }`}
            >
              <p className="font-semibold">
                {msg.role === 'user'
                  ? (playerCharacters[msg.userId]?.setting?.playerName || worldSetting?.playerName || 'Unknown Player')
                  : msg.role === 'model'
                  ? 'DM'
                  : 'System'}:
              </p>
              <div className="whitespace-pre-wrap text-sm md:text-base prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ✅ Save & Load Controls */}
      <div className="flex justify-between mb-4">
        <button
          onClick={() => saveGameState(chatHistory, characterStats, worldSetting, currentOptions, allPlayerCharacters)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl shadow-md"
        >
          💾 Save Game
        </button>
        <button
          onClick={() => window.location.reload()}
          className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-xl shadow-md"
        >
          ♻️ Reload Game
        </button>
      </div>

      {/* ✅ User Input Area and Options */}
      <div className="flex flex-col">
        {currentOptions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {currentOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handlePlayerAction(option)}
                disabled={isLoading}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-base text-left"
              >
                <span className="inline-block mr-2">➡️</span>{option}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            className="w-full p-4 rounded-xl bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-4 resize-none min-h-[80px] max-h-[150px] custom-scrollbar"
            placeholder={isLoading ? 'AI is thinking...' : 'What will you do next, adventurer?'}
            value={playerInput}
            onChange={(e) => setPlayerInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePlayerAction();
              }
            }}
            disabled={isLoading}
          />
        )}
        <button
          onClick={() => handlePlayerAction()}
          disabled={isLoading || (!playerInput.trim() && currentOptions.length === 0)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl flex items-center justify-center"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            <>
              <span className="inline-block mr-2">🎲</span>Take Action
            </>
          )}
        </button>
      </div>
    </>
  );
};


// Component for World Builder View
const WorldBuilderView = ({ isLoading, worldBuilderInput, setWorldBuilderInput, handleGenerateWorldElement, generatedWorldText }) => {
    return (
        <div className="flex-1 flex flex-col justify-between">
            <div className="flex-1 bg-gray-800 p-6 rounded-xl shadow-inner mb-6 overflow-y-auto custom-scrollbar">
                <h3 className="text-3xl font-bold mb-4 text-green-400">Generate World Elements</h3>
                <p className="text-gray-300 mb-4">Describe the kind of place, character, or lore you want to create (e.g., "a mysterious forest," "a legendary sword," "an ancient dwarven city").</p>
                <textarea
                    className="w-full p-4 rounded-xl bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4 resize-none min-h-[120px] max-h-[200px] custom-scrollbar"
                    placeholder={isLoading ? "Generating..." : "e.g., A floating city powered by magic crystals..."}
                    value={worldBuilderInput}
                    onChange={(e) => setWorldBuilderInput(e.target.value)}
                    disabled={isLoading}
                />
                <button
                    onClick={handleGenerateWorldElement}
                    disabled={isLoading || !worldBuilderInput.trim()}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl flex items-center justify-center mb-6"
                >
                    {isLoading ? (
                        <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                        </span>
                    ) : (
                        <>
                            <span className="inline-block mr-2">✨</span>Generate World Element
                        </>
                    )}
                </button>
                {generatedWorldText && (
                    <div className="p-6 bg-gray-700 rounded-xl shadow-inner mt-4">
                        <h4 className="text-2xl font-semibold mb-3 text-green-300">Generated Element:</h4>
                        <p className="whitespace-pre-wrap text-lg">{generatedWorldText}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Component for Creative Writer View
const CreativeWriterView = ({ isLoading, creativeWriterInput, setCreativeWriterInput, handleCreativeWriterGenerate, generatedCreativeStory }) => {
    return (
        <div className="flex-1 flex flex-col justify-between">
            <div className="flex-1 bg-gray-800 p-6 rounded-xl shadow-inner mb-6 overflow-y-auto custom-scrollbar">
                <h3 className="text-3xl font-bold mb-4 text-orange-400">Collaborative Story Writing</h3>
                <p className="text-gray-300 mb-4">Start a new story, provide a plot point, or offer a character idea. The AI will help you expand on it.</p>
                <textarea
                    className="w-full p-4 rounded-xl bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4 resize-none min-h-[120px] max-h-[200px] custom-scrollbar"
                    placeholder={isLoading ? "Generating..." : "e.g., The ancient portal hummed, beckoning to the lone traveler..."}
                    value={creativeWriterInput}
                    onChange={(e) => setCreativeWriterInput(e.target.value)}
                    disabled={isLoading}
                />
                <button
                    onClick={handleCreativeWriterGenerate}
                    disabled={isLoading || !creativeWriterInput.trim()}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl flex items-center justify-center mb-6"
                >
                    {isLoading ? (
                        <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                        </span>
                    ) : (
                        <>
                            <span className="inline-block mr-2">📝</span>Continue Story
                        </>
                    )}
                </button>
                {generatedCreativeStory && (
                    <div className="p-6 bg-gray-700 rounded-xl shadow-inner mt-4">
                        <h4 className="text-2xl font-semibold mb-3 text-orange-300">Generated Story:</h4>
                        <p className="whitespace-pre-wrap text-lg">{generatedCreativeStory}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Component for Multiplayer Setup View
const MultiplayerSetupView = ({ isLoading, worldSetting, handleCreateGame, joinGameInput, setJoinGameInput, handleJoinGame, displayError }) => {
    return (
        <div className="flex-1 flex flex-col justify-between">
            <div className="flex-1 bg-gray-800 p-6 rounded-xl shadow-inner mb-6 flex flex-col items-center justify-center">
                <h3 className="text-3xl font-bold mb-6 text-indigo-400">Multiplayer Adventure</h3>
                <p className="text-gray-300 mb-6 text-center">First, set up your character on the left panel, then choose to create or join a game.</p>

                <button
                    onClick={handleCreateGame}
                    disabled={isLoading || !worldSetting.playerName || !worldSetting.characterType || !worldSetting.worldType}
                    className="w-full max-w-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl flex items-center justify-center mb-6"
                >
                    {isLoading ? (
                        <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating Game...
                        </span>
                    ) : (
                        <>
                            <span className="inline-block mr-2">➕</span>Create New Game
                        </>
                    )}
                </button>

                <div className="w-full max-w-sm border-t-2 border-gray-700 pt-6 mt-6">
                    <h4 className="text-2xl font-bold mb-4 text-indigo-300">Join Existing Game</h4>
                    <input
                        type="text"
                        className="w-full p-3 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 uppercase"
                        placeholder="Enter Game Code (e.g., ABC123)"
                        value={joinGameInput}
                        onChange={(e) => setJoinGameInput(e.target.value)}
                        maxLength={6}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleJoinGame}
                        disabled={isLoading || !joinGameInput.trim() || !worldSetting.playerName || !worldSetting.characterType || !worldSetting.worldType}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl flex items-center justify-center"
                    >
                        {isLoading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Joining Game...
                            </span>
                        ) : (
                            <>
                                <span className="inline-block mr-2">➡️</span>Join Game
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};


// Main App Component
function App() {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [storyText, setStoryText] = useState('');
    const [playerInput, setPlayerInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [characterStats, setCharacterStats] = useState({
        health: 100,
        inventory: [],
        equipped_items: {},
        location: '',
        gold: 0,
        experience: 0,
    });
    const [worldSetting, setWorldSetting] = useState({
        playerName: '',
        characterType: '',
        worldType: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
    const [sessionId, setSessionId] = useState('mainGameSession'); // Default for single player
    const [currentOptions, setCurrentOptions] = useState([]);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // New states for Multiplayer, World Builder and Creative Writer features
    const [currentView, setCurrentView] = useState('game'); // 'game', 'worldBuilder', 'creativeWriter', 'multiplayerSetup'
    const [worldBuilderInput, setWorldBuilderInput] = useState('');
    const [generatedWorldText, setGeneratedWorldText] = useState('');
    const [creativeWriterInput, setCreativeWriterInput] = useState('');
    const [generatedCreativeStory, setGeneratedCreativeStory] = useState('');

    // Multiplayer specific states
    const [isMultiplayer, setIsMultiplayer] = useState(false);
    const [gameCode, setGameCode] = useState(''); // Code for joining/creating a multiplayer game
    const [joinGameInput, setJoinGameInput] = useState('');
    const [playerCharacters, setPlayerCharacters] = useState({}); // Stores all players' character data in multiplayer

    const messagesEndRef = useRef(null);

    // Scroll to the bottom of the chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const displayError = (message) => {
        setErrorMessage(message);
        setShowErrorModal(true);
    };

    const closeErrorModal = () => {
        setShowErrorModal(false);
        setErrorMessage('');
    };

    useEffect(() => {
        // Firebase Auth Listener
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                // If no user, try to sign in anonymously or with custom token
                try {
                    await signInAnonymously(auth);

                } catch (error) {
                    console.error("Firebase authentication failed:", error);
                    displayError("Failed to authenticate with Firebase. Please check your connection.");
                }
            }
        });

        return () => unsubscribeAuth();
    }, []); // Run only once on component mount

    // Firestore Listener for game session data (adapts for multiplayer)
    useEffect(() => {
    if (!isAuthReady || !userId) return;

    let sessionDocRef;
    if (isMultiplayer && gameCode) {
        // Option A — simplest fix
sessionDocRef = doc(db, `artifacts/${appId}/publicMultiplayerGames/${gameCode}`);

    } else {
        sessionDocRef = doc(db, `artifacts/${appId}/users/${userId}/gameSessions/${sessionId}`);
    }

  

        const unsubscribeFirestore = onSnapshot(sessionDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setChatHistory(data.chatHistory || []);
                setCurrentOptions(data.currentOptions || []);

                if (isMultiplayer) {
                    // In multiplayer, update all player characters and set current player's stats
                    setPlayerCharacters(data.playerCharacters || {});
                    if (data.playerCharacters && data.playerCharacters[userId]) {
                        setCharacterStats(data.playerCharacters[userId].stats);
                        setWorldSetting(data.playerCharacters[userId].setting);
                    } else {
                        // If user not found in playerCharacters, they might have just joined
                        // or data is not fully populated yet. Keep current character defaults.
                        console.log("Current user's character data not yet in shared session.");
                    }
                } else {
                    // Single-player mode
                    setCharacterStats(data.characterStats || { health: 100, inventory: [], equipped_items: {}, location: '', gold: 0, experience: 0 });
                    setWorldSetting(data.worldSetting || { playerName: '', characterType: '', worldType: '' });
                }

                setShowWelcomeScreen(!(data?.worldSetting?.playerName) && !isMultiplayer);
 // Show welcome if no player name AND not in multiplayer setup
                if (data.chatHistory && data.chatHistory.length > 0) {
                    setStoryText(data.chatHistory[data.chatHistory.length - 1].text);
                }
                console.log("Game state loaded from Firestore.");
            } else {
                console.log("No game session found or session deleted.");
                // If in multiplayer mode and session doesn't exist, show setup screen
                if (isMultiplayer && gameCode) {
                    displayError(`Game with code "${gameCode}" not found or ended.`);
                    setGameCode(''); // Clear invalid game code
                    setShowWelcomeScreen(false); // Stay on multiplayer setup
                    setCurrentView('multiplayerSetup');
                } else {
                    setShowWelcomeScreen(true); // Single-player, show welcome
                    setCurrentOptions([]); // Clear options if starting new
                }
            }
            scrollToBottom();
        }, (error) => {
            console.error("Error fetching game session:", error);
            displayError("Failed to load game session from the database. Please refresh.");
        });

        return () => unsubscribeFirestore();
    }, [isAuthReady, userId, sessionId, isMultiplayer, gameCode]); // Re-run if auth/session/multiplayer state changes

    // Effect to scroll to bottom when chat history updates
    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, worldSetting.playerName]);

    // Function to save game state to Firestore (adapts for multiplayer)
    const saveGameState = useCallback(async (newChatHistory, newCharacterStats, newWorldSetting, newCurrentOptions, newPlayerCharacters = {}) => {
        if (!userId || !db) {
            console.error("Firestore or User ID not available for saving.");
            return;
        }
        setIsLoading(true);

        let docRef;
        let dataToSave = {};

        if (isMultiplayer && gameCode) {
            docRef = doc(db, `artifacts/${appId}/public/multiplayerGames`, gameCode);
            // Update the specific player's data within the playerCharacters map
            const updatedPlayerCharacters = {
                ...newPlayerCharacters,
                [userId]: {
                    stats: newCharacterStats,
                    setting: newWorldSetting,
                }
            };
            dataToSave = {
                chatHistory: newChatHistory,
                currentOptions: newCurrentOptions,
                playerCharacters: updatedPlayerCharacters,
                lastUpdated: new Date(),
            };
        } else {
            docRef = doc(db, `artifacts/${appId}/users/${userId}/gameSessions`, sessionId);
            dataToSave = {
                chatHistory: newChatHistory,
                characterStats: newCharacterStats,
                worldSetting: newWorldSetting,
                currentOptions: newCurrentOptions,
                lastUpdated: new Date(),
            };
        }

        try {
            await setDoc(docRef, dataToSave, { merge: true });
            console.log("Game state saved to Firestore.");
        } catch (error) {
            console.error("Error saving game state:", error);
            displayError("Failed to save game state. Your progress might not be saved.");
        } finally {
            setIsLoading(false);
        }
    }, [userId, sessionId, isMultiplayer, gameCode]);


    // Function to call Gemini API (adapts for multiplayer context)
    const callGemini = async (currentChatHistory, currentCharacterStats, currentWorldSetting, mode = 'game', specificPrompt = '', allPlayerCharacters = {}) => {
        setIsLoading(true);
        if (mode === 'game') {
            setCurrentOptions([]);
        }

        let promptMessages = [];
        let contextMessageContent = "";
        let responseSchema = {};

        if (mode === 'worldBuilder') {
            contextMessageContent = `You are a creative world builder. Generate a detailed, imaginative description for the following request: "${specificPrompt}". Focus on atmosphere, key features, and unique elements. Do not include any game choices or stats.`;
            responseSchema = {
                type: "OBJECT",
                properties: {
                    "narrative": { "type": "STRING" }
                }
            };
            promptMessages.push({ role: "user", parts: [{ text: contextMessageContent }] });
        } else if (mode === 'creativeWriter') {
            contextMessageContent = `You are a collaborative storyteller and creative writer. Continue the narrative or generate new story content based on the following prompt or previous text: "${specificPrompt}". Focus purely on engaging narrative, character development, and world-building. Do not include game choices, stats updates, or any game mechanics. Your response should be a compelling story continuation.`;
            responseSchema = {
                type: "OBJECT",
                properties: {
                    "narrative": { "type": "STRING" }
                }
            };
            promptMessages.push({ role: "user", parts: [{ text: contextMessageContent }] });
        }
        else { // mode === 'game'
            const allPlayersInfo = Object.entries(allPlayerCharacters).map(([pId, pData]) => {
                const isCurrentPlayer = pId === userId;
                return `${isCurrentPlayer ? 'YOU (' : ''}Player ${pData.setting.playerName} (${pData.setting.characterType})${isCurrentPlayer ? ')' : ''}: Health: ${pData.stats.health}, Gold: ${pData.stats.gold}, Inventory: ${pData.stats.inventory.join(', ')}. Equipped: ${JSON.stringify(pData.stats.equipped_items)}. Location: ${pData.stats.location || "Unknown"}.`;
            }).join('\n');

            contextMessageContent = `You are an AI Dungeon Master. The current players and their stats are:\n${allPlayersInfo}\n\n`;
            contextMessageContent += `The player whose last action this is from is ${currentWorldSetting.playerName} (${currentWorldSetting.characterType}).
            Provide narrative and occasionally suggest options for the player to choose from, or update stats for ANY relevant player (using their userId).
            The response should be in JSON format like:
            {"narrative": "...", "stats_update": {"userId123": {"health": 90, "gold": 10, "inventory_add": ["Potion"]}, "userId456": {"health": 100, "inventory_remove": ["Old Map"], "inventory_equip": {"item": "Sword", "slot": "main_hand"}}}, "options": ["Option 1", "Option 2"]}
            If no stats update for a player, omit their userId. If no stats update at all, omit 'stats_update'. If no options, omit 'options'.
            Ensure the JSON is properly formatted within your response for programmatic parsing.
            Now, based on the previous conversation and the player's last action, continue the story, describe the outcome, and suggest next actions if applicable.
            `;
             responseSchema = {
                type: "OBJECT",
                properties: {
                    "narrative": { "type": "STRING" },
                    "stats_update": { // Now an object mapping userId to stat changes
                        type: "OBJECT",
                        patternProperties: {
                            "^[a-zA-Z0-9]+$": { // Allow any userId as a key
                                type: "OBJECT",
                                properties: {
                                    "health": { "type": "NUMBER" },
                                    "gold": { "type": "NUMBER" },
                                    "experience": { "type": "NUMBER" },
                                    "inventory_add": {
                                        type: "ARRAY",
                                        items: { "type": "STRING" }
                                    },
                                    "inventory_remove": {
                                        type: "ARRAY",
                                        items: { "type": "STRING" }
                                    },
                                    "inventory_equip": {
                                        type: "OBJECT",
                                        properties: {
                                            "item": { "type": "STRING" },
                                            "slot": { "type": "STRING" }
                                        },
                                        required: ["item", "slot"]
                                    },
                                    "inventory_unequip": {
                                        type: "STRING"
                                    },
                                    "location": { "type": "STRING" }
                                },
                                "additionalProperties": false
                            }
                        },
                        "additionalProperties": false // Don't allow other properties at the root of stats_update
                    },
                    "options": {
                        type: "ARRAY",
                        items: { "type": "STRING" }
                    }
                },
                "propertyOrdering": ["narrative", "stats_update", "options"]
            };
            promptMessages = [{ role: "user", parts: [{ text: contextMessageContent }] }, ...currentChatHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            }))];
        }

        const payload = {
            contents: promptMessages,
            generationConfig: {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024
}

        };

        const apiKey = process.env.REACT_APP_GEMINI_API_KEY; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const rawJson = result.candidates[0].content.parts[0].text;
                console.log("Raw JSON from Gemini:", rawJson);

                let parsedResponse;
try {
    // 🧼 Clean Gemini's markdown-style response (```json ... ```)
    let jsonText = rawJson;

// Try to extract just the JSON object (starting from the first { and ending at the matching })
const jsonMatch = rawJson.match(/\{[\s\S]*\}/);  // non-greedy match of outermost {...}
if (jsonMatch) {
    jsonText = jsonMatch[0];
}

try {
    parsedResponse = JSON.parse(jsonText);
} catch (jsonError) {
    console.error("Failed to parse extracted JSON from Gemini, falling back:", jsonError);
    parsedResponse = { narrative: rawJson, stats_update: {}, options: [] };
}

} catch (jsonError) {
    console.error("Failed to parse JSON from Gemini, attempting fallback:", jsonError);
    parsedResponse = { narrative: rawJson, stats_update: {}, options: [] };
}


                const narrative = parsedResponse.narrative || "The story continues...";
                const statsUpdate = parsedResponse.stats_update || {};
                const options = parsedResponse.options || [];
setCurrentOptions(options);


                if (mode === 'game') {
                    // Create a mutable copy of allPlayerCharacters for updates
                    const newAllPlayerCharacters = JSON.parse(JSON.stringify(allPlayerCharacters));

                    for (const playerToUpdateId in statsUpdate) {
                        if (newAllPlayerCharacters[playerToUpdateId]) {
                            const playerCurrentStats = newAllPlayerCharacters[playerToUpdateId].stats;
                            const playerUpdate = statsUpdate[playerToUpdateId];

                            if (playerUpdate.health !== undefined) playerCurrentStats.health = playerUpdate.health;
                            if (playerUpdate.gold !== undefined) playerCurrentStats.gold = playerUpdate.gold;
                            if (playerUpdate.experience !== undefined) playerCurrentStats.experience = playerUpdate.experience;
                            if (playerUpdate.location !== undefined) playerCurrentStats.location = playerUpdate.location;

                            if (playerUpdate.inventory_add && Array.isArray(playerUpdate.inventory_add)) {
                                playerCurrentStats.inventory = [...new Set([...playerCurrentStats.inventory, ...playerUpdate.inventory_add])];
                            }
                            if (playerUpdate.inventory_remove && Array.isArray(playerUpdate.inventory_remove)) {
                                playerCurrentStats.inventory = playerCurrentStats.inventory.filter(item => !playerUpdate.inventory_remove.includes(item));
                            }
                            if (playerUpdate.inventory_equip && playerUpdate.inventory_equip.item && playerUpdate.inventory_equip.slot) {
                                const { item, slot } = playerUpdate.inventory_equip;
                                if (playerCurrentStats.inventory.includes(item)) {
                                    if (playerCurrentStats.equipped_items[slot]) {
                                        playerCurrentStats.inventory.push(playerCurrentStats.equipped_items[slot]);
                                    }
                                    playerCurrentStats.equipped_items = { ...playerCurrentStats.equipped_items, [slot]: item };
                                    playerCurrentStats.inventory = playerCurrentStats.inventory.filter(i => i !== item);
                                }
                            }
                            if (playerUpdate.inventory_unequip && typeof playerUpdate.inventory_unequip === 'string') {
                                const itemToUnequip = playerUpdate.inventory_unequip;
                                const equippedSlot = Object.keys(playerCurrentStats.equipped_items).find(slot => playerCurrentStats.equipped_items[slot] === itemToUnequip);
                                if (equippedSlot) {
                                    playerCurrentStats.inventory.push(itemToUnequip);
                                    const newEquipped = { ...playerCurrentStats.equipped_items };
                                    delete newEquipped[equippedSlot];
                                    playerCurrentStats.equipped_items = newEquipped;
                                }
                            }
                        }
                    }
                    return { narrative, updatedStats: newAllPlayerCharacters[userId]?.stats || currentCharacterStats, options, allPlayerCharacters: newAllPlayerCharacters };
                } else {
                    return { narrative, updatedStats: currentCharacterStats, options: [] };
                }

            } else {
                console.error("Gemini response structure unexpected or empty:", result);
                return { narrative: "The AI is confused or returned an empty response.", updatedStats: currentCharacterStats, options: [] };
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            displayError("An error occurred while the AI was thinking. Please try again.");
            return { narrative: "An error occurred while the AI was thinking. Please try again.", updatedStats: currentCharacterStats, options: [] };
        } finally {
            setIsLoading(false);
        }
    };


    const handleStartGame = async () => {
        if (!worldSetting.playerName || !worldSetting.characterType || !worldSetting.worldType) {
            displayError("Please fill in all fields to start your adventure!");
            return;
        }

        setIsLoading(true);
        setShowWelcomeScreen(false); // Hide welcome screen immediately
        setIsMultiplayer(false); // Ensure single player mode

        const initialPrompt = `Start a text-based roleplaying game for a ${worldSetting.characterType} named ${worldSetting.playerName} in a ${worldSetting.worldType} world. Introduce the setting and present the first choice or situation. Provide 2-4 options for the player's first action.`;
        const initialChatHistory = [{ role: 'user', text: initialPrompt }];

        try {
            const { narrative, updatedStats, options } = await callGemini(
                initialChatHistory,
                characterStats, // Use initial character stats
                worldSetting,
                'game'
            );

            const newChatHistory = [...initialChatHistory, { role: 'model', text: narrative }];
            setChatHistory(newChatHistory);
            setStoryText(narrative);
            setCharacterStats(updatedStats);
            setCurrentOptions(options);
            await saveGameState(newChatHistory, updatedStats, worldSetting, options);
        } catch (error) {
            console.error("Error starting game:", error);
            setStoryText("Failed to start the game. Please try again.");
            displayError("Failed to start the game. Check console for details.");
            setShowWelcomeScreen(true); // Show welcome screen again on error
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlayerAction = async (actionText) => {
        const inputToProcess = actionText || playerInput;

        if (!inputToProcess.trim() || isLoading) return;

        setIsLoading(true);
        setCurrentOptions([]); // Clear current options
        const newChatEntry = { role: 'user', userId: userId, playerName: worldSetting.playerName, text: inputToProcess };
        const newChatHistory = [...chatHistory, newChatEntry];
        setChatHistory(newChatHistory);
        setPlayerInput(''); // Clear input immediately

        try {
            const { narrative, updatedStats, options, allPlayerCharacters: updatedAllPlayerCharacters } = await callGemini(
                newChatHistory,
                characterStats,
                worldSetting,
                'game',
                '', // No specific prompt for game mode action
                isMultiplayer ? playerCharacters : {} // Pass all player characters if multiplayer
            );

            const updatedHistoryWithAI = [...newChatHistory, { role: 'model', text: narrative }];
            setChatHistory(updatedHistoryWithAI);
            setStoryText(narrative);
            setCurrentOptions(options);

            // Save based on multiplayer status
            if (isMultiplayer) {
                // `updatedStats` here is just the current user's updated stats
                // `updatedAllPlayerCharacters` is the entire map of updated player data
                await saveGameState(updatedHistoryWithAI, updatedStats, worldSetting, options, updatedAllPlayerCharacters);
            } else {
                setCharacterStats(updatedStats);
                await saveGameState(updatedHistoryWithAI, updatedStats, worldSetting, options);
            }

        } catch (error) {
            console.error("Error processing player action:", error);
            setStoryText("An error occurred. The AI lost its train of thought. Please try another action.");
            const errorHistory = [...newChatHistory, { role: 'model', text: "An error occurred. The AI lost its train of thought. Please try another action." }];
            setChatHistory(errorHistory);
            // Save state even with error, clear options
            if (isMultiplayer) {
                await saveGameState(errorHistory, characterStats, worldSetting, [], playerCharacters);
            } else {
                await saveGameState(errorHistory, characterStats, worldSetting, []);
            }
            displayError("An error occurred during your action. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Function for World Builder generation
    const handleGenerateWorldElement = async () => {
        if (!worldBuilderInput.trim() || isLoading) {
            displayError("Please describe what kind of world element you want to generate.");
            return;
        }

        setIsLoading(true);
        setGeneratedWorldText(''); // Clear previous generation

        try {
            const { narrative } = await callGemini(
                [],
                characterStats,
                worldSetting,
                'worldBuilder',
                worldBuilderInput
            );
            setGeneratedWorldText(narrative);
            setWorldBuilderInput('');
        } catch (error) {
            console.error("Error generating world element:", error);
            setGeneratedWorldText("Failed to generate world element. Please try again.");
            displayError("Failed to generate world element. Check console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    // Function for Creative Writer generation
    const handleCreativeWriterGenerate = async () => {
        if (!creativeWriterInput.trim() || isLoading) {
            displayError("Please provide some text to continue or start the story.");
            return;
        }

        setIsLoading(true);
        setGeneratedCreativeStory(''); // Clear previous generation

        try {
            const { narrative } = await callGemini(
                [],
                characterStats,
                worldSetting,
                'creativeWriter',
                creativeWriterInput
            );
            setGeneratedCreativeStory(narrative);
            setCreativeWriterInput('');
        } catch (error) {
            console.error("Error generating creative story:", error);
            setGeneratedCreativeStory("Failed to generate story. Please try again.");
            displayError("Failed to generate creative story. Check console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    // Multiplayer Game Creation/Joining Functions
    const generateGameCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase(); // Simple 6-char code
    };

    

    const handleCreateGame = async () => {
        if (!worldSetting.playerName || !worldSetting.characterType || !worldSetting.worldType) {
            displayError("Please fill in your character details to create a game!");
            return;
        }
        setIsLoading(true);
        const newGameCode = generateGameCode();
        setGameCode(newGameCode);
        setIsMultiplayer(true);
        setPlayerInput('');
        setChatHistory([]);
        setCurrentOptions([]);
        setStoryText('');

        const initialPlayerCharacters = {
            [userId]: {
                stats: characterStats,
                setting: worldSetting,
            }
        };

        const initialPrompt = `Start a text-based roleplaying game for the following players: ${worldSetting.playerName} (${worldSetting.characterType}) in a ${worldSetting.worldType} world. Introduce the setting and present the first choice or situation. Provide 2-4 options for the player's first action.`;
        const initialChatHistoryForMP = [{ role: 'user', userId: userId, playerName: worldSetting.playerName, text: initialPrompt }];

        try {
            const { narrative, allPlayerCharacters: updatedAllPlayers, options } = await callGemini(
                initialChatHistoryForMP,
                characterStats,
                worldSetting,
                'game',
                '',
                initialPlayerCharacters // Pass initial player characters
            );

            const newChatHistoryForMP = [...initialChatHistoryForMP, { role: 'model', text: narrative }];
            setChatHistory(newChatHistoryForMP);
            setStoryText(narrative);
            setCurrentOptions(options);

            // Update local player characters state with AI's potential stat changes for creator
            const updatedCreatorStats = updatedAllPlayers[userId]?.stats || characterStats;
            setCharacterStats(updatedCreatorStats);
            setPlayerCharacters(updatedAllPlayers); // Set the full map of player characters

            // Save to the public multiplayerGames collection
            await saveGameState(newChatHistoryForMP, updatedCreatorStats, worldSetting, options, updatedAllPlayers);
            setCurrentView('game'); // Switch to game view
            setShowWelcomeScreen(false);
        } catch (error) {
            console.error("Error creating multiplayer game:", error);
            displayError("Failed to create multiplayer game. Please try again.");
            setGameCode(''); // Clear game code on error
            setIsMultiplayer(false); // Revert to single player setup
            setShowWelcomeScreen(true); // Go back to welcome screen on error
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinGame = async () => {
        if (!joinGameInput.trim()) {
            displayError("Please enter a game code to join.");
            return;
        }
        if (!worldSetting.playerName || !worldSetting.characterType || !worldSetting.worldType) {
            displayError("Please fill in your character details before joining a game!");
            return;
        }

        setIsLoading(true);
        const enteredGameCode = joinGameInput.trim().toUpperCase();
        setGameCode(enteredGameCode);
        setIsMultiplayer(true);
        setPlayerInput('');
        setChatHistory([]);
        setCurrentOptions([]);
        setStoryText('');
        setJoinGameInput(''); // Clear join input

        const gameDocRef = doc(db, `artifacts/${appId}/public/multiplayerGames`, enteredGameCode);

        try {
            const docSnap = await getDoc(gameDocRef);
            if (docSnap.exists()) {
                const gameData = docSnap.data();
                const existingPlayers = gameData.playerCharacters || {};

                if (existingPlayers[userId]) {
                    displayError("You are already in this game!");
                    // Just load existing state if already in game
                    setChatHistory(gameData.chatHistory || []);
                    setCharacterStats(existingPlayers[userId].stats || characterStats);
                    setWorldSetting(existingPlayers[userId].setting || worldSetting);
                    setPlayerCharacters(existingPlayers);
                    setCurrentOptions(gameData.currentOptions || []);
                    if (gameData.chatHistory && gameData.chatHistory.length > 0) {
                        setStoryText(gameData.chatHistory[gameData.chatHistory.length - 1].text);
                    }
                    setCurrentView('game');
                    setShowWelcomeScreen(false);
                } else {
                    // Add new player to existing game
                    const updatedPlayerCharacters = {
                        ...existingPlayers,
                        [userId]: {
                            stats: characterStats,
                            setting: worldSetting
                        }
                    };

                    // Update the Firestore document to add the new player
                    await updateDoc(gameDocRef, {
                        playerCharacters: updatedPlayerCharacters,
                        chatHistory: arrayUnion({ role: 'system', text: `${worldSetting.playerName} (${worldSetting.characterType}) has joined the game!` }),
                        lastUpdated: new Date()
                    });

                    setPlayerCharacters(updatedPlayerCharacters); // Update local state
                    setChatHistory(prev => [...prev, { role: 'system', text: `${worldSetting.playerName} (${worldSetting.characterType}) has joined the game!` }]);
                    setCurrentView('game');
                    setShowWelcomeScreen(false);
                }
            } else {
                displayError("Game not found. Please check the code.");
                setGameCode(''); // Clear invalid game code
                setIsMultiplayer(false); // Revert to single player setup
                setShowWelcomeScreen(false); // Stay on multiplayer setup screen
                setCurrentView('multiplayerSetup'); // Explicitly stay on setup
            }
        } catch (error) {
            console.error("Error joining game:", error);
            displayError("Failed to join game. Please try again.");
            setGameCode('');
            setIsMultiplayer(false);
            setShowWelcomeScreen(false); // Stay on multiplayer setup screen
            setCurrentView('multiplayerSetup'); // Explicitly stay on setup
        } finally {
            setIsLoading(false);
        }
    };


    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-inter">
                <div className="text-xl animate-pulse">Initializing Firebase and Authenticating...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100 font-inter">
            {showErrorModal && <ErrorModal message={errorMessage} onClose={closeErrorModal} />}

            {/* Left Panel: Character Stats */}
            <div className="w-full md:w-1/4 p-6 bg-gray-800 bg-opacity-70 rounded-br-2xl shadow-lg flex flex-col">
                <h2 className="text-3xl font-bold mb-6 text-yellow-400 border-b-2 border-yellow-500 pb-2">
                    <span className="inline-block mr-2">👤</span>Character Info
                </h2>
                {userId && (
                    <div className="mb-4 text-sm text-gray-400">
                        <p><strong>User ID:</strong> <span className="break-all">{userId}</span></p>
                    </div>
                )}
                {isMultiplayer && gameCode && (
                    <div className="mb-4 text-lg text-yellow-300 bg-gray-700 p-3 rounded-lg shadow-inner">
                        <p><strong>Multiplayer Game:</strong> <span className="font-mono text-xl text-green-300">{gameCode}</span></p>
                    </div>
                )}
                <div className="space-y-4 text-lg">
                    {showWelcomeScreen || currentView === 'multiplayerSetup' ? ( // Always show character setup if welcome or multiplayer setup
                        <>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <label className="block text-gray-300 mb-2">Player Name:</label>
                                <input
                                    type="text"
                                    className="w-full p-2 rounded-md bg-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    value={worldSetting.playerName}
                                    onChange={(e) => setWorldSetting(prev => ({ ...prev, playerName: e.target.value }))}
                                    placeholder="e.g., Kael"
                                />
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <label className="block text-gray-300 mb-2">Character Type:</label>
                                <input
                                    type="text"
                                    className="w-full p-2 rounded-md bg-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    value={worldSetting.characterType}
                                    onChange={(e) => setWorldSetting(prev => ({ ...prev, characterType: e.target.value }))}
                                    placeholder="e.g., Rogue, Wizard, Warrior"
                                />
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <label className="block text-gray-300 mb-2">World Setting:</label>
                                <input
                                    type="text"
                                    className="w-full p-2 rounded-md bg-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    value={worldSetting.worldType}
                                    onChange={(e) => setWorldSetting(prev => ({ ...prev, worldType: e.target.value }))}
                                    placeholder="e.g., Cyberpunk, Fantasy, Sci-Fi"
                                />
                            </div>
                            {showWelcomeScreen && (
                                <button
                                    onClick={handleStartGame}
                                    disabled={isLoading}
                                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-gray-900 font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl flex items-center justify-center"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Starting Single Player...
                                        </span>
                                    ) : (
                                        <>
                                            <span className="inline-block mr-2">🚀</span>Start Single Player
                                        </>
                                    )}
                                </button>
                            )}
                            {showWelcomeScreen && ( // Only show Multiplayer button on welcome
                                <button
                                    onClick={() => { setShowWelcomeScreen(false); setCurrentView('multiplayerSetup'); }}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 text-xl flex items-center justify-center mt-4"
                                >
                                    <span className="inline-block mr-2">🤝</span>Multiplayer
                                </button>
                            )}
                        </>
                    ) : ( // Display stats when game is active or setting up multiplayer
                        <>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <p><strong className="text-yellow-400">Name:</strong> {worldSetting.playerName}</p>
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <p><strong className="text-yellow-400">Type:</strong> {worldSetting.characterType}</p>
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <p><strong className="text-yellow-400">World:</strong> {worldSetting.worldType}</p>
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <p><strong className="text-yellow-400">Health:</strong> {characterStats.health} HP</p>
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <p><strong className="text-yellow-400">Gold:</strong> {characterStats.gold} G</p>
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <p><strong className="text-yellow-400">Experience:</strong> {characterStats.experience} XP</p>
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner max-h-48 overflow-y-auto">
                                <strong className="text-yellow-400 block mb-2">Inventory:</strong>
                                {characterStats.inventory.length > 0 ? (
                                    <ul className="list-disc list-inside">
                                        {characterStats.inventory.map((item, index) => (
                                            <li key={index}>{item}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-400">Empty</p>
                                )}
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner max-h-48 overflow-y-auto">
                                <strong className="text-yellow-400 block mb-2">Equipped:</strong>
                                {Object.keys(characterStats.equipped_items).length > 0 ? (
                                    <ul className="list-disc list-inside">
                                        {Object.entries(characterStats.equipped_items).map(([slot, item]) => (
                                            <li key={slot}><strong className="capitalize">{slot}:</strong> {item}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-400">Nothing equipped</p>
                                )}
                            </div>
                            <div className="p-4 bg-gray-700 rounded-lg shadow-inner">
                                <p><strong className="text-yellow-400">Current Location:</strong> {characterStats.location || "Unknown"}</p>
                            </div>
                            {isMultiplayer && gameCode && (
                                <div className="p-4 bg-gray-700 rounded-lg shadow-inner max-h-48 overflow-y-auto mt-4">
                                    <strong className="text-yellow-400 block mb-2">Active Players:</strong>
                                    <ul className="list-disc list-inside">
                                        {Object.entries(playerCharacters).map(([pId, pData]) => (
                                            <li key={pId} className={pId === userId ? "text-green-300 font-semibold" : ""}>
                                                {pData.setting.playerName} ({pData.setting.characterType})
                                                {pId === userId && " (You)"}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Right Panel: Story and Chat / World Builder / Creative Writer / Multiplayer Setup */}
            <div className="flex-1 p-6 flex flex-col justify-between bg-gray-900 bg-opacity-80 rounded-tl-2xl shadow-lg">
                <h1 className="text-5xl font-extrabold mb-8 text-center text-yellow-300 drop-shadow-lg">
                    <span className="inline-block mr-3">🔮</span>AI Dungeon Master
                </h1>

                {/* Navigation Tabs */}
                <div className="flex justify-center mb-6 space-x-4 flex-wrap">
                    <button
                        onClick={() => {
                            // Logic to determine if game view can be entered
                            const canEnterGame = !showWelcomeScreen && (isMultiplayer ? gameCode : true);
                            if (canEnterGame) {
                                setCurrentView('game');
                            } else {
                                displayError("Please start or join a game first.");
                                setCurrentView('multiplayerSetup'); // Guide user to multiplayer setup
                            }
                        }}
                        className={`py-3 px-6 rounded-xl font-bold text-lg md:text-xl transition duration-300 ease-in-out transform ${currentView === 'game' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        <span className="inline-block mr-2">🎮</span>Play Game
                    </button>
                    <button
                        onClick={() => setCurrentView('worldBuilder')}
                        className={`py-3 px-6 rounded-xl font-bold text-lg md:text-xl transition duration-300 ease-in-out transform ${currentView === 'worldBuilder' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        <span className="inline-block mr-2">🗺️</span>World Builder
                    </button>
                    <button
                        onClick={() => setCurrentView('creativeWriter')}
                        className={`py-3 px-6 rounded-xl font-bold text-lg md:text-xl transition duration-300 ease-in-out transform ${currentView === 'creativeWriter' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        <span className="inline-block mr-2">✍️</span>Creative Writer
                    </button>
                    <button
                        onClick={() => setCurrentView('multiplayerSetup')}
                        className={`py-3 px-6 rounded-xl font-bold text-lg md:text-xl transition duration-300 ease-in-out transform ${currentView === 'multiplayerSetup' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        <span className="inline-block mr-2">🌐</span>Multiplayer Setup
                    </button>
                </div>

                {/* Conditional Rendering based on currentView */}
                {currentView === 'game' && (!showWelcomeScreen || (isMultiplayer && gameCode)) ? (
                    <GameView
                        chatHistory={chatHistory}
                        messagesEndRef={messagesEndRef}
                        currentOptions={currentOptions}
                        isLoading={isLoading}
                        playerInput={playerInput}
                        setPlayerInput={setPlayerInput}
                        handlePlayerAction={handlePlayerAction}
                        showWelcomeScreen={showWelcomeScreen}
                        worldSetting={worldSetting}
                        isMultiplayer={isMultiplayer}
                        gameCode={gameCode}
                        playerCharacters={playerCharacters}
                    />
                ) : currentView === 'worldBuilder' ? (
                    <WorldBuilderView
                        isLoading={isLoading}
                        worldBuilderInput={worldBuilderInput}
                        setWorldBuilderInput={setWorldBuilderInput}
                        handleGenerateWorldElement={handleGenerateWorldElement}
                        generatedWorldText={generatedWorldText}
                    />
                ) : currentView === 'creativeWriter' ? (
                    <CreativeWriterView
                        isLoading={isLoading}
                        creativeWriterInput={creativeWriterInput}
                        setCreativeWriterInput={setCreativeWriterInput}
                        handleCreativeWriterGenerate={handleCreativeWriterGenerate}
                        generatedCreativeStory={generatedCreativeStory}
                    />
                ) : ( // Multiplayer Setup View
                    <MultiplayerSetupView
                        isLoading={isLoading}
                        worldSetting={worldSetting}
                        handleCreateGame={handleCreateGame}
                        joinGameInput={joinGameInput}
                        setJoinGameInput={setJoinGameInput}
                        handleJoinGame={handleJoinGame}
                        displayError={displayError}
                    />
                )}
            </div>
        </div>
    );
}

export default App;