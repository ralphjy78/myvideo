import React from 'react'

export default function Contact() {
  return (
    <section id="contact" className="container section">
      <h2>Contact</h2>
      <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
        <div className="row">
          <label htmlFor="name">Name</label>
          <input id="name" type="text" placeholder="Your name" required />
        </div>
        <div className="row">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" placeholder="you@example.com" required />
        </div>
        <div className="row">
          <label htmlFor="message">Message</label>
          <textarea id="message" rows="4" placeholder="Tell us more..." />
        </div>
        <button className="btn primary" type="submit">Send</button>
      </form>
    </section>
  )
}
