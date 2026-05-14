import { Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, ChatProvider } from './lib/store'
import ChatPage from './components/ChatPage'

export default function App() {
  return (
    <UserProvider>
      <ChatProvider>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </ChatProvider>
    </UserProvider>
  )
}
