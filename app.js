/** @typedef {import('pear-interface')} */ 

import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import b4a from 'b4a';
const { teardown, updates } = Pear;
import { marked } from 'marked';
import { sampleMarkdown } from './sampleMarkdown';

const swarm = new Hyperswarm();
teardown(() => swarm.destroy());
updates(() => Pear.reload());

const cursors = {};
const peerColors = {};
let userId;

function getPeerColor(peerId) {
  if (!peerColors[peerId]) {
    const randomColor = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
    peerColors[peerId] = randomColor;
  }
  console.log(peerColors[peerId])
  return peerColors[peerId];
}

swarm.on('connection', (peer) => {
  const peerId = b4a.toString(peer.remotePublicKey, 'hex').substr(0, 6);
  userId = peerId;
  console.log(`New peer connected: ${peerId}`);
  getPeerColor(peerId);
  
  peer.on('data', (message) => {
    const receivedData = JSON.parse(b4a.toString(message));
    if (receivedData.type === "markdown") {
      updateMarkdownFromPeer(receivedData.content);
    } else if (receivedData.type === "cursor") {
      updatePeerCursor(receivedData);
    }
  });

  peer.on('error', (e) => console.error(`Connection error: ${e}`));
});

swarm.on('update', () => {
  document.querySelector('#peers-count').textContent = swarm.connections.size + 1;
});

// -----------------------------------------------------------------------------------
  // Elements
  const markdownInput = document.getElementById('markdown-input');
  const previewPane = document.getElementById('preview-pane');
  const copyButton = document.getElementById('copy-button');
  const saveButton = document.getElementById('save-button');
  const clearButton = document.getElementById('clear-button');
  const toast = document.getElementById('toast');
  const lineNumbers = document.getElementById("line-numbers");

// Function to update line numbers
function updateLineNumbers() {
  const lines = markdownInput.value.split("\n").length;
  lineNumbers.innerHTML = "";

  for (let i = 1; i <= lines; i++) {
    const lineDiv = document.createElement("div");
    lineDiv.className = "line-number";
    lineDiv.textContent = i;
    lineDiv.dataset.line = i; // Store line number for tracking

    lineNumbers.appendChild(lineDiv);
  }
}

// Synchronize scroll between textarea and line numbers
markdownInput.addEventListener("input", updateLineNumbers);
markdownInput.addEventListener("scroll", () => {
  lineNumbers.scrollTop = markdownInput.scrollTop;
});

