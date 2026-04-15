import { Stream } from "socketmost/dist/modules/Messages";
import { DongleConfig } from 'node-carplay/node'

export type Most = {
  stream?: Stream
}

export type ExtraConfig = DongleConfig & {
  kiosk: boolean,
  camera: string,
  microphone: string,
  piMost: boolean,
  canbus: boolean,
  bindings: KeyBindings,
  most?: Most,
  canConfig?: CanConfig,
  /**
   * Per-stream user-set gains (0.0–1.5), persisted so the user's
   * preferred music/nav/call balance survives reboots. Written by the
   * renderer when the knob is turned. Optional to keep older config files
   * backwards-compatible.
   */
  gains?: StreamGains
}

export interface StreamGains {
  media: number
  navigation: number
  call: number
  other: number
}

export interface KeyBindings {
  'left': string,
  'right': string,
  'selectDown': string,
  'back': string,
  'down': string,
  'home': string,
  'play': string,
  'pause': string,
  'next': string,
  'prev': string
}

export interface CanMessage {
  canId: number,
  byte: number,
  mask: number
}

export interface CanConfig {
  reverse?: CanMessage,
  lights?: CanMessage
}
