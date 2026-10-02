import { Outlet } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import TopLoader from '../components/TopLoader.jsx'

// Layout for pages anyone can see. <Outlet /> is where the current page goes.
export default function PublicLayout() {
  return (
    <div className="app">
      <TopLoader />
      <Header title="Simple Bank" />
      <main className="content">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
