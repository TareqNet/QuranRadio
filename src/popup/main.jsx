import React from 'react'
import ReactDOM from 'react-dom/client'
import Popup from './Popup'
import '../styles/index.css'

document.body.className = 'popup-body';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
)
