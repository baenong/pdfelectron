const messageBox = document.getElementById("messagebox");

export function setMessage(content, color = "red") {
  messageBox.innerText = content;
  messageBox.style.color = color;
}

export function resetMessage() {
  if (messageBox.innerText !== "") messageBox.innerText = "";
}
