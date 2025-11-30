const CLIENT_ID = "fqIXidsH6gWK4vD2";

// random user info
const COLORS = ["#ff4d4d", "#4d79ff", "#33cc33", "#ff9933", "#cc33ff"];
const myData = {
  name: "User-" + Math.floor(Math.random() * 1000),
  color: COLORS[Math.floor(Math.random() * COLORS.length)]
};

const drone = new Scaledrone(CLIENT_ID, { data: myData });

const messagesContainer = document.getElementById("messages");
const usersList = document.getElementById("online-users");

const form = document.getElementById("message-form");
const input = document.getElementById("message-input");

let members = [];

// ------- CONNECT -------
drone.on('open', err => {
  if (err) return console.error(err);

  const room = drone.subscribe("observable-room");

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

// ------- DISPLAY MESSAGES -------
function addMessageToDOM(message, member) {
  const p = document.createElement("p");
  const info = member?.clientData;
  const name = info?.name || "Anon";

  p.textContent = `${name}: ${message}`;
  messagesContainer.appendChild(p);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ------- DISPLAY ONLINE USERS -------
function renderMemberList() {
  usersList.innerHTML = "";

  members.forEach(member => {
    const li = document.createElement("li");
    const info = member.clientData;
    li.textContent = info?.name || "Anon";
    li.style.color = info?.color || "#000";
    usersList.appendChild(li);
  });
}

// ------- SEND MESSAGE -------
form.addEventListener("submit", e => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg) return;

  drone.publish({
    room: "observable-room",
    message: msg
  });

  input.value = "";
});
