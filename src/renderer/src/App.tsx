import { useEffect, useState } from "react";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import Settings from "./components/Settings";
import './App.css'
import Info from "./components/Info";
import Home from "./components/Home";
import Nav from "./components/Nav";
import Carplay from './components/Carplay'
import Camera from './components/Camera'
import VolumeOSD from './components/VolumeOSD'
import BootCover from './components/BootCover'
import { Box, Modal } from '@mui/material'
import { useCarplayStore, useStatusStore } from "./store/store";
import { useVolumeStore, STEP } from "./store/volumeStore";

// rm -rf node_modules/.vite; npm run dev


const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  height: '95%',
  width: '95%',
  boxShadow: 24,
  display: "flex"
};

function App() {
  const [receivingVideo, setReceivingVideo] = useState(false)
  const [commandCounter, setCommandCounter] = useState(0)
  const [keyCommand, setKeyCommand] = useState('')
  const [reverse, setReverse] = useStatusStore(state => [state.reverse, state.setReverse])
  const settings = useCarplayStore((state) => state.settings)



  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [settings]);

  // Load persisted per-stream gains into the volume store whenever
  // settings come back from the main process.
  useEffect(() => {
    const persisted = (settings as any)?.gains
    if (persisted) useVolumeStore.getState().loadGains(persisted)
  }, [settings])

  // Whenever the user adjusts volume, persist the gains block to config
  // without relaunching the app (unlike saveSettings which triggers a
  // full Electron restart to reload bindings). Debounced so fast knob
  // turns write only once.
  useEffect(() => {
    let prev = useVolumeStore.getState().gains
    let debounceT: number | undefined
    const unsub = useVolumeStore.subscribe((s) => {
      if (
        s.gains.media === prev.media &&
        s.gains.navigation === prev.navigation &&
        s.gains.call === prev.call &&
        s.gains.other === prev.other
      ) return
      prev = s.gains
      if (debounceT !== undefined) window.clearTimeout(debounceT)
      debounceT = window.setTimeout(() => {
        useCarplayStore.getState().saveGains({ ...s.gains })
      }, 300)
    })
    return () => {
      unsub()
      if (debounceT !== undefined) window.clearTimeout(debounceT)
    }
  }, [])


  const onKeyDown = (event: KeyboardEvent) => {
    // Intercept volume keys before the CarPlay command bindings — these
    // map to our local per-stream mixer, not to the CarPlay protocol
    // (which has no volume commands in node-carplay v4.0.5 anyway).
    const vol = useVolumeStore.getState()
    if (event.code === 'AudioVolumeUp') {
      vol.adjustActive(+STEP)
      event.preventDefault()
      return
    }
    if (event.code === 'AudioVolumeDown') {
      vol.adjustActive(-STEP)
      event.preventDefault()
      return
    }
    if (event.code === 'AudioVolumeMute') {
      vol.toggleMuteActive()
      event.preventDefault()
      return
    }

    if(Object.values(settings!.bindings).includes(event.code)) {
      let action = Object.keys(settings!.bindings).find(key =>
        settings!.bindings[key] === event.code
      )
      console.log(action)
      if(action !== undefined) {
        setKeyCommand(action)
        setCommandCounter(prev => prev +1)
        if(action === 'selectDown') {
          console.log('select down')
          setTimeout(() => {
            setKeyCommand('selectUp')
            setCommandCounter(prev => prev +1)
          }, 200)
        }
      }
    }
  }

  return (
    <Router>
      <div
        style={{ height: '100%', touchAction: 'none' }}
        id={'main'}
        className="App"

      >
        <Nav receivingVideo={receivingVideo} settings={settings}/>
        {settings ? <Carplay  receivingVideo={receivingVideo} setReceivingVideo={setReceivingVideo} settings={settings} command={keyCommand} commandCounter={commandCounter}/> : null}
        <Routes>
          <Route path={"/"} element={<Home />} />
          <Route path={"/settings"} element={<Settings settings={settings!}/>} />
          <Route path={"/info"} element={<Info />} />
          <Route path={"/camera"} element={<Camera settings={settings!}/>} />
        </Routes>
        <Modal
          open={reverse}
          onClick={()=> setReverse(false)}
        >
          <Box sx={style}>
            <Camera settings={settings}/>
          </Box>
        </Modal>
        {/* Root-level boot cover — paints AM full-screen from frame 1 so
            Nav row never flashes standalone before Carplay's BootScreen
            mounts. Fades out on videoReady (first CarPlay frame). */}
        <BootCover />
        <VolumeOSD />
      </div>
    </Router>

  )
}

export default App
