import * as tf from "@tensorflow/tfjs";
import React, { useRef, useEffect, useState } from "react";
import * as handpose from "@tensorflow-models/handpose";
import Webcam from "react-webcam";
import "./App.css";

function App() {
  const webcamRef = useRef(null);
  const [prediction, setPrediction] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [history, setHistory] = useState([]);
  const DETECTION_INTERVAL = 1000;

  useEffect(() => {
    let net;
    let intervalId;

    const setupModel = async () => {
      net = await handpose.load();
      console.log("✅ Handpose model loaded");

      intervalId = setInterval(async () => {
        if (
          webcamRef.current &&
          webcamRef.current.video.readyState === 4
        ) {
          const video = webcamRef.current.video;
          const hand = await net.estimateHands(video);

          if (hand.length > 0) {
            const landmarks = hand[0].landmarks.flatMap(([x, y]) => [
              x / video.videoWidth,
              y / video.videoHeight,
            ]);

            if (landmarks.length === 42) {
              await sendToBackend(landmarks);
            }
          }
        }
      }, DETECTION_INTERVAL);
    };

    setupModel();

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const sendToBackend = async (landmarks) => {
    try {
      const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landmarks }),
      });

      const data = await response.json();
      console.log("📡 Prediction:", data);

      if (data.prediction && data.confidence >= 0.7) {
        setPrediction(data.prediction);
        setConfidence((data.confidence * 100).toFixed(2));

        setHistory((prevHistory) => {
          let updated = [...prevHistory];

          if (data.prediction === "del") {
            if (updated.length > 0) updated.pop();
          } else if (data.prediction === "space") {
            const lastWord = getLastWordFromHistory(updated);
            if (lastWord) {
              sendToSpeechAPI(lastWord);
              updated = []; // Clear history after speaking
            }
          } else if (data.prediction !== prevHistory[prevHistory.length - 1]) {
            updated.push(data.prediction);
          }

          return updated.slice(-10); // Keep recent history
        });
      }
    } catch (err) {
      console.error("❌ Backend error:", err);
    }
  };

  const getLastWordFromHistory = (historyArr) => {
    const word = [];
    for (let i = historyArr.length - 1; i >= 0; i--) {
      if (historyArr[i] === " ") break;
      word.unshift(historyArr[i]);
    }
    return word.join("");
  };

  const sendToSpeechAPI = (word) => {
    if (!word.trim()) return;
    console.log("🔊 Speaking:", word);
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    synth.speak(utterance);
  };

  return (
    <div className="App">
      <header className="App-header">
        <Webcam
          ref={webcamRef}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            marginLeft: "auto",
            marginRight: "auto",
            textAlign: "center",
            zIndex: 1,
            width: 640,
            height: 480,
          }}
        />

        {/* Prediction Box */}
        <div style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "10px 20px",
          fontSize: "24px",
          borderRadius: "10px",
          zIndex: 10,
          textAlign: "center"
        }}>
          <p>Prediction: <strong>{prediction || "Waiting..."}</strong></p>
          <p>Confidence: <strong>{confidence}%</strong></p>
        </div>

        {/* History Box */}
        <div style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "10px 20px",
          fontSize: "18px",
          borderRadius: "10px",
          zIndex: 10,
          textAlign: "center"
        }}>
          <p>History: {history.join(" ") || "None"}</p>
        </div>
      </header>
    </div>
  );
}

export default App;
