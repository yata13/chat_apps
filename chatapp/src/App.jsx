import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./css/App.css";

// Import slide images from the assets folder. These files were copied into
// the project via the build script. Each slide defines an image and
// accompanying heading and description to be displayed in the welcome screen.
import pingSlide from "/logo.png";
import worldSlide from "/worldSlide.png";
import groupSlide from "/group.png";

export default function App() {
  const navigate = useNavigate();

  // Define the slides that rotate on the welcome page. Each slide entry
  // contains a graphic and text. You can adjust the text to describe
  // your chat application's features.
  const slides = [
    {
      image: pingSlide,
      title: "Welcome to PingChat",
      text: "Send and receive messages instantly",
    },
    {
      image: worldSlide,
      title: "Connect Around the Globe",
      text: "Chat with friends across the world, anytime",
    },
    {
      image: groupSlide,
      title: "Share More Than Just Text",
      text: "Send images, voice messages, video calls and share songs",
    },
  ];

  // Track the current slide index. It increments every 3 seconds and loops
  // back to the start. State management ensures React re-renders when
  // the index updates.
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const { image, title, text } = slides[index];

  return (
    <section className="app-welcome">
      <div className="welcome-content">
        <img className="welcome-img" src={image} alt={title} />
        <h1 className="welcome-title">{title}</h1>
        <p className="welcome-text">{text}</p>
        
        <div className="welcome-dots">
          {slides.map((_, i) => (
            <span
              key={i}
              className={i === index ? "dot active" : "dot"}
            />
          ))}
        </div>

        <button
          type="button"
          className="welcome-btn"
          onClick={() => navigate("/login")}
        >
          Get Started
        </button>

        
      </div>
    </section>
  );
}