// Initialize line numbers
updateLineNumbers();


  // Load from localStorage if available
  const savedMarkdown = localStorage.getItem('savedMarkdown');

  markdownInput.value = savedMarkdown;
  updatePreview();

  function updatePreview() {
    previewPane.innerHTML = marked.parse(markdownInput.value);
    previewPane.querySelectorAll('a').forEach(link => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
    setupLazyLoading();
  }

  function broadcastMarkdown() {
    const markdown = markdownInput.value;
    localStorage.setItem('savedMarkdown', markdown);

    const message = JSON.stringify({ type: "markdown", content: markdown });
    for (const peer of swarm.connections) {
      peer.write(b4a.from(message));
    }
  }

  function updateMarkdownFromPeer(newMarkdown) {
    if (newMarkdown !== markdownInput.value) {
      markdownInput.value = newMarkdown;
      updatePreview();
    }
  }

  function copyHtml() {
    const htmlContent = previewPane.innerHTML;
    navigator.clipboard.writeText(htmlContent)
      .then(() => showToast('HTML copied to clipboard!'))
      .catch(() => showToast('Failed to copy HTML'));
  }

  function saveMarkdown() {
    const markdown = markdownInput.value;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();

    URL.revokeObjectURL(url);
    showToast('Markdown file saved!');
  }

  function clearEditor() {
    if (confirm('Are you sure you want to clear the editor? All unsaved changes will be lost.')) {
      markdownInput.value = '';
      updatePreview();
      showToast('Editor cleared');
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Add lazy loading for images in the preview
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.target.dataset.src) {
        entry.target.src = entry.target.dataset.src;
        entry.target.removeAttribute('data-src');
        observer.unobserve(entry.target);
      }
    });
  });

  function setupLazyLoading() {
    previewPane.querySelectorAll('img').forEach(img => {
      if (img.src) {
        img.dataset.src = img.src;
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
        observer.observe(img);
      }
    });
  }

  // Event Listeners
  markdownInput.addEventListener('input', () => {
    updatePreview();
    broadcastMarkdown();
  });
  copyButton.addEventListener('click', copyHtml);
  saveButton.addEventListener('click', saveMarkdown);
  clearButton.addEventListener('click', clearEditor);

  updatePreview();

  setInterval(() => {
    localStorage.setItem('savedMarkdown', markdownInput.value);
  }, 5000);

  document.querySelector('#create-md-room').addEventListener('click', createMDRoom);
  document.querySelector('#join-md-room').addEventListener('click', joinMDRoom);

  async function createMDRoom() {
    const topicBuffer = crypto.randomBytes(32);
    joinRoom(topicBuffer);
  }

  async function joinMDRoom(e) {
    e.preventDefault();
    const topicStr = document.querySelector('#join-md-room-topic').value;
    const topicBuffer = b4a.from(topicStr, 'hex');
    joinRoom(topicBuffer);
  }

  async function joinRoom(topicBuffer) {
    const discovery = swarm.join(topicBuffer, { client: true, server: true });
    await discovery.flushed();

    const topic = b4a.toString(topicBuffer, 'hex');
    document.querySelector('#md-room-topic').innerText = topic;
    document.querySelector('#detail-button').classList.remove('hide');
  }

  // -----------Cursor Tracking----------------

  document.addEventListener('mousemove', (e) => {
    const cursorData = {
      type: "cursor",
      x: e.clientX,
      y: e.clientY,
      name: getPeerId(),
    };

    for (const peer of swarm.connections) {
      peer.write(b4a.from(JSON.stringify(cursorData)));
    }

    updatePeerCursor(cursorData, true); // Update local cursor immediately
  });

  function updatePeerCursor(data, isLocal = false) {
    let cursorElement = document.getElementById(`cursor-${data.name}`);
    
    if (!cursorElement) {
      cursorElement = document.createElement("div");
      cursorElement.className = "peer-cursor";
      cursorElement.style.backgroundColor = getPeerColor(data.name);
      cursorElement.id = `cursor-${data.name}`;
      cursorElement.innerHTML = `<span class="peer-label">${data.name}</span>`;
      document.body.appendChild(cursorElement);
    }

    const offsetX = 5;
    const offsetY = 5;
  
    cursorElement.style.left = `${data.x + offsetX}px`;
    cursorElement.style.top = `${data.y + offsetY}px`;

    if (!isLocal) {
      cursors[data.name] = data;
    }
  }

  function getPeerId() {
    if (!window.peerId) {
      window.peerId = "Peer-" + crypto.randomBytes(3).toString("hex");
    }
    return window.peerId;
  }

document.getElementById('join-button').addEventListener('click', () => {
  document.getElementById('room-sideMenu').classList.toggle('active');
  document.getElementById('overlay').classList.toggle('active');
});

document.getElementById('detail-button').addEventListener('click', () => {
  document.getElementById('details').classList.toggle('active');
  document.getElementById('overlay').classList.toggle('active');
});

function displayUserOnLine(line, name) {
  let nameTag = document.getElementById("user-line-tag");

  if (!nameTag) {
    nameTag = document.createElement("div");
    nameTag.id = "user-line-tag";
    nameTag.className = "user-label";
    nameTag.style.borderLeft = `2px solid ${getPeerColor(name)}`;
    nameTag.style.color = getPeerColor(name);
    document.body.appendChild(nameTag);
  }

  const lineElement = document.querySelector(`.line-number:nth-child(${line})`);
  
  if (lineElement) {
    const rect = lineElement.getBoundingClientRect();
    
    nameTag.textContent = name;
    nameTag.style.position = "absolute";
    nameTag.style.right = `52%`;
    nameTag.style.top = `${rect.top}px`;
  }
}

markdownInput.addEventListener("keyup", () => {
  const cursorPosition = markdownInput.selectionStart;
  const textUptoCursor = markdownInput.value.substring(0, cursorPosition);
  const currentLine = textUptoCursor.split("\n").length;

  displayUserOnLine(currentLine, getPeerId());
});

markdownInput.addEventListener("scroll", () => {
  const cursorPosition = markdownInput.selectionStart;
  const textUptoCursor = markdownInput.value.substring(0, cursorPosition);
  const currentLine = textUptoCursor.split("\n").length;

  displayUserOnLine(currentLine, getPeerId());
});
