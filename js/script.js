const CLIENT_ID = "trE5KNh3r4nDXfSv";
const COLORS = ["#ff4d4d", "#4d79ff", "#33cc33", "#ff9933", "#cc33ff"];
const USERS = [
  { username: "Fredoka", color: "#a0f", password: "b2b42e2bca76b79cf40c8592fd06bdd846d263f6" },
  { username: "Sparkpacket", color: "#0f0",   password: "5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8" }
];

// Try to load saved username/color from localStorage
let myData = {
  name: localStorage.getItem("chatName") || "User-" + Math.floor(Math.random() * 1000000),
  color: localStorage.getItem("chatColor") || COLORS[Math.floor(Math.random() * COLORS.length)]
};


let drone = null;
let currentRoomName = "general"; // default
let room = null; // current room subscription
let isLoggedIn = false;

const messagesContainer = document.getElementById("messages");
const usersList = document.getElementById("online-users");

const form = document.getElementById("message-form");
const input = document.getElementById("message-input");

let members = [];

function connectDrone(skipHistory = false) {
  drone = new Scaledrone(CLIENT_ID, { data: myData });

  drone.on("open", err => {
    if (err) return console.error(err);

    room = drone.subscribe("observable-" + currentRoomName, {
      historyCount: skipHistory ? 0 : 20
    });

    room.on("history_message", msg => {
      addMessageToDOM(msg.data, msg.member, msg.timestamp);
    });

    document.getElementById("room-display").textContent =
      "Room: " + currentRoomName;

    room.on("message", event => {
      const { data, member } = event;
      addMessageToDOM(data, member);
    });

    room.on("members", m => {
      members = m;
      renderMemberList();
    });

    room.on("member_join", member => {
      members.push(member);
      renderMemberList();
    });

    room.on("member_leave", ({ id }) => {
      members = members.filter(m => m.id !== id);
      renderMemberList();
    });

    // Render guest immediately if needed
    renderMemberList();
  });
}

connectDrone(false);

function addMessageToDOM(message, member) {
  const p = document.createElement("p");

  // Determine name & color
  let name = member?.clientData?.name || "Anon";
  let color = member?.clientData?.color || "#000";

  // If message is formatted HTML
  if (typeof message === "object" && message.html) {
    name = message.name || name;
    color = message.color || color;
    p.innerHTML = `<span style="color:${color};">${name}:</span> ${message.content}`;
  } else {
    p.textContent = `${name}: ${message}`;
    p.style.color = color;
  }

  messagesContainer.appendChild(p);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderMemberList() {
  if (!usersList) return;

  usersList.innerHTML = "";

  // If no members from server, show a guest entry
  const listToRender = members.length > 0
    ? members
    : [{ id: "guest-" + myData.name, clientData: myData }];

  listToRender.forEach(member => {
    const li = document.createElement("li");
    const info = member.clientData || {};

    let name = info.name || "Anon";

    const isSelf =
      (drone?.clientId && member.id === drone.clientId) ||
      member.id.startsWith("guest-");

    if (isSelf) {
      name += isLoggedIn ? " √" : " (guest)";
    }

    li.textContent = name;

    // Color red for self, otherwise member color
    li.style.color = info.color || (isSelf ? "red" : "#000");

    usersList.appendChild(li);
  });
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg) return;

  if (msg.startsWith("/")) {
    handleCommand(msg);
    input.value = "";
    return;
  }

  drone.publish({
    room: "observable-" + currentRoomName,
    message: msg
  });


  input.value = "";
});

function handleCommand(raw) {
  const parts = raw.split(" ");
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ").trim();

  if (cmd === "/name") {
    if (!arg) return addSystemMessage("Usage: /name <newname>");
    reconnectWithNewData({ name: arg });
    return;
  }

  if (cmd === "/color") {
    if (!arg) return addSystemMessage("Usage: /color <hex>");
    reconnectWithNewData({ color: normalizeColor(arg) });
    return;
  }

  if (cmd === "/room") {
    if (!arg) return addSystemMessage("Usage: /room <room-name>");
    switchRoom(arg);
    return;
  }

  if (cmd === "/lobby") {
    switchRoom("general"); // always goes to observable-general
    return;
  }
  if (cmd === "/help") {
  showHelp();
  return;
  }
  if (cmd === "/me") {
    if (!arg) return addSystemMessage("Usage: /me <action>");
    sendAction(arg);
    return;
  }
  if (cmd === "/clear") {
    clearChat();
    return;
  }
  if (cmd === "/whoami") {
    whoAmI();
    return;
  }
  if (cmd === "/shrug") {
    drone.publish({ room: "observable-" + currentRoomName, message: "¯\\_(ツ)_/¯" });
    return;
  }
  if (cmd === "/tableflip") {
    drone.publish({ room: "observable-" + currentRoomName, message: "(╯°□°)╯︵ ┻━┻" });
    return;
  }
  if (cmd === "/unflip") {
    drone.publish({ room: "observable-" + currentRoomName, message: "┬─┬ ノ( ゜-゜ノ)" });
    return;
  }
  if (cmd === "/roll") {
    rollDice(arg);
    return;
  }
  if (cmd === "/bold") {
    if (!arg) return addSystemMessage("Usage: /bold <text>");
    sendFormatted("bold", arg);
    return;
  }
  if (cmd === "/italic") {
    if (!arg) return addSystemMessage("Usage: /italic <text>");
    sendFormatted("italic", arg);
    return;
  }
  if (cmd === "/login") {
  const [username, password] = arg.split(" ");
    if (!username || !password) {
      addSystemMessage("Usage: /login <username> <password>");
      return;
    }
    loginUser(username, password);
    return;
  }
  addSystemMessage(`Unknown command: ${cmd}`);
}

