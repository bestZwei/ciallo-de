import React, { useEffect, useRef } from "react";
import "./index.css";

const Ciallo = ({ dur = 20, color = 'red', size = "15px", top = "0px", lane = 0 }) => {
    const elementRef = useRef(null);
    
    // Enhanced lane management with collision detection
    const laneHeight = window.innerHeight / 8; // Assume 8 total lanes
    const baseLaneTop = lane * laneHeight;
    const laneOffset = Math.random() * (laneHeight * 0.6) + (laneHeight * 0.2); // Random position within lane bounds
    const adjustedTop = `${baseLaneTop + laneOffset}px`;
    
    // Vary the starting position and speed slightly to create more natural movement
    const startDelay = Math.random() * 3;
    const speedVariation = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x speed
    const adjustedDuration = dur / speedVariation;
    
    // Add slight vertical drift to make movement more interesting
    const verticalDrift = (Math.random() - 0.5) * 20; // Up to 20px drift
    
    useEffect(() => {
        if (elementRef.current) {
            // Apply dynamic custom properties for animation
            elementRef.current.style.setProperty('--vertical-drift', `${verticalDrift}px`);
            elementRef.current.style.setProperty('--lane-id', lane);
        }
    }, [verticalDrift, lane]);
    
    return (
        <p 
            ref={elementRef}
            className="ciallo" 
            style={{ 
                animationDuration: `${adjustedDuration}s`, 
                animationDelay: `${startDelay}s`,
                color: color, 
                fontSize: size,
                top: adjustedTop,
                zIndex: 100 - lane, // Higher lanes appear behind lower ones
                '--speed-variation': speedVariation,
            }} 
        >
            Ciallo～(∠・ω&lt; )⌒★
        </p>
    )
}

export default Ciallo;