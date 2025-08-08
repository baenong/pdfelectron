const messageBox = document.getElementById("messagebox");

export function setMessage(content, bgColor = "red", color = "#dddddd") {
  messageBox.innerText = content;
  messageBox.style.backgroundColor = bgColor;
  messageBox.style.color = color;
}

export function resetMessage() {
  if (messageBox.innerText !== "") messageBox.innerText = "";
  messageBox.style.backgroundColor = "#333333";
}
