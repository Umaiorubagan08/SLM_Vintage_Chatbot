let userId = "";
let lastBotMessage = "";
let isVoiceEnabled = true;
let voices = [];
let tamilVoice = null;
let englishVoice = null;
// Female voice preference
let tamilFemaleVoice = null;
let englishFemaleVoice = null;

// Voice input vars
let recognizing = false;
let recognition;

// Speech Synthesis Initialization
function initSpeechSynthesis() {
  function setVoices() {
    voices = speechSynthesis.getVoices();
    tamilFemaleVoice = voices.find(v =>
      (v.lang === 'ta-IN' || v.lang === 'ta') &&
      (v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('vaani') ||
        v.name.toLowerCase().includes('sangeetha'))
    );
    englishFemaleVoice = voices.find(v =>
      (v.lang === 'en-US' || v.lang === 'en-GB') &&
      (v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('jessa') ||
        v.name.toLowerCase().includes('zoe') ||
        v.name.toLowerCase().includes('linda') ||
        v.name.toLowerCase().includes('emma'))
    );
    tamilVoice = tamilFemaleVoice ||
      voices.find(v => v.lang === 'ta-IN' || v.lang === 'ta');
    englishVoice = englishFemaleVoice ||
      voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB');
    if (!englishVoice) {
      englishVoice = voices.find(v => v.lang.startsWith('en'));
    }
  }

  speechSynthesis.onvoiceschanged = setVoices;
  if (speechSynthesis.getVoices().length > 0) {
    setVoices();
  }
}

// DOMContentLoaded: initialize everything
document.addEventListener('DOMContentLoaded', () => {
  initSpeechSynthesis();

  // Enter key for message sending
  document.getElementById('userInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Voice input setup
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; // Set 'ta-IN' if you want Tamil

    recognition.onstart = function() {
      recognizing = true;
      document.getElementById('voiceInputBtn').classList.add('listening');
    };
    recognition.onend = function() {
      recognizing = false;
      document.getElementById('voiceInputBtn').classList.remove('listening');
    };
    recognition.onerror = function(e) {
      recognizing = false;
      document.getElementById('voiceInputBtn').classList.remove('listening');
      showAlert('🎤 Voice recognition error or permission denied.');
    };
    recognition.onresult = function(event) {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        document.getElementById('userInput').value = transcript;
        sendMessage();
      }
    };

    document.getElementById('voiceInputBtn').addEventListener('click', function() {
      if (recognizing) {
        recognition.stop();
      } else {
        recognition.start();
      }
    });
  } else {
    document.getElementById('voiceInputBtn').disabled = true;
    document.getElementById('voiceInputBtn').title = 'Voice recognition not supported in this browser';
  }
});

// Start chat after user name/phone is entered
function initializeChat() {
  userId = document.getElementById("userId").value.trim();
  if (!userId) {
    showAlert("Please enter your name or phone number");
    return;
  }
  document.querySelector(".welcome-message").style.display = "none";
  document.getElementById("chatBox").innerHTML = "";
  displayMessage("bot", `Hello ${userId}! How can I assist you with real estate today?`);
}

// Send message to backend and display response
async function sendMessage() {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;
  if (!userId) {
    showAlert("Please enter your name first");
    return;
  }

  displayMessage("user", message);
  input.value = "";

  // Contact info auto-response logic
  const contactPatterns = [
    /contact/i, /call/i, /phone/i, /mobile/i, /email/i, /reach (you|agent)/i,
    /discuss.*property/i, /connect.*property/i, /talk.*property/i,
    /speak.*property/i, /how.*contact/i, /agent.*number/i
  ];
  if (contactPatterns.some(re => re.test(message))) {
    displayMessage("bot",
      "You can contact us directly to discuss about the property. " +
      "Call us at 📞 +91 8939507733 or email at ✉️ enquiry.vintagepropertyshop@gmail.com."
    );
    if (isVoiceEnabled) speak(
      "You can contact us directly to discuss about the property. " +
      "Call us at plus nine one, eight nine three nine five zero seven seven three three, " +
      "or email at enquiry dot vintage property shop at gmail dot com."
    );
    return;
  }

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, user: userId })
    });

    const data = await res.json();

    if (data.reply) {
      lastBotMessage = data.reply;
      displayMessage("bot", data.reply);
      if (isVoiceEnabled) speak(data.reply);
    } else {
      displayMessage("bot", "⚠️ Error: " + (data.error || "Unknown issue."));
    }
  } catch (error) {
    displayMessage("bot", "⚠️ Network error. Please try again.");
    console.error("Error:", error);
  }
}

// Show message with date & time
function displayMessage(role, msg) {
  const chat = document.getElementById("chatBox");
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role}`;

  // Add message content
  const content = document.createElement("div");
  content.textContent = msg;
  msgDiv.appendChild(content);

  // Add timestamp + date
  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = getCurrentDateTime();
  msgDiv.appendChild(time);

  chat.appendChild(msgDiv);
  chat.scrollTop = chat.scrollHeight;
}

function getCurrentDateTime() {
  const now = new Date();
  return now.toLocaleDateString() + ' ' +
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Translate last bot message to Tamil
async function translateLast() {
  if (!lastBotMessage) {
    showAlert("No message to translate");
    return;
  }

  try {
    displayMessage("bot", "Translating to Tamil...");

    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(lastBotMessage)}`);
    const data = await res.json();

    if (data && data[0]) {
      const translated = data[0].map(pair => pair[0]).join("");
      displayMessage("bot", `தமிழ் (Tamil): ${translated}`);
      if (isVoiceEnabled) {
        speak(translated, 'ta-IN');
      }
    } else {
      displayMessage("bot", "⚠️ Translation failed. Please try again.");
    }
  } catch (error) {
    displayMessage("bot", "⚠️ Translation service unavailable.");
    console.error("Translation error:", error);
  }
}

// Prefer female voices for speech
function speak(text, lang = 'en-US') {
  if (!isVoiceEnabled) return;
  speechSynthesis.cancel();

  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = lang;
  msg.rate = 0.92;
  msg.pitch = 1.13;

  if (lang === 'ta-IN' && tamilFemaleVoice) {
    msg.voice = tamilFemaleVoice;
  } else if (lang === 'en-US' && englishFemaleVoice) {
    msg.voice = englishFemaleVoice;
  } else if (lang === 'ta-IN' && tamilVoice) {
    msg.voice = tamilVoice;
  } else if (lang === 'en-US' && englishVoice) {
    msg.voice = englishVoice;
  }
  speechSynthesis.speak(msg);
}

// Show alert
function showAlert(message) {
  const alert = document.createElement("div");
  alert.className = "alert-message";
  alert.textContent = message;
  document.body.appendChild(alert);

  setTimeout(() => {
    alert.classList.add("fade-out");
    setTimeout(() => alert.remove(), 300);
  }, 3000);
}

// Quick replies: auto-fill userInput
function insertQuickReply(text) {
  const input = document.getElementById("userInput");
  input.value = text;
  input.focus();
}
