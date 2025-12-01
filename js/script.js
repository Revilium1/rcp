const CLIENT_ID = "fqIXidsH6gWK4vD2";
const COLORS = ["#ff4d4d", "#4d79ff", "#33cc33", "#ff9933", "#cc33ff"];

// Try to load saved username/color from localStorage
let myData = {
  name: localStorage.getItem("chatName") || "User-" + Math.floor(Math.random() * 1000000),
  color: localStorage.getItem("chatColor") || COLORS[Math.floor(Math.random() * COLORS.length)]
};


let drone = null;
let currentRoomName = "general"; // default
let room = null; // current room subscription


const messagesContainer = document.getElementById("messages");
const usersList = document.getElementById("online-users");

const form = document.getElementById("message-form");
const input = document.getElementById("message-input");

let members = [];

function connectDrone() {
  drone = new Scaledrone(CLIENT_ID, { data: myData });

  drone.on('open', err => {
    if (err) return console.error(err);

    // Subscribe to the "observable-" + room name
    room = drone.subscribe("observable-" + currentRoomName);

    // Update room display at top
    document.getElementById("room-display").textContent = "Room: " + currentRoomName;

    // Handle messages
    room.on('message', event => {
      const { data, member } = event;
      addMessageToDOM(data, member);
    });

    // Handle member list
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
  });
}

connectDrone();

function addMessageToDOM(message, member) {
  const p = document.createElement("p");
  const info = member?.clientData;
  const name = info?.name || "System";
  const color = info?.color || "#000";

  p.textContent = `${name}: ${message}`;
  p.style.color = color;

  messagesContainer.appendChild(p);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderMemberList() {
  usersList.innerHTML = "";

  members.forEach(member => {
    const li = document.createElement("li");
    const info = member.clientData;
    li.textContent = info?.name || "Anon";

    // If this member is the current user, make the name red
    if (member.id === drone.clientId) {
      li.style.color = "red";
    } else {
      li.style.color = info?.color || "#000";
    }

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
    room: "observable-room",
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
  addSystemMessage(`Unknown command: ${cmd}`);
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
  connectDrone();

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
  addSystemMessage("Available commands:");
  addSystemMessage("/help — show this help menu");
  addSystemMessage("/name <name> — change your username");
  addSystemMessage("/color <hex> — change your message color");
  addSystemMessage("/room <room> — switch to a different room");
  addSystemMessage("/lobby — return to the general room");
}
