import React from 'react'
import VideoManager from './components/VideoManager'
import Header from './components/Header'
import Footer from './components/Footer'
import Hero from './components/Hero'
import Features from './components/Features'
import VideoSection from './components/VideoSection'
import Contact from './components/Contact'

export default function App() {
  return (
    <div className="app">
      <Header />
      <main className="container">
        <Hero />
        <Features />
        <VideoSection />
        <VideoManager />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
