import React from 'react'

const features = [
  { title: 'Fast streaming', desc: 'Optimized delivery for a smooth viewing experience.' },
  { title: 'Responsive design', desc: 'Looks great on phones, tablets, and desktops.' },
  { title: 'Easy management', desc: 'Organize your videos and content with ease.' }
]

export default function Features() {
  return (
    <section id="features" className="container section">
      <h2>Features</h2>
      <div className="grid">
        {features.map((f) => (
          <div key={f.title} className="card">
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