async function loginUser(username, password) {
  const hashed = await sha1(password);
  const match = USERS.find(u => u.username === username && u.password === hashed);
  if (!match) return addSystemMessage("Login failed.");

  isLoggedIn = true;
  loggedInUser = username;
  reconnectWithNewData({ 
    name: username, 
    color: match.color || myData.color 
  });
  addSystemMessage(`Logged in as ${username} √`);
}

async function sha1(message) {
  const buffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function reconnectWithNewData(changes) {
  addSystemMessage("Reconnecting...");

  // Update local data
  myData = { ...myData, ...changes };

  // Save immediately to localStorage
  localStorage.setItem("chatName", myData.name);
  localStorage.setItem("chatColor", myData.color);

  // Disconnect the old drone instance
  try { drone.close(); } catch {}

  // Clear members
  members = [];
  renderMemberList();

  // Reconnect with updated data
  connectDrone(true);

  // Show confirmation after a short delay
  setTimeout(() => {
    if (changes.name) addSystemMessage(`Name changed to "${changes.name}"`);
    if (changes.color) addSystemMessage(`Color changed to ${changes.color}`);
  }, 500);
}


function normalizeColor(c) {
  if (!c.startsWith("#")) c = "#" + c;
  return c;
}

function addSystemMessage(text) {
  const p = document.createElement("p");
  p.textContent = `[system] ${text}`;
  p.style.opacity = 0.6;
  messagesContainer.appendChild(p);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function switchRoom(newRoom) {
  addSystemMessage(`Switching to room "${newRoom}"...`);

  // Update current room
  currentRoomName = newRoom;

  // Clear local data for new room
  members = [];
  renderMemberList();
  messagesContainer.innerHTML = "";

  // Unsubscribe from old room
  try { room.unsubscribe(); } catch {}
  
  // Subscribe to the new room
  room = drone.subscribe("observable-" + currentRoomName);

  // Attach message handler
  room.on('message', event => {
    const { data, member } = event;
    addMessageToDOM(data, member);
  });

  // Attach member list handlers
  room.on('members', m => {
    members = m;
    renderMemberList();
  });

  room.on('member_join', member => {
    members.push(member);
    renderMemberList();
  });

  room.on('member_leave', ({ id }) => {
    members = members.filter(m => m.id !== id);
    renderMemberList();
  });

  // Update the room display
  document.getElementById("room-display").textContent = "Room: " + currentRoomName;
}

function showHelp() {
  addSystemMessage("Commands:");
  addSystemMessage("/help — show this help menu");
  addSystemMessage("/name <name> — change your username");
  addSystemMessage("/color <hex> — change your color");
  addSystemMessage("/room <room> — switch rooms");
  addSystemMessage("/lobby — go to the general room");
  addSystemMessage("/me <action> — perform an action");
  addSystemMessage("/clear — clear your chat window");
  addSystemMessage("/whoami — show your profile info");
  addSystemMessage("/shrug — sends ¯\\_(ツ)_/¯");
  addSystemMessage("/tableflip — sends (╯°□°)╯︵ ┻━┻");
  addSystemMessage("/unflip — sends ┬─┬ ノ( ゜-゜ノ)");
  addSystemMessage("/roll <sides> — roll a dice (default 6)");
}

function sendAction(action) {
  const text = `*${myData.name}: ${action}*`;
  drone.publish({
    room: "observable-" + currentRoomName,
    message: text
  });
}

function clearChat() {
  messagesContainer.innerHTML = "";
  addSystemMessage("Chat cleared.");
}

function whoAmI() {
  addSystemMessage(`You are "${myData.name}"`);
  addSystemMessage(`Color: ${myData.color}`);
  addSystemMessage(`Room: ${currentRoomName}`);
}

function rollDice(arg) {
  let sides = parseInt(arg);
  if (isNaN(sides) || sides < 2) sides = 6;

  const result = Math.floor(Math.random() * sides) + 1;

  const text = `${myData.name} rolled a ${result} (1–${sides})`;
  drone.publish({
    room: "observable-" + currentRoomName,
    message: text
  });
}

function sendFormatted(type, text) {
  let formatted;

  if (type === "bold") {
    formatted = `<strong>${escapeHTML(text)}</strong>`;
  } else if (type === "italic") {
    formatted = `<em>${escapeHTML(text)}</em>`;
  }

  // publish + mark message as HTML
  drone.publish({
    room: "observable-" + currentRoomName,
    message: { html: true, content: formatted, name: myData.name, color: myData.color }
  });
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
