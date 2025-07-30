const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  delete: (key) => ipcRenderer.send("delete-key", key),
  clearStore: () => ipcRenderer.send("clear-store"),
  set: (data) => ipcRenderer.send("set-store", data),
  fetch: (key) => {
    return new Promise((resolve) => {
      ipcRenderer.once("get-reply", (event, reply) => {
        resolve(reply);
      });
      ipcRenderer.send("get-store", key);
    });
  },
  fetchAll: () => {
    return new Promise((resolve) => {
      ipcRenderer.once("store-reply", (event, reply) => {
        resolve(reply);
      });
      ipcRenderer.send("get-all");
    });
  },
  saveFile: (data, defaultPath) =>
    ipcRenderer.invoke("save-file", data, defaultPath),
});
