import { create } from 'zustand'
import { ExtraConfig, StreamGains } from "../../../main/Globals";
import { io } from 'socket.io-client'
import { Stream } from "socketmost/dist/modules/Messages";

interface CarplayStore {
  settings: null | ExtraConfig,
  saveSettings: (settings: ExtraConfig) => void
  saveGains: (gains: StreamGains) => void
  getSettings: () => void
  stream: (stream: Stream) => void
}

interface StatusStore {
  reverse: boolean,
  lights: boolean,
  isPlugged: boolean,
  videoReady: boolean,
  setPlugged: (plugged: boolean) => void,
  setVideoReady: (v: boolean) => void,
  setReverse: (reverse: boolean) => void
}

export const useCarplayStore = create<CarplayStore>()((set) =>({
  settings: null,
  saveSettings: (settings) => {
    set(() => ({settings: settings}))
    socket.emit('saveSettings', settings)
  },
  saveGains: (gains) => {
    // Hot-path: persist gains without relaunching the app. The main
    // process writes only the gains block to config.json.
    socket.emit('saveGains', gains)
  },
  getSettings: () => {
    socket.emit('getSettings')
  },
  stream: (stream) => {
    socket.emit('stream', stream)
  }
}))

export const useStatusStore = create<StatusStore>()((set) => ({
  reverse: false,
  lights: false,
  isPlugged: false,
  videoReady: false,
  setPlugged: (plugged) => {
    set(() => ({isPlugged: plugged}))
  },
  setVideoReady: (v) => {
    set(() => ({videoReady: v}))
  },
  setReverse: (reverse) => {
    set(() => ({reverse: reverse}))
  }
}))

const URL = 'http://localhost:4000'
const socket = io(URL)

socket.on('settings', (settings: ExtraConfig) => {
  console.log("received settings", settings)
  useCarplayStore.setState(() => ({settings: settings}))
})

socket.on('reverse', (reverse) => {
  console.log("reverse data", reverse)
  useStatusStore.setState(() => ({reverse: reverse}))
})

socket.on('shutdown', () => {
  console.log("shutdown signal received — re-showing BootCover")
  useStatusStore.setState(() => ({videoReady: false, isPlugged: false}))
})




