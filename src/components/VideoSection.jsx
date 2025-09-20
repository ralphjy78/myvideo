import React from 'react'

export default function VideoSection() {
  return (
    <section id="video" className="container section">
      <h2>Demo Video</h2>
      <div className="video-wrap">
        <iframe
          src="https://www.youtube.com/embed/dQw4w9WgXcQ"
          title="Demo Video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </section>
  )
}
