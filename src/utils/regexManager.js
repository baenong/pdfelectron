let regexData = {};

export function insertList() {
  clearLines();
  addLines();
}

function addLines() {
  const ul = document.getElementById("regex-key-list");
  const keys = Object.keys(regexData);
  const fragment = document.createDocumentFragment();

  if (keys.length > 0) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = regexData[key];

      const li = createItem(key, value);
      fragment.appendChild(li);
    }
    ul.appendChild(fragment);
  }
}

function createItem(key, value) {
  const inputKey = document.getElementById("regex-key");
  const inputValue = document.getElementById("regex-value");

  const divKey = document.createElement("div");
  divKey.className = "regex-key-value";
  divKey.innerText = key;

  const divValue = document.createElement("div");
  divValue.className = "regex-list-value";

  const spanValue = document.createElement("span");
  spanValue.innerText = value;

  const deleteBtn = document.createElement("div");
  deleteBtn.className = "regex-row-delete";
  deleteBtn.innerText = "❌";

  divValue.appendChild(spanValue);
  divValue.appendChild(deleteBtn);

  const li = document.createElement("li");

  li.appendChild(divKey);
  li.appendChild(divValue);

  li.addEventListener("click", (event) => {
    if (event.target.className !== "regex-row-delete") {
      inputKey.value = key;
      inputValue.value = value;
    }
  });

  deleteBtn.addEventListener("click", () => {
    window.api.delete(key);
    delete regexData[key];
    li.remove();
  });

  return li;
}

function clearLines() {
  const ul = document.getElementById("regex-key-list");
  ul.innerHTML = "";
}

export function setRegex() {
  const key = document.getElementById("regex-key").value;
  if (key === "" || key === "color") return;

  const value = document.getElementById("regex-value").value;
  if (value === "") return;

  regexData[key] = value;
  window.api.set({ key: key, value: value });

  clearLines();
  addLines();
}

export function getRegex(key) {
  return regexData[key];
}

export function getAll() {
  return regexData;
}

export async function fetchAll() {
  try {
    const data = await window.api.fetchAll();
    regexData = data;
    delete regexData["color"];
  } catch (error) {
    console.error("정규식 데이터 로드 중 오류 발생: ", error);
    regexData = {};
  }
}

export function clearRegexData() {
  regexData = {};
  window.api.clearStore();
}
