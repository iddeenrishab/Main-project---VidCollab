import logo from './logo.svg';
import {Routes,Route} from "react-router-dom"
import './App.css';
import LobbyScreen from './screens/lobby';
import RoomPage from './screens/room';

function App() {
  return (
    <div className="App">
      {/* <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands"></script>
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils"></script> */}
      <Routes>
        <Route path='/' element={<LobbyScreen />} />
        <Route path="/room/:roomId" element={<RoomPage/>}/>
      </Routes>
    </div>
  );
}

export default App;
