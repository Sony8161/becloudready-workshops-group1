import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ToastProvider } from './shell/ToastContext.jsx'
import App from './App.jsx'
import './index.css'

// Entry point: find <div id="root"> in index.html and draw <App /> inside it.
// BrowserRouter lets the app show different pages for different URLs.
// AuthProvider wraps everything, so every component can ask "who is signed in?" with useAuth().
// ToastProvider lets any component show a "Deposited $50.00" message with useToast().
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
