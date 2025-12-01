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
    room = drone.subscribe("observable-" + currentRoomName, {
      historyCount: 20
    });
    
    room.on('history_message', msg => {
      addMessageToDOM(msg.data, msg.member, msg.timestamp);
    });

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
