import { ExtraConfig, StreamGains } from "./Globals";
import { Server } from 'socket.io'
import { EventEmitter } from 'events'
import { Stream } from "socketmost/dist/modules/Messages";

export enum MessageNames {
  Connection = 'connection',
  GetSettings = 'getSettings',
  SaveSettings = 'saveSettings',
  SaveGains = 'saveGains',
  Stream = 'stream'
}

export class Socket extends EventEmitter {
  config: ExtraConfig
  io: Server
  saveSettings: (settings: ExtraConfig) => void
  saveGains: (gains: StreamGains) => void
  constructor(
    config: ExtraConfig,
    saveSettings: (settings: ExtraConfig) => void,
    saveGains: (gains: StreamGains) => void,
  ) {
    super()
    this.config = config
    this.saveSettings = saveSettings
    this.saveGains = saveGains
    this.io = new Server({
      cors: {
        origin: '*'
      }
    })

    this.io.on(MessageNames.Connection, (socket) => {
      this.sendSettings()

      socket.on(MessageNames.GetSettings, () => {
        this.sendSettings()
      })

      socket.on(MessageNames.SaveSettings, (settings: ExtraConfig) => {
        this.saveSettings(settings)
      })

      // Volume adjustments arrive frequently while the user turns the knob;
      // we write them to disk without relaunching the Electron app (unlike
      // SaveSettings, which triggers a full app restart to reload bindings).
      socket.on(MessageNames.SaveGains, (gains: StreamGains) => {
        this.saveGains(gains)
      })

      socket.on(MessageNames.Stream, (stream: Stream) => {
        this.emit(MessageNames.Stream, stream)
      })

      socket.on('shutdown', () => {
        this.io.emit('shutdown')
      })
    })

    this.io.listen(4000)
  }

  sendSettings() {
    this.io.emit('settings', this.config)
  }

  sendReverse(reverse: boolean) {
    this.io.emit('reverse', reverse)
  }

  sendLights(lights: boolean) {
    this.io.emit('lights', lights)
  }
}
